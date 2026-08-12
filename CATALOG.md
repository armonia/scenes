# Remotion scene libraries — behaviour catalogue

Analysis only. Nothing here is copied source: these are behaviour names and
observable effects, gathered to decide what to build. Implementations are
written from scratch against this catalogue.

Compiled 2026-08-11.

## The landscape

| Library | Units | License | Stars | Distribution | Usable by us |
|---|---|---|---|---|---|
| [Curvable/motion](https://github.com/Curvable/motion) | 14 scenes | **MIT** | 15 | copy TSX | yes, freely |
| [av/remotion-bits](https://github.com/av/remotion-bits) | 5 components + 42 bits | **none** | 438 | jsrepo registry | [issue #1](https://github.com/av/remotion-bits/issues/1) filed |
| [reactvideoeditor/remotion-templates](https://github.com/reactvideoeditor/remotion-templates) | 81 templates | **none** | 204 | copy TSX + MCP | [issue #3](https://github.com/reactvideoeditor/remotion-templates/issues/3) filed |
| remotionui.com | 109 components | — | — | CLI | rejected: AI slop |
| ali-abassi/remotion-templates | ? | none | 15 | — | rejected: created and pushed in the same second, never touched |
| `@remotion/*` official | transitions, shapes, paths, motion-blur, animation-utils, layout-utils, captions | per Remotion license | — | npm | yes, comes with Remotion |

No `LICENSE` means all rights reserved, not public domain. The two biggest
libraries are therefore unusable until the issues above are answered.

## The 81 templates, grouped by job

Grouping matters more than the list: it shows what the ecosystem thinks it is for.

- **Logo reveals (9)** — blur, bounce-drop, fade, glitch, scale-rotate, spin, split, stroke-draw, typewriter
- **Transitions (12)** — blinds, clock-wipe, cross-dissolve, fade-through-black, film-burn, iris, morph, pixel, push, slide-wipe, whip-pan, zoom-through
- **Text (12)** — animated, bounce, bubble-pop, floating-bubble, glitch, popping, pulsing, slide, highlight, title-split, typewriter-subtitle, quote-card
- **Data (10)** — area/line/pie/donut/comparison charts, chart-animation, circular-progress, progress-bars, progress-steps, stat-counter
- **Photo & gallery (8)** — gallery-grid, image-carousel, comparison-slider, zoom-reveal, masonry, photo-stack, polaroid, picture-in-picture
- **Camera & film (9)** — camera-shake, ken-burns, letterbox-reveal, parallax-pan, vignette-pulse, zoom-pulse, noise-grain, split-screen, spotlight-reveal
- **Backgrounds & FX (8)** — bokeh, geometric-patterns, gradient-shift, grid-pulse, liquid-wave, matrix-rain, particle-explosion, starfield
- **YouTube furniture (9)** — chapter-title, countdown-intro, countdown-timer, credits-roll, end-card, lower-third, subscribe-reminder, notification-pop, sound-wave
- **Misc (4)** — animated-list, card-flip, cinematic-title-intro, rotating-carousel

### What this tells us

Two findings, both actionable.

**1. Twelve of the 81 are transitions that already ship free with Remotion.**
`@remotion/transitions` covers fade, slide, wipe, flip, clockWipe, iris, zoomBlur,
dreamyZoom, filmBurn, linearBlur, bookFlip, dissolve, ripple, crosswarp, crossZoom.
Reimplementing those is wasted work.

**2. The whole catalogue is a YouTube-creator toolkit, not a product-commercial toolkit.**
Nine ways to reveal a logo, plus subscribe reminders, end cards and credits rolls.
Nothing in the 81 does the thing we actually want:

- no prompt/AI input
- no cursor that acts
- no app UI mockup or device frame
- no dashboard on a tilted 3D plane
- no streaming/typing response
- no before/after product comparison
- no pricing or feature card choreography

`remotion-bits` is closer in spirit but is primitives, not scenes: AnimatedText,
StaggeredMotion, GradientTransition, ParticleSystem, Scene3D.

Curvable is the only one aiming at product ads — and it has 14 scenes and 15 stars:
prompt input (cursor flies in, types into a 3D-tilted dashboard, hits send, flies
out), floating stack, stats grid, two full Reddit ad spots.

## The gap

The empty niche is not "better Remotion components". It is:

> **Scenes for software product commercials.**

Nobody is serving it except a three-month-old project with 15 stars. That is a
sharper position than competing with 81 generic templates, and it is the exact
material Armonia needs for its own work anyway.

## Distribution — do not build a harness

Two standards already exist and both are fine:

- **shadcn registry** — `registry.json` served from our own domain,
  consumed with `npx shadcn add https://<our-domain>/r/<scene>.json`.
  Works for arbitrary files, not just UI components.
- **jsrepo** — what remotion-bits uses.

shadcn is the safer bet: bigger install base, and the registry-item schema is
documented and stable. Writing our own CLI would be rebuilding shadcn, worse.

## Build list (proposed, product-commercial first)

1. `prompt-input` — cursor enters, types with irregular rhythm, sends, response streams in
2. `ui-mockup` — app window on a tilted 3D plane, parallax on camera move
3. `cursor` — a shared primitive: path, easing, click, the thing every scene above needs
4. `before-after` — split or wipe comparison driven by one progress prop
5. `feature-cards` — staggered card choreography with depth
6. `metric-morph` — hero number that resolves into a grid of cards
7. `logo-outro` — one, not nine

Everything frame-locked: `useCurrentFrame` only, no CSS keyframes, no
`requestAnimationFrame`. Every scene takes a `progress` escape hatch so it can be
driven by a parent timeline.
