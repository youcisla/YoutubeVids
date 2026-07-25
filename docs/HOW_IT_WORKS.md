# How edu-channel Works

This document is the single source of truth for the project. Read it once, top to bottom. After that you can run the pipeline, swap voices, change the book, fix anything that breaks, and add chapters — without my help.

If you ever feel lost: read the section **"How do I make one chapter?"** first. It is the shortest path from "I want a video" to "video on YouTube".

---

## 1. What this project produces

A 15-second, 1920×1080, 30 FPS, narrated teaser video per book chapter, ready to upload to YouTube.

The audio is synthesized (ElevenLabs, with an automatic Edge TTS fallback when ElevenLabs is unavailable or out of credits), captions are derived from that same audio, and visuals are generated from a hand-authored HyperFrames composition.

The renderer is **HyperFrames** (a single Chromium-based engine). We do not build or maintain a renderer; we author HTML+GSAP timelines and HyperFrames renders them. **Never edit anything in this project to replace or wrap HyperFrames** — it is the chosen render engine and changing it requires rewriting every composition.

---

## 2. Repository layout (the only files you need to know)

```
edu-channel/
├── .env                  # your secrets (gitignored). Read by every script.
├── config.json           # pipeline config (voice rate, FPS, quality, …).
├── package.json          # root scripts: yt:auth, ui, test.
│
├── lib/                  # shared utilities, no behavior on their own
│   ├── contracts.js         # validates config.json keys/types
│   ├── chapter-contract.js  # validates chapter JSON files
│   ├── elevenlabs-tts.js    # ElevenLabs HTTP adapter
│   └── env.js               # loadRootEnv(): reads .env into process.env
│
├── scripts/              # the only entry points you run by hand
│   ├── yt-auth.mjs          # one-time YouTube OAuth2 → prints refresh token
│   └── generate-atomic-habits-teaser.js   # generates teaser narration + captions
│
├── tests/                # node:test, run via `npm test`
│
├── ui/                   # the React Studio (local web UI). Not required for the pipeline.
│
├── ChapterZero/          # a HyperFrames project: a single composition that
│   ├── index.html            # renders the 15-second teaser
│   ├── index.motion.json     # motion assertions the gate verifies
│   ├── compositions/         # sub-compositions: hook, daily tiles, captions
│   ├── assets/               # generated audio + captions JSON
│   ├── renders/              # final MP4 output
│   └── snapshots/            # per-frame previews for visual review
│
├── docs/                 # design docs and plans (this file lives here)
│
└── books/                # chapter JSON corpus
    └── atomic-habits/
        ├── chapter-01.json
        ├── chapter-02.json
        └── …
```

**You should not need to touch** `lib/`, `ui/`, `build-chapter.js`, `whisper-captions.js`, or `config.json` to make or upload one chapter. Those are the deeper pipeline we are migrating from. The current teaser pipeline (`scripts/` + `ChapterZero/`) is the path that works today.

---

## 3. How do I make one chapter? (the canonical workflow)

For the Atomic Habits teaser that already exists, run these four steps in order.

### Step 1 — Confirm your credentials are loaded

```powershell
node -e "const {loadRootEnv}=require('./lib/env');loadRootEnv();console.log('YT_CLIENT_ID set:', !!process.env.YT_CLIENT_ID);console.log('ELEVENLABS_API_KEY set:', !!process.env.ELEVENLABS_API_KEY);console.log('ELEVENLABS_VOICE_ID set:', !!process.env.ELEVENLABS_VOICE_ID);"
```

Expected: three `true` lines. If any is `false`, edit `.env` and rerun.

### Step 2 — Generate narration and captions (≈ 5 s)

```powershell
node scripts/generate-atomic-habits-teaser.js
```

What this does:

1. Reads your `.env` via `lib/env.js`.
2. Computes a cache key from `{text, voice_id, model_id, voice_settings}`. If `ChapterZero/assets/atomic-habits-teaser.mp3` exists and its metadata sidecar matches, the script reuses the cached file (no ElevenLabs credits spent).
3. Otherwise calls ElevenLabs and writes `ChapterZero/assets/atomic-habits-teaser.mp3` plus `.meta.json`.
4. Reads the service-generated `.srt` sidecar (ElevenLabs and Edge TTS both produce one) and writes `ChapterZero/assets/atomic-habits-teaser.captions.json` with 6 scene-relative captions.
5. The script fails loudly if any step produces zero output.

To force a regeneration (e.g. you changed the script text or voice settings), pass `--force`:

```powershell
node scripts/generate-atomic-habits-teaser.js --force
```

### Step 3 — Render the video (≈ 1 minute)

```powershell
npm --prefix ChapterZero run render -- --quality high --output renders/atomic-habits-teaser.mp4
```

The result lands at `ChapterZero/renders/atomic-habits-teaser.mp4`. The output is a self-contained MP4 with the narration audio baked in; no separate audio file is needed at upload time.

### Step 4 — Upload to YouTube

```powershell
node build-chapter.js --book atomic-habits --chapter 1 --upload
```

This uses the cached token in `.env` to upload through the YouTube Data API v3.

---

## 4. YouTube auth (the part that said "Set env vars first")

Until you run `yt:auth` once, `YT_REFRESH_TOKEN` is empty and uploads fail. The fix was already shipped:

- `scripts/yt-auth.mjs` now calls `loadRootEnv()` from `lib/env.js`. The credentials in `.env` are picked up automatically.
- Run `npm run yt:auth` (or `node scripts/yt-auth.mjs`).
- The script opens your browser to a Google login page.
- After you log in, Google shows you an "allow access" screen.
- Your browser hands the script a `code` at `http://localhost:3000/?code=...`.
- The script exchanges the `code` for a refresh token and prints it on stdout.
- Copy the `YT_REFRESH_TOKEN=...` line into your `.env`.

After that, `YT_REFRESH_TOKEN` is filled in and every subsequent `node build-chapter.js ... --upload` works without re-auth.

You do this **once per Google account**. Re-run `yt:auth` only if you revoke the token in Google Cloud Console.

---

## 5. Voice and credits

`ELEVENLABS_VOICE_ID` in your `.env` controls the voice. The default is `IRHApOXLvnW57QJPQH2P` (Adam, dark American male). To change voice:

1. Pick a voice from the ElevenLabs Voice Library. Each voice has a permanent ID like `IRHApOXLvnW57QJPQH2P`.
2. Replace the value of `ELEVENLABS_VOICE_ID` in `.env`.
3. Run `node scripts/generate-atomic-habits-teaser.js --force`.

Free-tier ElevenLabs accounts have a monthly character quota. The premium voice Adam consumes the quota faster than the default voice. If ElevenLabs returns HTTP 402, the script **automatically falls back to Edge TTS** using Microsoft's free "en-US-GuyNeural" voice. The teaser is regenerated, captions are re-parsed, and rendering still works. You can re-run after credits reset to get the ElevenLabs voice.

**How to tell which voice is in the current file:** read `ChapterZero/assets/atomic-habits-teaser.meta.json` → field `provider`. `elevenlabs` means Adam; `edge-tts` means Guy.

**How to verify your account state without leaking the key:**

```powershell
node -e "const r=require('node:https').request({host:'api.elevenlabs.io',path:'/v1/voices',method:'GET',headers:{'xi-api-key':require('fs').readFileSync('.env','utf8').match(/ELEVENLABS_API_KEY=(.*)/)[1].trim()}}); r.on('response',res=>console.log('voices API status:',res.statusCode)); r.end()"
```

Status 200 = key valid. Status 401 = key invalid. Status 402 = out of credits.

---

## 6. The 15-second composition (ChapterZero)

The composition is a single HTML page plus three sub-compositions. They live at:

- `ChapterZero/index.html` — root, 15 seconds, owns the narration `<audio>`, dark-navy background, and three `<div data-composition-src>` mounts.
- `ChapterZero/compositions/intro.html` — owns the hook (0–2.5 s) and the CTA end card (11.6–15 s).
- `ChapterZero/compositions/stats.html` — owns the daily accumulation and the `1×→37×` payoff (2.5–11.5 s).
- `ChapterZero/compositions/captions.html` — owns the kinetic captions. The 6 timing entries are inline JSON at the top of the file.

### Beat map (the contract)

| Time | What the viewer sees | What the viewer hears |
|---|---|---|
| 0.0–2.5 s | "WHAT IF / 1% / WAS ENOUGH?" in cream + gold | "What if one percent was enough?" |
| 2.5–7.0 s | Daily tiles 1.01, 1.02, 1.03, … and a rising electric-blue path | "Get one percent better each day." |
| 7.0–11.5 s | Counter animates 1× → 37× | "After one year, you're thirty-seven times better." |
| 11.5–15 s | "SMALL HABITS. BIG RESULTS. / WATCH THE FULL ATOMIC HABITS SUMMARY / EDU CHANNEL" | "Small habits. Big results. Watch the full summary." |

### Composition rules (the rules HyperFrames enforces; not arbitrary)

- Every animated element needs `data-start`, `data-duration`, `data-track-index`.
- Timelines must be paused and registered on `window.__timelines["<composition-id>"]`.
- GSAP owns every animated transform. CSS transforms are allowed only on non-animated layout wrappers.
- Easing is restricted to `power2`, `power3`, `power4`, `expo`. **No elastic, no back, no bounce** (advisory).
- Captions live in a dedicated lower safe zone; one card visible at a time.

`ChapterZero/index.motion.json` declares the motion assertions HyperFrames verifies:

- `#hook-percent` is visible by 1.2 s
- `#payoff-37x` appears by 9.5 s and `#hook-percent` comes before it
- `#cta` appears by 13.5 s and stays in frame

### How to change the script

Open `scripts/generate-atomic-habits-teaser.js` and edit the `TEASER_TEXT` constant. The `validateCaptions` function clamps every caption to the 15-second duration, so you can keep the same beat count. After saving, run with `--force` to regenerate audio and re-render.

### How to change the visuals

Edit the HTML files in `ChapterZero/compositions/` and the root `ChapterZero/index.html`. HyperFrames' `npm --prefix ChapterZero run check -- --snapshots` will lint, run a runtime audit, and save one PNG per sample timestamp. Open the PNGs and verify the result before running render.

---

## 7. Troubleshooting

### "Set YT_CLIENT_ID and YT_CLIENT_SECRET env vars first"
Already fixed in this repo: `scripts/yt-auth.mjs` now reads `.env` via `lib/env.js`. If you see this again, run `node -e "console.log(require('fs').readFileSync('.env','utf8'))"` to confirm `.env` still exists and is on disk.

### ElevenLabs returns 402
Free-tier quota exceeded for the selected voice. The pipeline falls back to Edge TTS automatically. Re-run after your quota resets; the same script regenerates with the ElevenLabs voice and no manual fix is needed.

### HyperFrames render is silent (no audio in the MP4)
Open `ChapterZero/index.html` and confirm the audio element has an `id`:

```html
<audio id="narration-audio" class="clip" data-start="0" data-duration="15" data-track-index="0" src="assets/atomic-habits-teaser.mp3"></audio>
```

Without `id`, HyperFrames still parses the element but skips it in the rendered timeline.

### Captions drift from audio
The caption timeline is generated from the same SRT the TTS service produced. If you change `TEASER_TEXT` or the voice, run `node scripts/generate-atomic-habits-teaser.js --force` so both the audio and the captions are regenerated together. Mixing old captions with new audio is the most common cause of drift.

### `git diff --check` shows LF→CRLF warnings
Expected on Windows. HyperFrames and our test runner are fine with it. Do not re-encode the files unless you also update `.gitattributes`.

### Render is slow or fails on a long chapter
HyperFrames captures 30 frames per second of timeline. A 15-second teaser at 1920×1080 takes about one minute. A 60-second chapter takes about four minutes. If you need something faster, render at `--quality draft` and re-render at `--quality high` once you approve the draft.

### I need to swap voices mid-project
1. Update `ELEVENLABS_VOICE_ID` in `.env`.
2. Run `node scripts/generate-atomic-habits-teaser.js --force`.
3. Render and review. The cache is keyed on the voice ID, so the new audio writes immediately.

---

## 8. Adding a second book

This repo currently has one teaser for Atomic Habits Chapter 1. To add a new book, copy the `ChapterZero` directory and edit:

- `ChapterZero-<new>/index.html` (composition id, asset paths)
- `ChapterZero-<new>/compositions/*.html` (copy and rewrite per book)
- `scripts/generate-<new>-teaser.js` (copy and rewrite `TEASER_TEXT`)
- Add the book to the upload workflow in `build-chapter.js` (existing path; one line per chapter)

The narration, caption, and render steps are identical to Atomic Habits. The voice and voice settings stay shared from `.env` so you do not duplicate configuration.

---

## 9. What NOT to do

- **Do not paste the ElevenLabs API key into any committed file** (or any chat). It belongs only in `.env`, which is gitignored.
- **Do not run `yt:auth` more than once for the same Google account** unless the token was revoked. Each run produces a new refresh token; old ones remain valid until explicitly revoked.
- **Do not introduce a second renderer** (Remotion, ffmpeg-only pipeline, anything else). HyperFrames is the only render path. The `lib/`, `ui/`, and `build-chapter.js` surface exists to be migrated onto the same HyperFrames pattern, not to add alternatives.
- **Do not delete the existing `atomic-habits-teaser.*` files** without re-running the generator. The composition mounts them by exact filename.
- **Do not commit `.env`** or `*.srt` files generated into `ChapterZero/assets/` for personal runs; they are gitignored.

---

## 10. Where to ask questions

This file is the answer to 80% of "how do I…?" questions. For the rest:

- Re-read the section that addresses the question. Most of the time the answer is in step 1 of a subsection.
- Run `npm test` and look at the output. Most of the time a test will name the file and line of a recent regression.
- Check `.superpowers/sdd/task-N-report.md` for the latest implementation notes.

If something still does not work after that, capture the exact command, exit code, and first 20 lines of output. That is enough to debug without re-running the whole pipeline.
