#!/usr/bin/env node
/**
 * generate-atomic-habits-teaser.js — Generate and cache the Atomic Habits teaser
 * narration, metadata, and scene-relative captions.
 *
 * Pipeline: ElevenLabs (primary) → edge-tts (fallback) → write SRT sidecar.
 * Atomic write + meta sidecar (never the API key). Captions never silently empty.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { narrationCacheKey, narrateWithElevenLabs } = require('../lib/elevenlabs-tts');
const whisper = require('../whisper-captions');

const ROOT = path.resolve(__dirname, '..');

const TEASER_TEXT = "What if one percent was enough? Get one percent better each day. After one year, you're thirty-seven times better. Small habits. Big results. Watch the full summary.";
const ASSET_BASENAME = 'atomic-habits-teaser';
const SCENE_DURATION = 15;
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const VOICE_SETTINGS = Object.freeze({
  stability: 0.42,
  similarity_boost: 0.78,
  style: 0.2,
  use_speaker_boost: true,
});

function readRootConfig() {
  const cfgPath = path.join(ROOT, 'config.json');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return {};
  }
}

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
    .map(c => ({ start: Number(c.start), end: Number(c.end), text: c.text.trim() }))
    .filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
    .map(c => ({ ...c, start: Math.max(0, c.start), end: Math.min(sceneDuration, c.end) }))
    .filter(c => c.end > c.start)
    .sort((a, b) => a.start - b.start);
}

async function generateCaptionsForProvider({ provider, audioPath, captionImpl, sceneDir }) {
  if (provider === 'edge-tts') {
    const srtPath = `${audioPath}.srt`;
    if (!fs.existsSync(srtPath)) {
      throw new Error(`edge-tts did not write SRT sidecar at ${srtPath}`);
    }
    const parsed = parseSrt(fs.readFileSync(srtPath, 'utf8'));
    const validated = validateCaptions(parsed);
    if (validated.length === 0) {
      throw new Error('edge-tts SRT parsed into zero captions');
    }
    return validated;
  }
  let scenes;
  try {
    scenes = await captionImpl(audioPath, [SCENE_DURATION], sceneDir, [SCENE_DURATION]);
  } catch (err) {
    throw new Error(`caption generation failed: ${err.message}`);
  }
  const validated = validateCaptions(scenes && scenes[0] ? scenes[0] : []);
  if (validated.length === 0) {
    throw new Error('caption generation produced no captions (empty result)');
  }
  return validated;
}

async function generateTeaserAudio({
  env = process.env,
  assetsDir = path.join(ROOT, 'ChapterZero', 'assets'),
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teaser-')),
  fetchImpl = fetch,
  edgeTtsImpl = defaultEdgeTts,
  captionImpl = whisper.generateCaptions,
  config = readRootConfig(),
  log = () => {},
  force = false,
} = {}) {
  fs.mkdirSync(assetsDir, { recursive: true });

  const apiKey = env.ELEVENLABS_API_KEY;
  const voiceId = env.ELEVENLABS_VOICE_ID || 'IRHApOXLvnW57QJPQH2P';
  const modelId = env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  const cacheKey = narrationCacheKey({
    text: TEASER_TEXT,
    voiceId,
    modelId,
    settings: VOICE_SETTINGS,
  });

  const audioPath = path.join(assetsDir, `${ASSET_BASENAME}.mp3`);
  const metaPath = path.join(assetsDir, `${ASSET_BASENAME}.meta.json`);
  const captionsPath = path.join(assetsDir, `${ASSET_BASENAME}.captions.json`);

  let provider = null;
  if (!force && fs.existsSync(audioPath) && fs.existsSync(metaPath)) {
    try {
      const prior = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (prior && prior.cacheKey === cacheKey && prior.provider) {
        provider = prior.provider;
        log(`cache hit — reusing ${audioPath} (provider=${provider})`);
      }
    } catch {
      // Corrupt sidecar — treat as cache miss.
    }
  }

  if (provider === null) {
    try {
      if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');
      log('Generating narration with ElevenLabs…');
      const { audio } = await narrateWithElevenLabs({
        apiKey,
        voiceId,
        modelId,
        text: TEASER_TEXT,
        settings: VOICE_SETTINGS,
        fetchImpl,
      });
      atomicWriteBytes(audioPath, audio);
      provider = 'elevenlabs';
    } catch (err) {
      log(`ElevenLabs failed: ${err.message} — falling back to edge-tts`);
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
          voiceId,
          modelId,
          settings: VOICE_SETTINGS,
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
    captionImpl,
    sceneDir,
  });
  fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2));

  return {
    provider,
    audioPath,
    metaPath,
    captionsPath,
    cacheKey,
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
  DEFAULT_MODEL_ID,
  VOICE_SETTINGS,
};

if (require.main === module) {
  require('../lib/env').loadRootEnv();
  const force = process.argv.includes('--force');
  const log = (msg) => console.log(msg);
  generateTeaserAudio({ env: process.env, log, force })
    .then((meta) => {
      console.log(`✓ ${ASSET_BASENAME} generated via ${meta.provider}`);
      console.log(`  audio:    ${meta.audioPath}`);
      console.log(`  captions: ${meta.captionsPath} (${meta.captions.length} captions)`);
      console.log(`  meta:     ${meta.metaPath}`);
    })
    .catch((err) => {
      console.error(`✗ ${ASSET_BASENAME} generation failed: ${err.message}`);
      process.exit(1);
    });
}
