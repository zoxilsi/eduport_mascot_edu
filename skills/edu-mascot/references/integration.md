# Bring Edu into your app

Edu is a browser-native SVG + CSS + JavaScript character. The core has no framework or network dependencies. The artwork and runtime are the originals from Eduport.

## Rights before integration

Implementation code and documentation are MIT. Edu artwork is reserved, including the SVG strings inside `mascot-art.js`, generator drawing data and rendered media. Read `LICENSE` and `ARTWORK-RIGHTS.md` at the repository or bundled skill root. Use the character in another project only within separate permission. These examples explain the implementation; they do not grant artwork rights. The MIT runtime can also be adapted to your own authorized artwork.

## Web setup

Copy `assets/` to a served directory, carrying `LICENSE` and `ARTWORK-RIGHTS.md` with it and preserving any separate artwork permission. Load `theme.css` before `mascot.css`; customize the theme tokens on `:root`, because speech and particles use a body-level overlay. Create a host such as `<div id="edu"></div>` and give it `width: 160px` in your stylesheet. Import `mascot.js` from a `<script type="module">` or a client-side component.

```js
import { mascot, watchInput } from './assets/mascot.js';
const edu = mascot('peek', { label: 'Edu, your study buddy', follow: true });
host.appendChild(edu.el);
edu.autoplay(true);
const stopWatching = watchInput(edu, textarea); // optional
// When leaving the view:
stopWatching();
edu.destroy();
```

Use one module version per page. The cache query in the original imports is intentional; retain relative filenames. In SSR frameworks, dynamically import after client mount: the module reads `window` and `document` at import time. In React, handle unmount during asynchronous import and call `destroy()` from effect cleanup. Vue/Svelte integrations follow the same lifecycle.

## Poses

| Pose | Use | Suggested width |
| --- | --- | --- |
| `peek` | Peeking over a ledge | 96–150px |
| `sit` | Seated companion | 120–180px |
| `sit-book` | Reading / explanations | 120–180px |
| `sit-magnifier` | Search / discovery | 120–180px |
| `sit-pencil` | Practice / writing | 120–180px |
| `head` | Textured avatar | 64–96px |
| `head-sm` | Filter-free small avatar | 32–40px |

Keep aspect ratios. The runtime inlines SVG and makes IDs unique. Static `<img>` works, but cannot expose SVG parts to the animation stylesheet.

## Controls

| Method | Behavior |
| --- | --- |
| `state(name)` | Persistent `idle`, `curious`, `thinking`, `happy`, `wave`, `sleepy` |
| `pulse(name, ms=900)` | Temporary mood, then idle/curious |
| `react(name)` | One-shot reaction; completion promise |
| `say(text, options)` | Speech; promise resolves when hidden, false if no placement fits |
| `talk(ms=500)` / `hush()` | Mouth movement / close bubble |
| `setPose(name)` | Change drawing on the same controller |
| `setLines(list)` | Customize tap copy; `[]` disables tap speech |
| `autoplay(on, {lookAt, skip})` | Small idle actions every 5–11 seconds while visible |
| `glance([x,y])` / `glance(null)` | Hold/release gaze; coordinates −1 to 1 |
| `look(element, ms=1200)` | Brief glance toward an element |
| `dip(true/false)` | Duck/pop at a ledge |
| `rest()` / `destroy()` | Interrupt action / remove instance and its resources |

Reactions: `tap`, `love`, `surprise`, `sad`, `cheer`, `nod`, `look-up`, `spot`, `twirl`, `lights-on`, `lights-off`. `spot` accepts `{at: element}`. Speech options include `{ms: 3000, place: ['left', 'above']}`.

Idle actions include sprout movement, a hop, tilt, yawn, wave, and reading/searching/jotting in prop poses. Occupied hands are protected automatically. Both hands hold the book; pencil and magnifier leave the left hand free.

Map real app events to states: request begins → thinking, success → cheer, request ends → idle. Keep important status in accessible text too. Use warm, brief speech that fits your product.

## Theme & accessibility

Set `document.documentElement.dataset.theme` to `light` or `dark`, then dispatch:

```js
document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'light' } }));
```

The runtime honors `prefers-reduced-motion` and pauses offscreen activity. Mascot click handlers are playful extras, not keyboard controls. If an action matters, expose a labeled native button and visible focus. Decorative mascots can omit the label. Never make speech bubbles the only source of essential information.

## Optional flying journey

Load `journey.css` alongside the core and import `journey` from `journey.js`:

```js
const trip = journey({ hero, footer, bento, label: 'Edu', avoid: [input, nav] });
```

`hero` and `footer` are connected, explicitly sized hosts. `bento` contains `.bento-perch` elements with `data-edu-station="doubt"`, `"quiz"` or `"course"` and optional `data-edu-pose`. Journey controls one traveling mascot, sprout rotor, trails, landing squash and scroll stations. `trip.ctl` is the core controller.

This is the original app choreography, not a generic router plugin. Adapt selectors and app events in the source, including `#main`, `#features`, `.footer`, `.bento-row`, `.dock-wrap`, and chat message/card classes. `chatLife` and `toChat` depend on those connections. `intro` expects logo nodes; the Eduport logo is not bundled.

Journey is a singleton without a public destroy API. Add a proper teardown before repeated SPA mounting. Avoid copying page-specific behavior blindly. The gallery previews the core; it does not wire the original journey.

## Native apps

Use the SVGs under `art/mascot/` as design sources. Native animation, Lottie and Rive require a separate port; this repository does not provide those runtimes. Preserve named groups, invisible pivots, gradients, layer order, timing and easing. Compare against the browser preview—SVG filters vary between renderers.

## Verify your integration

Check all used poses on mobile and desktop, both themes, reduced motion, duplicate instances, prop hand behavior, and unmount/remount. Confirm Edu does not cover inputs, navigation, video or dialogs. Core animation timing in `mascot.js`/`mascot.css` takes precedence over conceptual art notes.

## Maintaining this repo

- `python3 scripts/check.py` audits SVGs and verifies the bundled skill matches runtime assets.
- `python3 scripts/sync_skill.py` refreshes the portable skill after runtime/docs edits.
- `python3 art/mascot/src/build.py` regenerates drawings. Then run `python3 scripts/build_art.py` to refresh the runtime art module and skill.
- The README GIF is a preview, not the implementation. Do not reconstruct the mascot from its pixels.
