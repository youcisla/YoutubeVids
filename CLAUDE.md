# CLAUDE.md — Agent Operating Guide for edu-channel

> Read this before touching any file in this repo.

## What this project is

A faceless YouTube video pipeline. Structured JSON chapter data → HTML/GSAP templates → HyperFrames render → FFmpeg concat → YouTube upload. The differentiator is **programmatic HTML/CSS/GSAP animation** — no stock footage, no AI-generated scripts.

## Critical constraints (never violate)

1. **No stock photos, no human faces.** Animated gradients and typography only. Abstract editorial warmth.
2. **Single text layer per scene.** Scene HTML shows title/badge/visual element ONLY. The spoken words belong to the GSAP kinetic captions at the bottom of the screen — never duplicate narration as body text in the scene HTML.
3. **YouTube uploads use the official Data API v3 + OAuth2** (`googleapis`). Never re-introduce `youtube-videos-uploader` or any puppeteer-based uploader — they carry known vulnerabilities.
4. **Never commit secrets.** `.env` is gitignored. OAuth tokens, API keys, credentials stay out of the repo.
5. **`scene_base.html` is the template.** Scene content comes from chapter JSON. Don't hardcode scene HTML in the pipeline — inject via `{CONTENT}`, `{ANIMATIONS}`, `{DUR}`, `{BOOK}` placeholders.

## Tech stack anchors

- **Node.js 22+** at `C:\node22`. Pipeline is plain CommonJS (`build-chapter.js`).
- **pnpm** for the `ui/` React dashboard; **npm** for the root pipeline.
- **HyperFrames CLI** via `npx hyperframes`. On Windows, `npx` is `npx.cmd` — `spawn('npx')` fails with ENOENT. Always resolve via `path.join(path.dirname(process.execPath), 'npx.cmd')` and wrap with `cmd.exe /c`.
- **FFmpeg + FFprobe** on PATH. Use `ffprobe` for duration probing (returns clean JSON), not regex-parsing FFmpeg stderr.
- **edge-tts** for narration. `--rate` flag must be `--rate=-3%` (equals form), not `--rate -3%` (the leading `-` confuses argparse).
- **faster-whisper** for word-level timestamps. Falls back to manual `.srt` in JSON if unavailable.

## Windows gotchas

- Shell is **git-bash/MSYS**. Use POSIX syntax (`ls`, `$HOME`, `/c/Users/...`). PowerShell builtins won't work.
- The Hermes write_file/patch linter reports false `MODULE_NOT_FOUND` errors because it prepends `C:\c\` to absolute paths — **ignore those lint errors**, they don't reflect real file state. Verify with `node --help` or `node -e "require('./file')"`.
- Temp dirs use `os.tmpdir()` (resolves to `C:\Users\<user>\AppData\Local\Temp\`). Always use unique per-run dirs (`edu-channel-{baseName}-{Date.now()}`).

## Pipeline architecture

```
build-chapter.js (orchestrator)
├── edgeTts()              → narration.wav
├── getAudioDuration()     → ffprobe JSON parse
├── ffmpeg -ss -to         → narration_{i}.wav per scene
├── whisper.generateCaptions() → scene_{i}/captions.srt  (or fallback)
├── buildSceneHtml()       → scene_{i}/index.html (template + content + caption JS)
├── hyperframes render     → scene_{i}.mp4 (parallel, batches of 4)
├── ffmpeg concat          → {book}_Ch{N}.mp4
├── music ducking          → optional sidechaincompress mix
├── thumbnail              → frame at 2s
└── uploadToYouTube()      → googleapis OAuth2
```

Key behaviors:
- **Parallel renders** in batches of 4 (`Promise.all` per batch).
- **Render failures are tolerated** — missing scenes are skipped in concat, not fatal.
- **`exited null` from HyperFrames is normal** (signal-based exit). `run()` treats null-exit as success when stderr has no "error".
- **Caption timestamps are frame-snapped** (`Math.round(t / frameDur) * frameDur`) to prevent drift.
- **Scene pre-flight**: `document.fonts.ready` + image `onload` before `.ready` class unhides `#main`.

## Chapter JSON schema

```json
{
  "book_title": "Atomic Habits",
  "cover_ext": "svg",
  "chapter": 1,
  "chapter_title": "...",
  "narration_script": "Full TTS text...",
  "scenes": [
    {
      "index": 0,
      "timestamp_end": 20,         // cumulative — scene N ends here
      "duration": 22,              // scene length (>= timestamp_end - prev)
      "narration_text": "...",     // words spoken in this scene
      "html": "<h1 class=\"h1\">...</h1>",  // visual content ONLY
      "animations": "tl.from(...);",        // GSAP calls (R = composition selector)
      "captions": [{"start":0,"end":4,"text":"..."}]
    }
  ]
}
```

## When modifying code

1. **Think before coding** — state assumptions. Don't hide confusion.
2. **Surgical changes** — touch only what the task requires. Match existing style.
3. **Every changed line must trace to the request.** No speculative features.
4. **Verify by execution** — `node build-chapter.js --help` must parse clean. For renders, run `--chapter 1 --keep-temp --no-whisper` and confirm exit 0 + MP4 in `pilot/dist/`.

## File map (what to edit for what)

| Want to change... | Edit this |
|---|---|
| Voice, fps, music, YouTube privacy | `config.json` |
| Scene visual template (background, layout, caption bar) | `pilot/scenes/scene_base.html` |
| Pipeline behavior (render order, flags, error handling) | `build-chapter.js` |
| Caption generation (Whisper backend, word grouping) | `whisper-captions.js` |
| Chapter content (narration, scenes, captions) | `books/{book}/chapter-{N}.json` |
| Upload mechanism | `build-chapter.js` → `uploadToYouTube()` |
| OAuth flow | `scripts/yt-auth.mjs` |
| React dashboard | `ui/src/` |

## Known issues (as of 2026-07)

- Real TTS duration (~134s) is shorter than chapter JSON estimates (~213s). Scenes past the audio end reuse the last valid clip. Fix: regenerate chapter JSONs with accurate durations, or compute durations from TTS output.
- Whisper `base` model is slow on CPU (~60s for 134s audio). Use `--no-whisper` for fast iteration; enable Whisper for final renders.
- Scene render takes 60–90s each (7 scenes ≈ 7 min total). Parallel batches of 4 help but don't eliminate the bottleneck.
