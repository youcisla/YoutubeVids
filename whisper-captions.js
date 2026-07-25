#!/usr/bin/env node
/** Generate scene-relative word captions using faster-whisper. */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateConfig } = require('./lib/contracts');

const CONFIG = validateConfig(JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')));
const TRANSCRIBE_SCRIPT = path.join(__dirname, 'scripts', 'transcribe-faster-whisper.py');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: opts.timeout || 300000,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', data => { stdout += data; });
    proc.stderr.on('data', data => { stderr += data; });
    proc.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${opts.label || cmd} exited ${code}\n${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

async function detectWhisper() {
  try {
    await run('python', ['-c', 'import faster_whisper; print("ok")'], { timeout: 15000 });
    return { backend: 'faster-whisper', binary: 'python' };
  } catch {
    return null;
  }
}

async function transcribeFasterWhisper(audioPath, outDir) {
  const modelSize = CONFIG.whisper?.model_size || 'base';
  const outJson = path.join(outDir, 'transcript.json');
  await run('python', [TRANSCRIBE_SCRIPT, modelSize, audioPath, outJson], {
    label: 'faster-whisper transcription',
    timeout: 600000,
  });
  return JSON.parse(fs.readFileSync(outJson, 'utf8'));
}

function groupWordsIntoCaps(words, sceneDuration, maxDuration = 6, minDuration = 2.5) {
  const captions = [];
  let chunk = [];
  let chunkStart = 0;

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (chunk.length === 0) {
      chunkStart = word.start;
      chunk.push(word);
      continue;
    }
    const duration = word.end - chunkStart;
    const isPause = word.start - words[index - 1].end > 0.35;
    const isSentenceEnd = /[.!?]$/.test(word.word.replace(/[^\w.!?]/g, ''));
    const isLongEnough = duration >= minDuration;
    if ((isPause && isLongEnough) || (isSentenceEnd && isLongEnough) || duration >= maxDuration) {
      captions.push({
        start: chunkStart,
        end: chunk[index === 0 ? 0 : chunk.length - 1].end,
        text: chunk.map(item => item.word).join(' ').trim(),
      });
      chunkStart = word.start;
      chunk = [word];
    } else {
      chunk.push(word);
    }
  }

  if (chunk.length > 0) {
    captions.push({
      start: chunkStart,
      end: chunk[chunk.length - 1].end,
      text: chunk.map(item => item.word).join(' ').trim(),
    });
  }

  return captions
    .map(caption => ({
      ...caption,
      start: Math.max(0, Math.min(caption.start, sceneDuration)),
      end: Math.max(0, Math.min(caption.end, sceneDuration)),
    }))
    .filter(caption => caption.text && caption.end > caption.start);
}

async function generateCaptions(narrationPath, sceneTimestamps, sceneDir, sceneDurations) {
  const backend = await detectWhisper();
  if (!backend) {
    console.warn('  No Whisper backend found. Install faster-whisper: uv pip install faster-whisper');
    return null;
  }

  console.log(`  Transcribing with ${backend.backend}...`);
  const result = await transcribeFasterWhisper(narrationPath, sceneDir);
  const allWords = result.segments.flatMap(segment => segment.words || []);
  if (allWords.length === 0) return null;

  return sceneTimestamps.map((endTime, index) => {
    const startTime = index === 0 ? 0 : sceneTimestamps[index - 1];
    const localWords = allWords
      .filter(word => word.start < endTime && word.end > startTime)
      .map(word => ({
        word: word.word,
        start: Math.max(0, word.start - startTime),
        end: Math.min(sceneDurations[index], word.end - startTime),
      }));
    return groupWordsIntoCaps(localWords, sceneDurations[index]);
  });
}

module.exports = { generateCaptions, detectWhisper, groupWordsIntoCaps };

if (require.main === module) {
  console.error('Use build-chapter.js to generate scene captions.');
  process.exit(1);
}
