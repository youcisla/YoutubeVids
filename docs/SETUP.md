# Chapter Zero Studio — Local Setup

> The repo is `edu-channel` (local folder). The YouTube channel it serves is **Chapter Zero** → https://www.youtube.com/@chapterzer.

This is the only doc you need. It walks you from "I just cloned the repo" to "I have a working local app that can publish to YouTube."

**If anything in this doc is wrong, edit it.** This is a living document, not a manual.

---

## 0. TL;DR — the five commands

```bash
git clone https://github.com/youcisla/YoutubeVids.git edu-channel
cd edu-channel
npm install
npm run setup:all
npm run ui
```

Then open http://localhost:5173. That's the app. `npm run setup:all` runs every step below that can be automated. Skip to **§5 YouTube upload** only if you want to publish (not required to render locally).

---

## 1. Prerequisites — install these once

| Tool | What it's for | Install |
|---|---|---|
| **Node.js 22+** | App runtime, Vite UI, all build scripts | https://nodejs.org (LTS) |
| **Python 3.10+** | Kokoro TTS runs through a Python subprocess (`kokoro-onnx`) | https://python.org |
| **ffmpeg + ffprobe** | Audio transcode (wav → mp3), video assembly, ffprobe for duration checks | https://ffmpeg.org — must be on `PATH` |
| **edge-tts** *(optional)* | Fallback TTS if Kokoro ever fails. Kokoro is the primary; edge-tts is a safety net. | `pip install edge-tts` |
| **Git** | Clone + push | https://git-scm.com |

### Quick install commands

**Windows (PowerShell, as admin):**
```powershell
winget install OpenJS.NodeJS.LTS Python.Python.3.12 Gyan.FFmpeg
pip install edge-tts
```

**macOS:**
```bash
brew install node python ffmpeg
pip3 install edge-tts
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install nodejs python3 python3-pip ffmpeg
pip3 install edge-tts --break-system-packages
```

After install, **open a new terminal** so the new `PATH` entries take effect. Verify:
```bash
node --version    # v22+
python --version  # 3.10+
ffmpeg -version
pip --version
```

If any of these say "command not found" — you have a `PATH` problem. Restart your terminal. If still broken, see **§7 Troubleshooting**.

---

## 2. Clone + install

```bash
git clone https://github.com/youcisla/YoutubeVids.git edu-channel
cd edu-channel
npm install
```

`npm install` pulls in `googleapis` (YouTube Data API) and `sharp` (thumbnail generation). It's quick (<1 min on a normal connection).

---

## 3. One-time environment setup

```bash
npm run setup:all
```

This single command does all of:

1. **Checks** Node, Python, ffmpeg, ffprobe, edge-tts, hyperframes — prints a green ✓ or red ✗ for each
2. **`pip install kokoro-onnx soundfile`** — Python TTS runtime
3. **Downloads the Kokoro ONNX model + voices** (338MB, ~1-2 min on a normal connection) into `models/kokoro/`
4. **Scaffolds `.env`** from `.env.example` if missing
5. **Prints the 2 manual steps** that can't be automated (YouTube OAuth, start the app)

Re-runnable. Idempotent. Will not re-download the model if it's already there.

---

## 4. Start the app

```bash
npm run ui
```

This starts two things in parallel:
- The **Vite dev server** (React UI) on `http://localhost:5173`
- The **Express backend** (`ui/server.cjs`) on `http://127.0.0.1:3001` — the UI proxies `/api/*` to it

Open `http://localhost:5173` in your browser. The UI loads. The backend serves book chapters, config, and build jobs.

**To stop the app:** `Ctrl+C` in the terminal.

---

## 5. YouTube upload (only if you want to publish)

The app uses the official **YouTube Data API v3** with OAuth2 — no scraping, no vulnerable deps. One-time setup per Google account.

### 5.1 Create Google Cloud credentials

1. Go to https://console.cloud.google.com/apis/credentials (log in with the Google account that owns the Chapter Zero channel)
2. **Create a project** (or pick an existing one) — call it "Chapter Zero Studio" or whatever
3. **Enable YouTube Data API v3**: https://console.cloud.google.com/apis/library — search for "YouTube Data API v3" → Enable
4. **Configure OAuth consent screen**: APIs & Services → OAuth consent screen → External → fill in app name + your email as support/dev contact → add scope `https://www.googleapis.com/auth/youtube.upload` → add your Google account as a **Test User** (the channel owner) → save
5. **Create OAuth client ID**: APIs & Services → Credentials → Create Credentials → OAuth client ID → **Desktop app** → name it "Chapter Zero Local" → Create
6. Copy the **Client ID** and **Client Secret** that appear

### 5.2 Put them in `.env`

Open `.env` in the repo root and fill in:

```env
YT_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
YT_CLIENT_SECRET=your-client-secret-here
```

### 5.3 Run the one-time browser auth

```bash
npm run yt:auth
```

This opens a browser to Google's OAuth screen. Log in with the channel-owner Google account. You'll see a code. Paste it back into the terminal. The script writes a `YT_REFRESH_TOKEN=...` line into your `.env`.

You're done. From now on, the app can upload to YouTube headlessly with no further browser interaction.

### 5.4 Verify

```bash
node build-chapter.js --book atomic-habits --chapter 1 --upload
```

If it renders, captions, and uploads successfully — you have a fully working pipeline. Skip to **§6 Usage** for the day-to-day workflow.

---

## 6. Usage

Once `npm run ui` is running and (optionally) YouTube is set up:

### 6.1 Add a new book

Books live in `books/{book-slug}/` with this structure:

```
books/
  my-new-book/
    cover.svg          # 500x720+ book cover (SVG or PNG)
    chapter-01.json
    chapter-02.json
    ...
```

Each `chapter-NN.json` looks like:

```json
{
  "book_title": "My New Book",
  "cover_ext": "svg",
  "chapter": 1,
  "chapter_title": "The first chapter title",
  "narration_script": "Full narration text for the chapter. Sentences are split into scenes by natural pauses — periods, question marks, em-dashes. The first sentence is the hook.",
  "scene_count": 7,
  "scenes": [
    {
      "index": 0,
      "timestamp_end": 20,
      "duration": 22,
      "narration_text": "If you get one percent better each day...",
      "html": "<h1 class=\"h1\">...</h1>",
      "animations": "tl.from(R+' .h1', ...)",
      "captions": [{"start": 0, "end": 4, "text": "If you get one percent better each day"}]
    }
  ]
}
```

The first 4 fields are mandatory. The `scenes` array is the visual choreography (see `books/atomic-habits/` for the full pattern). For a basic chapter, you can have just 1 scene that spans the whole duration.

### 6.2 Render a single chapter

**Via UI:** open the app → pick the book → pick the chapter → check "Build" → click **Build**.

**Via CLI:**
```bash
node build-chapter.js --book my-new-book --chapter 1
```

The output lands in `pilot/dist/my-new-book_Ch01.mp4`. Watch the live log in the UI for the full pipeline (TTS → render → upload).

### 6.3 Render a whole book and upload

```bash
node build-chapter.js --batch my-new-book --upload
```

Renders every chapter sequentially. The `--upload` flag pushes each one to YouTube when it finishes.

### 6.4 Customization

- **Voice:** `config.json` → `voice` field. Default is `en-US-ChristopherNeural` (edge-tts fallback). Kokoro uses `am_adam` (ElevenLabs-Adam-like deep US male) — the primary engine, set via `KOKORO_VOICE` env var.
- **Resolution:** `config.json` → `canvas_width` / `canvas_height` (1920×1080 default).
- **Background music:** `config.json` → `bg_music` (path to an audio file or `null`).
- **Per-chapter pacing:** edit `TEASER_TEXT` in `scripts/generate-atomic-habits-teaser.js` for the teaser, or rewrite the chapter's `narration_script`.

---

## 7. Troubleshooting

### "ffmpeg not found"

Restart your terminal after installing ffmpeg. If still broken, find where it installed and add to PATH:
- Windows: `C:\ffmpeg\bin` is typical
- macOS with brew: should be on PATH automatically
- Linux: usually `/usr/bin/ffmpeg`

Test: `ffmpeg -version` should print a banner.

### "Cannot find module '../lib/omnivoice-tts'"

You're on an old commit. OmniVoice support was removed in favor of Kokoro. Pull the latest:
```bash
git pull origin main
npm install
```

### Kokoro model fails to download (HTTPS cert error on Windows)

The downloader uses `curl --ssl-no-revoke` to work around Windows cert store issues. If you still hit one, re-run with the URL manually:
```bash
curl -L --ssl-no-revoke -o models/kokoro/kokoro-v1.0.onnx https://huggingface.co/fastrtc/kokoro-onnx/resolve/main/kokoro-v1.0.onnx
curl -L --ssl-no-revoke -o models/kokoro/voices-v1.0.bin https://huggingface.co/fastrtc/kokoro-onnx/resolve/main/voices-v1.0.bin
```

### UI loads but every action errors

Backend isn't running. Check the terminal where you ran `npm run ui` — the Express server line should show:
```
ui server listening on 127.0.0.1:3001
```

If missing, look for the error. The most common cause: port 3001 already in use. Kill the process or change the port in `ui/vite.config.ts` and `ui/server.cjs`.

### Render hangs forever

Check `pilot/dist/` for partial output. If HyperFrames is the slow step, it's normal (~60s per chapter). If it's stuck on Kokoro for >2 min, the model might be in a stuck state. Kill the process and re-run.

### YouTube upload fails with "403 access_denied"

The OAuth test-user list doesn't include the account you're uploading as. Go to Google Cloud Console → OAuth consent screen → Test users → add the Google account email that's the channel owner → save → re-run.

### "Port 5173 already in use"

Vite picks a different port if 5173 is taken — check the terminal output. Or kill the conflicting process.

### Want to wipe and start over

```bash
rm -rf node_modules models .env
npm install
npm run setup:all
```

`models/kokoro/` and `.env` will be rebuilt from scratch.

---

## 8. What's where

| Path | What lives here |
|---|---|
| `books/{book}/chapter-NN.json` | Chapter data: script, scenes, captions, animations |
| `books/{book}/cover.svg` | Book cover image (used in thumbnails) |
| `ChapterZero/` | HyperFrames project — the actual rendered video compositions |
| `ChapterZero/renders/` | Rendered MP4s (output) |
| `lib/` | Shared TTS, env loader, contract validators |
| `scripts/` | `setup-all.js`, `setup-models.js`, `generate-atomic-habits-teaser.js`, etc. |
| `ui/` | React app + Express backend |
| `models/kokoro/` | Kokoro ONNX model + voices (gitignored, downloaded) |
| `whisper-captions.js` | Whisper-based caption generation (alternative to chapter-supplied captions) |
| `pilot/dist/` | Build pipeline output (MP4s) |
| `build-chapter.js` | CLI entry point for the full per-chapter build |
| `config.json` | Render config: voice, resolution, fps, etc. |
| `docs/SETUP.md` | This file |
| `docs/USER_GUIDE.md` | UI walkthrough once the app is running |

---

## 9. Still stuck?

- Re-read **§7 Troubleshooting** above — most common issues are covered
- Check `docs/HOW_IT_WORKS.md` for the architecture deep-dive
- Check `docs/USER_GUIDE.md` for UI-specific walkthroughs
- The Kokoro model is the biggest moving part — if TTS is broken, re-run `npm run setup:models`
