# Atomic Habits Editorial-Pop Teaser Design

**Date:** 2026-07-25
**Status:** Approved

## Goal

Adapt the existing ChapterZero HyperFrames composition into the first Edu Channel book-summary teaser: a 15-second Atomic Habits Chapter 1 video that communicates one memorable idea—1% daily improvement compounds to roughly 37× in one year—and directs viewers to the full summary.

## Deliverable

- 1920×1080 landscape MP4
- 30 FPS
- 15 seconds
- H.264 video with ElevenLabs narration
- Synchronized kinetic captions
- High-quality HyperFrames render
- No background music in this proof

## Visual Direction

Use **Editorial Pop**:

- Dark navy base for Edu Channel authority
- Gold for core insight and book identity
- Electric blue for growth/progression
- Pink for short beat accents and CTA framing
- Heavy editorial typography, strong number hierarchy, restrained shape accents
- No survey language, HyperFrames promotion, or generic creator-tool copy

Retain ChapterZero's useful composition structure, but replace its survey-specific visual content. Motion should feel energetic without elastic or bounce-heavy easing.

## Story and Timing

### Beat 1 — Hook, 0.0–2.5 seconds

**Narration:** “What if one percent was enough?”

**On-screen:** `WHAT IF 1% WAS ENOUGH?`

A large gold `1%` enters against dark navy. Supporting words reveal with restrained scale and opacity motion.

### Beat 2 — Daily accumulation, 2.5–7.0 seconds

**Narration:** “Get one percent better each day.”

**On-screen:** `1.01  ·  1.02  ·  1.03  ·  ...`

Daily tiles stack and advance left-to-right. Electric-blue path/curve begins rising. Captions stay in a dedicated lower safe zone and never duplicate main visual copy word-for-word.

### Beat 3 — Compounding payoff, 7.0–11.5 seconds

**Narration:** “After one year, you’re thirty-seven times better.”

**On-screen:** counter accelerates from `1×` to `37×`; supporting line `SMALL GAINS COMPOUND`.

The rising path resolves into a dominant gold `37×`. Motion peak lands on narration emphasis.

### Beat 4 — CTA, 11.5–15.0 seconds

**Narration:** “Small habits. Big results. Watch the full summary.”

**On-screen:**

- `SMALL HABITS. BIG RESULTS.`
- `WATCH THE FULL ATOMIC HABITS SUMMARY`
- Edu Channel mark

CTA holds long enough to read; no additional motion after final settle beyond a subtle living accent.

## Audio Design

Use ElevenLabs with a warm male premade narrator.

### Configuration

- API key: `ELEVENLABS_API_KEY` in ignored `.env`
- Voice: `ELEVENLABS_VOICE_ID`, configurable without code changes
- Model: configurable, defaulting to the current low-latency multilingual model supported by the account
- Output: WAV or high-quality MP3 accepted by HyperFrames/FFmpeg
- Stability: medium-low to preserve natural variation
- Similarity: high
- Style exaggeration: light
- Speaker boost: enabled when supported

No voice cloning. Edge TTS remains fallback when key, credits, voice, or API availability fails.

### Caching

Cache narration by hash of:

- Script text
- Voice ID
- Model ID
- Voice settings

A rerender with unchanged narration settings must not spend additional ElevenLabs credits.

### Failure Behavior

- Never print API key or authorization headers.
- Time out failed requests.
- Surface ElevenLabs error clearly.
- Fall back to Edge TTS only after logging fallback reason.
- Reuse cached successful narration even when ElevenLabs is unavailable.

## Caption Contract

Captions must derive from final narration audio timing, not estimated WPM.

- Scene-local timestamps
- Nonempty caption text
- No caption beyond 15-second composition duration
- Maximum readable phrase length
- Dedicated lower safe zone
- No overlapping caption cards
- Visual captions and optional SRT/VTT sidecar share same timing source

## Composition Architecture

Reuse ChapterZero project:

- `index.html`: 15-second root composition, audio track, shared background, and sub-composition mounts
- `compositions/intro.html`: hook and book/chapter identity
- `compositions/stats.html`: daily stack, rising path, and 37× payoff
- `compositions/captions.html`: synchronized narration captions
- New local narration asset under `assets/`

Do not add a second renderer, React layer, template framework, or general agent system. HyperFrames remains sole composition/render engine.

## Data Flow

1. Read approved teaser script.
2. Resolve cached narration key.
3. Generate ElevenLabs narration when cache misses; use Edge TTS fallback when necessary.
4. Obtain final word timing from audio transcription/alignment.
5. Write local narration and caption timing artifacts.
6. Generate/update ChapterZero composition content from approved fixed script and timings.
7. Run HyperFrames check with snapshots.
8. Inspect hook, buildup, payoff, and CTA frames.
9. Render high-quality MP4.
10. Verify media metadata with ffprobe.

## Validation

### Automated

- HyperFrames check passes with zero errors.
- Runtime reports zero console/network errors.
- Contrast passes WCAG AA.
- Motion remains seek-safe.
- Audio exists and has expected duration.
- MP4 contains H.264 video plus audio stream.
- Output is 1920×1080, 30 FPS, approximately 15 seconds.

### Visual

Inspect snapshots near:

- 1.2 seconds: hook hierarchy
- 4.5 seconds: daily tiles readable
- 9.5 seconds: 37× payoff dominant
- 13.5 seconds: CTA readable and branded

Reject clipped text, duplicate narration layers, caption overlap, off-frame shapes, stale survey copy, or empty space that weakens hierarchy.

## Out of Scope

- Full Atomic Habits chapter video
- Background music selection/licensing
- DeepSeek chapter generation
- Voice cloning
- Portrait/Shorts adaptation
- YouTube upload automation
- A/B variant generation

These can follow after this proof is reviewed.

## Acceptance Criteria

- Video clearly reads as an Edu Channel Atomic Habits teaser.
- Viewer understands `1% daily → 37× yearly` without external context.
- Warm male narration sounds natural and synchronized.
- CTA directs viewer to full Atomic Habits summary.
- No HyperFrames demo/survey content remains.
- Check, snapshots, render, and ffprobe verification pass.
