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
const { validateConfig } = require('./lib/contracts');
const { validateChapter } = require('./lib/chapter-contract');
const CONFIG = validateConfig(JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')));
const whisper = require('./whisper-captions.js');

const VALID_BOOK_RE = /^[a-z0-9_-]+$/;

// ─── Safe spawn helpers (no shell, no injection) ─────────
async function getAudioDuration(audioPath) {
  try {
    // Use ffprobe — it returns clean JSON with duration in seconds
    const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', audioPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', d => stdout += d);
    const code = await new Promise((resolve, reject) => {
      proc.on('close', resolve);
      proc.on('error', reject);
    });
    if (code === 0) {
      const j = JSON.parse(stdout);
      return parseFloat(j.format?.duration || '0');
    }
  } catch {}
  return 0;
}

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
  // npx is .cmd on Windows — spawn() can't find it without cmd.exe
  const npxPath = path.join(path.dirname(process.execPath), 'npx' + (process.platform === 'win32' ? '.cmd' : ''));
  const cmd = process.platform === 'win32' ? 'cmd.exe' : npxPath;
  const cmdArgs = process.platform === 'win32' ? ['/c', npxPath, 'hyperframes', ...args] : ['hyperframes', ...args];
  return run(cmd, cmdArgs, { ...opts, label: opts.label || 'hyperframes' });
}

function edgeTts(voice, rate, text, outPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('edge-tts', [
      '--voice', voice,
      `--rate=${rate}`,
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

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ─── Core pipeline functions ─────────────────────────────
function buildCaptionJs(scene, fps) {
  // Build word-by-word kinetic captions from scene.captions.
  // Snap all timestamps to exact frame boundaries to prevent drift over long renders.
  const captions = scene.captions || [];
  if (captions.length === 0) return '';
  const frameDur = 1 / fps;
  const snap = t => Math.round(t / frameDur) * frameDur;
  const lines = captions.map((c, i) => {
    const words = c.text.split(/\s+/).filter(Boolean);
    return JSON.stringify({
      start: snap(c.start),
      end: snap(c.end),
      words,
    });
  }).join(',\n  ');
  return `
(function(){
  const lines = [
  ${lines}
  ];
  const capEl = document.getElementById('cap-line');
  if (!capEl) return;
  let wordEls = [];
  function showLine(idx) {
    const l = lines[idx];
    if (!l) return;
    wordEls.forEach(w => w.remove());
    wordEls = [];
    capEl.innerHTML = '';
    l.words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = w;
      capEl.appendChild(span);
      wordEls.push(span);
    });
    const span = (l.end - l.start) / Math.max(l.words.length, 1);
    l.words.forEach((_, i) => {
      tl.to(wordEls[i], { className: 'word live', duration: 0.05 }, l.start + i * span);
    });
  }
  // Hide before first line, show on entry, hide between lines
  lines.forEach((l, i) => {
    const prev = i > 0 ? lines[i-1].end : 0;
    tl.set('#cap-line', { opacity: 0 }, 0);
    tl.set('#cap-line', { opacity: 1 }, l.start);
    tl.set('#cap-line', { opacity: 0 }, l.end + 0.2);
  });
  // Actually populate each line at its start time
  lines.forEach((l, i) => {
    tl.call(() => showLine(i), [], l.start);
  });
})();`;
}

function buildSceneHtml(scene, bookTitle, coverExt) {
  const base = fs.readFileSync(path.join(ROOT, 'pilot/scenes/scene_base.html'), 'utf8');
  const gsapSrc = CONFIG.gsap_source || 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.14.2/gsap.min.js';
  const captionJs = buildCaptionJs(scene, CONFIG.fps);
  const allAnims = scene.animations + '\n' + captionJs;
  return base
    .replace(/\{N\}/g, scene.index)
    .replace(/\{DUR\}/g, scene.duration)
    .replace(/\{CONTENT\}/g, scene.html)
    .replace(/\{ANIMATIONS\}/g, allAnims)
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

// ─── YouTube upload (Data API v3 + OAuth2) ──────────────

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function uploadToYouTube(videoPath, title, description) {
  loadEnv();
  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;
  const refreshToken = process.env.YT_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('  ⚠ YouTube OAuth credentials not set.');
    console.warn('  Run: node scripts/yt-auth.mjs (see .env.example)');
    return;
  }

  console.log('  Uploading to YouTube...');
  const { google } = require('googleapis');
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  oauth2.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });
  const fileSize = fs.statSync(videoPath).size;
  const privacy = (CONFIG.youtube?.upload_as_draft ? 'private' : (CONFIG.youtube?.publish_type || 'public')).toLowerCase();

  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description: description || title,
        categoryId: '27', // Education
      },
      status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(videoPath) },
  }, {
    onUploadProgress: e => {
      const pct = Math.round((e.bytesRead / fileSize) * 100);
      process.stdout.write(`\r  Upload: ${pct}%   `);
    },
  });
  process.stdout.write('\n');
  const videoId = res.data.id;
  const url = `https://youtu.be/${videoId}`;
  console.log(`  ✓ Uploaded (${privacy}): ${url}`);
  return url;
}

// ─── Main build ──────────────────────────────────────────
async function buildChapter(book, chapterNum, keepTemp, noWhisper, doUpload) {
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

    const splitTimestamps = scenes.map(s => s.timestamp_end);

    // 2. Split audio into scene clips (use individual -ss -to).
    //    For each scene, slice [prevTime, t]. If the audio is shorter than t,
    //    FFmpeg returns empty — handle by clamping to actual audio length.
    let prevTime = 0;
    const audioDuration = await getAudioDuration(narrationPath);
    for (let i = 0; i < splitTimestamps.length; i++) {
      let t = Math.min(splitTimestamps[i], audioDuration);
      const outPath = path.join(sceneDir, `narration_${i}.wav`);
      if (t - prevTime < 0.1) {
        // Scene would be empty (audio ended) — duplicate last meaningful clip or skip
        const lastValid = i - 1 >= 0 ? path.join(sceneDir, `narration_${i-1}.wav`) : narrationPath;
        fs.copyFileSync(lastValid, outPath);
        console.log(`  ⚠ Scene ${i}: audio past end, reusing scene ${i-1}`);
      } else {
        await ffmpeg([
          '-y', '-i', narrationPath,
          '-ss', String(prevTime),
          '-to', String(t),
          '-c', 'pcm_s16le',
          outPath,
        ], { label: `audio split scene ${i}` });
      }
      prevTime = t;
    }

    // 3. Select caption source. Whisper returns scene-relative captions consumed by HTML.
    const sceneEndTimes = scenes.map(scene => scene.timestamp_end);
    const sceneDurations = scenes.map(scene => scene.duration);
    const sceneDirs = scenes.map((_, index) => path.join(sceneDir, `scene_${index}`));
    for (const dir of sceneDirs) fs.mkdirSync(dir, { recursive: true });

    if (!noWhisper) {
      try {
        const generatedCaptions = await whisper.generateCaptions(
          narrationPath,
          sceneEndTimes,
          sceneDir,
          sceneDurations,
        );
        if (generatedCaptions) {
          generatedCaptions.forEach((captions, index) => {
            if (captions.length > 0) scenes[index].captions = captions;
          });
          console.log('  Captions generated by Whisper');
        } else {
          console.warn('  Using static captions from chapter JSON');
        }
      } catch (err) {
        console.warn(`  Whisper failed: ${err.message}`);
        console.warn('  Using static captions from chapter JSON');
      }
    }

    // 4. Build content + start renders in parallel (batches of 4)
    console.log(`  Building ${scenes.length} scene directories...`);

    // Copy narration, HTML, and cover into each scene dir
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const dir = sceneDirs[i];
      const srcNar = path.join(sceneDir, `narration_${i}.wav`);
      if (fs.existsSync(srcNar)) fs.copyFileSync(srcNar, path.join(dir, 'narration.wav'));
      s.index = i;
      fs.writeFileSync(path.join(dir, 'index.html'), buildSceneHtml(s, bookTitle, coverExt));
      const coverSrc = path.join(ROOT, 'books', book, `cover.${coverExt}`);
      if (fs.existsSync(coverSrc)) fs.copyFileSync(coverSrc, path.join(dir, `cover.${coverExt}`));
    }

    console.log('  Rendering scenes in batches...');
    const BATCH_SIZE = 4;
    for (let batch = 0; batch < sceneDirs.length; batch += BATCH_SIZE) {
      const batchDirs = sceneDirs.slice(batch, batch + BATCH_SIZE);
      await Promise.all(batchDirs.map((dir, offset) => {
        const index = batch + offset;
        return hyperframes(
          ['render', '--quality', CONFIG.quality, '--output', `scene_${index}.mp4`, '--fps', String(CONFIG.fps)],
          { cwd: dir, label: `render scene ${index}`, timeout: 300000 },
        );
      }));
      console.log(`  Batch ${Math.floor(batch / BATCH_SIZE) + 1}/${Math.ceil(sceneDirs.length / BATCH_SIZE)} complete`);
    }

    // 5. Skip subtitle burn — captions are rendered via GSAP in the scene HTML.
    //    FFmpeg .srt burn is disabled to avoid double subtitles and timing drift.
    console.log('  Skipping subtitle burn (GSAP-driven captions in scene HTML)');

    // 6. Concat all required scenes. Missing output is fatal.
    console.log('  Concatenating...');
    const renderedScenes = sceneDirs.map((dir, index) => {
      const output = path.join(dir, `scene_${index}.mp4`);
      if (!fs.existsSync(output) || fs.statSync(output).size < 1000) {
        throw new Error(`Scene ${index} render produced no valid output`);
      }
      return output;
    });
    const playlistPath = path.join(sceneDir, 'playlist.txt');
    const lines = renderedScenes.map(output => `file '${output.replace(/'/g, "'\\''")}'`);
    fs.writeFileSync(playlistPath, lines.join('\n'));
    await ffmpeg([
      '-y', '-f', 'concat', '-safe', '0',
      '-i', playlistPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      outPath,
    ], { label: 'concat scenes' });
    fs.unlinkSync(playlistPath);

    // 6b. Mix background music with auto-ducking (sidechaincompress)
    const bgMusic = CONFIG.bg_music ? path.join(ROOT, CONFIG.bg_music) : null;
    if (bgMusic && fs.existsSync(bgMusic)) {
      console.log('  Mixing background music (auto-ducking)...');
      const musicMix = path.join(sceneDir, `${baseName}_music.mp4`);
      await ffmpeg([
        '-y', '-i', outPath, '-i', bgMusic,
        '-filter_complex',
        `[1:a]volume=0.15[bg];[bg][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[ducked];[0:a][ducked]amix=inputs=2:duration=first[a]`,
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
        '-shortest',
        musicMix,
      ], { label: 'music ducking' });
      fs.copyFileSync(musicMix, outPath);
      fs.unlinkSync(musicMix);
      console.log('  ✓ Music mixed');
    }

    console.log(`✓ ${outPath}`);

    // 6c. Generate thumbnail (frame at 2s)
    const thumbPath = path.join(outDir, `${baseName}_thumb.jpg`);
    try {
      await ffmpeg([
        '-y', '-ss', '2', '-i', outPath,
        '-frames:v', '1', '-q:v', '3',
        thumbPath,
      ], { label: 'thumbnail' });
      console.log(`  ✓ Thumbnail: ${thumbPath}`);
    } catch (err) {
      console.warn(`  ⚠ Thumbnail failed: ${err.message.slice(0, 100)}`);
    }

    // 7. Upload if requested
    if (doUpload && outPath) {
      const chapterTitle = `${bookTitle} — Chapter ${chapterNum}`;
      await uploadToYouTube(outPath, chapterTitle, data.description || chapterTitle);
    }

  } finally {
    // 8. Cleanup (unless --keep-temp)
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
const noWhisper = args.includes('--no-whisper');
const doUpload = args.includes('--upload');

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
  --no-whisper       Skip Whisper caption generation (use static .srt from JSON)
  --upload           Upload finished MP4 to YouTube (Data API v3 + OAuth2)
  --help             Show this message

DEPENDENCIES:
  - Node.js 22+
  - ffmpeg (on PATH)
  - edge-tts (npm install -g edge-tts)
`);
  process.exit(0);
}

const book = batchIdx >= 0 ? args[batchIdx + 1] : args[bookIdx + 1];
if (!book) { console.error(batchIdx >= 0 ? '--batch requires a book name' : '--book is required'); process.exit(1); }
try { validateBook(book); } catch (e) { console.error(e.message); process.exit(1); }

async function main() {
  if (batchIdx >= 0) {
    const bookDir = path.join(ROOT, 'books', book);
    if (!fs.existsSync(bookDir)) { console.error(`Book not found: ${bookDir}`); process.exit(1); }
    const files = fs.readdirSync(bookDir).filter(f => f.startsWith('chapter-') && f.endsWith('.json'));
    const chapters = files.map(f => parseInt(f.match(/chapter-(\d+)/)[1])).sort((a,b)=>a-b);
    console.log(`Batch: ${book} (${chapters.length} chapters)`);
    let failures = 0;
    for (const ch of chapters) {
      try { await buildChapter(book, ch, keepTemp, noWhisper, doUpload); }
      catch (err) {
        failures++;
        console.error(`✗ Chapter ${ch} failed: ${err.message}`);
      }
    }
    console.log(`\n=== Batch complete: ${chapters.length - failures} passed, ${failures} failed ===`);
    if (failures > 0) process.exitCode = 1;
  } else if (chIdx >= 0) {
    const chapter = Number(args[chIdx + 1]);
    if (!Number.isInteger(chapter) || chapter < 1) throw new Error('--chapter requires a positive integer');
    await buildChapter(book, chapter, keepTemp, noWhisper, doUpload);
  } else {
    console.error('Specify --chapter <num> or --batch');
    process.exit(1);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
