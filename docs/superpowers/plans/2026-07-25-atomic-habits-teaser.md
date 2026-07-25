# Atomic Habits Editorial-Pop Teaser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a verified 15-second Atomic Habits Chapter 1 teaser with Editorial Pop visuals, cached ElevenLabs narration, synchronized captions, and a full-summary CTA.

**Architecture:** A small Node script owns narration generation and caching. It requests ElevenLabs through built-in `fetch`, falls back to existing Edge TTS, then feeds final audio into existing faster-whisper caption generation. ChapterZero remains the sole HyperFrames project; its three existing sub-compositions are rewritten around fixed approved content rather than introducing a template framework.

**Tech Stack:** Node.js 22+, built-in `fetch`/`crypto`/`node:test`, ElevenLabs Text-to-Speech API, existing Edge TTS and faster-whisper tools, HyperFrames 0.7.65, GSAP, FFmpeg/ffprobe.

## Global Constraints

- Preserve unrelated user modifications in `ChapterZero/` and current root working tree.
- Do not commit.
- Keep `ELEVENLABS_API_KEY` only in ignored `.env`; never print it.
- Use a premade warm male voice; no voice cloning.
- Keep Edge TTS as fallback.
- Cache narration by script, voice, model, and voice settings.
- Captions must derive from final audio timing.
- Keep 1920×1080, 30 FPS, 15 seconds.
- No background music, DeepSeek, portrait version, upload automation, or variant generation.
- HyperFrames remains sole render engine.

---

### Task 1: ElevenLabs Narration Adapter and Cache

**Files:**
- Create: `lib/elevenlabs-tts.js`
- Create: `tests/elevenlabs-tts.test.js`
- Modify: `.env.example`

**Interfaces:**
- Produces: `narrateWithElevenLabs(options): Promise<{ audio: Buffer, contentType: string }>`
- Produces: `narrationCacheKey(options): string`
- Consumes later: `generateTeaserAudio()` in Task 2.

- [ ] **Step 1: Write failing cache-key tests**

Test fixed SHA-256 output stability and prove script, voice, model, or settings changes produce different keys:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { narrationCacheKey } = require('../lib/elevenlabs-tts');

const base = {
  text: 'What if one percent was enough?',
  voiceId: 'warm-male',
  modelId: 'eleven_multilingual_v2',
  settings: { stability: 0.42, similarity_boost: 0.78, style: 0.2, use_speaker_boost: true },
};

test('cache key is stable and input-sensitive', () => {
  assert.equal(narrationCacheKey(base), narrationCacheKey({ ...base }));
  assert.notEqual(narrationCacheKey(base), narrationCacheKey({ ...base, text: `${base.text}!` }));
  assert.notEqual(narrationCacheKey(base), narrationCacheKey({ ...base, voiceId: 'other' }));
});
```

- [ ] **Step 2: Write failing HTTP adapter tests**

Inject `fetchImpl` so tests make no live API calls. Assert endpoint `/v1/text-to-speech/{voiceId}`, `xi-api-key` header, JSON body, timeout signal, binary response, and redacted errors.

- [ ] **Step 3: Run tests and confirm failure**

Run: `node --test tests/elevenlabs-tts.test.js`

Expected: FAIL with `Cannot find module '../lib/elevenlabs-tts'`.

- [ ] **Step 4: Implement minimum adapter**

Use built-in `fetch` and `AbortSignal.timeout(45000)`:

```js
const crypto = require('node:crypto');

function narrationCacheKey(options) {
  return crypto.createHash('sha256').update(JSON.stringify({
    text: options.text,
    voiceId: options.voiceId,
    modelId: options.modelId,
    settings: options.settings,
  })).digest('hex');
}

async function narrateWithElevenLabs({ apiKey, text, voiceId, modelId, settings, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID is not set');
  const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg', 'xi-api-key': apiKey },
    body: JSON.stringify({ text, model_id: modelId, voice_settings: settings }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`ElevenLabs TTS failed (${response.status})`);
  return { audio: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'audio/mpeg' };
}
```

- [ ] **Step 5: Document environment variables**

Append to `.env.example` without real values:

```dotenv
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

- [ ] **Step 6: Verify tests pass**

Run: `node --test tests/elevenlabs-tts.test.js`

Expected: PASS; zero network calls.

---

### Task 2: Generate and Cache Final Narration plus Captions

**Files:**
- Create: `scripts/generate-atomic-habits-teaser.js`
- Create: `tests/generate-atomic-habits-teaser.test.js`
- Modify: `whisper-captions.js` only if a narrow export is required
- Generate: `ChapterZero/assets/atomic-habits-teaser.mp3`
- Generate: `ChapterZero/assets/atomic-habits-teaser.captions.json`
- Generate: `ChapterZero/assets/atomic-habits-teaser.meta.json`

**Interfaces:**
- Consumes: `narrateWithElevenLabs`, `narrationCacheKey`.
- Consumes: existing `whisper.generateCaptions(audioPath, [15], tempDir, [15])`.
- Produces: `generateTeaserAudio({ env, fetchImpl, edgeTtsImpl, captionImpl }): Promise<metadata>`.

- [ ] **Step 1: Write failing orchestration tests**

Use temporary directories and injected fakes. Cover:

1. Cache miss calls ElevenLabs once and writes audio/meta.
2. Same inputs hit cache and call ElevenLabs zero times.
3. ElevenLabs failure calls Edge TTS fallback once.
4. Caption generation receives final cached/fallback audio path.
5. Logs never contain API key.

- [ ] **Step 2: Run orchestration tests and confirm failure**

Run: `node --test tests/generate-atomic-habits-teaser.test.js`

Expected: FAIL because generator module does not exist.

- [ ] **Step 3: Implement approved fixed script and settings**

Use this exact narration:

```text
What if one percent was enough? Get one percent better each day. After one year, you're thirty-seven times better. Small habits. Big results. Watch the full summary.
```

Use these defaults:

```js
const VOICE_SETTINGS = {
  stability: 0.42,
  similarity_boost: 0.78,
  style: 0.2,
  use_speaker_boost: true,
};
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
```

Read `.env` with the existing line parser pattern from `build-chapter.js`; do not add `dotenv`.

- [ ] **Step 4: Implement atomic cache writes**

Write API response to `ChapterZero/assets/.atomic-habits-teaser.<pid>.tmp`, then rename to `.mp3`. Write metadata containing cache key, provider, voice ID, model ID, settings, and generation timestamp; omit API key.

- [ ] **Step 5: Implement Edge TTS fallback**

Use existing root config voice/rate and `spawn('edge-tts', [...])` with array arguments. Convert fallback output to same final asset path. A nonzero process exit must reject.

- [ ] **Step 6: Generate scene-relative captions from final audio**

Call existing caption API with one 15-second scene. Flatten returned scene 0 into `atomic-habits-teaser.captions.json`. Validate nonempty text, ordered timing, and every `end <= 15`.

- [ ] **Step 7: Run unit tests**

Run: `node --test tests/generate-atomic-habits-teaser.test.js tests/elevenlabs-tts.test.js`

Expected: PASS.

- [ ] **Step 8: Run authorized live generation**

Before running, user places real key and premade warm-male voice ID in root `.env`. Run:

```bash
node scripts/generate-atomic-habits-teaser.js
```

Expected: audio, captions, and metadata files exist; log reports `elevenlabs` or explicit `edge-tts fallback`; no secret shown.

---

### Task 3: Rewrite ChapterZero into Editorial Pop Atomic Habits Teaser

**Files:**
- Modify: `ChapterZero/index.html`
- Modify: `ChapterZero/compositions/intro.html`
- Modify: `ChapterZero/compositions/stats.html`
- Modify: `ChapterZero/compositions/captions.html`
- Create: `ChapterZero/index.motion.json`

**Interfaces:**
- Consumes: `assets/atomic-habits-teaser.mp3` and captions JSON from Task 2.
- Produces: HyperFrames composition ID `main-video`, 15-second duration.

- [ ] **Step 1: Update root duration and audio ownership**

Set all root/sub-composition host durations to 15 seconds. Add framework-owned audio:

```html
<audio class="clip" data-start="0" data-duration="15" data-track-index="0" src="assets/atomic-habits-teaser.mp3"></audio>
```

Remove empty A-roll container and all HyperFrames survey/demo copy.

- [ ] **Step 2: Implement hook composition**

`intro.html` owns 0–2.5 seconds. Render `WHAT IF`, dominant gold `1%`, and `WAS ENOUGH?` with dark navy base. Use GSAP `power4.out`/`expo.out`; no elastic or bounce easing.

- [ ] **Step 3: Implement daily accumulation and payoff**

`stats.html` owns 2.5–11.5 seconds:

- Daily tiles `1.01`, `1.02`, `1.03`, `...`
- Electric-blue rising path
- Counter `1×` to `37×`
- Supporting copy `SMALL GAINS COMPOUND`

GSAP owns every animated transform; remove CSS transforms from animated targets.

- [ ] **Step 4: Implement CTA**

From 11.5 seconds, settle to:

```text
SMALL HABITS. BIG RESULTS.
WATCH THE FULL ATOMIC HABITS SUMMARY
EDU CHANNEL
```

Keep CTA visible through 15 seconds.

- [ ] **Step 5: Generate caption DOM from approved timing JSON**

`captions.html` embeds transcript as strict JSON with quoted keys and no trailing comma. Group into short phrases. Ensure only one caption card is visible at a time and all hides finish by 15 seconds.

- [ ] **Step 6: Add motion assertions**

Create:

```json
{
  "duration": 15,
  "assertions": [
    { "kind": "appearsBy", "selector": "#hook-percent", "bySec": 1.2 },
    { "kind": "before", "a": "#hook-percent", "b": "#payoff-37x" },
    { "kind": "appearsBy", "selector": "#payoff-37x", "bySec": 9.5 },
    { "kind": "appearsBy", "selector": "#cta", "bySec": 13.5 },
    { "kind": "staysInFrame", "selector": "#cta" }
  ]
}
```

- [ ] **Step 7: Run fast lint**

Run: `npm --prefix ChapterZero exec -- hyperframes@0.7.65 lint`

Expected: zero errors. Fix only warnings that affect this single-instance composition or render determinism.

---

### Task 4: Check, Inspect, Render, and Verify

**Files:**
- Generate: `ChapterZero/snapshots/*.png`
- Generate: `ChapterZero/renders/atomic-habits-teaser.mp4`

**Interfaces:**
- Consumes: completed Task 3 composition.
- Produces: final reviewed MP4.

- [ ] **Step 1: Run full HyperFrames gate with hero timestamps**

```bash
npm --prefix ChapterZero run check -- --snapshots --at 1.2,4.5,9.5,13.5
```

Expected: check passes with zero errors; runtime zero errors; contrast WCAG AA; motion assertions pass.

- [ ] **Step 2: Inspect four required snapshots**

Verify:

- 1.2s: `1%` dominates hook.
- 4.5s: daily tiles remain readable.
- 9.5s: `37×` dominates payoff.
- 13.5s: CTA is readable and branded.

If any frame contains survey copy, clipped text, duplicate captions, overlap, or off-frame shapes, edit owning composition and repeat Step 1.

- [ ] **Step 3: Render high-quality MP4**

```bash
npm --prefix ChapterZero run render -- --quality high --output renders/atomic-habits-teaser.mp4
```

Expected: nonempty MP4 produced.

- [ ] **Step 4: Verify media metadata**

```bash
ffprobe -v error -show_entries format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate -of json ChapterZero/renders/atomic-habits-teaser.mp4
```

Expected:

- H.264 video
- Audio stream present
- 1920×1080
- 30/1 FPS
- Duration near 15 seconds
- Nonzero size

- [ ] **Step 5: Run repository regression checks**

```bash
npm test
npm --prefix ui run build
node --check scripts/generate-atomic-habits-teaser.js
node --check lib/elevenlabs-tts.js
git diff --check
```

Expected: all pass; only known Windows line-ending warnings allowed.

- [ ] **Step 6: Request code review**

Run mandatory JavaScript and HyperFrames review against changed files. Apply only confirmed blockers, rerun Steps 1–5, then present clickable MP4 path.

---

## Self-Review Result

- Spec coverage: visual direction, script, ElevenLabs settings, caching, fallback, final-audio captions, HyperFrames structure, snapshots, render, and ffprobe all map to tasks.
- Placeholder scan: no incomplete implementation placeholders.
- Interface consistency: Task 1 adapter feeds Task 2 generator; Task 2 assets feed Task 3; Task 3 feeds Task 4.
- Scope: one independently testable teaser; full chapter, music, DeepSeek, portrait, upload, and A/B variants remain excluded.
