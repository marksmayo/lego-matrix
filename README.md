# THE MATRIX — opening sequence, in ABS

Scenes 1 through 11 of the Wachowskis' screenplay (`opening.md`, Rev. 3/9/98),
staged as a real-time animation in the browser with **three.js** and
**cannon-es** rigid-body physics — and performed entirely by LEGO
minifigures.

Runtime is about **4 minutes 25 seconds**, in ten scenes. The screenplay's
dialogue is both captioned and performed, the score is original, and every
sound is synthesised in the browser.

## Running it

ES modules need to be served over HTTP — opening `index.html` from the
filesystem will not work. From this folder:

```bash
python -m http.server 8000
# or: npx serve .
```

then open <http://localhost:8000>.

three.js and cannon-es load from unpkg via an import map, so the first load
needs a network connection. Nothing else is fetched — no textures, no models,
no audio files. Everything you see and hear is generated at startup.

**Controls:** `space` play/pause · `←` `→` previous/next scene · `m` mute ·
`r` restart. Move the mouse for the transport bar and the scene list.

## What's actually being simulated

| | |
|---|---|
| **Scale** | 1 world unit = 1 stud pitch = 8 mm. Brick height 9.6 mm (1.2 u), plate 3.2 mm (0.4 u), stud Ø 4.8 mm, and the 0.2 mm part gap that makes a 2×1 brick 15.8 mm instead of 16. A minifigure is 40 mm to the crown, so the scale to a person is roughly 1:42 — which is why the 40-foot rooftop gap in scene 9 is exactly **36 studs** of nothing. |
| **Bricks** | Every part is chamfered `ExtrudeGeometry` plus real studs, cached per footprint and drawn instanced. A wall is courses of 1× and 2× bricks with staggered joints and per-brick colour variation, because a monochrome extrusion doesn't read as plastic. |
| **Minifigures** | Correctly proportioned and correctly limited: rotation at hips, shoulders and neck, no knees, no wrists, no elbows. All the choreography is built from what a minifig can actually do — which is why the fight lands its hits on cuts. |
| **Physics** | The door of Room 303, four police officers, a hall window, a stairwell window and one telephone booth all come apart into their component parts, each with its own rigid body. Gravity is tuned (−420 u/s² rather than the geometrically correct −1226) so plastic falls like plastic on camera. |
| **Sound** | Web Audio only: the 440 + 480 Hz US ring cadence, a 1998 modem handshake, gunfire, a diesel engine, tyre squeal, breaking glass, and the bandpassed clicks of ABS hitting concrete. |
| **Voices** | Every line is spoken through the browser's own speech synthesiser. Each character has a fixed casting decision — which installed voice, and a baseline pitch, rate and volume — and each line carries an acting note (`urgent`, `cold`, `shout`, `weary`, `dread`) that modifies it. No actor is imitated and no audio is shipped. |
| **Score** | Ten original cues in `core/score.js`, one per scene, as a 16-step sequencer over the same master bus: sustained drones, an industrial pulse, tritone stabs, a driving sixteenth ostinato for the fight, and one held low note for the bullet-time. Written in the idiom; nothing transcribed. |
| **Grade** | Bloom, then a custom pass for the green cast in the shadows, radial chromatic aberration, vignette, grain, and scanlines while we're inside the screen. |

## Structure

```
index.html            import map, transport UI, subtitle layer
styles.css
opening.md            the source screenplay
src/
  main.js             director: builds acts, runs the clock, wires the UI
  script.js           every line of dialogue on a global timeline + chapters
  core/
    legoParts.js      brick / plate / tile / slope / stud geometry, instancing
    legoBuild.js      walls, floors, facades, roofs, stairs, streets, lamps
    minifig.js        the rig, its poses, its props, and disassemble()
    faces.js          printed faces and torsos, painted to canvas at runtime
    props.js          sedan, cruiser, garbage truck, phone booth, workstation
    materials.js      ABS, trans-clear, chrome, rubber, glow
    physics.js        cannon-es world, part release, shatterInto()
    anim.js           easing, keyframed camera, seek-safe one-shot cues
    actor.js          blocking helpers: move, jump, follow, driveAlong
    audio.js          effects, engines, ring cadences — all oscillators
    score.js          ten original cues on a 16-step sequencer
    voices.js         casting and acting notes for the speech synthesiser
    subtitles.js
  fx/
    rain.js           the CRT canvas, and the glyph volume behind it
    particles.js      tracers, muzzle flashes, sparks, smoke, light cones
    post.js           bloom + grade chain
  sets/
    hotel.js          Room 303 and the burnt corridor, shared by four acts
  acts/
    01-screen.js      1  ON COMPUTER SCREEN
    02-room303.js     2  INT. HEART O' THE CITY HOTEL
    03-exterior.js    3  EXT. HEART O' THE CITY HOTEL
    04-fight.js       4  the arrest goes wrong (shots 11-41 of the sheet)
    05-operator.js    6  Trinity calls the Operator
    06-escape.js      7  INT. HALL / 8 EXT. FIRE ESCAPE
    07-roof.js        9  EXT. ROOF — the 40-foot jump
    08-dive.js        10 EXT. WINDOW / A10 INT. BACK STAIRWELL
    09-street.js      11 EXT. STREET — the booth and the truck
    10-title.js       title, assembled one stud at a time
```

Each act is a self-contained module exporting `{ slug, start, end, build(ctx) }`.
`build` returns `{ group, enter, exit, update(t, dt, ctx), reseek(t) }` and every
animation is a pure function of act-local time, so any moment can be scrubbed to
and any scene replayed. One-shot events (a door exploding, a booth being
demolished) run through a cue scheduler that fires them silently when you seek
past them, so state stays consistent without replaying the fireworks.

## Scene 4, and the shot sheet

The 303 fight is the one scene built from a shot list rather than from prose,
because the screenplay covers it in two paragraphs and the film covers it in
thirty-one shots. Working from the opening's 43-shot / 92-panel camera
worksheet, scene 4 runs thirty seconds and follows shots 11 to 41 in order:
the cuffs, her eyes, the spin, **the arm**, the nose, the scream, the
anticipation, **the suspended kick**, the feet, the cop flying back into
another cop, **the chair**, the gun, **the wall run**, the landing, the grab
and spin, the shot, the last kick, and the long down shot where she turns to
look at what she has done.

Two of those needed capabilities the rest of the piece didn't have:

- **Shot 19, the suspended kick** (3.4 seconds — three times the length of
  anything around it, and the first bullet-time shot in the film). The physics
  solver takes a `frozen` flag: every loose brick in the room stops exactly
  where it is while the camera walks 200° around her, rising the whole way. The
  practicals stop flickering too, because a held frame that still flickers
  reads as a stutter rather than as stopped time. A rim light tracks opposite
  the lens for the entire orbit — a minifigure moulded in black on a dark set
  has no silhouette otherwise.
- **Shots 28–31, the wall run.** `orient()` in `core/actor.js` builds a
  figure's orientation from a basis rather than a yaw, which is the only way to
  stand a minifigure sideways on a wall. Gravity is a suggestion.

And the film's "breaks arm" is played completely straight, because a minifigure
has no elbows and cannot throw a punch: the arm comes off, and the officer
looks at where it used to be.

## Notes on the adaptation

- Nothing in the screenplay is skipped, and no dialogue is paraphrased.
- "Blood erupting" is rendered the only way a brick-built film can render it:
  a burst of dark red 1×1 round plates.
- Trinity's escape through the phone is not shown, exactly as it isn't in
  scene 11 — the frame just gets one beat of green where she was.
- Agents' faces are printed and therefore cannot change expression, so
  "Agent Smith almost smiles" is played entirely with the neck joint.

## Performance

Targets 60 fps at 1080p on a discrete GPU; the heaviest moments are the
gunfight (up to ~400 live rigid bodies) and the rooftop wide shots. If it
struggles, the cheapest wins are lowering `renderer.setPixelRatio` in
`src/main.js` and reducing `MAX_BODIES` in `src/core/physics.js`.

## Test harness

Two headless tools, both run against a local server:

```bash
python -m http.server 8123
```

**`_smoke.html`** builds every act and steps the whole 253-second timeline,
then seeks backwards into each scene, reporting any error per scene:

```bash
chrome --headless=new --disable-gpu --virtual-time-budget=900000 \
  --dump-dom http://localhost:8123/_smoke.html
```

**`_clip.html`** steps the timeline and tests every visible figure's feet and
torso against that scene's own static colliders, reporting the worst sink,
float and wall-penetration per figure per scene. Analytic rather than raycast
on purpose: a brick wall is one InstancedMesh with hundreds of instances, and
raycasting thousands of samples against those costs minutes. It is what caught
the systematic bug where `tiledFloor` placed tiles' *undersides* at the
requested height, so every figure in every scene stood one plate deep in the
floor:

```bash
chrome --headless=new --disable-gpu --virtual-time-budget=900000   --dump-dom http://localhost:8123/_clip.html
```

**`_sheet.html`** renders a contact sheet of key frames into one image, which
is the only practical way to judge staging without watching four minutes in
real time. It warms each cell up from its act's first frame, so physics debris
and one-shot cues are in the right state when the frame is taken:

```bash
chrome --headless=new --disable-gpu --virtual-time-budget=900000 \
  --window-size=1920,1640 --screenshot=sheet.png \
  http://localhost:8123/_sheet.html
```

Query parameters: `?shots=3,26,71.2` picks the timestamps, `?cols=3` sets the
grid, and `?flat=1` floods the set and disables the grade so framing can be
judged separately from lighting. Each cell is logged with the camera position,
the FOV, the live rigid-body count, and — via a raycast down the lens — what
the camera is actually pointing at and how far away it is. That probe is what
found the light cone filling the frame in the hotel, and the garbage truck
parked on top of its own close-up.

## Credits

Screenplay by Larry & Andy Wachowski, Rev. 3/9/98. Scene 4's shot order and
camera moves follow the opening sequence's published 43-shot camera worksheet.
All music is original to this project. This is a non-commercial
fan animation. LEGO is a trademark of the LEGO Group, which does not sponsor,
authorise or endorse it.
