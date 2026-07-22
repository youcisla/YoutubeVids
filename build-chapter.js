#!/usr/bin/env node
/**
 * build-chapter.js — Book Summary Chapter Pipeline
 *
 * Generates one book chapter video from a chapter_data.json file.
 *
 * Usage:
 *   node build-chapter.js --book atomic-habits --chapter 1
 *   node build-chapter.js --batch atomic-habits   # all chapters
 *
 * Expected input: ./books/{book}/chapter-{N}.json
 * Output:         ./pilot/dist/{book}_Ch{N}.mp4
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

// ─── Helpers ────────────────────────────────────────────
function sh(cmd, cwd) {
  execSync(cmd, { cwd: cwd || ROOT, stdio: 'pipe', encoding: 'utf8' });
}

function collectScenes(book, chapterNum) {
  const dataPath = path.join(ROOT, 'books', book, `chapter-${String(chapterNum).padStart(2,'0')}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  // Scenes are defined in the chapter data (no hardcoding)
  return data;
}

function generateNarration(text, outPath) {
  const cmd = `edge-tts --voice ${CONFIG.voice} --rate=${CONFIG.voice_rate} --write-media "${outPath}" --text "${text.replace(/"/g,'\\"')}"`;
  execSync(cmd, { stdio: 'pipe', timeout: 120000 });
}

function splitNarration(narrationWav, sceneTimestamps) {
  const outDir = path.dirname(narrationWav);
  const timestamps = sceneTimestamps.join(',');
  sh(`ffmpeg -y -i "${narrationWav}" -c copy -map 0 -f segment -segment_times ${timestamps} -reset_timestamps 1 "${outDir}/narration_%d.wav"`, ROOT);
}

function buildSceneHtml(scene, bookTitle, coverExt) {
  const base = fs.readFileSync(path.join(ROOT, 'pilot/scenes/scene_base.html'), 'utf8');
  let html = base
    .replace(/\{N\}/g, scene.index)
    .replace(/\{DUR\}/g, scene.duration)
    .replace(/\{CONTENT\}/g, scene.html)
    .replace(/\{ANIMATIONS\}/g, scene.animations)
    .replace(/\{BOOK\}/g, bookTitle)
    .replace(/\{EXT\}/g, coverExt)
    .replace(/\{GSAP_SRC\}/g, CONFIG.gsap_source);
  return html;
}

function renderScene(sceneDir, sceneIndex) {
  const cmd = `npx hyperframes render --quality ${CONFIG.quality} --output scene_${sceneIndex}.mp4 --fps ${CONFIG.fps}`;
  execSync(cmd, { cwd: sceneDir, stdio: 'pipe', timeout: 300000 });
}

function burnSubtitles(sceneDir, sceneIndex) {
  fs.writeFileSync(path.join(sceneDir, 'vf.txt'), 'subtitles=captions.srt');
  sh(`ffmpeg -y -i scene_${sceneIndex}.mp4 -filter_script:v vf.txt -c:a copy scene_${sceneIndex}_captioned.mp4`, sceneDir);
}

function concatScenes(sceneCount, book, chapterNum) {
  const outDir = path.join(ROOT, 'pilot/dist');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const playlistPath = path.join(outDir, 'playlist.txt');
  const lines = [];
  for (let i = 0; i < sceneCount; i++) {
    lines.push(`file '../scenes/scene_${i}/scene_${i}_captioned.mp4'`);
  }
  fs.writeFileSync(playlistPath, lines.join('\n'));
  sh(`ffmpeg -y -f concat -safe 0 -i "${playlistPath}" -c copy "${outDir}/${book}_Ch${String(chapterNum).padStart(2,'0')}.mp4"`);
  fs.unlinkSync(playlistPath);
  console.log(`→ ${outDir}/${book}_Ch${String(chapterNum).padStart(2,'0')}.mp4`);
}

// ─── Main ───────────────────────────────────────────────
async function buildChapter(book, chapterNum) {
  console.log(`\n=== Building ${book} Chapter ${chapterNum} ===`);
  const data = collectScenes(book, chapterNum);
  const scenes = data.scenes;
  const narrationText = data.narration_script || scenes.map(s => s.narration_text).join(' ');
  const bookTitle = data.book_title || book.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const coverExt = data.cover_ext || 'svg';

  const sceneDir = path.join(ROOT, 'pilot/scenes');
  const baseNm = `${book}_Ch${String(chapterNum).padStart(2,'0')}`;

  // 1. Generate full narration
  const narrationWav = path.join(sceneDir, `${baseNm}_narration.wav`);
  if (!fs.existsSync(narrationWav)) {
    console.log('  Generating narration...');
    generateNarration(narrationText, narrationWav);
  }

  // 2. Split into scene clips
  const timestamps = scenes.map(s => s.timestamp_end).slice(0, -1);
  splitNarration(narrationWav, timestamps);

  // 3. Build scene HTMLs and render
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const dir = path.join(sceneDir, `scene_${i}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Copy narration clip
    fs.copyFileSync(
      path.join(sceneDir, `narration_${i}.wav`),
      path.join(dir, 'narration.wav')
    );

    s.index = i;
    const html = buildSceneHtml(s, bookTitle, coverExt);
    fs.writeFileSync(path.join(dir, 'index.html'), html);

    // Copy cover
    const coverSrc = path.join(ROOT, 'books', book, `cover.${coverExt}`);
    if (fs.existsSync(coverSrc)) {
      fs.copyFileSync(coverSrc, path.join(dir, `cover.${coverExt}`));
    }

    // Render
    console.log(`  Rendering scene ${i + 1}/${scenes.length}...`);
    renderScene(dir, i);
  }

  // 4. Write .srt subtitles per scene
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const dir = path.join(sceneDir, `scene_${i}`);
    const srtLines = [];
    for (let j = 0; j < s.captions.length; j++) {
      const c = s.captions[j];
      const start = formatTime(c.start);
      const end = formatTime(c.end);
      srtLines.push(`${j + 1}\n${start} --> ${end}\n${c.text}\n`);
    }
    fs.writeFileSync(path.join(dir, 'captions.srt'), srtLines.join('\n'));
  }

  // 5. Burn subtitles
  console.log('  Burning subtitles...');
  for (let i = 0; i < scenes.length; i++) {
    burnSubtitles(path.join(sceneDir, `scene_${i}`), i);
  }

  // 6. Concat
  console.log('  Concatenating...');
  concatScenes(scenes.length, book, chapterNum);

  // Cleanup scene dirs
  for (let i = 0; i < scenes.length; i++) {
    fs.rmSync(path.join(sceneDir, `scene_${i}`), { recursive: true, force: true });
  }
  fs.unlinkSync(narrationWav);
  for (let i = 0; i < scenes.length; i++) {
    try { fs.unlinkSync(path.join(sceneDir, `narration_${i}.wav`)); } catch {}
  }

  console.log(`✓ Chapter ${chapterNum} complete`);
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${s.toFixed(2).replace('.',',')}`;
}

// ─── CLI ────────────────────────────────────────────────
const args = process.argv.slice(2);
const bookIdx = args.indexOf('--book');
const chIdx = args.indexOf('--chapter');
const batchIdx = args.indexOf('--batch');

if (batchIdx >= 0) {
  const book = args[batchIdx + 1];
  const bookDir = path.join(ROOT, 'books', book);
  const files = fs.readdirSync(bookDir).filter(f => f.startsWith('chapter-') && f.endsWith('.json'));
  const chapters = files.map(f => parseInt(f.match(/chapter-(\d+)/)[1])).sort((a,b)=>a-b);
  for (const ch of chapters) {
    buildChapter(book, ch);
  }
} else if (bookIdx >= 0 && chIdx >= 0) {
  buildChapter(args[bookIdx + 1], parseInt(args[chIdx + 1]));
} else {
  console.log('Usage: node build-chapter.js --book <name> --chapter <num>');
  console.log('       node build-chapter.js --batch <name>');
  process.exit(1);
}
