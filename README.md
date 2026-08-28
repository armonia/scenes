# scenes

Scenes for **software product commercials**, written in [Remotion](https://remotion.dev)
and locked to the frame clock.

Not another pack of logo reveals. `CATALOG.md` counts what the ecosystem
already ships: 81 templates in the biggest catalogue, nine of them ways to
reveal a logo. It also counts what none of it does. A prompt being typed, a
cursor that acts, real app UI on a tilted plane, a response streaming in. That
gap is what this repo is for.

## The rules

Four, and they are the reason the scenes compose instead of merely existing.

**Frame-locked.** `useCurrentFrame()` and nothing else. No CSS keyframes, no
`requestAnimationFrame`, no wall clock. A frame renders the same whether it is
the first one or the thousandth, in the studio or in headless CI.

**A `progress` escape hatch.** Every scene accepts a normalized 0 to 1 progress
so a parent timeline can drive it. Left unset, the scene derives it from its own
frame.

**No cuts.** The two Linear commercials this repo takes its grammar from run 52
and 41 seconds in one unbroken shot. Scenes therefore have to chain by
continuous transformation rather than by cut, and each one has to be able to
enter from the previous one's final state. This is an architectural constraint,
not a stylistic preference.

That rule was an assertion until there were three scenes. Two clips that both
start and end at rest can be placed in any order without anyone seeing a cut,
because there is no motion to break. `CardHandoff` starts from the pose
`UIMockup` stops in, both reading it from `primitives/slab.ts`, and `seam.sh`
diffs the two frames to prove it.

**Real UI, not a drawing of UI.** Slabs of the actual product on inclined
planes, with the product's own tokens, radii and system font stack. A mockup
that is 3px off reads as a mockup.

## Layout

| | |
|---|---|
| `video/` | The Remotion project. Scenes in `video/src/scenes/`, primitives in `video/src/primitives/` |
| `scripts/` | Six things, all run by hand. Four measurements, one review page, one showcase build. See below |
| `showcase/` | The public page. `index.html` is committed, the renders beside it are not: `showcase-build.sh` puts them there |
| `CATALOG.md` | The surveyed libraries with verified licenses, the 81 templates grouped, the market gap |
| `ref/` | Reference commercials and their contact sheets. **Not in git**, see below |

## Verification happens on the render

A scene looked at on its own always seems fine. What shows the gap is the
comparison, so every check here puts our render and the reference through the
same treatment and prints both columns. A number with nothing beside it is
decoration.

```bash
npx remotion render PromptInput out/prompt-input.mp4   # from video/

./scripts/contact-sheet.sh out/prompt-input-vs-ref.png  # composition, frozen
./scripts/review-page.sh                                # composition + rhythm, moving
./scripts/beats.sh                                      # are all four beats on screen
./scripts/fill-measure.sh video/out/prompt-input.mp4    # does it fill the frame
./scripts/legibility.sh                                 # down to what size it reads
./scripts/framelocked-verdict.sh                        # is it really frame-locked
./scripts/seam.sh                                       # is the join really cutless
./scripts/handoff-travel.sh                             # does the card actually cross
./scripts/showcase-build.sh                             # assemble showcase/dist for deploy
```

`beats.sh` is the one that earns its keep. `prompt-input` promises four beats:
the cursor arrives, types, sends, and the answer streams in. For a full day the
render delivered three. The thread is anchored to the bottom and ran to y=922,
the composer is opaque and starts at y=838, so the newest message sat
underneath it: the response was assembling itself word by word where nobody
could see it. Every type check passed the whole time. Nothing catches that
except reading the finished frame, which is what this script does, and it
requires the word count to *grow* across the streaming window rather than
merely be non-zero.

`contact-sheet.sh` and `review-page.sh` are the same judgement on two clocks.
The contact sheet compares composition, which is a property of a still. The
page compares rhythm, which only exists in motion: the uneven typing, the pause
before send, the pace of the streaming response. A strip of frames cannot show
any of that.

`fill-measure.sh` and `legibility.sh` are the two defects that sank the first
scene, turned into numbers. Measured on both renders: the frame is full on all
four edges at every instant sampled (20 of 20 samples on `ui-mockup`), where the
reference keeps two of four alive and the retired `OrbitLoop` none. Text
survives downscaling at least as well as the reference, and better below 640px
wide.

`OrbitLoop` is what `UIMockup` replaced, and it is named here only as the
baseline the measurements are read against. It is no longer a composition.

`seam.sh` turns the no-cuts rule into a number. It pulls the last frame of
`UIMockup` and the first frame of `CardHandoff` and counts differing pixels.
What makes the reading honest is the control beside it: the same last frame
against a frame from the *middle* of `CardHandoff`, which is a deliberate cut.
Measured: 552 pixels for the join, 18,019 for the cut, a 32× separation. If the
two ever came out close the script exits 2 and says the measurement separates
nothing, because a check that cannot fail is decoration. It does not demand
zero either: two frames survive two independent H.264 encodes, so the bar is a
fraction of pixels past a perceptual tolerance, not byte equality.

`handoff-travel.sh` checks the thing none of the others look at: whether the
gesture happens. A scene where the card never moves passes `seam.sh` and
`fill-measure.sh` with full marks, because a freeze frame has a perfect join and
live edges. So this one tracks the centroid of changed pixels across the travel
window and requires the horizontal motion to be monotonic and to cover half a
column. Verified against both failure modes: it exits 1 on `ui-mockup` (a scene
with no travelling card) and on a still frame looped into a video, and 0 on
`card-handoff`.

```bash
cd video
npm install
npm run dev          # Remotion studio
npx remotion render <CompositionId> out/<name>.mp4
```

## The showcase page

`showcase/index.html` is the public page: the three scenes playing
(`PromptInput`, `UIMockup`, `CardHandoff`), the four rules, the license note. It
carries no build step and no dependency, so what you open locally is what ships.

Live at <https://scenes.armonia.io>.

**Pushing to `main` publishes it.** `.github/workflows/showcase.yml` renders the
scenes from source, runs the measurements, and deploys only if they all pass.
This exists because the page once spent days showing `OrbitLoop`, a scene that
had already been deleted: the code was current, the `.mp4` files on somebody's
laptop were not, and a hand-run `wrangler pages deploy` had no way to know. Now
the videos cannot be older than the commit.

The deploy step needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo
secrets. Without them the workflow still renders, still measures, and still
uploads the videos as run artifacts, so it is useful on day one and a CI nobody
has to switch on:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo armonia/scenes
gh secret set CLOUDFLARE_ACCOUNT_ID --repo armonia/scenes  # 628858edcbd8e54fd59d77358b575cb1
```

To publish by hand instead:

```bash
./scripts/showcase-build.sh
npx wrangler pages deploy showcase/dist --project-name scenes
```

Re-render before building whenever a scene changes. The script refuses to
assemble a page whose videos are missing, but it cannot tell a stale render
from a fresh one, which is the whole argument for letting CI do it.

## Adding a scene

The order matters, and step 4 is the one people skip.

1. **Write it in `video/src/scenes/`.** Take `progress?: number` and derive
   everything else from `useCurrentFrame()`. If you reach for `Date.now()`,
   `Math.random()` or a CSS keyframe, the scene is no longer reproducible and
   `framelocked-verdict.sh` will say so.
2. **Reuse `primitives/`.** `slab.ts` holds the geometry and the camera poses,
   `SlabChrome.tsx` the app furniture. A scene that redraws its own sidebar can
   only stay aligned with the others by hand, and it will not.
3. **Register it in `Root.tsx`** with an explicit `durationInFrames`.
4. **Give it a check that can fail.** Every scene here has one bench that
   fails when the scene's own promise is broken: `beats.sh` for the four beats,
   `handoff-travel.sh` for the card crossing. Write the negative control first,
   confirm it exits non-zero on a broken input, and only then trust the pass.
   `npm run lint` proves nothing about a video.
5. **Add it to `showcase/index.html` and `showcase-build.sh`**, and to the
   render list in the workflow.
6. **Push.** CI renders, measures, deploys.

If your scene is meant to follow another without a cut, read the previous
scene's end pose from `slab.ts` rather than retyping the numbers, then add it to
`seam.sh`. Two copies of the same pose stay equal exactly as long as nobody
edits one of them.

## Licensing, which has two halves

**Our code is MIT** (see `LICENSE`). That covers everything under `video/src`,
written from scratch.

**Remotion is not MIT.** It carries its own license, and a company above a
headcount threshold needs a paid company licence to render with it. Nothing in
the MIT grant above covers that. It is between you and Remotion, so check
[remotion.dev/license](https://www.remotion.dev/license) before rendering
commercially.

Of the scene libraries surveyed in `CATALOG.md`, only
[Curvable/motion](https://github.com/Curvable/motion) carries a license (MIT).
The other two carry none, which means all rights reserved rather than public
domain, so no code is taken from them. Copyright protects the code, not the
effect. Studying what an effect does and then writing it yourself is the whole
method here.

## `ref/` is deliberately not committed

Four product commercials pulled with `yt-dlp`, plus the keyframe contact sheets
made from them. They are somebody else's copyrighted work, kept as study
material. Verification happens on the render, with our contact sheet set beside
the reference's, so the reference has to be on disk. Fetch it again with:

```bash
mkdir -p ref && cd ref
for id in 7gZBxBTapDQ ovxL42LkKNg _gBF27M7NHI uJ70iGerYzE; do
  yt-dlp -f 'bv*[height<=1080]+ba/b' -o "$id.%(ext)s" "https://www.youtube.com/watch?v=$id"
done
```

Two of those are Linear (*Introducing Linear Diffs*, *Loops in Linear*) and they
are the ones that matter. They are the only two of the four that are motion
graphics. The other two are live action, an actor and a camera, and no library
makes those.
