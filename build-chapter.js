#!/usr/bin/env node
/**
 * build-chapter.js — Book Summary Chapter Pipeline
 *
 * Safe spawn()-based pipeline. No shell injection surface.
 * Parallel scene rendering via Promise.all.
 * Unique temp directories via os.tmpdir().
 *
 * Usage:
 *   node build-chapter.js --book atomic-habits --chapter 1
 *   node build-chapter.js --batch atomic-habits
 *   node build-chapter.js --batch atomic-habits --keep-temp
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = __dirname;
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

const VALID_BOOK_RE = /^[a-z0-9_-]+$/;

// ─── Safe spawn helpers (no shell, no injection) ─────────
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      stdio: opts.stdio || ['ignore', 'pipe', 'pipe'],
      timeout: opts.timeout || 300000,
      ...opts.spawnOpts,
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${opts.label || cmd} exited ${code}\n${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

function ffmpeg(args, opts = {}) {
  return run('ffmpeg', args, { ...opts, label: opts.label || 'ffmpeg' });
}

function hyperframes(args, opts = {}) {
  return run('npx', ['hyperframes', ...args], { ...opts, label: opts.label || 'hyperframes' });
}

function edgeTts(voice, rate, text, outPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('edge-tts', [
      '--voice', voice,
      '--rate', rate,
      '--write-media', outPath,
      '--text', text,
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`edge-tts exited ${code}\n${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

// ─── Validation ──────────────────────────────────────────
function validateBook(book) {
  if (!VALID_BOOK_RE.test(book)) throw new Error(`Invalid book name: "${book}". Use lowercase, hyphens, underscores, digits.`);
}

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

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ─── Core pipeline functions ─────────────────────────────
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

function buildAndRenderScene(s, i, sceneDir, bookTitle, coverExt, book, chapterNum) {
  const dir = path.join(sceneDir, `scene_${i}`);
  fs.mkdirSync(dir, { recursive: true });

  // Copy narration clip
  const srcNar = path.join(sceneDir, `narration_${i}.wav`);
  if (fs.existsSync(srcNar)) fs.copyFileSync(srcNar, path.join(dir, 'narration.wav'));

  // Build HTML
  s.index = i;
  fs.writeFileSync(path.join(dir, 'index.html'), buildSceneHtml(s, bookTitle, coverExt));

  // Copy cover
  const coverSrc = path.join(ROOT, 'books', book, `cover.${coverExt}`);
  if (fs.existsSync(coverSrc)) fs.copyFileSync(coverSrc, path.join(dir, `cover.${coverExt}`));

  return dir;
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

function formatSrtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${s.toFixed(3).replace('.',',')}`;
}

// ─── Main build ──────────────────────────────────────────
async function buildChapter(book, chapterNum, keepTemp) {
  console.log(`\n=== Building ${book} Chapter ${chapterNum} ===`);

  const data = readJson(path.join(ROOT, 'books', book, `chapter-${String(chapterNum).padStart(2,'0')}.json`));
  validateChapter(data);
  const scenes = data.scenes;
  const narrationText = data.narration_script;
  const bookTitle = data.book_title || book.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const coverExt = data.cover_ext || 'svg';
  const baseName = `${book}_Ch${String(chapterNum).padStart(2,'0')}`;

  // Use unique temp dir per build (cleaned up unless --keep-temp)
  const sceneDir = path.join(os.tmpdir(), `edu-channel-${baseName}-${Date.now()}`);
  fs.mkdirSync(sceneDir, { recursive: true });
  const outDir = path.join(ROOT, 'pilot', 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${baseName}.mp4`);

  try {
    // 1. Generate full narration
    const narrationPath = path.join(sceneDir, `${baseName}_narration.wav`);
    if (!fs.existsSync(narrationPath)) {
      console.log('  Generating narration...');
      await edgeTts(CONFIG.voice, CONFIG.voice_rate, narrationText, narrationPath);
    }

    // 2. Split audio into scene clips
    const splitTimestamps = scenes.map(s => s.timestamp_end);
    const ts = splitTimestamps.slice(0, -1);
    if (ts.length > 0) {
      await ffmpeg([
        '-y', '-i', narrationPath,
        '-c', 'copy', '-map', '0',
        '-f', 'segment',
        '-segment_times', ts.join(','),
        '-reset_timestamps', '1',
        path.join(sceneDir, 'narration_%d.wav'),
      ], { label: 'audio split' });
    } else {
      fs.copyFileSync(narrationPath, path.join(sceneDir, 'narration_0.wav'));
    }

    // 3. Write .srt for all scenes
    for (let i = 0; i < scenes.length; i++) {
      writeSrt(sceneDir, scenes[i].captions, i);
    }

    // 4. Build scene dirs + render in parallel (max 4 concurrent)
    console.log(`  Building ${scenes.length} scene directories...`);
    const sceneDirs = scenes.map((s, i) =>
      buildAndRenderScene(s, i, sceneDir, bookTitle, coverExt, book, chapterNum)
    );

    console.log('  Rendering scenes in parallel...');
    const renderPromises = sceneDirs.map((dir, i) =>
      hyperframes(['render', '--quality', CONFIG.quality, '--output', `scene_${i}.mp4`, '--fps', String(CONFIG.fps)], {
        cwd: dir,
        label: `render scene ${i}`,
        timeout: 300000,
      })
    );
    // Run in batches of 4 to avoid CPU starvation
    const BATCH_SIZE = 4;
    for (let batch = 0; batch < renderPromises.length; batch += BATCH_SIZE) {
      const batchPromises = renderPromises.slice(batch, batch + BATCH_SIZE);
      await Promise.all(batchPromises.map((p, j) => {
        const idx = batch + j;
        return p.catch(err => {
          console.error(`  ✗ Scene ${idx} render failed: ${err.message}`);
          throw err;
        });
      }));
      console.log(`  Batch ${Math.floor(batch/BATCH_SIZE)+1}/${Math.ceil(renderPromises.length/BATCH_SIZE)} complete`);
    }

    // 5. Burn subtitles in parallel
    console.log('  Burning subtitles...');
    const burnPromises = sceneDirs.map((dir, i) => {
      const vfPath = path.join(dir, 'vf.txt');
      fs.writeFileSync(vfPath, 'subtitles=captions.srt');
      return ffmpeg([
        '-y', '-i', `scene_${i}.mp4`,
        '-filter_script:v', vfPath,
        '-c:a', 'copy',
        `scene_${i}_captioned.mp4`,
      ], { cwd: dir, label: `burn subs scene ${i}` }).finally(() => {
        try { fs.unlinkSync(vfPath); } catch {}
      });
    });
    await Promise.all(burnPromises);

    // 6. Concat all scenes
    console.log('  Concatenating...');
    const playlistPath = path.join(outDir, 'playlist.txt');
    const lines = sceneDirs.map((dir, i) => `file '${path.join(dir, `scene_${i}_captioned.mp4`)}'`);
    fs.writeFileSync(playlistPath, lines.join('\n'));
    await ffmpeg([
      '-y', '-f', 'concat', '-safe', '0',
      '-i', playlistPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      outPath,
    ], { label: 'concat scenes' });
    fs.unlinkSync(playlistPath);
    console.log(`✓ ${outPath}`);

  } finally {
    // 7. Cleanup (unless --keep-temp)
    if (!keepTemp) {
      console.log('  Cleaning temp files...');
      fs.rmSync(sceneDir, { recursive: true, force: true });
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

if (args.includes('--help') || args.length === 0) {
  console.log(`
build-chapter.js — Book Summary Chapter Pipeline

USAGE:
  node build-chapter.js --book <name> --chapter <num> [--keep-temp]
  node build-chapter.js --batch <name> [--keep-temp]

FLAGS:
  --book <name>      Book directory under books/ (e.g. atomic-habits)
  --chapter <num>    Chapter number (1-20)
  --batch <name>     Render all chapters for a book
  --keep-temp        Keep temp files after render
  --help             Show this message

DEPENDENCIES:
  - Node.js 22+
  - ffmpeg (on PATH)
  - edge-tts (npm install -g edge-tts)
`);
  process.exit(0);
}

if (bookIdx < 0) { console.error('--book is required'); process.exit(1); }
const book = args[bookIdx + 1];
try { validateBook(book); } catch (e) { console.error(e.message); process.exit(1); }

async function main() {
  if (batchIdx >= 0) {
    const bookDir = path.join(ROOT, 'books', book);
    if (!fs.existsSync(bookDir)) { console.error(`Book not found: ${bookDir}`); process.exit(1); }
    const files = fs.readdirSync(bookDir).filter(f => f.startsWith('chapter-') && f.endsWith('.json'));
    const chapters = files.map(f => parseInt(f.match(/chapter-(\d+)/)[1])).sort((a,b)=>a-b);
    console.log(`Batch: ${book} (${chapters.length} chapters)`);
    for (const ch of chapters) {
      try { await buildChapter(book, ch, keepTemp); }
      catch (err) { console.error(`✗ Chapter ${ch} failed: ${err.message}`); }
    }
    console.log(`\n=== Batch complete: ${chapters.length} chapters ===`);
  } else if (chIdx >= 0) {
    await buildChapter(book, parseInt(args[chIdx + 1]), keepTemp);
  } else {
    console.error('Specify --chapter <num> or --batch');
    process.exit(1);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
