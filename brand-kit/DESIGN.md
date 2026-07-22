# Book Summary Channel — Brand Design System

## Color Palette
- Background: `#0A0D16` (deep midnight)
- Text Primary: `#F8FAFC` (almost white)
- Text Muted: `#94A3B8` (slate 400)
- Text Dim: `#64748B` (slate 500)
- Accent Primary: `#FACC15` (amber/yellow — kinetic captions, badges, highlights)
- Accent Secondary: `#A78BFA` (violet — secondary highlights)
- Card BG: `rgba(15,23,42,0.6)` — translucent slate overlay
- Card Border: `rgba(148,163,184,0.1)` — subtle white border

## Typography
- **Headings & Badges**: Space Grotesk, weight 500-700, letter-spacing -0.02em
  - Hero H1: 90px, line-height 1.1
  - Section H2: 56px, line-height 1.15
  - Section H3: 40px, line-height 1.2
- **Body Text**: Inter, weight 300
  - Standard body: 32px, line-height 1.35
  - Small/Dim: 26-28px, line-height 1.3
  - Caption bar text: 28px, weight 400
- **Chapter Badge**: Space Grotesk, 18px, letter-spacing 3px, uppercase
- **CTA text**: Inter, 22px, letter-spacing 3px, uppercase, color `#64748B`

## Layout Safe Zones
- Canvas: 1920×1080
- Scene padding: 100px top, 140px left/right, 220px bottom (220px = caption bar clearance)
- Caption bar: bottom 180px, centered, max-width 1400px
- Content area 2-col grid: `grid-template-columns: 1fr 1fr; gap: 60px`
- Content area centered: `max-width: 1400px; margin: 0 auto`
- Content area two-third: `grid-template-columns: 3fr 1fr; max-width: 1600px`

## Component Sizing
- Swiss badge: padding `8px 24px`, border `1px solid rgba(250,204,21,0.3)`
- Cards: padding `28px 32px`, border-radius `4px`
- Swiss divider: width `60px`, height `2px`, background `rgba(250,204,21,0.5)`
- Quote block: border-left `2px solid accent`, padding `20px 32px`
- 4-Law grid: `grid-template-columns: repeat(4, 1fr); gap: 20px`

## Animation Standards
- **Easing**: `power4.out` for all entrance animations (snappy, dramatic)
- **Duration**: 0.8-1.2s for entrances, 0.6s for exits
- **Stagger**: 0.12-0.2s between staggered elements
- **Caption word transition**: 0.08s color shift
- **Background Ken Burns**: 240s infinite alternate, scale 1.02→1.08
- **Glitch**: 0.1s on/off for chaos scenes

## Anti-Patterns (Do Not Use)
- `position: absolute; top: Npx; left: Npx` on text elements
- `Math.random()` or `Date.now()` in timeline — use seeded PRNG only
- `repeat: -1` — use finite calculated counts
- CDN dependencies — vendor GSAP locally
- Default linear easing — always use `power4.out` / `expo.out`
- `<br>` in body text — use block elements
- Common sans-serif fallbacks — always specify Space Grotesk + Inter
