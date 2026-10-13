---
name: edu-mascot
description: Integrate Edu, Eduport's existing animated SVG mascot, into an app using the bundled original artwork and browser runtime. Use when a user asks to add or reuse Edu, preserving its design and motion.
---

# Edu mascot

Bring the original Edu into the user's app. Preserve the orange felt pear silhouette, two-leaf sprout, bead eyes, coral cheeks, stitched smile, palette and proportions. The bundled code is the implementation; do not recreate Edu with emoji, generated art or approximate shapes.

## Integrate

1. Inspect the app's framework, component lifecycle, styling and existing mascot placement. Follow the requested scope. If no placement is specified, start with one modest, unobtrusive companion.
2. Read [the integration guide](references/integration.md) for the API and lifecycle. Copy the required files from `assets/` into the app: `mascot.js`, `mascot-art.js`, `mascot.css`, and `theme.css` (or map its tokens into existing root theme tokens). Preserve relative module filenames. The skill works without the original repo checkout.
3. Load on the client after mount. The module accesses browser globals at import time. Append `mascot(pose, options).el` to an explicitly sized host; retain the controller. On unmount, call `destroy()`. In async client initialization, guard against the component unmounting before import completes.
4. Connect only relevant app events: loading → thinking, completion → happy/cheer, focus → curious. Keep tap copy short and app-appropriate with `setLines`. Use `autoplay` sparingly; honor reduced motion and offscreen pausing.
5. Test the rendered result, used expressions, mobile sizing, reduced motion, multiple instances and cleanup. Important actions/status need accessible app controls/text. The mascot's pointer interactions do not provide keyboard access by themselves.

## Preserve the rig

Keep gradients, clipping IDs, named SVG groups, invisible shoulder/sprout pivots and paint order. Inline SVG is required for motion; an `img` is static. Use `head-sm` for small avatars. Let the runtime namespace IDs and protect hands holding props. Do not stretch the drawings or apply broad SVG transforms that break the rig.

## Optional scope

`journey.js` and `journey.css` provide original scroll flight and chat choreography. Use them only when requested or directly relevant. Read the guide's journey section: it is tied to original selectors, runs as a singleton, and lacks public teardown. Adapt lifecycle and page wiring before using it in a routed app.

For native/Lottie/Rive targets, explain that a port is needed; use the browser rendering and original SVG geometry as reference. Do not claim the browser runtime is a native component. Publishing, installing packages or changing unrelated app configuration is outside this skill's implicit scope.
