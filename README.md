# Chapter Zero Studio

> Local repo name is `edu-channel`. The **YouTube channel it serves is "Chapter Zero"** → https://www.youtube.com/@chapterzer.

Programmatic video pipeline that turns structured JSON chapter data into polished, narrated, captioned YouTube videos. No stock footage, no human faces, no AI slop — every frame is a HyperFrames + GSAP + FFmpeg render of HTML you control.

**Static UI preview:** https://chapter-zero-studio.vercel.app *(Vercel deploys the React UI as a showcase — it has no backend, so build actions are disabled there. To use the app for real, run it locally.)*

## What it does

`books/{book}/chapter-NN.json` → `node build-chapter.js --book X --chapter N` →

1. **Kokoro TTS** (`am_adam` — deep, documentary US male) renders the narration script
2. **ffmpeg** transcodes wav → mp3
3. **SRT sidecar** written for YouTube's auto-caption indexer
4. **Sharp + SVG** builds a 1280×720 thumbnail (book cover + title + chapter badge)
5. **HyperFrames** renders the visual choreography (HTML + GSAP timeline)
6. **Optional** YouTube upload via Data API v3 OAuth2

## Run it locally

**Full local setup:** see **[docs/SETUP.md](docs/SETUP.md)** (the only doc you need to install and run).

**Day-to-day usage:** see **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** (UI walkthrough, adding books, troubleshooting).

### 30-second start (if you already have everything installed)

```bash
git clone https://github.com/youcisla/YoutubeVids.git edu-channel
cd edu-channel
npm install
npm run setup:all   # one-time: pip deps + 338MB model + .env
npm run ui          # → http://localhost:5173
```

## Render from the CLI (no UI)

```bash
# One chapter
node build-chapter.js --book atomic-habits --chapter 1

# Whole book, upload each chapter to YouTube
node build-chapter.js --batch atomic-habits --upload
```

## Why this exists

- **Atomic Habits** is the first book. The plan is to publish every book that makes sense for the format. See `books/atomic-habits/` for the reference chapter shape.
- **TTS is Kokoro** because ElevenLabs is paid and F5-TTS needs a GPU. Kokoro is local, free, light on CPU, and `am_adam` matches the documentary-male tone of the brand. See `lib/kokoro-tts.js` + `scripts/kokoro_synth.py`.
- **Visuals are HTML + GSAP**, not stock footage. Same JSON → same video, every time. No licensing, no AI slop.
- **Captions are burned-in** for retention + separate SRT for SEO.

## Repo layout

```
edu-channel/
├── books/{book}/chapter-NN.json   # Input — one JSON per chapter
├── build-chapter.js                # CLI pipeline
├── ui/                             # React + Vite dashboard (Express backend)
├── lib/                            # Shared: TTS, env, contracts
├── scripts/                        # Teaser generator, model downloader, setup
├── ChapterZero/                    # HyperFrames project + rendered MP4s
├── docs/
│   ├── SETUP.md                    # Local install (one-shot, follow this)
│   ├── USER_GUIDE.md               # UI walkthrough + day-to-day
│   └── HOW_IT_WORKS.md             # Architecture deep-dive
├── config.json                     # Voice, resolution, fps, music
├── vercel.json                     # Vercel deploy (ui/ as static SPA)
└── .env                            # YouTube OAuth (gitignored)
```

## Voice

- **Primary:** Kokoro `am_adam` (ElevenLabs-Adam-alike, deep US male documentary, free, local)
- **Fallback:** `edge-tts` `en-US-ChristopherNeural` (used if Kokoro fails or model missing)
- **Override:** `KOKORO_VOICE` env var. Try `am_michael`, `bm_george` (UK) for variation.

## License

MIT — see [LICENSE](LICENSE).
