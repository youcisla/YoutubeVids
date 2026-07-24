# Graph Report - .  (2026-07-24)

## Corpus Check
- Corpus is ~31,442 words - fits in a single context window. You may not need a graph.

## Summary
- 229 nodes · 317 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 68% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- React Dashboard Components
- Pipeline Orchestrator
- Audio & TTS Processing
- UI Build Tooling
- Docs & Brand System
- npm Scripts
- TypeScript Configuration
- Whisper Caption Module
- Chapter Content Data
- React/Vite UI Framework
- YouTube OAuth Flow
- Environment Config
- Frame-Accurate Captions
- Community 13
- Community 14

## God Nodes (most connected - your core abstractions)
1. `build-chapter.js` - 26 edges
2. `compilerOptions` - 17 edges
3. `scene_base.html` - 15 edges
4. `buildChapter()` - 11 edges
5. `scripts` - 8 edges
6. `BADGE()` - 7 edges
7. `BookMeta` - 7 edges
8. `BuildStatus` - 7 edges
9. `generateCaptions()` - 7 edges
10. `scripts` - 6 edges

## Surprising Connections (you probably didn't know these)
- `build-chapter.js` ----> `.env`  [0.8]
  CLAUDE.md → AGENTS.md
- `books/atomic-habits/cover.svg` ----> `Brand Design System`  [0.6]
  books/atomic-habits/cover.svg → brand-kit/DESIGN.md
- `pilot/assets/cover.svg` ----> `Brand Design System`  [0.6]
  pilot/assets/cover.svg → brand-kit/DESIGN.md
- `build-chapter.js` ----> `config.json`  [0.95]
  CLAUDE.md → README.md
- `scene_base.html` ----> `Inter (body)`  [0.95]
  CLAUDE.md → brand-kit/DESIGN.md

## Import Cycles
- None detected.

## Communities (18 total, 4 thin omitted)

### Community 0 - "React Dashboard Components"
Cohesion: 0.11
Nodes (16): Props, ConfigEditor(), Props, Props, Props, Props, AppConfig, BookMeta (+8 more)

### Community 1 - "Pipeline Orchestrator"
Cohesion: 0.10
Nodes (29): args, batchIdx, bookIdx, buildAndRenderScene(), buildCaptionJs(), buildChapter(), buildSceneHtml(), chIdx (+21 more)

### Community 2 - "Audio & TTS Processing"
Cohesion: 0.12
Nodes (30): build-chapter.js, uploadToYouTube(), whisper-captions.js, scripts/yt-auth.mjs, Faceless Video Pipeline, HTML/GSAP over Stock Footage, ffprobe for Duration, OAuth API, Never Puppeteer (+22 more)

### Community 3 - "UI Build Tooling"
Cohesion: 0.08
Nodes (25): dependencies, lucide-react, react, react-dom, devDependencies, autoprefixer, concurrently, express (+17 more)

### Community 4 - "Docs & Brand System"
Cohesion: 0.12
Nodes (21): scene_base.html, Inter (body), Multi-Agent Coordination, Space Grotesk (headings), Never Commit Secrets, No CDN Dependencies, No Random in Timeline, No Stock Photos / Human Faces (+13 more)

### Community 5 - "npm Scripts"
Cohesion: 0.11
Nodes (18): dependencies, googleapis, description, engines, node, name, optionalDependencies, open (+10 more)

### Community 6 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleDetection (+10 more)

### Community 7 - "Whisper Caption Module"
Cohesion: 0.24
Nodes (14): CONFIG, detectWhisper(), formatSrtTime(), fs, generateCaptions(), groupWordsIntoCaps(), os, path (+6 more)

### Community 8 - "Chapter Content Data"
Cohesion: 0.23
Nodes (12): BADGE(), CHAPTERS, fourLaws, fourLawsGrid(), fs, hook(), keyInsight(), OUT (+4 more)

### Community 9 - "React/Vite UI Framework"
Cohesion: 0.50
Nodes (5): ui/index.html, ui/src/main.tsx, ui/src (React dashboard), React, Vite

### Community 10 - "YouTube OAuth Flow"
Cohesion: 0.40
Nodes (4): authUrl, oauth2, scope, server

## Knowledge Gaps
- **105 isolated node(s):** `fs`, `path`, `OUT`, `fourLaws`, `CHAPTERS` (+100 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build-chapter.js` connect `Audio & TTS Processing` to `Docs & Brand System`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `scene_base.html` connect `Docs & Brand System` to `Audio & TTS Processing`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `OUT` to the rest of the system?**
  _105 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React Dashboard Components` be split into smaller, more focused modules?**
  _Cohesion score 0.10588235294117647 - nodes in this community are weakly interconnected._
- **Should `Pipeline Orchestrator` be split into smaller, more focused modules?**
  _Cohesion score 0.0989247311827957 - nodes in this community are weakly interconnected._
- **Should `Audio & TTS Processing` be split into smaller, more focused modules?**
  _Cohesion score 0.11827956989247312 - nodes in this community are weakly interconnected._
- **Should `UI Build Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._