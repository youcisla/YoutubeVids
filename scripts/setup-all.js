#!/usr/bin/env node
/**
 * setup-all.js — One-shot local environment bootstrap.
 *
 * Handles everything that can be automated:
 *   1. Check Node + Python + ffmpeg + edge-tts are reachable
 *   2. pip install kokoro-onnx, soundfile, edge-tts
 *   3. node scripts/setup-models.js (downloads the 338MB Kokoro model)
 *   4. Copy .env.example → .env if missing
 *
 * Prints a checklist of what still needs manual setup (YouTube OAuth is the
 * big one — can't automate because it requires browser login).
 *
 * Usage: npm run setup:all
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PY = process.env.KOKORO_PYTHON || 'python';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function step(label) {
  console.log(`\n${YELLOW}== ${label} ==${RESET}`);
}
function ok(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function fail(msg) { console.log(`${RED}✗${RESET} ${msg}`); }
function info(msg) { console.log(`${DIM}  ${msg}${RESET}`); }

function checkTool(name, versionArgs = ['--version']) {
  const r = spawnSync(name, versionArgs, { encoding: 'utf8' });
  if (r.status === 0) {
    const v = (r.stdout || r.stderr).split('\n')[0].trim();
    ok(`${name} — ${v}`);
    return true;
  }
  fail(`${name} not found on PATH`);
  info(`Install: see docs/SETUP.md → Prerequisites`);
  return false;
}

function main() {
  console.log(`${YELLOW}Chapter Zero Studio — local environment setup${RESET}`);
  console.log(`${DIM}Everything that can be automated happens here.${RESET}`);
  console.log(`${DIM}You'll still need to do 2 manual steps after this runs (see below).${RESET}`);

  step('Checking prerequisites');
  const nodeOk = checkTool('node', ['--version']);
  const pyOk = checkTool(PY, ['--version']);
  const ffmpegOk = checkTool('ffmpeg', ['-version']);
  const ffprobeOk = checkTool('ffprobe', ['-version']);
  const edgeTtsOk = checkTool('edge-tts', ['--version']);
  const hfOk = checkTool('hyperframes', ['--version']); // optional

  if (!nodeOk) { fail('Node.js is required. Install from https://nodejs.org (>= 22).'); process.exit(1); }
  if (!pyOk) { fail('Python is required. Install from https://python.org.'); process.exit(1); }
  if (!ffmpegOk || !ffprobeOk) {
    fail('ffmpeg + ffprobe are required for audio/video processing.');
    info('Windows: `winget install ffmpeg` or download from https://ffmpeg.org');
    info('macOS: `brew install ffmpeg`');
    info('Linux: `apt install ffmpeg`');
    process.exit(1);
  }
  if (!edgeTtsOk) info('edge-tts not found — fallback TTS won\'t work, but Kokoro is the primary engine.');

  step('Installing Python TTS dependencies');
  const pipPkgs = ['kokoro-onnx', 'soundfile'];
  if (!edgeTtsOk) pipPkgs.push('edge-tts');
  const pipCmd = `${PY} -m pip install --quiet ${pipPkgs.join(' ')}`;
  info(`Running: ${pipCmd}`);
  const r = spawnSync(PY, ['-m', 'pip', 'install', '--quiet', ...pipPkgs], { stdio: 'inherit' });
  if (r.status === 0) ok(`Installed: ${pipPkgs.join(', ')}`);
  else { fail(`pip install failed — try manually: ${pipCmd}`); process.exit(1); }

  step('Downloading Kokoro ONNX model (338MB, one-time)');
  if (fs.existsSync(path.join(ROOT, 'models', 'kokoro', 'kokoro-v1.0.onnx'))) {
    ok('Model already present — skipping download');
  } else {
    require('./setup-models.js'); // direct require calls main()
  }

  step('Scaffolding .env');
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, '.env.example');
  if (fs.existsSync(envPath)) {
    ok('.env already exists — leaving it alone');
  } else if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    ok(`Copied .env.example → .env`);
  } else {
    info('No .env.example found — skipping (you may not need one if YouTube isn\'t set up yet)');
  }

  step('Manual steps still required');
  console.log(`
  ${YELLOW}A.${RESET} ${BOLD}Set up YouTube upload (only if you want to publish)${RESET}
     1. Go to https://console.cloud.google.com/apis/credentials
     2. Create credentials → OAuth client ID → Desktop app
     3. Enable YouTube Data API v3
     4. Add your Google account as a Test User
     5. Copy Client ID + Client Secret into ${YELLOW}.env${RESET} as ${YELLOW}YT_CLIENT_ID${RESET} and ${YELLOW}YT_CLIENT_SECRET${RESET}
     6. Run: ${YELLOW}npm run yt:auth${RESET} → browser opens → log in → paste the refresh token into .env

  ${YELLOW}B.${RESET} ${BOLD}Start the app${RESET}
     ${YELLOW}npm run ui${RESET}
     → opens at http://localhost:5173

  ${DIM}That's it. See docs/SETUP.md for troubleshooting and docs/USER_GUIDE.md for the full UI walkthrough.${RESET}
`);
}

const BOLD = '\x1b[1m';
main();
