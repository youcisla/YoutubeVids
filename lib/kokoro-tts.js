'use strict';

// Kokoro TTS (am_adam) via a small Python subprocess (kokoro-onnx).
// Local, free, no API key. Produces natural narration far less robotic than
// edge-tts. Node owns the ffmpeg wav->mp3 transcode so the rest of the
// pipeline keeps consuming .mp3 as before.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MODEL_DIR = path.join(ROOT, 'models', 'kokoro');
const SYNTH_PY = path.join(ROOT, 'scripts', 'kokoro_synth.py');
const DEFAULT_MODEL = path.join(MODEL_DIR, 'kokoro-v1.0.onnx');
const DEFAULT_VOICES = path.join(MODEL_DIR, 'voices-v1.0.bin');
const DEFAULT_VOICE = 'am_adam'; // ElevenLabs "Adam" analogue
const DEFAULT_LANG = 'en-us';

function kokoroCacheKey(options) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        text: options.text,
        voice: options.voice,
        speed: options.speed,
        lang: options.lang,
        engine: 'kokoro-onnx',
      })
    )
    .digest('hex');
}

// ponytail: even-timed split of a KNOWN script across the measured audio
// duration. Time per caption is proportional to its character count — good
// enough for short teasers. Upgrade path: swap to whisper/kokoro word
// timestamps if lip-tight sync is ever needed.
function buildProportionalCaptions({ text, durationSec, maxChars = 60 }) {
  const units = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const s of sentences) {
    if (s.length <= maxChars) { units.push(s.trim()); continue; }
    let buf = '';
    for (const word of s.split(/\s+/)) {
      if (buf && (buf + ' ' + word).length > maxChars) { units.push(buf.trim()); buf = word; }
      else buf = buf ? `${buf} ${word}` : word;
    }
    if (buf.trim()) units.push(buf.trim());
  }
  const totalChars = units.reduce((n, u) => n + u.length, 0) || 1;
  let t = 0;
  return units.map(u => {
    const dur = (u.length / totalChars) * durationSec;
    const cap = { start: t, end: t + dur, text: u };
    t += dur;
    return cap;
  });
}

function resolveFfmpeg(env = process.env) {
  return env.FFMPEG_PATH || 'ffmpeg';
}

// Synthesize `text` to `outMp3`. Returns { durationSec, sampleRate, voice }.
// Throws on any failure so the caller can fall back to another engine.
function synthesizeKokoro({
  text,
  voice = DEFAULT_VOICE,
  speed = 1.0,
  lang = DEFAULT_LANG,
  outMp3,
  model = DEFAULT_MODEL,
  voices = DEFAULT_VOICES,
  python = process.env.KOKORO_PYTHON || 'python',
  env = process.env,
  timeoutMs = 300_000,
} = {}) {
  if (!text || !text.trim()) throw new Error('Kokoro TTS: text is required');
  if (!fs.existsSync(model) || !fs.existsSync(voices)) {
    throw new Error(`Kokoro model missing (${model} / ${voices})`);
  }
  const tmpWav = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kokoro-')), 'out.wav');
  const py = spawnSync(
    python,
    [SYNTH_PY, '--model', model, '--voices', voices, '--voice', voice,
      '--speed', String(speed), '--lang', lang, '--out', tmpWav, '--text', text],
    { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }
  );
  if (py.status !== 0 || !fs.existsSync(tmpWav)) {
    throw new Error(`kokoro_synth failed: ${(py.stderr || py.error?.message || 'unknown').slice(-400)}`);
  }
  let meta = {};
  try { meta = JSON.parse((py.stdout || '{}').trim().split('\n').pop()); } catch {}

  fs.mkdirSync(path.dirname(outMp3), { recursive: true });
  const ff = spawnSync(
    resolveFfmpeg(env),
    ['-y', '-i', tmpWav, '-codec:a', 'libmp3lame', '-qscale:a', '2', outMp3],
    { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }
  );
  if (ff.status !== 0 || !fs.existsSync(outMp3)) {
    throw new Error(`ffmpeg mp3 transcode failed: ${(ff.stderr || ff.error?.message || 'unknown').slice(-400)}`);
  }
  return { durationSec: Number(meta.duration_sec) || 0, sampleRate: Number(meta.sample_rate) || 24000, voice };
}

module.exports = {
  synthesizeKokoro,
  buildProportionalCaptions,
  kokoroCacheKey,
  DEFAULT_VOICE,
  DEFAULT_LANG,
  DEFAULT_MODEL,
  DEFAULT_VOICES,
  MODEL_DIR,
};
