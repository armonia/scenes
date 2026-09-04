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

That rule was an assertion until one scene had to enter from another. Two clips
that both start and end at rest can be placed in any order without anyone seeing
a cut, because there is no motion to break. `CardHandoff` starts from the pose
`UIMockup` stops in, both reading it from `primitives/slab.ts`, and `seam.sh`
diffs the two frames to prove it.

One measured join makes the rule true of a pair. `CardFocus` is the third link:
it enters from the pose `CardHandoff` stops in and descends onto the card that
scene has just delivered, magnifying it 2.35 times. `seam.sh` now takes the pair
as arguments, because a join exists for every adjacent couple and hardcoding the
paths meant a second script identical to the first but for two lines. Across the
six scenes yaw runs -18, -9, -4, 0, 0, -34 and pitch 5, 2.5, 1.2, 0, 0, 3.2. It
reverses twice, at CardRelease and at BoardOrbit, and both times between two
poses that are at rest: where the join is still there is no derivative to flip.
In motion it never reverses: a join reads as a cut when the derivative flips, even when the pixels
match.

`PromptInput` used to stand on its own, and the reason is worth keeping because
it was not laziness. It drew a slab of its own — 2200 wide at perspective 2800
and scale 1.045, with its own chrome and its own sidebar — which made it a
second screen, and between two different screens the passage is a cut whatever
you do with it. So the thirteen seconds that hold half the film's performance,
the typing, the pause, the click, the streaming answer, sat outside the chain
while the other twenty-eight were joined.

Putting it in was not a swap of constants. The board only ever used the top half
of the slab; the bottom half was empty, which is also why the frames read as a
mockup rather than as a screen in use. The assistant thread and the composer now
live down there, in `primitives/Assistant.tsx`, drawn by every scene — if only
one scene drew them, the join before it would show half a screen appearing out
of nothing, and `seam.sh` would call that a cut, correctly. With one screen the
move from the board to the composer stops being a change of screen and becomes a
camera descending, which is a movement the catalogue already has a name for.

Five scenes at that point, 1310 frames, and four measured joins.

Four more of the catalogue's movements went into the film after that, and they
are all one gesture. `CardHandoff` used to fly the card across on an
interpolation with nobody touching it, which reads as an animation; now the
cursor arrives on an arc with a small overshoot, presses, and the card follows
the hand three frames behind, tilting into the direction of travel. Getting that
into a scene needed the pointer's *position* and not just its drawing, so
`Cursor.tsx` exports `pointOnPath` and keeps the arrow to itself — the
alternative was a second copy of the trajectory inside the scene, equal to the
first exactly as long as nobody touched one of them. The extraction was checked
by re-rendering `PromptInput` against its previous file: five of six sampled
frames identical, one off by a single pixel.

Then the board answers in a chain rather than all at once. The card lands, the
destination count moves five frames later, and six frames after that the card
rewrites its own age from `12h` to `ora`. The third link was supposed to be the
detail panel — the catalogue said so — and looking at the render said otherwise:
at that pose the camera is close enough that the panel runs off the right edge,
labels visible and values not. A link of the chain outside the frame is not a
link. Before this, the count and the panel both flipped on the same frame at
mid-travel, which is precisely the defect the entry describes: three things
changing together read as three unrelated things, and it is the delay that reads
as cause.

And while the answer streams in `PromptInput`, everything that is not the answer
drops to 0.62 — the board above, the earlier messages, the composer. Not a blur:
nothing becomes unreadable, only the place where the contrast is full moves.

The film ends on an orbit, which is the one thing a product piece says once:
this is an *object*. Seen frontally, an inclined plane with UI on it is
indistinguishable from wallpaper glued to the background, and until `BoardOrbit`
nothing in the chain ever turned far enough to prove otherwise. It stops at 34
degrees of yaw, just under the 40 where the board foreshortens below sixty per
cent of its width and the titles stop being titles, and it holds still for the
last 32 frames so the piece finishes on a pose rather than on an interrupted
move.

The thickness it shows — `SlabEdge` — is drawn by all six scenes and visible in
exactly one, because at small yaw angles it sits precisely behind the slab. It
is a *sibling* of the slab and not a child, and that is not a detail: the slab
clips, any clipping flattens `preserve-3d`, and a child at `translateZ(-30)`
would be squashed onto its parent's plane and never stick out. The same fact is
why the parallax truck is still unwritten: per-layer depth inside the slab needs
the clipping moved somewhere else, in every scene, which is a restructure and
not an addition.

Six scenes now, 1460 frames, 48.7 seconds, five measured joins: 557, 64, 55, 29
and 15 pixels.

## Ten of thirty demos tore on every pass

The page's demos run on a loop. Ten of them were one-way animations — a camera
that pushes in and stays in, a graph that draws itself and stays drawn, a board
that fills and stays full — so the last frame had nothing to do with the first
and every pass ended in a hard cut. On a page whose entire subject is why you do
not cut. `GIU-04` changed 28 per cent of the frame at the join.

Nobody reads that as "the demo restarted". It reads as the site stuttering,
which is exactly how it was reported.

The fix is one shared idea rather than ten patches: a round-trip profile, and a
virtual clock for the demos whose state is a function of a running frame rather
than of a 0-to-1 parameter — a board filling in has no `t` to invert, it has a
clock to run backwards. The return leg is not part of the movement and the
readout says so: better a declared leg home than a tear every pass. Two demos
did not need a rewind and got something truer instead: the streaming answer
scrolls up and out the way the app would, and the shared-word sentence swaps back
in the opposite direction, so the loop is `join → pose → join`.

`loop-close.py` measures it, and finding the right question took three wrong
ones. Against the demo's *typical* motion, the demos that sit still between
discrete beats have a median of zero and every join looks infinite. Against the
demo's *largest* step, a demo that also cuts internally takes its own cut as the
reference and absolves itself — `CHR-02` scored 652 against 652, the same defect
counted twice. The question that works is simpler: **is the last frame one step
away from the first, or somewhere else entirely?** Compare the wrap against a
normal one-frame step taken at the same place in the loop.

It measures the cut in the middle too, and getting there took giving up on being
clever. Half the entries show the right case and then the wrong one, and in the
handover between the two they can restart from scratch — the same cut, somewhere
else in the loop. Hunting for it did not work: a cut and a **fade** look too much
alike. Counting pixels over a threshold, a linear fade spikes halfway through —
that is where most pixels cross at once — so the bench flagged a line of text
leaving the frame, which is the most continuous thing on the page. With a mean
difference the spike goes away and the measure becomes so sensitive it flags
everything.

The answer was not a smarter metric, it was to stop guessing: every two-part demo
**declares** the frame it changes on, and the bench looks there. It is the same
bargain `seamAfter` strikes in `catalog.json` — the scene says where the join is
and the bench measures it — and it holds for the same reason: a declared join can
be measured exactly, a guessed one cannot.

Pointed at the declared frames it found exactly one survivor, and it was the one
being reported: `CUR-03` changed 547 pixels in a single frame against zero in its
neighbours, because the answer to the click sat there until the half ran out and
then vanished. It resolves now instead — the work finishes, which is what the app
would do — and that is not a rewind: nobody sees the line write itself backwards.

One more defect, and it was the one that showed. `TYP-02` grew its keyword by
changing its font size inside a single flex line — and changing the size changes
the box, so the line recomposed, the wrap point moved, and halfway through the
growth the whole sentence jumped 147 pixels. Exactly the opposite of what the
entry claims. The keyword now has a row of its own and grows with a `scale()`,
which does not touch layout, so the other words move 0.00 px — measured, not
asserted. It is also closer to the references, where the enormous word is alone.

## Typography, where the sentence is the film

Ten entries with no interface on screen at all. They come from three reference
films the type direction was read off — a SaaS promo, a Spotify spot, an Apple
Business Essentials piece — and their common DNA: the typography *is* the film,
one phrase per beat, always centred, heavy sans with tight tracking, scale
contrast so one word per beat becomes enormous, and colour on the keyword only.

That DNA also said **hard cuts on the beat, no continuous camera**, which is the
opposite of this repo's founding rule. It is not a contradiction to paper over,
so here is how it resolves: the references chosen *later* moved the other way on
their own. Apple's Creator Studio film has five cuts in thirty-five seconds and
is continuous transformation rather than editing; the three shots picked for the
UI direction have **zero**; Linear's and Vercel's have zero. These four entries
sit on that side. `TYP-04` is the clearest case — it is this repo's join rule
written as a sentence: two consecutive lines share most of their words, and the
shared ones do not move a pixel while the one that changes is replaced.

**The dwell is measured, and it is the entry that matters.** How long a line
stays is not chosen by eye but in characters per second of *net* dwell — the
stretch in which the sentence is already composed and still, after the last word
has landed. Large type holds 15 to 16; over 20 the line is taken away while you
are still reading it. The declared window and the net dwell are not the same
number — with a staggered entry there are six frames between them — which is
exactly why the bench measures the net figure on the rendering instead of
trusting the constant. It reads 15.5 c/s against 24.9 across the two halves of
the demo. And the corollary is the useful part: to gain reading time *without*
slowing the cut down, tighten the entry stagger and lengthen only the dwell.
Widening the stagger looks like generosity and is theft, because every frame it
takes comes out of the only stretch where anybody is reading.

Six more went in after the first four were looked at, and they split into how a
line *arrives* and where it *sits*.

Arriving: a **mask** that uncovers each word from behind the edge of its own box
— the most common technique in the reference work, and the reason is that a mask
does not move the text, the word is already in place and only gets revealed. The
**grain of the stagger**, letter by letter against word by word: 23 entry moments
against 7 on the same sentence, which is the difference between a line that pours
and a line that lands in blocks. **Tracking** closing from 0.225em, the only
entrance that brings nothing in from off-frame — the sentence is all there and
only stops holding its breath. And **weight** landing from 300 to 800.

Two of those corrected the entry that described them, which is the point of
measuring. The weight one claimed weight was the axis that changes a word's ink
without changing the room it takes; the render disagreed in the first frame,
because the long line fitted on one row at 300 and wrapped at 800. It is now two
words, the width growth is stated (12 per cent) rather than denied, and the
lesson is written down: on a long line you either keep it short or lock the
width. Tracking had the same shape of problem one floor down — wide spacing
pushed the line onto three rows and tight spacing onto two, so the composition
redid itself mid-animation. Tracking *is* a layout property, which is the entry;
the demo is two words so the effect does not eat the composition.

Sitting: **the companion on another axis** — the small rotated line running up
the side in spaced capitals, which is what the references put next to every main
sentence. It does not compete because it is not on the axis the eye is following;
set flat underneath, the same words become a subtitle, and a subtitle is a second
thing to read. And **the sentence on the plane**, which is the entry that ties
this family to the rest of the repo: the type lives in the slab's own
perspective instead of sitting on the frame. If the film is an inclined object
seen by a camera, a sentence lying flat on the glass comes from a different film.
The bench measures it the cheapest way there is — on the plane the two ends of
the line differ (0.909), flat they are identical (1.000).

The page grew a second kind of stage for these. Type demos do not mount the slab
— mounting it and then covering it would render a kanban behind a word for
nothing, and the stage's perspective would falsify the type size. Same engine,
same frame lock, same HUD and scrub; what changes is what is inside. The body is
sized in `cqw` and not pixels, because in a real composition the type is a
fraction of the frame, and the proportion between word and frame *is* the content
of these entries.

One defect worth recording, because it is the same shape as others in here.
`TYP-04` first cross-faded the two swapping words in the same box, and at the
midpoint you saw `join` and `pose` overlapping — which does not read as one word
replacing another, it reads as a rendering error. The substitution is sequential
now: the old one leaves, then the new one arrives, and the two frames of empty
box between them are a beat rather than a hole. The box keeps its width the whole
time because the outgoing word stays in the flow while invisible, so the three
words that are supposed to stay put have no reason to move — and `demo-check.py`
measures that they move 0.00 px, against 77 in the half that replaces the whole
line.

## Speed is a number in `catalog.json`

Motion design is dense. The references this repo chases run 13 to 42 seconds and
fit more into them than there is in these 48. Going faster used to mean opening
every scene and rewriting a dozen constants — `GRAB 78`, `DRAG_END 176`,
`CAM_SETTLE 132` — keeping them consistent with each other by eye. That is the
kind of work that goes wrong silently: miss one and the gesture comes apart with
every bench still green.

Now the tempo *is* the duration. Each scene declares its beats against a
reference duration, and `durationInFrames` scales all of them: halving it halves
every beat inside the scene rather than cutting the tail off.

**But not everything scales, and that is the part that matters.** There are two
kinds of number in a scene. *Edit tempi* scale — when the hand arrives, how long
the travel runs, when the camera settles: those are rhythm decisions, and rhythm
is exactly what you want to change. *Perceptual thresholds* do not. The four
frames between a click and its consequence are not rhythm, they are the window
in which the eye ties a gesture to its effect — `click-gap.sh` measures that they
sit between 1 and 8, and at double speed they would be two, on the edge of
disappearing. The three frames the card lags behind the hand are the weight of
the object. The caret's fifteen-frame blink is a frequency, not a duration.
Scaling the second kind along with the first is how a faster scene becomes a
broken scene. `at()` scales; bare numbers do not; and every bare number in a
scene has the reason it stayed bare written next to it.

One of those got the sign wrong first time round, and only measuring caught it.
`cps` — the typing rate — is a *speed*, so it goes as the inverse of the factor:
half the duration needs twice the characters per second. Written as a
multiplication, a shorter scene got a *slower* typist, the send slid to 83 per
cent of the duration instead of 60, and `beats.sh` found the field still full
where it expected the placeholder.

`tempo.py` proves the mechanism the only way it can be proved: if the beats
scale, frame *f* of the short render is frame *f/k* of the long one. Compared
time-normalised the two renders differ by 287 pixels; compared without
normalising, by 5379 — nineteen times worse. And the 287 is not slop: it is the
signature of the thresholds that deliberately stayed put. At zero they would
have scaled too. Its negative control is the same scene truncated instead of
retimed, which is exactly what lowering the duration produced before any of
this, and there the normalised comparison is the wrong one.

Every bench with a hardcoded frame number now follows the duration too —
`beats.sh`, `handoff-travel.sh`, `contrast-floor.py` — because a bench that
looks at frame 430 of a scene that is now 300 frames long is measuring a scene
that no longer exists. They all pass on both the film and the retimed fixtures,
and that is the real regression guard: retime a scene and the perceptual
measurements still hold.

**Real UI, not a drawing of UI.** Slabs of the actual product on inclined
planes, with the product's own tokens, radii and system font stack. A mockup
that is 3px off reads as a mockup.

## Layout

| | |
|---|---|
| `video/` | The Remotion project. Scenes in `video/src/scenes/`, primitives in `video/src/primitives/` |
| `scripts/` | The measurements, the review page, the showcase build, and `catalog.mjs`, which is how shell and CI read `catalog.json` without a compiler. See below |
| `showcase/` | The public pages. `index.template.html` and `grammatica.html` are committed; the scene section and the renders are not, `showcase-build.sh` generates the first from `catalog.json` and copies the second into `showcase/dist/` |
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
./scripts/seam.sh [A.mp4] [B.mp4]                       # is the join really cutless
./scripts/handoff-travel.sh                             # does the card actually cross
./scripts/focus-sharpness.sh                            # does the text survive the push-in
./scripts/rest-point.sh [scene.mp4]                     # is the scene still at both edges
./scripts/click-gap.sh [scene.mp4]                      # does the UI answer the click, or fire with it
./scripts/fixture-screenshot.sh                         # build the scene focus-sharpness must fail
./scripts/demo-check.py [page.html]                     # do the catalogue demos still show their thesis
./scripts/loop-close.py [page.html]                     # does every demo loop close, or tear every pass
./scripts/contrast-floor.py [scene.mp4]                 # is the attenuated content still readable
./scripts/tempo.py [long.mp4 short.mp4]                 # does shortening a scene retime it or just trim it
./scripts/fixture-tempo.sh                              # render the two retimed fixtures
./scripts/fixture-trim.sh                               # build the trimmed scene tempo.py must fail
./scripts/fixture-attenuation.sh                        # build the scene contrast-floor must fail
./scripts/showcase-build.sh                             # assemble showcase/dist for deploy

node scripts/catalog.mjs render                          # the render command for every scene
node scripts/catalog.mjs measures                        # the benches the catalogue implies
```

`catalog.mjs` is not a check, it is how everything that is not TypeScript reads
`catalog.json`: the workflow gets its render and bench commands from it, and
`showcase-build.sh` gets the scene section of the page. Run `render` and pipe it
to a file to redo every scene from scratch — not straight into `sh`, because a
bench that reads standard input will eat the lines it has not run yet.

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
Measured on this machine: 552 pixels for the join, 18,019 for the cut. On the
CI runner the same two frames give 3,921 and 160,595, because a different
encoder puts different noise into both. The absolute counts are not portable and
the script does not compare them across machines; what it checks is the ratio
between the join and its control, which came out 32× locally and 41× on CI. If
the two ever came out close the script exits 2 and says the measurement separates
nothing, because a check that cannot fail is decoration. It does not demand
zero either: two frames survive two independent H.264 encodes, so the bar is a
fraction of pixels past a perceptual tolerance, not byte equality.

`focus-sharpness.sh` is the only bench here whose first version was thrown away
after it had already gone green. It compared the card crop against a blurred copy
of itself, which sounds reasonable and measures nothing: that ratio stays high
even when the source is already mush, because it is relative to itself. Put
against a scene built by magnifying a still, exactly the defect it exists to
catch, it scored 4.14x and passed it. The version that ships builds the
counterfactual from the render's own first frame instead, so both readings are
the same content at the same pixel size and the only remaining difference is the
scale the pixels were rasterised at. Measured: 2.09x on the real render, 1.03x on
the fixture, threshold at the geometric mean of the two.

`rest-point.sh` turns the rest-point rule into a number, and finding the right
number took two wrong ones. Consecutive frames measure nothing here: these
cameras move fractions of a degree per frame, and mid-way through a scene where
somebody is typing, well under a tenth of a per cent of pixels change, which is
barely more than the edges. Five frames apart the signal separates. Its first control was wrong too:
`CardHandoff` is documented as the scene that does not start at rest, and that is
true of its *pose* and false of its *velocity* — it eases in and out, so it
starts still like everything else. The control that works is the one `seam.sh`
already uses: a pair taken from the middle of the same scene. It asserts only on scenes that declare `restAtEdges` in
`catalog.json`, and what counts as still is a ratio rather than a number: the
same renders read five to ten times higher on Linux than on macOS, so a threshold
tuned on one platform fails three scenes out of five on the other. An earlier
version appeared to pass everything only because ffmpeg was consuming the loop's
input and it was measuring a single scene.

A bench for the pause before the send was written and then deleted, which is
worth recording because the reason generalises. Measuring stillness by
frame-to-frame pixel difference cannot separate a deliberate hold from a slow
settle: these cameras move fractions of a degree per frame, so a threshold low
enough to call the hold "still" also calls the settle still. Pointed at
`CardHandoff`, which has no composer and never pauses, it reported a confident
40-frame pause. It promoted its own worst case, the same way the first
`focus-sharpness.sh` did, and unlike that one it could not be repaired by
changing the control. Measuring this needs the pointer's position, not the whole
frame. On the catalogue page the pointer does have a position, so
`demo-check.py` measures the pause there: 20 frames between the hand landing on
the button and the button going down, against 0 in the half of the loop that
shows the same press with no wait at all. On the render it is still unmeasured.

`demo-check.py` measures the catalogue page rather than a render. Every entry on
`grammatica.html` states a thesis and runs a demonstration next to it, and the
difference between a demonstration that shows its thesis and one that only sits
there is almost always temporal: two events five frames apart instead of on the
same frame, a delay that follows distance instead of index. Screenshots cannot
see that, so the script drives each demonstration frame by frame in a headless
browser and reads the elements' own rectangles and computed styles. It does not
read the on-screen readout: that line is the demonstration's own claim, and
having a claim confirm itself is not a measurement.

It found two entries that were not demonstrating anything. `CAM-02` promised that
the layers come apart under a truck, and at the wide pose the repo's z offsets
buy four pixels of shear over the whole move — real, and invisible. The truck now
runs pushed in at 780, where the same offsets, unexaggerated, are worth nineteen,
and the demonstration measures them on the rendering instead of asserting them.
`CHR-02` promised a stagger that follows distance rather than index, and
demonstrated it by removing a card from a column so that its one neighbour moved
up: in a single column the two orderings are the same ordering, so the entry
could not have shown its own point. It now settles the whole board outward from
the change, where the correlation between delay and distance is 1.00 against 0.43
for the same spread staggered by reading order.

Its own negative control is a copy of the built page with one line changed, so
that `CHR-03` fires its three events on separate frames in both halves and the
contrast disappears. The script has to exit non-zero on that copy and name the
entry, or its green means only that it reached the end.

`contrast-floor.py` measures the number `CAM-05` had been asserting. The
catalogue says the attenuation floor is 0.62 *because* below it the attenuated
content falls under 3:1 once rendered — and nobody had ever rendered it and
looked. It now reads the WCAG ratio between the attenuated thread heading and its
background on a real frame, with the crop projected out of `slab.ts` instead of
picked by eye, and gets 4.17:1 here — 3.84:1 in CI, because Linux renders the
same text with different fonts. Same verdict, and a reminder of why the number
is a floor and not an equality. The same scene rendered at 0.25, which is what
`attnFloor` exists for, collapses to 1.71:1 and the bench fails it.

It took two wrong versions to get there. The first measured the composer's
placeholder and failed the scene at 1.76:1 — right reading, wrong subject:
"Chiedi qualcosa" is deliberately faint and sits at 2.93:1 with no attenuation
at all, so the bench was failing `CAM-05` for a decision about the input field.
A placeholder is not content.

The second measured real content in a place that moves. Messages have natural
heights and the thread is anchored to the bottom, so the instant the font
metrics differ — which is exactly what happens between this machine and the
Linux in CI — everything shifts and a fixed crop lands on empty background. It
exited 3 there, "could not measure", which was at least the honest answer rather
than a verdict about a scene that was fine. The heading it reads instead sits at
`THREAD_TOP`, which is a constant, so its position is arithmetic. The same
lesson `slab.ts` already records about card heights, learned again one floor
down.

How it reads matters too: background is the modal value of the crop, foreground
is the mean of the *glyph core*, the pixels above sixty per cent of the way from
background to maximum. Percentiles were not enough — on a crop where text is a
small fraction of the pixels, the 97th percentile is still measuring background,
and the same scene read 2.59:1 or 4.17:1 depending on how much text happened to
fall inside the rectangle.

`beats.sh` was not running anywhere, and had not been for months. It is not in
the workflow's measurement step, and on the machine these scenes are written on
`tesseract` was never installed — so every OCR read came back empty, every count
came back zero, and the verdict came back "the answer is never visible". A
diagnosis about the scene for a missing tool, which is the same shape as the
`handoff-travel.sh` failure below and the reason that one is described at
length. It now refuses to give a verdict without the OCR: exit 3 means it could
not measure, which is a different thing from exit 1, which means it measured and
the scene is wrong. It runs in CI, and CI proves both halves — that it passes
with `tesseract` present, and that it exits 3 with only `tesseract` taken away.
Taking the whole `PATH` away instead would have proved nothing: the script would
have died at 127 for want of a shell.

`click-gap.sh` was repaired after it reported a click, with confidence, ninety
frames before the real one. Its rule was "the hit is the first frame whose
changed-pixel count is at least five times the window median", which held while
the camera drifted through the whole scene. Once the camera settles before the
performance — which is how it should be shot; nobody moves the camera while
somebody is typing — half the frames in the window change nothing at all, the
median is zero, and five times zero is any flicker at all. It promoted the first
typed character. The baseline is the ninetieth percentile now: still a ratio
inside the window, which is the rule every threshold here follows, but it does
not collapse on a locked-off shot. On a window with no motion at all it reports
no click rather than inventing one. All five negative controls still fail.

`rest-point.sh` said one thing and did another. It prints, correctly, that its
verdict applies only to scenes declaring `restAtEdges` and that the others are
measured rather than judged — and then exited 2 on a scene that declared
nothing, because `PromptInput` holds the camera still through the performance,
so its middle control sample is as still as its edges and the instrument cannot
tell a locked shot from a freeze frame. That check now runs only against scenes
that promised something. A file passed as an argument still counts as a promise,
which is what keeps the freeze-frame control failing.

`handoff-travel.sh` needed a crop it did not need before, and this is the cost of
putting the assistant on the slab. It isolates the travelling card by diffing
whole frames, which worked while the bottom half of the slab was empty. With a
thread down there — static relative to the slab, but moving with the camera like
everything else — thousands of high-contrast text pixels drag the centroid down.
The reading fell from 154px to 83 and invented a backward step: the scene blamed
for a change in the instrument's surroundings. It now diffs only the board's half
of the frame, and where that half ends is read from `slab.ts` rather than picked
by eye, so it follows if the assistant moves.

`handoff-travel.sh` had never run on macOS. Its centroid step was a heredoc
inside a process substitution, which bash 3.2 cannot parse, so the script died
before the first sample and printed "the card does not travel": a diagnosis about
the scene for a fault in the equipment. CI runs bash 5 and went green, which is
why it stayed invisible from one side and total from the other. The Python now
lives in `scripts/_centroid.py`.

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

`showcase/index.template.html` is the public page, and it is a template: the
scene section is generated from `catalog.json` by `showcase-build.sh`, so a
render that exists and a page that shows it cannot drift apart. Open
`showcase/dist/index.html` after a build to see it. It carries the six scenes
playing
(`UIMockup`, `CardHandoff`, `CardFocus`, `CardRelease`, `PromptInput`,
`BoardOrbit`, in the order they join), the four rules, the
license note. Beside it, `showcase/grammatica.html` is the catalogue: twenty-six
movements with a live demo each, the numbers they start from, and the bench that
can fail them. The demos are browser re-creations of the slab, not the renders,
which is the point of keeping them next to the renders rather than instead of
them. Neither page carries a build step or a dependency, so what you open
locally is what ships.

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
gh secret set CLOUDFLARE_API_TOKEN --repo armonia/scenes   # Pages:Edit
gh secret set CLOUDFLARE_ACCOUNT_ID --repo armonia/scenes  # npx wrangler whoami
```

Make the token at
[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
with **Cloudflare Pages:Edit** on this account and nothing else. The credential
`wrangler login` leaves on a laptop is not a substitute: it is an OAuth token
that expires within the hour and carries account-wide scope, so pasting it into
a repo secret would give a public repo's CI broad access to the account and stop
working before anyone noticed. A scoped token is the smaller and the more
durable option at the same time.

The Pages project is still called `remotion-scenes` while the repo is `scenes`.
Cloudflare cannot rename a project, and `scenes.armonia.io` is a CNAME to that
project's hostname: creating a correctly named project and moving the domain
onto it took the site down with 522s until the domain was moved back. The
internal name is invisible from outside, the outage was not.

To publish by hand instead:

```bash
./scripts/showcase-build.sh
npx wrangler pages deploy showcase/dist --project-name remotion-scenes
```

Re-render before building whenever a scene changes. The script refuses to
assemble a page whose videos are missing, but it cannot tell a stale render
from a fresh one, which is the whole argument for letting CI do it.

## Adding a scene

The order matters, and step 4 is the one people skip.

0. **Decide the pose it enters from and the pose it leaves in**, and put both in
   `primitives/slab.ts`. `CARD_HANDOFF_END_POSE` spent three scenes as three
   literals inside `CardHandoff.tsx`, which was fine exactly as long as nothing
   came after it.
1. **Write it in `video/src/scenes/`.** Take `progress?: number` and derive
   everything else from `useCurrentFrame()`. If you reach for `Date.now()`,
   `Math.random()` or a CSS keyframe, the scene is no longer reproducible and
   `framelocked-verdict.sh` will say so.
2. **Reuse `primitives/`.** `slab.ts` holds the geometry and the camera poses,
   `SlabChrome.tsx` the app furniture. A scene that redraws its own sidebar can
   only stay aligned with the others by hand, and it will not.
3. **Add one entry to `video/src/scenes/catalog.json`** — id, slug, duration,
   the blurb for the page, and `seamAfter` if it follows another scene — then
   the one line in `COMPONENTS` in `Root.tsx` that binds the id to the import.
   That entry is what the render step, the generic benches and the showcase
   page all read: there is no second list to keep in sync. Leave out the
   `COMPONENTS` line and the project refuses to load and says which id is
   unbound, which is the one failure mode a JSON file cannot cover on its own.
4. **Give it a check that can fail.** Every scene here has one bench that
   fails when the scene's own promise is broken: `beats.sh` for the four beats,
   `handoff-travel.sh` for the card crossing. Write the negative control first,
   confirm it exits non-zero on a broken input, and only then trust the pass.
   `npm run lint` proves nothing about a video.
5. **Push.** CI renders, measures, deploys — the scene is on the site without
   any of those three files being touched. Rendering only happens when it can
   change something: the renders are cached under a key made of the scene
   sources, the dependencies and the benches, so a push that only touches the
   page or the README reuses the videos that already passed and goes straight
   to the deploy. Change a scene or a bench and the full run comes back.

If your scene is meant to follow another without a cut, read the previous
scene's end pose from `slab.ts` rather than retyping the numbers, and name that
scene in `seamAfter`. Two copies of the same pose stay equal exactly as long as nobody
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
