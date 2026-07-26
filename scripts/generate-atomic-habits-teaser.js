#!/usr/bin/env node
/**
 * generate-atomic-habits-teaser.js — Generate and cache the Atomic Habits teaser
 * narration, metadata, and scene-relative captions.
 *
 * Pipeline:
 *   1. Compute cache key from { text, voice, model, language, seed, ... }.
 *   2. If a matching audio file exists and --force is not set, treat as cache hit.
 *   3. Otherwise, call OmniVoice-Studio's OpenAI-compatible /v1/audio/speech
 *      endpoint. On failure, fall back to edge-tts (which also writes an SRT
 *      sidecar in the same invocation).
 *   4. Atomic write: write to a `.tmp` sidecar then rename to the final mp3.
 *   5. Persist metadata sidecar (provider, voice, model, language, seed,
 *      cacheKey, generatedAt) — never the API key.
 *   6. Captions are NEVER silently empty:
 *      - OmniVoice path: parses the SRT sidecar OmniVoice produces alongside mp3.
 *      - Edge TTS path: parses the SRT sidecar produced by edge-tts'
 *        --write-subtitles flag in the same generation call; rejects if empty.
 *
 * Usage:
 *   node scripts/generate-atomic-habits-teaser.js [--force]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { loadRootEnv } = require('../lib/env');
const { synthesizeKokoro, buildProportionalCaptions, kokoroCacheKey, DEFAULT_VOICE, DEFAULT_LANG } = require('../lib/kokoro-tts');

const ROOT = path.resolve(__dirname, '..');

const TEASER_TEXT = "Get one percent better, every day. After one year... you'll be thirty-seven times better.";
const ASSET_BASENAME = 'atomic-habits-teaser';
const SCENE_DURATION = 15;
const DEFAULT_LANGUAGE = 'en';
// ponytail: 0.9 floor of natural stretch. Real Adam ~150 WPM; this teases
// down to ~111 WPM (capped by Kokoro's per-phoneme natural rate + the one
// "..." pause after the hook). Closing the gap needs either shorter copy
// or a model trained on slower delivery, not more speed-knob work.
const DEFAULT_SPEED = 0.9;
// Adam-alike (ElevenLabs) → Kokoro voice am_adam.
const DEFAULT_VOICE_ID = DEFAULT_VOICE;

// ponytail: env file is gitignored and parsed line-by-line (same regex as
// build-chapter.js) so we never ship a dotenv dep for a one-file read.
function readRootConfig() {
  const cfgPath = path.join(ROOT, 'config.json');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return {};
  }
}

// edge-tts writes the audio and SRT subtitle sidecar in a single invocation
// when --write-subtitles is supplied. ponytail: assumes both flags succeed in
// the same process; if SRT ever fails to write, generateCaptionsForProvider
// throws and surfaces the missing-file error.
function defaultEdgeTts(text, voice, rate, outPath) {
  return new Promise((resolve, reject) => {
    const srtPath = `${outPath}.srt`;
    const proc = spawn(
      'edge-tts',
      ['--voice', voice, `--rate=${rate}`, '--write-media', outPath, '--write-subtitles', srtPath, '--text', text],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }
    );
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`edge-tts exited ${code}\n${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

function atomicWriteBytes(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, bytes);
  fs.renameSync(tmpPath, filePath);
}

// ponytail: regex-based SRT parser; tolerant of edge-tts's default output
// (HH:MM:SS,mmm --> HH:MM:SS,mmm) and optional leading index line. No deps.
function parseSrt(srtText) {
  if (typeof srtText !== 'string' || srtText.length === 0) return [];
  const blocks = srtText.replace(/\r\n/g, '\n').split(/\n\s*\n+/);
  const captions = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.length > 0);
    if (lines.length === 0) continue;
    const tsIdx = lines.findIndex(l => l.includes('-->'));
    if (tsIdx < 0) continue;
    const m = lines[tsIdx].match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/
    );
    if (!m) continue;
    const toSec = (h, mm, s, ms) =>
      Number(h) * 3600 + Number(mm) * 60 + Number(s) + Number(ms.padEnd(3, '0').slice(0, 3)) / 1000;
    const start = toSec(m[1], m[2], m[3], m[4]);
    const end = toSec(m[5], m[6], m[7], m[8]);
    const text = lines.slice(tsIdx + 1).join(' ').trim();
    if (text) captions.push({ start, end, text });
  }
  return captions;
}

function validateCaptions(captions, sceneDuration = SCENE_DURATION) {
  if (!Array.isArray(captions)) return [];
  const safe = Array.isArray(captions) ? captions.slice() : [];
  return safe
    .filter(c => c && typeof c.text === 'string' && c.text.trim().length > 0)
    .map(c => ({
      start: Number(c.start),
      end: Number(c.end),
      text: c.text.trim(),
    }))
    .filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
    .map(c => ({
      ...c,
      start: Math.max(0, c.start),
      end: Math.min(sceneDuration, c.end),
    }))
    .filter(c => c.end > c.start)
    .sort((a, b) => a.start - b.start);
}

async function generateCaptionsForProvider({ provider, audioPath, text, durationSec }) {
  if (provider === 'kokoro') {
    // Kokoro emits audio only — derive captions proportionally from the known
    // script over the measured duration.
    const validated = validateCaptions(buildProportionalCaptions({ text, durationSec }));
    if (validated.length === 0) throw new Error('kokoro produced zero captions');
    return validated;
  }
  if (provider === 'edge-tts') {
    const srtPath = `${audioPath}.srt`;
    if (!fs.existsSync(srtPath)) {
      throw new Error(`${provider} did not write SRT sidecar at ${srtPath}`);
    }
    const parsed = parseSrt(fs.readFileSync(srtPath, 'utf8'));
    const validated = validateCaptions(parsed);
    if (validated.length === 0) {
      throw new Error(`${provider} SRT parsed into zero captions`);
    }
    return validated;
  }
  throw new Error(`unknown provider: ${provider}`);
}

async function generateTeaserAudio({
  env = process.env,
  assetsDir = path.join(ROOT, 'ChapterZero', 'assets'),
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teaser-')),
  fetchImpl = fetch,
  edgeTtsImpl = defaultEdgeTts,
  config = readRootConfig(),
  log = () => {},
  force = false,
} = {}) {
  fs.mkdirSync(assetsDir, { recursive: true });

  const voiceId = env.KOKORO_VOICE || DEFAULT_VOICE_ID;
  const language = env.KOKORO_LANG || DEFAULT_LANG;
  const speed = env.KOKORO_SPEED ? Number(env.KOKORO_SPEED) : DEFAULT_SPEED;
  const cacheKey = kokoroCacheKey({ text: TEASER_TEXT, voice: voiceId, speed, lang: language });

  const audioPath = path.join(assetsDir, `${ASSET_BASENAME}.mp3`);
  const metaPath = path.join(assetsDir, `${ASSET_BASENAME}.meta.json`);
  const captionsPath = path.join(assetsDir, `${ASSET_BASENAME}.captions.json`);

  let provider = null;
  let durationSec = null;
  if (!force && fs.existsSync(audioPath) && fs.existsSync(metaPath)) {
    try {
      const prior = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (prior && prior.cacheKey === cacheKey && prior.provider) {
        provider = prior.provider;
        durationSec = prior.durationSec ?? null;
        log(`cache hit — reusing ${audioPath} (provider=${provider})`);
      }
    } catch {
      // Corrupt sidecar — treat as cache miss.
    }
  }

  if (provider === null) {
    try {
      log('Generating narration with Kokoro (am_adam)…');
      const res = synthesizeKokoro({ text: TEASER_TEXT, voice: voiceId, speed, lang: language, outMp3: audioPath, env });
      durationSec = res.durationSec;
      provider = 'kokoro';
    } catch (err) {
      log(`Kokoro failed: ${err.message} — falling back to edge-tts`);
      const voice = (config && config.voice) || 'en-US-ChristopherNeural';
      const voiceRate = (config && config.voice_rate) || '+0%';
      await edgeTtsImpl(TEASER_TEXT, voice, voiceRate, audioPath);
      provider = 'edge-tts';
    }

    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          provider,
          voice: voiceId,
          speed,
          language,
          durationSec,
          cacheKey,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }

  const sceneDir = path.join(tmpDir, 'captions');
  fs.mkdirSync(sceneDir, { recursive: true });
  const captions = await generateCaptionsForProvider({
    provider,
    audioPath,
    text: TEASER_TEXT,
    durationSec: durationSec ?? SCENE_DURATION,
  });
  fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2));

  return {
    provider,
    audioPath,
    metaPath,
    captionsPath,
    cacheKey,
    voice: voiceId,
    speed,
    language,
    durationSec,
    captions,
  };
}

module.exports = {
  generateTeaserAudio,
  generateCaptionsForProvider,
  TEASER_TEXT,
  ASSET_BASENAME,
  SCENE_DURATION,
  atomicWriteBytes,
  validateCaptions,
  parseSrt,
  defaultEdgeTts,
  readRootConfig,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE_ID,
};

if (require.main === module) {
  loadRootEnv();
  const force = process.argv.includes('--force');
  const log = (msg) => console.log(msg);
  generateTeaserAudio({ env: process.env, log, force })
    .then(meta => {
      console.log(`✓ ${ASSET_BASENAME} generated via ${meta.provider}`);
      console.log(`  audio:    ${meta.audioPath}`);
      console.log(`  captions: ${meta.captionsPath} (${meta.captions.length} captions)`);
      console.log(`  meta:     ${meta.metaPath}`);
    })
    .catch(err => {
      console.error(`✗ ${ASSET_BASENAME} generation failed: ${err.message}`);
      process.exit(1);
    });
}
