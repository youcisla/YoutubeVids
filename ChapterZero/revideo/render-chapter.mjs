#!/usr/bin/env node
/**
 * render-chapter.mjs — Headless Revideo renderer.
 *
 * Invokes @revideo/renderer's renderVideo() against project.tsx with a
 * variables manifest derived from the chapter JSON + audio metadata.
 *
 * Usage:
 *   node ChapterZero/revideo/render-chapter.mjs \
 *     --book atomic-habits --chapter 1 \
 *     --audio ChapterZero/assets/atomic-habits-teaser.mp3 \
 *     --duration 13.65 \
 *     --out ChapterZero/renders/atomic-habits-teaser-revideo.mp4
 */
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ponytail: Vite triggers a page reload when it finishes optimizing deps on the
// first hit. Puppeteer's navigation gets cancelled mid-flight ("Navigating frame
// was detached"). Pre-warm by curl-ing the URL once, waiting for deps to settle,
// then letting Revideo take over the same port — the optimization is cached on
// the second hit, no reload, no detachment.
async function prewarmVite(port, projectFile, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    // Start Vite programmatically via tsx so we share node_modules resolution.
    const tsx = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'tsx.cmd');
    const viteBin = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'vite.cmd');
    // Simpler: invoke vite directly via tsx loader on a tiny one-shot script.
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'prewarm-vite.ts'), projectFile, String(port)],
      { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, FORCE_COLOR: '0' } },
    );
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prewarm exited ${code}`));
    });
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error('prewarm timeout'));
    }, timeoutMs);
    // Unref so the process doesn't keep us alive if it exits early
    timer.unref?.();
  });
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

async function main() {
  const ROOT = path.resolve(__dirname, '..', '..');
  const PROJECT = path.join(__dirname, 'project.tsx');
  const book = arg('book', 'atomic-habits');
  const chapter = Number(arg('chapter', '1'));
  const audio = arg('audio', path.join(ROOT, 'ChapterZero', 'assets', 'atomic-habits-teaser.mp3'));
  const duration = Number(arg('duration', '15'));
  const out = arg('out', path.join(ROOT, 'ChapterZero', 'renders', `chapter-zero-${book}-ch${String(chapter).padStart(2, '0')}-revideo.mp4`));
  const workers = Number(arg('workers', '1'));

  // Load chapter JSON for title + narration-derived captions
  const chapterJsonPath = path.join(ROOT, 'books', book, `chapter-${String(chapter).padStart(2, '0')}.json`);
  let chapterTitle = `Chapter ${chapter}`;
  if (fs.existsSync(chapterJsonPath)) {
    const data = JSON.parse(fs.readFileSync(chapterJsonPath, 'utf8'));
    chapterTitle = data.chapter_title || chapterTitle;
  }

  // Build variables manifest
  const variables = {
    bookTitle: 'Atomic Habits',
    chapterNumber: chapter,
    chapterTitle,
    audioPath: path.relative(ROOT, audio).replace(/\\/g, '/'),
    audioDurationSec: duration,
    stat: { from: '1%', to: '37×', atSec: Math.min(2.5, duration * 0.18) },
    captions: [],
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });

  // Spawn the TS runner in the Revideo subdir so node_modules resolution works
  const runnerPath = path.join(__dirname, 'render-chapter.ts');
  console.log(`▶ Revideo render: ${book} ch${chapter} → ${out}`);
  console.log(`  project: ${PROJECT}`);
  console.log(`  audio:   ${variables.audioPath} (${duration}s)`);
  console.log(`  workers: ${workers}`);

  // Write variables to a temp file (shell-safe — JSON in argv gets mangled by spaces)
  const os = await import('node:os');
  const variablesPath = path.join(os.tmpdir(), `revideo-vars-${Date.now()}.json`);
  fs.writeFileSync(variablesPath, JSON.stringify(variables));

  // The .ts runner imports @revideo/renderer; we exec it via tsx for
  // zero-config TS execution. tsx is the same loader the Revideo editor uses.
  const tsxBin = path.join(ROOT, 'node_modules', '.bin', 'tsx.cmd');
  const args = [runnerPath, '--project', PROJECT, '--out', out, '--workers', String(workers), '--variables-file', variablesPath];
  const child = spawn(tsxBin, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`✓ rendered: ${out}`);
      process.exit(0);
    } else {
      console.error(`✗ render failed (exit ${code})`);
      process.exit(code ?? 1);
    }
  });
}

main().catch((err) => {
  console.error('render-chapter.mjs failed:', err);
  process.exit(1);
});
