# AGENTS.md — Multi-Agent Coordination for edu-channel

> Rules for AI agents (Claude, Codex, Hermes, etc.) working on this repo concurrently.

## Single source of truth

| Artifact | Authority |
|---|---|
| `CLAUDE.md` | Operating guide — constraints, stack, file map. Read first. |
| `README.md` | Human-facing setup and usage. |
| `config.json` | Runtime configuration. |
| `.env` | Secrets (gitignored). Never commit. |
| `scene_base.html` | Visual template. Single source for all scene rendering. |
| `books/{book}/chapter-{N}.json` | Content per chapter. |

When docs disagree, `CLAUDE.md` wins for agent behavior; `config.json` wins for runtime values; chapter JSON wins for content.

## Non-negotiable constraints

1. **No stock photos / human faces.** Animated gradients + typography only.
2. **Single text layer per scene.** Visual title in HTML, spoken words in kinetic captions. Never both.
3. **YouTube uploads via `googleapis` (Data API v3 + OAuth2).** Never puppeteer-based uploaders.
4. **Never commit `.env`**, OAuth tokens, or credentials.
5. **Don't modify `scene_base.html` structure without updating all 20 chapter JSONs** — they depend on the `{CONTENT}`, `{ANIMATIONS}`, `{DUR}`, `{BOOK}`, `{GSAP_SRC}` placeholders.

## Division of work

Agents should claim a layer, not overlap:

| Layer | Scope | Typical agent |
|---|---|---|
| **Pipeline** (`build-chapter.js`, `whisper-captions.js`) | Render orchestration, FFmpeg, spawn safety, error recovery | Backend agent |
| **Template** (`scene_base.html`, CSS, GSAP) | Visual design, animations, caption bar | Design agent |
| **Content** (`books/*/chapter-*.json`) | Narration scripts, scene HTML, animations, captions | Content agent |
| **Upload** (`scripts/yt-auth.mjs`, `uploadToYouTube`) | OAuth flow, API integration | Backend agent |
| **UI** (`ui/src/`) | React dashboard | Frontend agent |
| **Docs** (`README`, `CLAUDE.md`, `AGENTS.md`) | Documentation | Any |

If two agents need the same file, serialize — don't merge-conflict.

## Coordination protocol

1. **Before working**, read `CLAUDE.md` and the file you're about to edit.
2. **Claim your layer** explicitly in your first message.
3. **Don't touch files outside your layer** unless absolutely necessary. If you must, say why.
4. **After editing**, verify:
   - `node build-chapter.js --help` parses clean
   - `npm test` (if any tests exist) passes
   - For renders: `node build-chapter.js --book atomic-habits --chapter 1 --keep-temp --no-whisper` exits 0
5. **Report** what you changed, what you verified, and what remains.

## Verification commands

```bash
# Pipeline parses?
node build-chapter.js --help

# Single chapter render (fast path, no Whisper)?
node build-chapter.js --book atomic-habits --chapter 1 --keep-temp --no-whisper

# Full chapter with Whisper captions?
node build-chapter.js --book atomic-habits --chapter 1

# Batch all chapters?
node build-chapter.js --batch atomic-habits

# UI dashboard?
cd ui && npm run start

# YouTube auth (one-time)?
npm run yt:auth
```

## Windows notes (for non-Windows agents)

- Shell is git-bash/MSYS. **POSIX syntax only** (`ls`, `$HOME`, `/c/Users/...`). PowerShell builtins fail.
- `npx` is `npx.cmd`. `spawn('npx')` → ENOENT. Resolve via `path.dirname(process.execPath)`.
- The write_file/patch linter reports false `MODULE_NOT_FOUND` because it prepends `C:\c\` to paths. **Ignore those lint errors** — verify with `node` directly.
- FFmpeg filter paths with drive colons conflict — use `-filter_script:v` with relative paths when burning subtitles.

## Known issues

- TTS duration < chapter JSON estimates → scenes past audio end reuse last valid clip.
- Whisper `base` model slow on CPU (~60s per 134s audio). Use `--no-whisper` for iteration.
- Each scene render takes 60–90s. 7 scenes ≈ 7 min wall-clock per chapter.

## Don't

- Don't add features not requested. Surgical changes only.
- Don't "improve" adjacent code while fixing a bug.
- Don't rename existing exports without updating all call sites.
- Don't introduce new dependencies without updating `package.json` + `README.md`.
- Don't push to GitHub from an agent session (read-only per project policy).
