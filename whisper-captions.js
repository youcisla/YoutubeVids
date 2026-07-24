#!/usr/bin/env node
/**
 * whisper-captions.js — Auto-generate word-level caption timestamps
 * using faster-whisper (Python) or whisper.cpp (local binary).
 *
 * Called by build-chapter.js after narration.wav is generated.
 * Outputs per-scene .srt files with word-level accuracy.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// ─── Helpers ────────────────────────────────────────────

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: opts.timeout || 300000,
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${opts.label || cmd} exited ${code}\n${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

// ─── Whisper backends ───────────────────────────────────

async function detectWhisper() {
  // Try faster-whisper via Python
  try {
    const { stdout } = await run('python', ['-c', 'import faster_whisper; print("ok")'], { timeout: 15000 });
    return { backend: 'faster-whisper', binary: 'python' };
  } catch {}

  // Try openai-whisper via Python
  try {
    const { stdout } = await run('python', ['-c', 'import whisper; print("ok")'], { timeout: 15000 });
    return { backend: 'openai-whisper', binary: 'python' };
  } catch {}

  return null;
}

async function transcribeWhisperCpp(audioPath, outDir) {
  const modelPath = CONFIG.whisper?.model_path || path.join(os.homedir(), '.cache', 'whisper', 'ggml-base.en.bin');
  const outJson = path.join(outDir, 'transcript.json');
  
  await run('whisper', [
    '--model', modelPath,
    '--file', audioPath,
    '--output-json',
    '--output-file', path.join(outDir, 'transcript'),
    '--no-timestamps',  // we want word-level timestamps
  ], { label: 'whisper.cpp transcription', timeout: 600000 });

  return JSON.parse(fs.readFileSync(outJson, 'utf8'));
}

async function transcribeFasterWhisper(audioPath, outDir) {
  const modelSize = CONFIG.whisper?.model_size || 'base';
  const outJson = path.join(outDir, 'transcript.json');
  
  const script = `
import json, sys
from faster_whisper import WhisperModel
model = WhisperModel("${modelSize}", device="cpu", compute_type="int8")
segments, info = model.transcribe("${audioPath.replace(/\\/g,'\\\\')}", word_timestamps=True)
result = {"segments": []}
for seg in segments:
    words = [{"word": w.word, "start": w.start, "end": w.end} for w in (seg.words or [])]
    result["segments"].append({
        "start": seg.start, "end": seg.end, "text": seg.text, "words": words
    })
with open("${outJson.replace(/\\/g,'\\\\')}", "w") as f:
    json.dump(result, f)
print(f"done: {len(result['segments'])} segments")
`;
  
  await run('python', ['-c', script], { label: 'faster-whisper transcription', timeout: 600000 });
  return JSON.parse(fs.readFileSync(outJson, 'utf8'));
}

async function transcribeUvxFasterWhisper(audioPath, outDir) {
  const modelSize = CONFIG.whisper?.model_size || 'base';
  const outJson = path.join(outDir, 'transcript.json');
  
  const script = `
import json, sys
from faster_whisper import WhisperModel
model = WhisperModel("${modelSize}", device="cpu", compute_type="int8")
segments, info = model.transcribe("${audioPath.replace(/\\/g,'\\\\')}", word_timestamps=True)
result = {"segments": []}
for seg in segments:
    words = [{"word": w.word, "start": w.start, "end": w.end} for w in (seg.words or [])]
    result["segments"].append({
        "start": seg.start, "end": seg.end, "text": seg.text, "words": words
    })
with open("${outJson.replace(/\\/g,'\\\\')}", "w") as f:
    json.dump(result, f)
print(f"done: {len(result['segments'])} segments")
`;
  
  await run('uvx', ['faster-whisper', '-c', script], { label: 'uvx faster-whisper transcription', timeout: 600000 });
  return JSON.parse(fs.readFileSync(outJson, 'utf8'));
}

// ─── Caption generation from word timestamps ───────────

function groupWordsIntoCaps(words, sceneDuration, maxDuration = 6, minDuration = 2.5) {
  // Group words into caption chunks at natural breakpoints
  const caps = [];
  let chunk = [];
  let chunkStart = 0;
  
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (chunk.length === 0) {
      chunkStart = w.start;
      chunk.push(w);
      continue;
    }
    
    const duration = w.end - chunkStart;
    const isPause = w.start - words[i-1].end > 0.35;
    const isSentenceEnd = /[.!?]$/.test(w.word.replace(/[^\w.!?]/g, ''));
    const isLongEnough = duration >= minDuration;
    
    if ((isPause && isLongEnough) || (isSentenceEnd && isLongEnough) || duration >= maxDuration) {
      caps.push({
        start: chunkStart,
        end: words[i-1].end,
        text: chunk.map(w => w.word).join(' ').trim(),
      });
      chunkStart = w.start;
      chunk = [w];
    } else {
      chunk.push(w);
    }
  }
  
  // Flush remaining
  if (chunk.length > 0) {
    caps.push({
      start: chunkStart,
      end: chunk[chunk.length-1].end,
      text: chunk.map(w => w.word).join(' ').trim(),
    });
  }
  
  // Cap last entry at sceneDuration
  if (caps.length > 0 && caps[caps.length-1].end > sceneDuration) {
    caps[caps.length-1].end = sceneDuration;
  }
  
  return caps;
}

function writeSrt(sceneDir, captions) {
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

// ─── Main API ───────────────────────────────────────────

async function generateCaptions(narrationPath, sceneTimestamps, sceneDir, sceneDurations) {
  console.log('  Transcribing narration...');
  
  const backend = await detectWhisper();
  if (!backend) {
    console.warn('  ⚠ No Whisper backend found. Install faster-whisper: uv pip install faster-whisper');
    console.warn('  Or whisper.cpp: https://github.com/ggerganov/whisper.cpp');
    return null;
  }
  
  console.log(`  Using backend: ${backend.backend}`);
  
  let result;
  switch (backend.backend) {
    case 'whisper-cpp':
      result = await transcribeWhisperCpp(narrationPath, sceneDir);
      break;
    case 'faster-whisper':
      result = await transcribeFasterWhisper(narrationPath, sceneDir);
      break;
    case 'uvx-faster-whisper':
      result = await transcribeUvxFasterWhisper(narrationPath, sceneDir);
      break;
    default:
      throw new Error('No Whisper backend');
  }
  
  // Flatten all words from all segments
  const allWords = [];
  for (const seg of result.segments) {
    for (const w of (seg.words || [])) {
      allWords.push({ word: w.word, start: w.start, end: w.end });
    }
  }
  
  if (allWords.length === 0) {
    console.warn('  ⚠ No word-level timestamps from Whisper. Falling back to manual .srt.');
    return null;
  }
  
  console.log(`  Got ${allWords.length} word timestamps across ${result.segments.length} segments`);
  
  // Map words to scenes by time boundaries (inclusive of boundary, last scene gets rest)
  let wordIdx = 0;
  for (let i = 0; i < sceneTimestamps.length; i++) {
    const startTime = i === 0 ? 0 : sceneTimestamps[i-1];
    const endTime = sceneTimestamps[i];
    const isLastScene = i === sceneTimestamps.length - 1;
    const sceneWords = [];

    // Take words with start < endTime, OR if last scene, take ALL remaining words
    while (wordIdx < allWords.length) {
      const w = allWords[wordIdx];
      if (isLastScene || w.start < endTime) {
        sceneWords.push(w);
        wordIdx++;
      } else {
        break;
      }
    }

    const captions = groupWordsIntoCaps(sceneWords, sceneDurations[i]);
    const s = path.join(sceneDir, `scene_${i}`);
    fs.mkdirSync(s, { recursive: true });
    writeSrt(s, captions);
    console.log(`  Scene ${i}: ${captions.length} captions (${sceneWords.length} words)`);
  }
  
  return true;
}

module.exports = { generateCaptions, detectWhisper, groupWordsIntoCaps };

// ─── CLI usage ──────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length < 1) {
    console.log('Usage: node whisper-captions.js <narration.wav> [sceneDir]');
    console.log('  Generates per-scene .srt files with word-level captions.');
    console.log('  Requires: faster-whisper (uv pip install faster-whisper)');
    console.log('  Or: whisper.cpp binary on PATH');
    process.exit(0);
  }
  const audioPath = path.resolve(args[0]);
  const outDir = args[1] ? path.resolve(args[1]) : path.dirname(audioPath);
  generateCaptions(audioPath, [], outDir, []).catch(console.error);
}
