#!/usr/bin/env node
/**
 * setup-models.js — Download Kokoro ONNX model + voices on first run.
 *
 * Why a script, not a vendored copy: the model is 310MB (over GitHub's 100MB
 * push limit) and 28MB for voices, so they live outside git. Anyone cloning
 * the repo runs `npm run setup:models` (or this directly) to pull them.
 *
 * Source: fastrtc/kokoro-onnx on HuggingFace (thewh1teagent/kokoro-onnx GitHub
 * repo was deleted; nazdridoy mirror 404s on the v1.0 release).
 *
 * Windows TLS: needs --ssl-no-revoke (Windows curl TLS cert check fails
 * for some HF certs).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MODEL_DIR = path.join(ROOT, 'models', 'kokoro');
const MODEL = path.join(MODEL_DIR, 'kokoro-v1.0.onnx');
const VOICES = path.join(MODEL_DIR, 'voices-v1.0.bin');
const URL_BASE = 'https://huggingface.co/fastrtc/kokoro-onnx/resolve/main';

// ponytail: 310MB over a flaky Windows TLS path. Stream to a .partial,
// fsync, rename — restart-safe, no half-written models.
function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.partial`;
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024 * 1024) {
    console.log(`✓ ${path.basename(dest)} already present (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB) — skipping`);
    return;
  }
  console.log(`↓ ${path.basename(url)} → ${path.basename(dest)}`);
  // Windows curl needs --ssl-no-revoke for HF; harmless on POSIX.
  const r = spawnSync('curl', [
    '-sL', '--ssl-no-revoke', '-o', tmp,
    '--retry', '3', '--retry-delay', '2',
    url,
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`curl failed (${r.status}) for ${url}`);
  if (!fs.existsSync(tmp) || fs.statSync(tmp).size < 1024 * 1024) {
    throw new Error(`download too small (${fs.existsSync(tmp) ? fs.statSync(tmp).size : 0}B) — probably an error page, not the model`);
  }
  fs.renameSync(tmp, dest);
  console.log(`✓ ${path.basename(dest)} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`);
}

function main() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  download(`${URL_BASE}/kokoro-v1.0.onnx`, MODEL);
  download(`${URL_BASE}/voices-v1.0.bin`, VOICES);
  console.log('\n✓ Kokoro models ready. Run `node scripts/generate-atomic-habits-teaser.js` to test.');
}

if (require.main === module) main();

module.exports = { MODEL_DIR, MODEL, VOICES };
