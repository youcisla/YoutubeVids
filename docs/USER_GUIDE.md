# Chapter Zero Studio — User Guide

You're past setup (see [SETUP.md](SETUP.md)). The app is running at http://localhost:5173. Here's what to do next.

## The two-tab layout

The UI has two tabs in the top right:

- **Build** — render chapters, see live logs, watch the output preview
- **Config** — edit `config.json` (voice, resolution, fps, etc.)

## Build tab — left side

### Sidebar (far left)

Lists all books in `books/`. Click a book to see its chapters. Click a chapter to select it for build.

### Build Controls

Once you pick a book + chapter, you get three flags:

| Flag | What it does |
|---|---|
| **Keep temp files** | Don't delete the temp directory after build (for debugging) |
| **No whisper** | Skip the auto-captioning pass (use the chapter JSON's manual captions instead) |
| **Upload to YouTube** | Push the final MP4 to the channel when build finishes |

Click **Build** to start. The build pipeline runs in this order:
1. TTS synthesis (Kokoro `am_adam`)
2. MP3 transcode (wav → mp3 via ffmpeg)
3. SRT sidecar generation
4. Thumbnail generation
5. HyperFrames render
6. Final video assembly

## Build tab — right side

### Live Log

A live-updating feed of every step the pipeline takes. Same output you'd see in the terminal — useful for debugging when something hangs or fails.

Look here first if a build is taking forever. The most common bottleneck is Kokoro (~30-90s depending on chapter length, CPU-only) and HyperFrames render (~60s).

### Output Preview

The final MP4 appears here when the build finishes. The video tag lets you play it inline. Right-click to download, or it's already at `pilot/dist/{book}_Ch{NN}.mp4`.

## Config tab

Every field in `config.json` is editable here. Hover over a field for a tooltip explaining it. Click **Save** to write changes back to disk.

The most-tweaked fields:

- `voice` — TTS voice. For Kokoro, set `KOKORO_VOICE` env var (defaults to `am_adam`).
- `voice_rate` — Pitch rate adjustment (edge-tts only, like `+0%` or `-10%`).
- `canvas_width` / `canvas_height` — Render resolution. 1920×1080 is standard.
- `fps` — 30 is standard, 24 for cinematic.
- `bg_music` — Path to a background track, or `null` for none.

## Adding a new book

The UI doesn't (yet) have a "new book" form. For now:

1. Create a folder: `books/{slug}/` (slug = lowercase, no spaces, e.g. `ego-is-the-enemy`)
2. Drop a cover image in: `books/{slug}/cover.svg` or `cover.png`
3. Write chapter JSONs: `books/{slug}/chapter-01.json`, `chapter-02.json`, etc.

Use `books/atomic-habits/chapter-01.json` as a template. The four mandatory fields are `book_title`, `chapter`, `chapter_title`, `narration_script`. The full `scenes` array drives the visual choreography.

**Tip:** copy `books/atomic-habits/` to `books/your-book/`, edit the chapter titles + scripts, replace the cover, and you have a new book ready to render.

## Day-to-day workflow

1. Open the app: `npm run ui`
2. Pick a book in the sidebar
3. Pick a chapter
4. Check **Upload to YouTube** if you want to publish this one
5. Click **Build**
6. Watch the live log; the output appears on the right when done
7. If the chapter has a hook failure (e.g. weak opening), the validator flags it in the test suite — see `tests/hook-validator.test.js`

## Running from the CLI

The UI is the front end. The CLI is the back end. Same code, just no dashboard:

```bash
# One chapter
node build-chapter.js --book my-book --chapter 1

# Whole book
node build-chapter.js --batch my-book

# Whole book + upload each chapter when done
node build-chapter.js --batch my-book --upload

# Force rebuild (ignore cache)
node build-chapter.js --book my-book --chapter 1 --force
```

The CLI is what runs in `npm run ui` under the hood when you click Build. Use it for batch jobs and CI/CD.

## Caching

Each build is content-addressed. If the chapter JSON + voice + speed hasn't changed since the last build, the TTS audio is reused from cache (no Kokoro re-synthesis). Click **Build** with the **No whisper** flag if you want to force a faster re-render.

The teaser (`scripts/generate-atomic-habits-teaser.js`) has its own cache keyed on the script text + voice + speed. Edit `TEASER_TEXT` to invalidate.

## Common gotchas

### Build hangs on "Captions"

Kokoro sometimes stalls on the first cold run. Re-run. If it still hangs, check that `models/kokoro/kokoro-v1.0.onnx` exists and is the right size (311MB, not a 9-byte error page).

### "Cannot find chapter" in the log

The chapter JSON is missing or has a wrong filename. Check `books/{book}/chapter-01.json` (zero-padded) — the build pipeline parses `chapter-NN.json` strictly.

### Audio sounds robotic

You're on the edge-tts fallback. Kokoro is the primary. Check `KOKORO_VOICE=am_adam` is set, the model is downloaded, and no errors in the log. If Kokoro is unavailable, edit `TEASER_TEXT` to use shorter sentences with explicit `...` pauses — edge-tts reads them as natural breaks.

### Render looks wrong / off-frame

HyperFrames assertions in `index.motion.json` control what must be visible by when. Open `ChapterZero/snapshots/` to see rendered frames and compare against the spec. Update `index.motion.json` if the timing is off.

## What's missing (roadmap)

- **Long-form chapters** — currently the atomic-habits teaser is the only fully-wired pipeline. The full chapter pipeline (`build-chapter.js`) is in place; per-book motion plans need to be written.
- **Auto-caption refinement** — the Whisper pass is optional; chapter JSONs ship with manual captions.
- **Batch UI** — render whole books from a single button click. CLI works today; UI is per-chapter.
- **Resume** — if a long batch crashes mid-book, restart picks up from where it stopped. (Currently the pipeline restarts from scratch; add a job-state file if you need resume.)
- **Multi-language** — Kokoro supports 8 languages, edge-tts supports 100+. Per-book language override is not yet wired in the UI.
