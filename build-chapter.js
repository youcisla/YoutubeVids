#!/usr/bin/env node
/**
 * build-chapter.js — Book Summary Chapter Pipeline
 *
 * Usage:
 *   node build-chapter.js --book atomic-habits --chapter 1
 *   node build-chapter.js --batch atomic-habits       # all chapters
 *   node build-chapter.js --batch atomic-habits --keep-temp
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

// ─── Helpers ────────────────────────────────────────────
function sh(cmd, cwd, label) {
  try {
    return execSync(cmd, { cwd: cwd || ROOT, stdio: 'pipe', timeout: 300000, encoding: 'utf8' });
  } catch (err) {
    console.error(`✗ FAILED: ${label || cmd.slice(0,60)}`);
    if (err.stderr) console.error(err.stderr.slice(-500));
    throw err;
  }
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function validateChapter(data) {
  const required = ['narration_script', 'scenes'];
  for (const k of required) {
    if (!data[k]) throw new Error(`Missing required field: "${k}"`);
  }
  if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
    throw new Error('scenes must be a non-empty array');
  }
  data.scenes.forEach((s, i) => {
    if (!s.html || !s.animations || !s.captions) {
      throw new Error(`Scene ${i} missing html/animations/captions`);
    }
  });
  return true;
}

function generateNarration(text, outPath) {
  const cmd = `edge-tts --voice ${CONFIG.voice} --rate=${CONFIG.voice_rate} --write-media "${outPath}" --text "${text.replace(/"/g,'\\"')}"`;
  sh(cmd, null, 'TTS narration generation');
}

function splitNarration(narrationWav, timestamps, outDir) {
  if (timestamps.length === 0) {
    // Single scene — just copy
    fs.copyFileSync(narrationWav, path.join(outDir, 'narration_0.wav'));
    return;
  }
  const ts = timestamps.join(',');
  sh(`ffmpeg -y -i "${narrationWav}" -c copy -map 0 -f segment -segment_times ${ts} -reset_timestamps 1 "${outDir}/narration_%d.wav"`, null, 'audio split');
}

function buildSceneHtml(scene, bookTitle, coverExt) {
  const base = fs.readFileSync(path.join(ROOT, 'pilot/scenes/scene_base.html'), 'utf8');
  const gsapSrc = CONFIG.gsap_source || 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.14.2/gsap.min.js';
  return base
    .replace(/\{N\}/g, scene.index)
    .replace(/\{DUR\}/g, scene.duration)
    .replace(/\{CONTENT\}/g, scene.html)
    .replace(/\{ANIMATIONS\}/g, scene.animations)
    .replace(/\{BOOK\}/g, bookTitle)
    .replace(/\{EXT\}/g, coverExt)
    .replace(/\{GSAP_SRC\}/g, gsapSrc);
}

function renderScene(sceneDir, sceneIndex) {
  sh(`npx hyperframes render --quality ${CONFIG.quality} --output scene_${sceneIndex}.mp4 --fps ${CONFIG.fps}`, sceneDir, `render scene ${sceneIndex}`);
}

function burnSubtitles(sceneDir, sceneIndex) {
  const vfPath = path.join(sceneDir, 'vf.txt');
  fs.writeFileSync(vfPath, 'subtitles=captions.srt');
  try {
    sh(`ffmpeg -y -i scene_${sceneIndex}.mp4 -filter_script:v vf.txt -c:a copy scene_${sceneIndex}_captioned.mp4`, sceneDir, `burn subs scene ${sceneIndex}`);
  } finally {
    try { fs.unlinkSync(vfPath); } catch {}
  }
}

function concatScenes(sceneCount, outPath) {
  const tmpDir = path.join(ROOT, 'pilot', 'dist');
  fs.mkdirSync(tmpDir, { recursive: true });
  const playlistPath = path.join(tmpDir, 'playlist.txt');
  const lines = [];
  for (let i = 0; i < sceneCount; i++) {
    lines.push(`file '../scenes/scene_${i}/scene_${i}_captioned.mp4'`);
  }
  fs.writeFileSync(playlistPath, lines.join('\n'));
  try {
    // Re-encode during concat for reliable output (slower but prevents codec mismatch)
    sh(`ffmpeg -y -f concat -safe 0 -i "${playlistPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "${outPath}"`, null, 'concat scenes');
  } finally {
    try { fs.unlinkSync(playlistPath); } catch {}
  }
}

function formatSrtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${s.toFixed(3).replace('.',',')}`;
}

function writeSrt(sceneDir, captions, sceneIndex) {
  const lines = [];
  captions.forEach((c, i) => {
    const start = formatSrtTime(c.start);
    const end = formatSrtTime(c.end);
    lines.push(`${i+1}\n${start} --> ${end}\n${c.text}\n`);
  });
  fs.writeFileSync(path.join(sceneDir, 'captions.srt'), lines.join('\n'));
}

// ─── Main ───────────────────────────────────────────────
async function buildChapter(book, chapterNum, keepTemp) {
  console.log(`\n=== Building ${book} Chapter ${chapterNum} ===`);
  const data = readJson(path.join(ROOT, 'books', book, `chapter-${String(chapterNum).padStart(2,'0')}.json`));
  validateChapter(data);
  const scenes = data.scenes;
  const narrationText = data.narration_script;
  const bookTitle = data.book_title || book.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const coverExt = data.cover_ext || 'svg';
  const outDir = path.join(ROOT, 'pilot', 'dist');
  const sceneDir = path.join(ROOT, 'pilot', 'scenes');
  const baseName = `${book}_Ch${String(chapterNum).padStart(2,'0')}`;
  const outPath = path.join(outDir, `${baseName}.mp4`);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Generate narration
  const narrationPath = path.join(sceneDir, `${baseName}_narration.wav`);
  if (!fs.existsSync(narrationPath)) {
    console.log('  Generating narration...');
    generateNarration(narrationText, narrationPath);
  }

  // 2. Split into scene clips
  const splitTimestamps = scenes.map(s => s.timestamp_end);
  splitNarration(narrationPath, splitTimestamps.slice(0, -1), sceneDir);

  // 3. Build and render each scene
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const dir = path.join(sceneDir, `scene_${i}`);
    fs.mkdirSync(dir, { recursive: true });

    // Copy narration clip
    const srcNar = path.join(sceneDir, `narration_${i}.wav`);
    if (fs.existsSync(srcNar)) {
      fs.copyFileSync(srcNar, path.join(dir, 'narration.wav'));
    }

    // Build HTML
    s.index = i;
    fs.writeFileSync(path.join(dir, 'index.html'), buildSceneHtml(s, bookTitle, coverExt));

    // Copy cover
    const coverSrc = path.join(ROOT, 'books', book, `cover.${coverExt}`);
    if (fs.existsSync(coverSrc)) {
      fs.copyFileSync(coverSrc, path.join(dir, `cover.${coverExt}`));
    }

    // Render
    console.log(`  Rendering scene ${i+1}/${scenes.length}...`);
    renderScene(dir, i);
  }

  // 4. Write .srt subtitles
  for (let i = 0; i < scenes.length; i++) {
    writeSrt(path.join(sceneDir, `scene_${i}`), scenes[i].captions, i);
  }

  // 5. Burn subtitles
  console.log('  Burning subtitles...');
  for (let i = 0; i < scenes.length; i++) {
    burnSubtitles(path.join(sceneDir, `scene_${i}`), i);
  }

  // 6. Concat
  console.log('  Concatenating...');
  concatScenes(scenes.length, outPath);
  console.log(`✓ ${outPath}`);

  // 7. Cleanup (unless --keep-temp)
  if (!keepTemp) {
    console.log('  Cleaning temp files...');
    for (let i = 0; i < scenes.length; i++) {
      fs.rmSync(path.join(sceneDir, `scene_${i}`), { recursive: true, force: true });
    }
    try { fs.unlinkSync(narrationPath); } catch {}
    for (let i = 0; i < scenes.length; i++) {
      try { fs.unlinkSync(path.join(sceneDir, `narration_${i}.wav`)); } catch {}
    }
  }
  console.log(`✓ Chapter ${chapterNum} complete`);
}

// ─── CLI ────────────────────────────────────────────────
const args = process.argv.slice(2);
const bookIdx = args.indexOf('--book');
const chIdx = args.indexOf('--chapter');
const batchIdx = args.indexOf('--batch');
const keepTemp = args.includes('--keep-temp');
const helpIdx = args.indexOf('--help');

if (helpIdx >= 0 || args.length === 0) {
  console.log(`
build-chapter.js — Book Summary Chapter Pipeline

USAGE:
  node build-chapter.js --book <name> --chapter <num> [--keep-temp]
  node build-chapter.js --batch <name> [--keep-temp]

FLAGS:
  --book <name>      Book directory under books/ (e.g. atomic-habits)
  --chapter <num>    Chapter number (1-20)
  --batch <name>     Render all chapters for a book
  --keep-temp        Keep scene directories and narration WAVs after render
  --help             Show this message

DEPENDENCIES:
  - Node.js 22+
  - ffmpeg (on PATH)
  - edge-tts (npm install -g edge-tts)
  - npx hyperframes (bundled with Node)

CHAPTER DATA:
  Expects books/{book}/chapter-{NN}.json with:
  {
    "book_title": "...",
    "cover_ext": "svg",
    "narration_script": "Full text for TTS...",
    "scenes": [{
      "html": "<div class=...>",
      "animations": "GSAP calls...",
      "timestamp_end": 20,
      "duration": 22,
      "captions": [{"start":0, "end":5, "text":"..."}]
    }]
  }
`);
  process.exit(0);
}

if (bookIdx < 0) { console.error('--book is required'); process.exit(1); }
const book = args[bookIdx + 1];

if (batchIdx >= 0) {
  const bookDir = path.join(ROOT, 'books', book);
  if (!fs.existsSync(bookDir)) { console.error(`Book not found: ${bookDir}`); process.exit(1); }
  const files = fs.readdirSync(bookDir).filter(f => f.startsWith('chapter-') && f.endsWith('.json'));
  const chapters = files.map(f => parseInt(f.match(/chapter-(\d+)/)[1])).sort((a,b)=>a-b);
  console.log(`Batch: ${book} (${chapters.length} chapters)`);
  for (const ch of chapters) {
    try {
      buildChapter(book, ch, keepTemp);
    } catch (err) {
      console.error(`✗ Chapter ${ch} failed: ${err.message}`);
    }
  }
  console.log(`\n=== Batch complete: ${chapters.length} chapters ===`);
} else if (chIdx >= 0) {
  buildChapter(book, parseInt(args[chIdx + 1]), keepTemp);
} else {
  console.error('Specify --chapter <num> or --batch');
  process.exit(1);
}
