# edu-channel — Faceless Book Summary YouTube Pipeline

Local repo name is `edu-channel`. The **YouTube channel is "Chapter Zero"** → https://www.youtube.com/@chapterzer.

Programmatic video pipeline that turns structured JSON chapter data into polished, narrated, captioned YouTube videos. Each book = a playlist of chapter videos, rendered via **HyperFrames + GSAP + FFmpeg + Kokoro TTS (am_adam)** — no stock footage, no human faces, no AI slop.

## Quick Start

```bash
# Install dependencies (incl. sharp for thumbnail generation)
npm install

# Download the Kokoro TTS model (~338MB, on first run only)
npm run setup:models

# Generate one chapter
node build-chapter.js --book atomic-habits --chapter 1

# Batch all chapters of a book
node build-chapter.js --batch atomic-habits

# Render + upload to YouTube in one pass
node build-chapter.js --batch atomic-habits --upload
```

> The Kokoro ONNX model and voices.bin live under `models/kokoro/` and are
> **not committed to git** (Kokoro is 310MB, exceeds GitHub's 100MB push
> limit). `npm run setup:models` downloads them from
> `huggingface.co/fastrtc/kokoro-onnx` and is idempotent — safe to re-run.
> Re-download any time by deleting the directory.

## What You Need

| Dependency | Install |
|---|---|
| **Node.js 22+** | https://nodejs.org |
| **FFmpeg + FFprobe** | https://ffmpeg.org (must be on PATH) |
| **edge-tts** | `pip install edge-tts` |
| **HyperFrames CLI** | `npm install -g hyperframes` (or npx auto-fetches) |
| **faster-whisper** *(optional, for auto-captions)* | `uv pip install faster-whisper` |

## YouTube Upload Setup (one-time)

The pipeline uses the official **YouTube Data API v3** with OAuth2 (no puppeteer, no vulnerable deps).

1. Go to https://console.cloud.google.com/apis/credentials
2. Create credentials → **OAuth client ID** → **Desktop app**
3. Enable **YouTube Data API v3**
4. Add your Google account as a **Test User** (OAuth consent screen)
5. Copy your `Client ID` and `Client Secret` into `.env`:

```bash
cp .env.example .env
# Edit .env — fill YT_CLIENT_ID and YT_CLIENT_SECRET
```

6. Run the auth flow once:

```bash
npm run yt:auth
# Browser opens → log in → prints YT_REFRESH_TOKEN
# Paste it into .env
```

7. Now `--upload` works headlessly forever.

## Architecture

```
books/{book}/chapter-{N}.json
    ↓ build-chapter.js
    ├─ edge-tts → narration.wav (full chapter audio)
    ├─ ffprobe → exact audio duration
    ├─ FFmpeg → 5–7 scene WAV clips (frame-accurate split)
    ├─ whisper-captions.js → word-level timestamps (or fallback .srt)
    ├─ scene_base.html + scene content → rendered MP4 per scene
    │   (parallel batches of 4, pre-flight font/image load guard)
    ├─ GSAP kinetic captions injected (word-by-word, frame-snapped)
    ├─ FFmpeg concat → final MP4
    ├─ Optional: background music with auto-ducking (sidechaincompress)
    └─ FFmpeg → thumbnail (frame at 2s)
```

### Why HTML/GSAP (not stock footage or MoviePy)

- **Pixel-perfect control** over layout, typography, motion
- **Reusable templates** — `scene_base.html` is the single source of truth
- **Deterministic** — same JSON always produces the same video
- **Zero asset sourcing** — no Pexels/Pixabay API calls, no copyright issues
- **Web tech** — if you can build a landing page, you can build a video

## Directory Structure

```
edu-channel/
├── config.json              # Voice, WPM, fps, quality, music, YouTube
├── build-chapter.js         # Main pipeline script
├── whisper-captions.js      # Auto-caption generation
├── .env                     # YouTube OAuth credentials (gitignored)
├── .env.example             # Template — copy to .env
├── scripts/
│   └── yt-auth.mjs          # One-time OAuth flow
├── brand-kit/
│   └── DESIGN.md            # Visual identity spec
├── books/
│   └── {book-name}/
│       ├── cover.{jpg|svg}
│       ├── chapter-01.json
│       └── ...
├── pilot/
│   ├── scenes/
│   │   └── scene_base.html  # Reusable template
│   └── dist/                # Output MP4s + thumbnails
└── ui/                      # React dashboard (optional)
```

## Chapter Data Format

```json
{
  "book_title": "Atomic Habits",
  "cover_ext": "svg",
  "chapter": 1,
  "chapter_title": "The Surprising Power of Tiny Gains",
  "narration_script": "Full TTS script...",
  "scenes": [
    {
      "index": 0,
      "timestamp_end": 20,
      "duration": 22,
      "narration_text": "Scene narration...",
      "html": "<h1 class=\"h1\">Key phrase</h1><div class=\"divider\"></div>",
      "animations": "tl.to('#orb-1',{...}); tl.from(R+' .h1',{...});",
      "captions": [
        { "start": 0.0, "end": 4.0, "text": "Caption line" }
      ]
    }
  ]
}
```

- `timestamp_end` values are **cumulative** (scene 0 ends at 20s, scene 1 at 45s, etc.)
- `html` = visual content only (title, badge, divider, optional visual element). **No body text** — captions handle the spoken words.
- `animations` = GSAP timeline calls. `R` is the composition selector.
- `captions` = manually timed OR Whisper-generated (auto if `--no-whisper` not passed)

## Config

`config.json`:

```json
{
  "voice": "en-US-GuyNeural",
  "voice_rate": "-3%",
  "wpm": 164,
  "fps": 30,
  "quality": "high",
  "canvas_width": 1920,
  "canvas_height": 1080,
  "bg_music": null,
  "youtube": { "publish_type": "public", "upload_as_draft": true }
}
```

- `bg_music`: path to a music file (relative to project root). When set, music is auto-mixed with sidechain ducking under narration. `null` = no music.
- `voice_rate`: `-3%` ≈ 164 WPM (research-backed sweet spot for calm, authoritative delivery)

## Flags

| Flag | Effect |
|---|---|
| `--book <name>` | Book directory under `books/` |
| `--chapter <num>` | Chapter number |
| `--batch <name>` | Render all chapters of a book |
| `--keep-temp` | Keep temp files for debugging |
| `--no-whisper` | Skip Whisper, use manual `.srt` from JSON |
| `--upload` | Upload finished MP4 to YouTube |
| `--help` | Show usage |

## Brand Kit

`brand-kit/DESIGN.md` defines:
- **Space Grotesk** (headings) + **Inter** (body)
- **Hearth gold** `#FACC15` accent
- **Midnight** `#0A0D16` base
- Animated radial-gradient orbs (gold/violet/emerald) as background
- `power4.out` easing, staggered entrances

## UI Dashboard (optional)

A React + Vite dashboard for visual control:

```bash
npm run ui
# Opens http://localhost:5173
# Edit config, browse chapters, build, watch live logs, download MP4
```

## License

MIT — see [LICENSE](LICENSE).
