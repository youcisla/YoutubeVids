# Two-Channel Educational Network — Build Spec

**Status:** Draft v1 (pre-build)
**Owner:** Y. Chehboub
**Date:** 2026-07-21

---

## 1. Vision

Two YouTube channels, one production pipeline. Both AI-generated, both educational, both MIT-clean (no competitor mentions per the user's brand-purity rule).

| Channel | Audience | Niche | Format |
|---|---|---|---|
| **Channel A** — *Working Name: "How It Actually Works"* | Adults 18–55 + curious teens 13+ | "How Things Actually Work" — everyday objects, systems, and processes explained in 60–90s | Vox / Kurzgesagt motion-graphic explainers + 5–8 min long-form deep-dives |
| **Channel B** — *Working Name: "AI Pals for Kids"* | Kids 6–12 (YouTube Kids eligible) + co-watching parents | "AI Literacy for Kids" — what is AI, how does it think, how to use it safely and creatively | Kurzgesagt Junior style — animated cartoon characters + warm narrator |

**Shared:**
- Production pipeline (Hyperframes + key.AI images + 11 Labs / HeyGen voice)
- MIT license on assets
- Brand-purity discipline (no competitor / tool mentions on screen or in scripts)
- Topic discovery + script generation in Hermes Agent

**Diverged:**
- Palette (Channel A: editorial dark/teal; Channel B: warm pastels + bold primaries)
- Voice (Channel A: measured adult male/female; Channel B: warm female, slower cadence, brighter affect)
- Pacing (Channel A: 4s/scene; Channel B: 5–6s/scene, more dwell)
- Script vocabulary (Channel A: college-educated; Channel B: 6th-grade reading level, no jargon)

---

## 2. Production Pipeline (one system, two outputs)

```
                        ┌────────────────────────┐
                        │   Topic / Idea          │
                        │   (Hermes brainstorms)  │
                        └──────────┬──────────────┘
                                   │
                                   ▼
                        ┌────────────────────────┐
                        │  Script (Hermes LLM)   │
                        │  + shot list            │
                        └──────────┬──────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
                ▼                                     ▼
    Channel A: "How It Actually Works"    Channel B: "AI Pals for Kids"
    (adult Vox tone)                       (kids cartoon tone)
                │                                     │
                ▼                                     ▼
    ┌────────────────────────┐         ┌────────────────────────┐
    │ key.AI images          │         │ key.AI images          │
    │ (Nano Banana 2 /       │         │ (Nano Banana Pro       │
    │  Seedream 4.5)         │         │  for character art)    │
    └──────────┬─────────────┘         └──────────┬─────────────┘
               │                                   │
               ▼                                   ▼
    ┌────────────────────────┐         ┌────────────────────────┐
    │ 11 Labs narration      │         │ 11 Labs narration      │
    │ (measured adult voice) │         │ (warm female, slow)    │
    └──────────┬─────────────┘         └──────────┬─────────────┘
               │                                   │
               ▼                                   ▼
    ┌────────────────────────┐         ┌────────────────────────┐
    │ Hyperframes composition│         │ Hyperframes composition│
    │ A-composition.html     │         │ B-composition.html     │
    │ (4s/scene, dense type) │         │ (6s/scene, big icons)  │
    └──────────┬─────────────┘         └──────────┬─────────────┘
               │                                   │
               ▼                                   ▼
    ┌────────────────────────┐         ┌────────────────────────┐
    │ FFmpeg caption burn-in │         │ FFmpeg caption burn-in │
    │ (small, lower-third)   │         │ (large, centered)      │
    └──────────┬─────────────┘         └──────────┬─────────────┘
               │                                   │
               ▼                                   ▼
        out/<topic>.mp4                    out/<topic>.mp4
        (1920×1080)                        (1920×1080 or 1080×1920)
```

**Per-episode cost (rough):**
- key.AI images (8 per short): ~40 credits
- 11 Labs narration (60s): ~$0.05–0.15
- Hyperframes render: free local
- FFmpeg: free
- **Total per Channel A short: ~$0.20**
- **Total per Channel B short: ~$0.25** (more images, character art)

Per-channel weekly cadence at 5 shorts + 1 long-form = ~$5/week in API costs. Negligible.

---

## 3. Channel A — "How It Actually Works"

### Identity

| Field | Value |
|---|---|
| Format | 60–90s shorts + 5–8 min long-form deep-dives |
| Cadence | 5 shorts/week + 1 long-form/month to start |
| Audience | Adults 18–55 + curious teens 13+ |
| Voiceover | 11 Labs "Adam" (deep male, measured) — TBD after test renders |
| Visual style | Dark editorial (#0E1418 bg), accent teal (#4FD1C5), warm amber highlights (#F6AD55). Fraunces display + Inter body |
| Motion language | GSAP-powered, 4s/scene, geometric transitions, dense infographic panels |
| Caption style | Lower-third, white text on 60% black, 32pt Inter Medium |
| Aspect ratio | 16:9 long-form, 9:16 shorts |

### Topic pipeline (first 10)

These are the topics the user can choose from or modify. All evergreen, all "actually useful to know":

1. **How does your phone know which way is up?** — accelerometer + gyroscope
2. **Why does bread go stale but crackers don't?** — starch retrogradation
3. **How does Google Maps find the fastest route in 30 seconds?** — graph theory + traffic data
4. **Why does your Wi-Fi work better in some rooms?** — radio wave physics + building materials
5. **How do barcode scanners read upside-down barcodes?** — check digits + redundancy
6. **Why do batteries die faster in the cold?** — electrochemistry kinetics
7. **How does autocomplete know what you'll type next?** — Markov chains / transformers in miniature
8. **Why does airplane food taste bland?** — cabin pressure effect on taste buds
9. **How does a microwave heat food unevenly?** — standing wave patterns + rotating turntable
10. **Why do we get brain freeze?** — trigeminal nerve + vascular response

(More in reserve: shipping containers, postal sorting, refrigeration cycles, how elevators decide where to go, why traffic lights are timed the way they are, etc.)

### Verification per episode

- [ ] `npx hyperframes check` passes
- [ ] `npx hyperframes snapshot --at 0.25,0.5,0.75` shows clean frames
- [ ] `ffprobe` shows video + audio + burned subtitles
- [ ] Total duration within 5% of target (60s / 5min / 8min)
- [ ] Voiceover peak alignment with visual transitions <100ms

---

## 4. Channel B — "AI Pals for Kids"

### Identity

| Field | Value |
|---|---|
| Format | 2–4 min episodes (one concept per episode, no rush) |
| Cadence | 1 episode/week to start (slower for quality) |
| Audience | Kids 6–12 + co-watching parents |
| Voiceover | 11 Labs "Hope" or custom warm-female clone (TBD) |
| Visual style | Warm pastels (cream #FFF8E7 bg, coral #FF6B6B accent, sky #4ECDC4, sun #FFE66D). Quicksand / Nunito display + body |
| Motion language | Bouncy, spring-easing, character-led. 6s/scene, big icons, full-frame friendly |
| Caption style | Centered, 56pt Nunito Bold, white with thick black outline (readable on any background) |
| Aspect ratio | 16:9 (YouTube Kids-friendly) |
| Characters | 2 recurring: "Pixel" (the curious kid) + "Byte" (the friendly AI pal, friendly glowy cloud-shape) |
| COPPA / YouTube Kids compliance | No personalised ads, no comments by default, no external links in description |

### Topic pipeline (first 10)

Designed as a coherent first season — "What is AI, really?" arc:

1. **What's a robot?** (set up: AI exists in software too, not just hardware)
2. **How do computers learn?** (training as practice, not magic)
3. **Where does AI live?** (in data centres, in the cloud — kids see servers)
4. **Can AI be wrong?** (yes — show a real mistake, then explain why)
5. **How does AI see?** (computer vision — pixels → shapes → names)
6. **How does AI talk?** (language models as word-predictors, with humour)
7. **Can AI be creative?** (yes — and also: AI + your creativity is more fun)
8. **How do you talk to an AI?** (prompting — be specific, be kind, ask again if wrong)
9. **Is AI safe?** (real safety rules: ask a grown-up, don't share secrets, AI is a tool not a friend)
10. **What's AI good at? What's it bad at?** (strengths + limits, no hype, no fear)

(Season 2 ideas: How AI helps doctors, How AI helps the planet, AI in music and art, building your first AI project with a grown-up)

### Verification per episode

- [ ] `npx hyperframes check` passes (zero findings)
- [ ] All on-screen text passes WCAG AAA at the rendered size (this is non-negotiable for kids content — pre-check before render)
- [ ] Reading-level check on the SCRIPT.md (target: 6th grade / Lexile 700-900L)
- [ ] Voiceover peak alignment with character mouth animation (where applicable)
- [ ] No external links, no scary imagery, no references to non-MIT-licensed content
- [ ] YouTube Kids metadata fields set correctly: `madeForKids=true`, no paid promotion, age target 6–12

---

## 5. Tech stack — what we use, what we don't

### Use

| Tool | Why | Cost |
|---|---|---|
| **Hermes Agent** | Orchestrator + script + topic brainstormer | Free (already running) |
| **Hyperframes** | Composition + render | Free (CLI local) |
| **key.AI** | Image gen aggregator (one key, many models) | $5 starter → ~1000 credits |
| **11 Labs** | Narration (best quality for the cost) | $5/mo starter |
| **FFmpeg** | Caption burn-in, final assembly | Free |
| **Whisper** | (Channel A only) timing alignment | Free local |

### Don't use (yet)

| Tool | Why deferred |
|---|---|
| HeyGen avatar | Channel A doesn't need a presenter; Channel B uses animated characters, not avatar |
| Blotato / cross-posting | User said they'll handle upload manually |
| Higgsfield B-rolls | Not needed for explainers — we're animation-only |
| Any third-party "faceless YouTube" SaaS | Off-brand; we want full creative control |

---

## 6. Deliverable for this session

**Scope of THIS build** (not the whole network — just the first deliverable):

1. **One Channel A short** — "How does your phone know which way is up?" — 60–90s, fully rendered .mp4
2. **One Channel B episode** — "What's a robot?" — 2–3 min, fully rendered .mp4
3. **Reusable Hyperframes composition templates** — one per channel (so future episodes reuse the skeleton)
4. **The educational-network skill** — `edu-channel-network` — captures this whole spec for future reuse

After this batch is done and you've reviewed, we scale to 10 episodes/week across both channels.

---

## 7. Out of scope (deferred)

- Channel brand assets (logo, channel art, intro/outro sting) — defer to week 2
- Music selection (BGM) — defer until we have one episode per channel to feel the vibe
- Thumbnail generation — defer until upload-ready
- YouTube upload automation — user uploads manually
- Analytics dashboard — defer until we have data
- Multi-language versions — defer
- Sponsor integration — defer until monetisation threshold hit

---

## 8. Open questions for the user (these don't block the build)

1. **Channel A working name** — "How It Actually Works" is my default. Any preference?
2. **Channel B working name** — "AI Pals for Kids" is my default. Any preference?
3. **Pilot topics** — the 10 above are my defaults. Want to swap any for a personal favourite?
4. **Voice preferences** — I'm defaulting to 11 Labs "Adam" (Channel A) + "Hope" or a custom warm-female clone (Channel B). Want a specific accent / age / gender?
5. **Series premise** — should Channel B be a single 10-episode arc (recommended), or independent episodes?

I'll proceed with the defaults unless you say otherwise. Building now.