# edu-channel — Faceless Book Summary YouTube Videos

AI-powered video pipeline for a faceless YouTube channel. Each book = a playlist of chapter videos, rendered via HyperFrames + GSAP + FFmpeg.

## Quick Start

```bash
# Generate one chapter
node build-chapter.js --book atomic-habits --chapter 1

# Batch all chapters of a book
node build-chapter.js --batch atomic-habits
```

## Directory Structure

```
edu-channel/
├── config.json              # Voice, WPM, quality, canvas config
├── build-chapter.js          # Pipeline script: JSON → HTML → render → sub burn → concat
├── brand-kit/
│   └── DESIGN.md            # Colors, typography, safe zones, animation standards
├── books/
│   └── {book-name}/
│       ├── cover.{jpg|svg}  # Book cover art
│       ├── chapter-01.json   # Scene data, captions, narration script
│       ├── chapter-02.json
│       └── ...
├── pilot/
│   ├── scenes/
│   │   ├── scene_base.html   # Reusable HTML template (GSAP + brand styles)
│   │   └── scene_{N}/        # Generated per-render (auto-cleaned)
│   ├── assets/               # Shared backgrounds
│   └── dist/                 # Output MP4s
```

## How It Works (Per Chapter)

```
books/{book}/chapter-{N}.json
  → build-chapter.js
    → edge-tts → narration.wav (full chapter audio)
    → FFmpeg split → 5-7 scene WAV clips
    → scene_base.html + scene content → rendered MP4 per scene
    → .srt subtitles per scene → FFmpeg burned-in
    → FFmpeg concat → pilot/dist/{book}_Ch{N}.mp4
```

## Chapter Data Format

Each `chapter-{N}.json` file requires:

```json
{
  "book_title": "Atomic Habits",
  "cover_ext": "svg",
  "narration_script": "Full narration text for TTS...",
  "scenes": [
    {
      "timestamp_end": 22,
      "duration": 22,
      "html": "<div class=\"scene\"><h1 class=\"h1\">Key phrase</h1></div>",
      "animations": "GSAP animation calls...",
      "captions": [
        {"start": 0.0, "end": 5.0, "text": "Caption line one"},
        {"start": 5.0, "end": 10.0, "text": "Caption line two"}
      ]
    }
  ]
}
```

## Config

Edit `config.json` to change:
- **voice**: Edge TTS voice (default: `en-US-GuyNeural`)
- **voice_rate**: Speaking rate (default: `-10%` for deliberate pacing)
- **wpm**: Words per minute (default: 148)
- **fps**: Frame rate (default: 30)
- **quality**: Render quality (default: `high`)

## Brand Kit

`brand-kit/DESIGN.md` defines the visual identity:
- Space Grotesk (headings) + Inter (body)
- Hearth Terracotta accents (#FACC15 gold highlight)
- Dark backgrounds (deep midnight #0A0D16)
- Power4.out easing, stagger entrances

## Dependencies

- Node.js 22+ (for build-chapter.js)
- ffmpeg (for audio split, subtitle burn, concat)
- edge-tts (npm) for narration
- HyperFrames CLI (`npx hyperframes`) for rendering
