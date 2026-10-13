// Edu, Eduport's study buddy: one plush character drawn in SVG (assets/mascot-art.js)
// and brought to life here with classes and CSS custom properties (assets/mascot.css).
//
//   const m = mascot("peek", { follow: true, label: "…" });
//   host.appendChild(m.el);
//   m.state("thinking"); m.pulse("happy", 900);  // moods: idle curious thinking happy wave (and sleepy)
//   m.react("cheer");                             // tap love surprise sad cheer nod look-up spot twirl lights-on lights-off
//   m.say("Ask me anything!");                    // a speech bubble; the promise settles when it hides
//   m.say("Hi!", { place: ["left", "above"], fits: (rect) => … });  // beside it, and only where it fits
//   m.autoplay(true, { lookAt: form });           // a small idle action every 5–11 s
//   m.setPose("sit-book");                        // the same Edu in another drawing (journey.js flies it)
//   m.glance([0, -1]);                            // keep looking up, until glance(null)
//   watchInput(m, textarea); scrollPeek(m);
//
// Tapping a mascot makes it giggle (quick taps: hearts) and now and then say a line.
// One timer, one animation-frame loop (onFrame, which journey.js shares), one
// IntersectionObserver and one pointer listener serve every mascot.
// Long loops only move outer HTML layers, which the compositor animates without
// repainting the felt filter; parts inside the SVG move for short events only.
// Offscreen mascots rest, and mascots removed from the page are cleaned up even
// when nobody calls destroy(). With reduced motion there is no autoplay, no particles
// and no travel; faces still change and bubbles still appear, without animation.
// No style="" markup anywhere: CSSOM writes only, as the page's CSP requires.

import { ART } from "./mascot-art.js?v=20261012120000";

const SVG_NS = "http://www.w3.org/2000/svg";
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
let still = motionQuery.matches;

const live = new Set(); // every mascot that has not been destroyed
const byEl = new WeakMap();
const byCtl = new WeakMap();
let seq = 0;

const now = () => performance.now();
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Short, warm lines in Eduport's teacher voice. Pages can pass their own `lines`.
const LINES = [
  "Ask me anything!",
  "Stuck on a doubt? Let's crack it together.",
  "No question is too small. Go on, ask!",
  "Physics, Chemistry, Maths, Biology… try me!",
  "Every topper started with a question.",
  "Let's learn something new today!",
];
const LOVE_LINES = ["Hehe, that tickles!", "Aww! Now, what shall we learn?", "Okay, okay, I'm wide awake!"];

// Which paws are busy holding a prop (art/mascot/README.md).
const HOLDING = { "sit-book": "lr", "sit-magnifier": "r", "sit-pencil": "r" };

const poseKey = (pose) => (ART[pose] ? pose : String(pose).startsWith("sit") ? "sit"
  : String(pose).startsWith("head") ? "head" : "peek");
const familyOf = (key) => (key.startsWith("sit") ? "sit" : key.startsWith("head") ? "head" : "peek");

// --- one timer for everything ------------------------------------------------------------
const jobs = new Set();
const GLOBAL = { jobs: new Set() };
let wakeTimer = 0;
let wakeAt = Infinity;

function after(owner, ms, fn) {
  const job = { at: now() + Math.max(0, ms), fn, owner };
  jobs.add(job);
  owner.jobs.add(job);
  if (job.at < wakeAt - 1) arm(job.at);
  return job;
}
function cancel(job) {
  if (job) {
    jobs.delete(job);
    job.owner.jobs.delete(job);
  }
  return null;
}
/** Run fn after ms on the mascots' one timer. Returns a function that cancels it. */
export function later(ms, fn) {
  const job = after(GLOBAL, ms, fn);
  return () => { cancel(job); };
}
function arm(at) {
  clearTimeout(wakeTimer);
  wakeAt = at;
  wakeTimer = setTimeout(runJobs, Math.max(0, at - now()));
}
function runJobs() {
  wakeTimer = 0;
  wakeAt = Infinity;
  const due = [];
  const t = now() + 4;
  for (const job of jobs) if (job.at <= t) due.push(job);
  due.sort((a, b) => a.at - b.at);
  for (const job of due) {
    if (!jobs.has(job)) continue; // cancelled by an earlier job in this batch
    jobs.delete(job);
    job.owner.jobs.delete(job);
    try { job.fn(); } catch (err) { setTimeout(() => { throw err; }); } // report it, keep the clock running
  }
  let next = Infinity;
  for (const job of jobs) if (job.at < next) next = job.at;
  if (next < wakeAt) arm(next);
}

// --- one animation-frame loop for everything -----------------------------------------------
// Bubbles that follow a moving mascot, the eyes that follow the pointer, and journey.js's
// flights all run here, so the page never has two loops competing for the same frame.
const frameFns = new Set();
let frameReq = 0;
function frameLoop(t) {
  frameReq = 0;
  for (const fn of [...frameFns]) {
    if (!frameFns.has(fn)) continue; // stopped by an earlier callback in this frame
    let keep = false;
    try { keep = fn(t) !== false; } catch (err) { setTimeout(() => { throw err; }); }
    if (!keep) frameFns.delete(fn);
  }
  if (frameFns.size && !frameReq) frameReq = requestAnimationFrame(frameLoop);
}
/** Call fn(time) on every animation frame until it returns false, or until the returned stop() is called. */
export function onFrame(fn) {
  frameFns.add(fn);
  if (!frameReq) frameReq = requestAnimationFrame(frameLoop);
  return () => { frameFns.delete(fn); };
}
/** Call fn(time) once, on the next animation frame. */
export function nextFrame(fn) {
  return onFrame((t) => { fn(t); return false; });
}

// --- shared observers ---------------------------------------------------------------------
let seenIO = null; // is a mascot on screen?
let dipIO = null; // scrollPeek

function watchSeen(m) {
  if (!("IntersectionObserver" in window)) { m.ratio = 1; wake(m); return; }
  if (!seenIO) seenIO = new IntersectionObserver(onSeen, { threshold: [0, 0.35, 0.7] });
  seenIO.observe(m.el);
}
function onSeen(entries) {
  for (const e of entries) {
    const m = byEl.get(e.target);
    if (!m || m.dead) continue;
    const was = m.ratio;
    m.ratio = e.isIntersecting ? e.intersectionRatio : 0;
    m.el.classList.toggle("is-offscreen", !e.isIntersecting);
    if (e.target.isConnected) m.attached = true;
    else if (m.attached) after(m, 1200, () => { if (!m.el.isConnected) destroy(m); });
    if (m.ratio > 0 && !(was > 0)) wake(m);
  }
}
// Back on screen: blinking and idle actions resume (they stop while offscreen).
function wake(m) {
  if (!m.blinkJob) scheduleBlink(m);
  if (m.auto && !m.autoJob) scheduleAuto(m, rand(2200, 5200));
  if (m.follow) aim(m);
}

// Mascots taken off the page without destroy() (a cleared chat, say) are reaped here.
let sweepJob = null;
function sweep() {
  sweepJob = null;
  const t = now();
  for (const m of live) {
    if (m.el.isConnected) m.attached = true;
    else if (m.attached || t - m.born > 60000) destroy(m);
  }
  if (live.size) sweepJob = after(GLOBAL, 10000, sweep);
}

// --- the pointer: eyes follow it, and glance at taps on phones ---------------------------
let pointer = null;
let aimQueued = false;
let pointerJob = null;
function onPointer(e) {
  if (!e.isPrimary) return;
  pointer = { x: e.clientX, y: e.clientY, t: now() };
  queueAim();
  if (!pointerJob) pointerJob = after(GLOBAL, 3600, pointerRest);
}
function pointerRest() {
  pointerJob = null;
  if (!pointer) return;
  const quiet = now() - pointer.t;
  if (quiet < 3400) { pointerJob = after(GLOBAL, 3500 - quiet, pointerRest); return; }
  pointer = null; // a few still seconds: the eyes wander back to the visitor
  queueAim();
}
function queueAim() {
  if (aimQueued) return;
  aimQueued = true;
  nextFrame(() => {
    aimQueued = false;
    for (const m of live) if (m.follow && m.ratio > 0) aim(m);
  });
}
window.addEventListener("pointermove", onPointer, { passive: true });
window.addEventListener("pointerdown", onPointer, { passive: true });

// --- theme: the mascots on screen notice the lights going on or off ------------------------
// The biggest, most visible ones go first (the hero before a chat avatar), a beat apart.
// Calm mascots (the faces beside each answer) and ones that are part of a control
// (inert, like the theme switch's own Edu) stay out of it.
const PRESENCE = { peek: 3, sit: 2, head: 1 };
document.addEventListener("themechange", (e) => {
  const kind = e.detail && e.detail.theme === "light" ? "lights-on" : "lights-off";
  [...live].filter((m) => !m.calm && onStage(m))
    .sort((a, b) => PRESENCE[b.family] + b.ratio - (PRESENCE[a.family] + a.ratio))
    .slice(0, 3)
    .forEach((m, i) => after(m, i * 130, () => { if (onStage(m)) react(m, kind); }));
});

const onMotionPref = (e) => {
  still = e.matches;
  for (const m of live) {
    if (still) {
      setDip(m, false, true);
      m.el.classList.remove("is-entering");
      stopAction(m, true);
    }
    aim(m);
  }
};
if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionPref);
else if (motionQuery.addListener) motionQuery.addListener(onMotionPref);

function onStage(m) {
  return !m.dead && m.ratio > 0 && m.el.isConnected && !m.dipped && !m.el.closest("[inert]")
    && !m.el.classList.contains("is-flying");
}

// --- the overlay: bubbles and particles live in one fixed layer, so no card clips them ----
let overlay = null;
const anchored = new Set();
let tracking = false;

function anchorOf(m) {
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "m-overlay";
    overlay.setAttribute("aria-hidden", "true");
  }
  if (!overlay.isConnected) document.body.appendChild(overlay);
  if (!m.anchor) {
    m.anchor = document.createElement("div");
    m.anchor.className = `m-anchor m-anchor--${m.family}`;
    m.box = null;
    overlay.appendChild(m.anchor);
  }
  anchored.add(m);
  place(m);
  if (!tracking) { tracking = true; onFrame(track); }
  return m.anchor;
}
function place(m) {
  const a = m.anchor;
  const r = m.el.getBoundingClientRect();
  // Hidden mascots (inert, offscreen, or visibility: hidden like the chat-box one before the first answer)
  // keep their bubbles and confetti hidden too.
  const show = m.el.isConnected && r.width > 0 && r.bottom > -80 && r.top < innerHeight + 80 && !m.el.closest("[inert]")
    && getComputedStyle(m.el).visibility !== "hidden";
  a.classList.toggle("is-hidden", !show);
  if (!show) return;
  const vw = document.documentElement.clientWidth;
  const b = m.box;
  if (b && b.left === r.left && b.top === r.top && b.width === r.width && b.height === r.height && b.vw === vw) return;
  if (b && b.vw !== vw) m.bubbleSize = null; // the bubble may wrap differently now
  m.box = { left: r.left, top: r.top, width: r.width, height: r.height, vw };
  a.style.transform = `translate(${r.left}px, ${r.top}px)`;
  a.style.width = `${r.width}px`;
  a.style.height = `${r.height}px`;
  if (m.bubble) fitBubble(m);
}
function track() {
  for (const m of anchored) {
    if (m.dead || !m.anchor || !m.anchor.firstChild) {
      anchored.delete(m);
      if (m.anchor) { m.anchor.remove(); m.anchor = null; }
      continue;
    }
    place(m);
  }
  if (!anchored.size) { tracking = false; return false; }
  return true;
}

const TOP = { peek: 0.04, sit: 0.06, head: 0 }; // where the head starts inside the box
const FACE = { peek: 0.6, sit: 0.42, head: 0.5 }; // the face's height inside the box (side bubbles)

// Where a bubble of the measured size goes for one placement, in viewport coordinates.
// `fixed`: keep the side it was given (a bubble that follows a moving mascot never flips).
function bubbleSpot(m, where, fixed = false) {
  const box = m.box;
  const [bw, bh] = m.bubbleSize;
  const vw = box.vw;
  if (where === "left" || where === "right") {
    // Beside the face (lifted when it must stay above something, like the chat box's edge), and it
    // stays there as the mascot moves (it scrolls away with it).
    const cy = box.top + box.height * FACE[m.family];
    const top = Math.round(cy - bh / 2 - (m.bubbleLift || 0));
    const left = Math.round(where === "left" ? box.left - 10 - bw : box.left + box.width + 10);
    const inside = left >= 8 && left + bw <= vw - 8 && top >= 8 && top + bh <= innerHeight - 8;
    return { where, left, top, width: bw, height: bh, tail: Math.round(clamp(cy - top, 12, bh - 12)), inside };
  }
  const cx = box.left + box.width / 2;
  const left = clamp(Math.round(cx - bw / 2), 10, Math.max(10, vw - 10 - bw));
  const head = box.top + box.height * TOP[m.family];
  const below = where === "below" || (!fixed && head - 12 - bh < 8);
  const top = Math.round(below ? box.top + box.height + 12 : head - 12 - bh);
  return { where: below ? "below" : "above", left, top, width: bw, height: bh, tail: Math.round(clamp(cx - left, 16, bw - 16)), inside: true };
}

function fitBubble(m) {
  const b = m.bubble;
  const box = m.box;
  if (!b || !box) return;
  if (!m.bubbleSize) m.bubbleSize = [b.offsetWidth, b.offsetHeight];
  const spot = bubbleSpot(m, m.bubbleWhere || "above", true);
  b.style.left = `${spot.left - box.left}px`;
  b.style.setProperty("--tail", `${spot.tail}px`);
  const side = spot.where === "left" || spot.where === "right";
  b.classList.toggle("is-below", spot.where === "below");
  b.classList.toggle("is-left", spot.where === "left");
  b.classList.toggle("is-right", spot.where === "right");
  b.style.top = side ? `${spot.top - box.top}px` : "";
}

function say(m, text, { ms, place: where = "above", fits = null, maxBottom = null } = {}) {
  text = String(text == null ? "" : text).trim();
  if (m.dead || !text) return Promise.resolve(false);
  closeBubble(m, true);
  const dur = ms > 0 ? ms : clamp(1500 + text.length * 55, 2200, 6500);
  const b = document.createElement("span");
  b.className = "m-bubble";
  b.textContent = text;
  const a = anchorOf(m);
  a.appendChild(b);
  m.bubble = b;
  m.bubbleSize = null;
  m.bubbleLift = 0;
  // Choose where it goes: the first placement that stays on screen and that the page agrees to
  // (fits), so a bubble never lands on the words someone is reading or on a control.
  const order = Array.isArray(where) ? where : [where];
  const shown = m.box && !a.classList.contains("is-hidden");
  let pick = null;
  if (shown) {
    const measure = () => { m.bubbleSize = [b.offsetWidth, b.offsetHeight]; };
    // maxBottom: a side bubble's bottom stays above this line (viewport px).
    const lift = () => {
      m.bubbleLift = 0;
      if (maxBottom == null) return;
      const cy = m.box.top + m.box.height * FACE[m.family];
      m.bubbleLift = Math.max(0, Math.round(cy + m.bubbleSize[1] / 2 - maxBottom));
    };
    measure();
    for (const w of order) {
      lift();
      let spot = bubbleSpot(m, w);
      if (!spot.inside && (w === "left" || w === "right")) {
        // Too wide beside it (a phone): the words wrap into the room there is.
        const room = Math.floor(w === "left" ? m.box.left - 18 : m.box.vw - m.box.left - m.box.width - 18);
        if (room >= 140 && room < spot.width) {
          b.style.maxWidth = `${room}px`;
          measure();
          lift();
          spot = bubbleSpot(m, w);
        }
      }
      const ok = spot.inside && (!fits || fits({ left: spot.left, top: spot.top, right: spot.left + spot.width,
        bottom: spot.top + spot.height, width: spot.width, height: spot.height }));
      if (ok) { pick = spot.where; break; }
      if (b.style.maxWidth) { b.style.maxWidth = ""; measure(); }
    }
  } else if (!fits) {
    pick = order[0]; // hidden for now: it is placed when the mascot shows
  }
  if (!pick) {
    b.remove();
    m.bubble = null;
    return Promise.resolve(false);
  }
  m.bubbleWhere = pick;
  fitBubble(m);
  // The mouth moves while the words appear.
  m.el.classList.add("is-talking");
  cancel(m.talkJob);
  m.talkJob = after(m, Math.min(dur - 300, 380 + text.length * 34), () => {
    m.talkJob = null;
    m.el.classList.remove("is-talking");
  });
  return new Promise((resolve) => {
    m.bubbleDone = () => resolve(true);
    m.bubbleJob = after(m, dur, () => closeBubble(m));
  });
}
function closeBubble(m, instant) {
  const b = m.bubble;
  if (!b) return;
  m.bubble = null;
  m.bubbleJob = cancel(m.bubbleJob);
  const done = m.bubbleDone;
  m.bubbleDone = null;
  if (instant) {
    m.talkJob = cancel(m.talkJob);
    m.el.classList.remove("is-talking");
  }
  const finish = () => { m.fades.delete(finish); b.remove(); if (done) done(); };
  if (instant || still) finish();
  else {
    b.classList.add("is-out");
    m.fades.add(finish); // settled by destroy() too, if it comes first
    after(m, 210, finish);
  }
}

// --- particles: small spans with CSS keyframes, placed through CSSOM and removed after ----
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21.2C5.6 16.9 2.5 13.5 2.5 9.4 2.5 6.4 4.8 4.2 7.6 4.2c1.8 0 3.4.9 4.4 2.4 1-1.5 2.6-2.4 4.4-2.4 2.8 0 5.1 2.2 5.1 5.2 0 4.1-3.1 7.5-9.5 11.8z"/></svg>';
const DROP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5c3.3 4.6 6.2 8.2 6.2 11.6a6.2 6.2 0 0 1-12.4 0c0-3.4 2.9-7 6.2-11.6z"/></svg>';
const BANG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6c1.6 0 2.6 1.2 2.5 2.7l-.8 9.6c-.1.9-.8 1.5-1.7 1.5s-1.6-.6-1.7-1.5l-.8-9.6C9.4 3.8 10.4 2.6 12 2.6z"/><circle fill="currentColor" cx="12" cy="20.2" r="2"/></svg>';
const ORIGIN = { peek: [50, 30], sit: [50, 24], head: [50, 26] };

// Each kind returns, for particle i of n at scale k: [dx, dy, size, rotation, duration, delay, extra]
const FX = {
  spark: (i, n, k) => {
    const a = (-168 + (156 * i) / (n - 1) + rand(-9, 9)) * (Math.PI / 180);
    const d = rand(30, 50) * k;
    return [Math.cos(a) * d, Math.sin(a) * d * 0.9 - 6 * k, rand(7, 11) * k, rand(60, 160), rand(620, 820), rand(0, 60)];
  },
  twinkle: (i, n, k) => {
    const a = (-180 + (180 * i) / (n - 1) + rand(-12, 12)) * (Math.PI / 180);
    const d = rand(34, 54) * k;
    return [Math.cos(a) * d, Math.sin(a) * d - 4 * k, rand(7, 12) * k, 0, rand(900, 1150), i * 70];
  },
  heart: (i, n, k) => [(((i % 2) ? 1 : -1) * rand(10, 34)) * k, -rand(56, 88) * k, rand(11, 16) * k, rand(-18, 18), rand(1150, 1450), i * 150 + rand(0, 60)],
  confetti: (i, n, k) => {
    const a = (-150 + (120 * i) / (n - 1) + rand(-8, 8)) * (Math.PI / 180);
    const d = rand(36, 60) * k;
    return [Math.cos(a) * d, Math.sin(a) * d, rand(7, 10) * k, rand(-240, 240), rand(1100, 1400), rand(0, 90), rand(46, 70) * k];
  },
  drop: (i, n, k) => [0, 11 * k, 10 * k, 0, 1150, 0],
  bang: (i, n, k) => [0, 0, 18 * k, 0, 950, 0],
};
const FX_AT = { drop: { peek: [70, 34], sit: [72, 32], head: [76, 34] }, bang: { peek: [68, -6], sit: [70, -4], head: [76, -10] } };
const FX_HTML = { heart: HEART, drop: DROP, bang: BANG };

function burst(m, kind, count) {
  if (still || m.dead || !onStage(m) || !FX[kind]) return;
  const a = anchorOf(m);
  const k = clamp((m.box ? m.box.width : 110) / 120, 0.42, 1.2);
  const n = m.family === "head" ? Math.max(1, Math.ceil(count * 0.6)) : count;
  const [ox, oy] = (FX_AT[kind] && FX_AT[kind][m.family]) || ORIGIN[m.family];
  const made = [];
  let longest = 0;
  for (let i = 0; i < n; i++) {
    const [dx, dy, size, r, t, d, fall] = FX[kind](i, n, k);
    const p = document.createElement("span");
    p.className = `m-fx m-fx-${kind} m-c${(i + seq) % 4}`;
    if (FX_HTML[kind]) p.innerHTML = FX_HTML[kind];
    const s = p.style;
    s.setProperty("--ox", `${ox + (kind === "heart" ? rand(-18, 18) : 0)}%`);
    s.setProperty("--oy", `${oy}%`);
    s.setProperty("--dx", `${dx.toFixed(1)}px`);
    s.setProperty("--dy", `${dy.toFixed(1)}px`);
    s.setProperty("--size", `${size.toFixed(1)}px`);
    s.setProperty("--r", `${Math.round(r)}deg`);
    s.setProperty("--s", rand(0.85, 1.15).toFixed(2));
    s.setProperty("--t", `${Math.round(t)}ms`);
    s.setProperty("--d", `${Math.round(d)}ms`);
    if (fall) s.setProperty("--fall", `${fall.toFixed(1)}px`);
    a.appendChild(p);
    made.push(p);
    longest = Math.max(longest, t + d);
  }
  after(m, longest + 60, () => { for (const p of made) p.remove(); });
}

// --- one-shot actions: reactions and idle actions share one little player ---------------
// A plan is { ms, steps: [[atMs, op, arg]] }. Ops: "+"/"-" expression classes,
// "fx" particles, "look" a gaze to hold (or null, or "target"), "blink".
const PLANS = {
  tap: () => (Math.random() < 0.3
    ? { ms: 960, steps: [[0, "+", "x-wink x-open"], [0, "fx", ["spark", 6]], [700, "-", "x-wink x-open"]] }
    : { ms: 960, steps: [[0, "+", "x-joy x-open x-giggle"], [0, "fx", ["spark", 7]], [620, "-", "x-giggle"], [760, "-", "x-joy x-open"]] }),
  love: () => ({ ms: 1850, steps: [[0, "+", "x-joy x-blush x-open"], [40, "fx", ["heart", 5]], [1450, "-", "x-open"], [1600, "-", "x-joy"]] }),
  surprise: () => ({ ms: 1150, steps: [[70, "+", "x-wide x-o"], [80, "fx", ["bang", 1]], [880, "-", "x-wide x-o"]] }),
  sad: () => ({
    ms: 1950,
    steps: [[0, "+", "x-frown x-droop"], [0, "look", [0, 0.9]], [300, "fx", ["drop", 1]],
      [1520, "-", "x-droop"], [1520, "look", null], [1700, "-", "x-frown"]],
  }),
  cheer: () => ({ ms: 1650, steps: [[0, "+", "x-joy x-open"], [170, "fx", ["confetti", 10]], [1500, "-", "x-open"]] }),
  nod: () => ({ ms: 1150, steps: [[0, "+", "x-content"], [0, "look", [0, 0.65]], [760, "look", null], [900, "-", "x-content"]] }),
  "look-up": () => ({ ms: 1500, steps: [[0, "+", "x-wide-sm"], [0, "look", [0.12, -1]], [1250, "look", null], [1250, "-", "x-wide-sm"]] }),
  // spot: notices something (react("spot", { at: element })): eyes on it, a twinkle and a knowing nod
  spot: () => ({
    ms: 1750,
    steps: [[0, "look", "at"], [0, "+", "x-wide-sm x-point"], [240, "fx", ["twinkle", 5]], [420, "-", "x-wide-sm"], [420, "+", "x-content"],
      [1250, "-", "x-point"], [1450, "look", null], [1550, "-", "x-content"]],
  }),
  // twirl: a little flourish (the suggestions were shuffled): eyes on it, the sprout spins like a rotor, a twinkle
  twirl: () => ({
    ms: 1200,
    steps: [[0, "look", "at"], [0, "+", "x-joy x-twirl"], [120, "fx", ["twinkle", 5]], [720, "-", "x-twirl"], [900, "look", null], [1000, "-", "x-joy"]],
  }),
  "lights-on": () => ({
    ms: 2050,
    steps: [[0, "+", "x-squint"], [820, "-", "x-squint"], [820, "+", "x-joy x-open"], [860, "fx", ["twinkle", 6]], [1800, "-", "x-open"]],
  }),
  "lights-off": () => ({
    ms: 2350,
    steps: [[0, "look", [-1, 0.1]], [470, "look", [1, 0.1]], [930, "look", null], [980, "+", "x-yawn x-sleepy"],
      [1900, "-", "x-yawn"], [2020, "-", "x-sleepy"], [2080, "blink"]],
  }),
  // idle actions (autoplay)
  glance: () => {
    const s = Math.random() < 0.5 ? -1 : 1;
    const lean = (d) => (d < 0 ? "x-lean-l" : "x-lean-r");
    return Math.random() < 0.5
      ? { ms: 1300, steps: [[0, "look", [s, 0.1]], [0, "+", lean(s)], [900, "look", null], [900, "-", lean(s)]] }
      : { ms: 1750, steps: [[0, "look", [s, 0.1]], [0, "+", lean(s)], [640, "-", lean(s)], [640, "look", [-s, 0.1]], [640, "+", lean(-s)], [1300, "look", null], [1300, "-", lean(-s)]] };
  },
  sprout: () => ({ ms: 1150, steps: [[0, "look", [0.05, -1]], [720, "look", null]] }),
  // react("hop", { at }) also keeps its eyes on what was tapped
  hop: (m) => ({ ms: 1450, steps: [...(m.reactAt ? [[0, "look", "at"]] : []), [260, "+", "x-joy"], [720, "-", "x-joy"], [1100, "look", null]] }),
  tilt: () => {
    const right = Math.random() < 0.5;
    return { ms: 2300, steps: [[0, "+", right ? "x-tilt-r x-wide-sm" : "x-wide-sm"], [0, "look", [right ? 0.35 : -0.35, -0.3]], [1300, "look", null], [1300, "-", "x-wide-sm"]] };
  },
  yawn: () => ({ ms: 2200, steps: [[120, "+", "x-yawn x-sleepy"], [1480, "-", "x-yawn"], [1700, "-", "x-sleepy"], [1820, "blink"]] }),
  askbox: () => ({ ms: 1700, steps: [[0, "look", "target"], [0, "+", "x-wide-sm"], [1450, "look", null], [1450, "-", "x-wide-sm"]] }),
  wave: () => ({ ms: 1450, steps: [] }),
  // the feature-card poses act out their props
  read: () => ({ ms: 2100, steps: [[0, "look", [-0.35, 0.95]], [0, "+", "x-content"], [700, "look", [0.35, 0.95]], [1400, "look", [-0.2, 0.9]], [1850, "look", null], [1850, "-", "x-content"]] }),
  search: () => ({ ms: 1800, steps: [[0, "look", [0.85, -0.55]], [0, "+", "x-wide-sm"], [1500, "look", null], [1500, "-", "x-wide-sm"]] }),
  jot: () => ({ ms: 1850, steps: [[0, "look", [1, 0.35]], [900, "look", [0, -0.2]], [900, "+", "x-joy"], [1300, "-", "x-joy"], [1300, "look", null]] }),
};
const PROP_ACTION = { "sit-book": "read", "sit-magnifier": "search", "sit-pencil": "jot" };
const REACTIONS = new Set(["tap", "love", "surprise", "sad", "cheer", "nod", "look-up", "spot", "twirl", "lights-on", "lights-off"]);
const AUTO = [["glance", 3], ["sprout", 3], ["hop", 2], ["tilt", 2], ["yawn", 1], ["askbox", 2], ["wave", 0.6],
  ["read", 4], ["search", 4], ["jot", 4]];

function react(m, kind, { at = null } = {}) {
  const plan = PLANS[kind];
  if (m.dead || !plan) return Promise.resolve();
  m.reactAt = at;
  const t = now();
  // The same reaction twice in one moment (the page's click handler and ours): play it once.
  if (m.act && m.act.name === kind && t - m.act.t0 < 140) return m.act.promise;
  const restart = m.act && m.act.name === kind;
  stopAction(m);
  const spec = plan(m);
  let done;
  const promise = new Promise((r) => { done = r; });
  const act = { name: kind, t0: t, auto: !REACTIONS.has(kind), jobs: [], done, promise };
  m.act = act;
  if (restart) void m.el.offsetWidth; // let the same keyframes play again
  m.el.classList.add(`act-${kind}`);
  for (const [at, op, arg] of spec.steps) {
    if (at <= 0) step(m, op, arg);
    else act.jobs.push(after(m, at, () => step(m, op, arg)));
  }
  act.jobs.push(after(m, spec.ms, () => { if (m.act === act) stopAction(m); }));
  return promise;
}
function step(m, op, arg) {
  const c = m.el.classList;
  if (op === "+") for (const x of arg.split(" ")) { c.add(x); m.xs.add(x); }
  else if (op === "-") for (const x of arg.split(" ")) { c.remove(x); m.xs.delete(x); }
  else if (op === "fx") burst(m, arg[0], arg[1]);
  else if (op === "blink") blink(m);
  else if (op === "look") {
    m.hold = arg === "target" ? gazeToward(m, m.lookAt) : arg === "at" ? gazeToward(m, m.reactAt) : arg;
    aim(m);
  }
}
function stopAction(m, onlyAuto) {
  const act = m.act;
  if (!act || (onlyAuto && !act.auto)) return;
  m.act = null;
  for (const job of act.jobs) cancel(job);
  m.el.classList.remove(`act-${act.name}`);
  for (const x of m.xs) m.el.classList.remove(x);
  m.xs.clear();
  if (m.hold) { m.hold = null; aim(m); }
  act.done();
}

// --- autoplay: a small idle personality ---------------------------------------------------
function scheduleAuto(m, ms) {
  m.autoJob = cancel(m.autoJob);
  m.autoJob = after(m, ms == null ? rand(5000, 11000) : ms, () => {
    m.autoJob = null;
    if (!m.auto || m.dead || m.ratio <= 0) return; // offscreen: wake() resumes it
    if (canIdle(m)) {
      const name = chooseAuto(m);
      if (name) { m.lastAuto = name; react(m, name); }
    }
    scheduleAuto(m);
  });
}
function canIdle(m) {
  const c = m.el.classList;
  return !still && !document.hidden && m.ratio >= 0.35 && m.el.dataset.state === "idle" && !m.act && !m.bubble
    && !m.dipped && !c.contains("is-hover") && !c.contains("is-entering") && !c.contains("is-typing") && !c.contains("is-popping")
    && !c.contains("is-flying") && !c.contains("is-landing") && m.el.isConnected && !m.el.closest("[inert]");
}
function chooseAuto(m) {
  const options = AUTO.filter(([name]) => name !== m.lastAuto && allowed(m, name));
  let total = 0;
  for (const [, w] of options) total += w;
  let roll = Math.random() * total;
  for (const [name, w] of options) if ((roll -= w) <= 0) return name;
  return options.length ? options[options.length - 1][0] : null;
}
function allowed(m, name) {
  if (m.skip && m.skip.has(name)) return false;
  if (name === "read" || name === "search" || name === "jot") return PROP_ACTION[m.pose] === name;
  if (name === "wave") return !!m.el.dataset.wave;
  if (name === "askbox") {
    const t = m.lookAt;
    if (!t || !t.isConnected) return false;
    const r = t.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
  }
  return true;
}

// --- eyes -----------------------------------------------------------------------------------
function setGaze(m, x, y) {
  x = clamp(x, -1, 1);
  y = clamp(y, -1, 1);
  if (m.gx === x && m.gy === y) return;
  m.gx = x;
  m.gy = y;
  // On the eyes' own group: a custom property set on the mascot itself would restyle every part of
  // the drawing (all of them inherit it); here only the eyes are restyled.
  const g = m.gazeEl && m.gazeEl.isConnected ? m.gazeEl : (m.gazeEl = m.el.querySelector(".m-gaze"));
  const target = g || m.el;
  target.style.setProperty("--gx", x.toFixed(3));
  target.style.setProperty("--gy", y.toFixed(3));
}
function gazeToward(m, target) {
  if (!target || !target.isConnected) return null;
  const r = target.getBoundingClientRect();
  return r.width ? vectorTo(m, r.left + r.width / 2, r.top + r.height / 2) : null;
}
function vectorTo(m, x, y) {
  const r = (m.eyes || m.el).getBoundingClientRect();
  if (!r.width) return [0, 0];
  const dx = x - (r.left + r.width / 2);
  const dy = y - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy) || 1;
  const reach = Math.min(1, d / 240); // far away: eyes at the edge; close: a gentle look
  return [(dx / d) * reach, (dy / d) * reach];
}
// Who decides where the eyes look, strongest first: a reaction or look(), a glance(), the
// words being typed (watchInput), the mood, then the pointer.
function aim(m) {
  if (m.dead) return;
  if (m.hold) { setGaze(m, m.hold[0], m.hold[1]); return; }
  if (m.glance && !still) {
    const v = Array.isArray(m.glance) ? m.glance : gazeToward(m, m.glance);
    if (v) { setGaze(m, v[0], v[1]); return; }
  }
  if (m.lookFn && !still) {
    const p = m.lookFn();
    if (p) { const v = vectorTo(m, p.x, p.y); setGaze(m, v[0], v[1]); return; }
  }
  if (m.stateGaze) { setGaze(m, m.stateGaze[0], m.stateGaze[1]); return; }
  if (!m.follow || !pointer || still) { setGaze(m, 0, 0); return; }
  const v = vectorTo(m, pointer.x, pointer.y);
  setGaze(m, v[0], v[1]);
}
function blink(m) {
  if (m.dead || !m.el.isConnected) return;
  const c = m.el.classList;
  c.add("is-blinking");
  after(m, 110, () => c.remove("is-blinking"));
  // Now and then a quick double blink, like a real face.
  if (Math.random() < 0.18) after(m, 300, () => { c.add("is-blinking"); after(m, 100, () => c.remove("is-blinking")); });
}
function scheduleBlink(m) {
  m.blinkJob = cancel(m.blinkJob);
  // Calm faces (one beside every answer) blink less often, so a long chat is not a flicker of eyes.
  m.blinkJob = after(m, m.calm ? rand(6500, 13000) : rand(2800, 6200), () => {
    m.blinkJob = null;
    if (m.dead || m.ratio <= 0) return; // offscreen: wake() starts it again
    // Reduced motion means a still face too: no idle blinking (expressions still change on events).
    if (!document.hidden && !still) blink(m);
    scheduleBlink(m);
  });
}

// --- thought cloud ------------------------------------------------------------------------------
function showThink(m) {
  if (m.think) return;
  const t = document.createElement("span");
  t.className = "m-think";
  t.setAttribute("aria-hidden", "true");
  t.innerHTML = '<span class="m-think-cloud"><i></i><i></i><i></i></span>';
  m.el.appendChild(t);
  m.think = t;
}
function hideThink(m) {
  const t = m.think;
  if (!t) return;
  m.think = null;
  if (still) { t.remove(); return; }
  t.classList.add("is-out");
  after(m, 220, () => t.remove());
}

// --- scrollPeek ---------------------------------------------------------------------------------
function setDip(m, down, instant) {
  if (m.dipped === down) return;
  m.dipped = down;
  const c = m.el.classList;
  m.dipJob = cancel(m.dipJob);
  c.remove("is-ducking", "is-popping");
  c.toggle("is-dipped", down);
  if (down) { stopAction(m, true); closeBubble(m, true); }
  if (instant || still) return;
  void m.el.offsetWidth;
  c.add(down ? "is-ducking" : "is-popping");
  m.dipJob = after(m, down ? 440 : 1420, () => { m.dipJob = null; c.remove("is-ducking", "is-popping"); });
}
function onDip(entries) {
  for (const e of entries) {
    const m = byEl.get(e.target);
    if (!m || m.dead || !m.peeking) continue;
    const first = m.dipped === undefined;
    setDip(m, !(e.isIntersecting && e.intersectionRatio >= 0.6), first);
  }
}

/**
 * When a peeking mascot scrolls out of view it ducks behind its ledge, and when it
 * comes back it pops up with a little bounce. Returns a function that stops it.
 */
export function scrollPeek(ctl, { margin = "-18% 0px 0px 0px" } = {}) {
  const m = byCtl.get(ctl);
  // Only a peek has a ledge to hide behind.
  if (!m || m.dead || m.family !== "peek" || still || !("IntersectionObserver" in window)) return () => {};
  if (!dipIO) dipIO = new IntersectionObserver(onDip, { rootMargin: margin, threshold: [0, 0.6] });
  m.peeking = true;
  dipIO.observe(m.el);
  return () => {
    m.peeking = false;
    if (dipIO) dipIO.unobserve(m.el);
    setDip(m, false, true);
  };
}

// --- art --------------------------------------------------------------------------------------
function uniqueIds(svg, n) {
  // Only real references: path data such as "M-2 4" must stay untouched.
  return svg.replace(/(id="|url\(#|href="#)M-/g, `$1M${n}-`);
}
function node(tag, cls, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  if (cls) el.setAttribute("class", cls);
  if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
const num = (el, a) => parseFloat(el.getAttribute(a)) || 0;
function firstX(el) {
  if (el.hasAttribute("cx")) return num(el, "cx");
  const d = el.getAttribute("d");
  const hit = d && /M\s*(-?[\d.]+)/i.exec(d);
  return hit ? parseFloat(hit[1]) : 0;
}

// Adds what the moods need to the drawing: one group per eye (wide, squint, wink),
// a blink lid, closed "happy" eyes, a small round mouth (surprise, yawn) and a blush.
function rig(svg) {
  const eyes = svg.querySelector(".m-eyes");
  const gaze = svg.querySelector(".m-gaze");
  if (eyes && gaze) {
    const beads = [...gaze.querySelectorAll("circle")].filter((c) => /bead/.test(c.getAttribute("fill") || ""));
    if (beads.length === 2) {
      beads.sort((a, b) => num(a, "cx") - num(b, "cx"));
      const groups = [node("g", "m-eye m-eye-l"), node("g", "m-eye m-eye-r")];
      const mid = (num(beads[0], "cx") + num(beads[1], "cx")) / 2;
      for (const child of [...gaze.children]) groups[firstX(child) <= mid ? 0 : 1].appendChild(child);
      gaze.append(...groups);
      const joy = node("g", "m-joy");
      beads.forEach((b, i) => {
        const x = num(b, "cx"), y = num(b, "cy"), r = num(b, "r");
        joy.appendChild(node("path", i ? "m-joy-r" : "m-joy-l", {
          d: `M${(x - r).toFixed(2)},${(y + r * 0.32).toFixed(2)}Q${x.toFixed(2)},${(y - r * 1.2).toFixed(2)} ${(x + r).toFixed(2)},${(y + r * 0.32).toFixed(2)}`,
          fill: "none", stroke: "#2b1a14", "stroke-width": (r * 0.48).toFixed(2), "stroke-linecap": "round",
        }));
      });
      eyes.appendChild(joy);
    }
    const lid = node("g", "m-lid");
    eyes.insertBefore(lid, gaze);
    lid.appendChild(gaze);
  }
  const mouth = svg.querySelector(".m-mouth");
  const nums = mouth && (mouth.getAttribute("d") || "").match(/-?\d*\.?\d+/g);
  if (nums && nums.length >= 6) {
    const [x1, y1, , qy, x2] = nums.map(Number);
    const w = (x2 - x1) / 2;
    const c = x1 + w;
    if (!svg.querySelector(".m-mouth-open")) {
      // Older art had no open smile: draw one from the stitched one.
      const h = 1.25 * w;
      const g = node("g", "m-mouth-open", { display: "none" });
      g.appendChild(node("path", "", {
        d: `M${x1},${y1}Q${c},${y1 + 0.36 * w} ${x2},${y1}C${x2 - 0.02 * w},${y1 + 0.72 * h} ${c + 0.52 * w},${y1 + h} ${c},${y1 + h}C${c - 0.52 * w},${y1 + h} ${x1 + 0.02 * w},${y1 + 0.72 * h} ${x1},${y1}Z`,
        fill: "#4A1806",
      }));
      mouth.after(g);
    }
    mouth.after(node("ellipse", "m-mouth-o", {
      cx: c.toFixed(2), cy: ((y1 + qy) / 2 + w * 0.18).toFixed(2), rx: (w * 0.5).toFixed(2), ry: (w * 0.62).toFixed(2), fill: "#4A1806",
    }));
  }
  const cheeks = svg.querySelector(".m-cheeks");
  if (cheeks) {
    const blush = cheeks.cloneNode(true);
    blush.setAttribute("class", "m-blush");
    cheeks.after(blush);
  }
}
// One drawing, with its own ids (so two drawings on a page never share defs) and its rig.
function buildArt(key) {
  const tpl = document.createElement("template");
  tpl.innerHTML = uniqueIds(ART[key] || "", ++seq);
  const svg = tpl.content.querySelector("svg");
  if (svg) {
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    rig(svg);
  }
  return svg;
}
function setHands(m, svg) {
  const held = HOLDING[m.pose] || "";
  const free = (svg && svg.querySelector(".m-hand-l") && !held.includes("l") ? "l" : "")
    + (svg && svg.querySelector(".m-hand-r") && !held.includes("r") ? "r" : "");
  m.el.dataset.hands = free;
  m.el.dataset.wave = free.includes("r") ? "r" : free.includes("l") ? "l" : "";
}

// --- the mascot ---------------------------------------------------------------------------
export function mascot(pose = "peek", { label = "", follow = false, lines = null, interactive = true, calm = false } = {}) {
  const key = poseKey(pose);
  const family = familyOf(key);
  const el = document.createElement("span");
  el.className = `mascot mascot-${key} mascot--${family}`;
  el.dataset.state = "idle";
  if (label) {
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", label);
  } else {
    el.setAttribute("aria-hidden", "true");
  }
  el.innerHTML = '<span class="m-clip"><span class="m-stage"><span class="m-dip"><span class="m-act"><span class="m-mood"></span></span></span></span></span>';
  const svg = buildArt(key);
  if (svg) el.querySelector(".m-mood").appendChild(svg);

  const m = {
    el, family, pose: key, follow, calm, born: now(), jobs: new Set(), offs: [], xs: new Set(), fades: new Set(),
    eyes: svg && svg.querySelector(".m-eyes"), arts: new Map(), ratio: 0, gx: null, gy: null,
    hold: null, glance: null, stateGaze: null, lookFn: null, lookAt: null, act: null,
    auto: false, autoJob: null, blinkJob: null, pulseJob: null, lastAuto: "",
    bubble: null, bubbleWhere: "above", think: null, anchor: null, box: null, attached: false, dead: false, dipped: undefined, peeking: false,
    taps: [], lastLine: -1e9, lines: lines && lines.length ? [...lines] : family === "head" ? [] : [...LINES], bag: [],
  };
  setHands(m, svg);
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    m.offs.push(() => target.removeEventListener(type, fn, opts));
  };

  if (interactive) {
    el.classList.add("is-interactive");
    on(el, "click", () => onTap(m, ctl));
    on(el, "pointerenter", (e) => { if (e.pointerType === "mouse" && hoverQuery.matches) el.classList.add("is-hover"); });
    on(el, "pointerleave", () => el.classList.remove("is-hover"));
  }

  const ctl = {
    el,
    /** idle | curious | thinking | happy | wave (and sleepy) */
    state(name) { setState(m, name); return ctl; },
    /** Build a pose's drawing ahead of time (when idle), so the first switch to it costs nothing. Returns it. */
    prepare(pose) {
      const key = poseKey(pose);
      if (key === m.pose) return m.el.querySelector(".m-mood > svg");
      if (!m.arts.has(key)) { const svg = buildArt(key); if (svg) m.arts.set(key, svg); }
      return m.arts.get(key) || null;
    },
    /** Play a state for a moment, then go back: to "curious" if its input is focused meanwhile, else idle. */
    pulse(name, ms = 900) {
      setState(m, name);
      m.pulseJob = after(m, ms, () => { m.pulseJob = null; setState(m, m.lookFn ? "curious" : "idle"); });
      return ctl;
    },
    blink: () => blink(m),
    aim: () => aim(m),
    /**
     * A small speech bubble. `place`: "above" (the default; below when there is no room),
     * "left", "right", or a list to try in order. `fits(rect)`: return false to refuse a spot.
     * Resolves true when a shown bubble hides, false when there was nowhere to show it.
     */
    say: (text, opts) => say(m, text, opts),
    /** Close the bubble now. */
    hush: () => { closeBubble(m, true); return ctl; },
    /** tap | love | surprise | sad | cheer | nod | look-up | spot / twirl (opts.at: what it looks at) | lights-on | lights-off. Resolves when done. */
    react: (kind, opts) => react(m, kind, opts),
    /** Glance at an element (a chip, the ask box) for a moment. */
    look(target, ms = 1200) {
      const v = m.dead || m.act || still ? null : gazeToward(m, target);
      if (!v) return ctl;
      m.hold = v;
      aim(m);
      m.lookJob = cancel(m.lookJob);
      m.lookJob = after(m, ms, () => { m.lookJob = null; if (!m.act) { m.hold = null; aim(m); } });
      return ctl;
    },
    /** Keep looking somewhere ([x, y] from -1 to 1, or an element) until glance(null). */
    glance(target) { m.glance = target || null; aim(m); return ctl; },
    /** Small idle actions every 5–11 s while on screen. `lookAt`: an element it glances at; `skip`: names it never plays. */
    autoplay(on = true, { lookAt, skip } = {}) {
      if (lookAt !== undefined) m.lookAt = lookAt;
      if (skip !== undefined) m.skip = new Set(skip || []); // idle actions it never plays (a yawn in the chat)
      m.auto = !!on && !m.dead;
      m.autoJob = cancel(m.autoJob);
      if (m.auto && m.ratio > 0) scheduleAuto(m, rand(3000, 6500));
      return ctl;
    },
    /** The same Edu in another drawing: peek, sit, sit-book, sit-magnifier, sit-pencil, head, head-sm. */
    setPose(name) { setPose(m, name); return ctl; },
    /**
     * Duck behind the edge it stands on (true) or pop back up (false), in any pose. The page clips
     * the .m-clip layer at that edge. instant: no duck or pop animation (and always so with reduced motion).
     */
    dip(down, { instant = false } = {}) { if (!m.dead) setDip(m, !!down, instant); return ctl; },
    /** Ducked behind its edge right now? */
    get dipped() { return !!m.dipped; },
    /** The mouth moves for a moment, as if saying a word (no bubble). */
    talk(ms = 500) {
      if (m.dead || still || m.bubble) return ctl;
      m.el.classList.add("is-talking");
      cancel(m.talkJob);
      m.talkJob = after(m, ms, () => { m.talkJob = null; if (!m.bubble) m.el.classList.remove("is-talking"); });
      return ctl;
    },
    /** The lines it says when tapped, and how they are said (say()'s options: place, fits). */
    setLines(list, opts = null) { m.lines = list && list.length ? [...list] : []; m.bag = []; m.tapSay = opts; return ctl; },
    /** Stop whatever it is doing (a reaction, a wave, a bubble, an entrance): ready to fly. */
    rest() {
      stopAction(m);
      m.pulseJob = cancel(m.pulseJob);
      m.lookJob = cancel(m.lookJob);
      m.hold = null;
      closeBubble(m, true);
      m.el.classList.remove("is-entering", "is-hover", "is-ducking", "is-popping");
      const s = m.el.dataset.state;
      if (s === "wave" || s === "happy") setState(m, m.lookFn ? "curious" : "idle");
      aim(m);
      return ctl;
    },
    get pose() { return m.pose; },
    destroy: () => destroy(m),
  };
  byEl.set(el, m);
  byCtl.set(ctl, m);
  live.add(m);
  if (!sweepJob) sweepJob = after(GLOBAL, 10000, sweep);
  watchSeen(m);
  return ctl;
}

function setState(m, name) {
  if (m.dead) return;
  m.pulseJob = cancel(m.pulseJob);
  m.el.dataset.state = name;
  m.stateGaze = name === "thinking" ? [0.55, -0.75] : name === "curious" ? [0, -0.6] : name === "sleepy" ? [0, 0.5] : null;
  if (name === "thinking") showThink(m);
  else hideThink(m);
  if (name !== "idle") stopAction(m, true); // an idle action never fights a mood
  aim(m);
}

// Swap the drawing in place. Drawings already made are kept, so flying back and forth
// between poses never parses the same art twice.
function setPose(m, pose) {
  if (m.dead) return;
  const key = poseKey(pose);
  if (key === m.pose) return;
  const family = familyOf(key);
  stopAction(m); // a reaction may be holding parts of the old drawing
  const mood = m.el.querySelector(".m-mood");
  const old = mood && mood.querySelector(":scope > svg");
  if (old) { m.arts.set(m.pose, old); old.remove(); }
  const svg = m.arts.get(key) || buildArt(key);
  m.arts.delete(key);
  if (mood && svg) mood.appendChild(svg);
  const c = m.el.classList;
  c.remove(`mascot-${m.pose}`, `mascot--${m.family}`);
  c.add(`mascot-${key}`, `mascot--${family}`);
  if (family !== "peek") {
    // Only a peek has a ledge to hide behind.
    m.dipJob = cancel(m.dipJob);
    c.remove("is-entering", "is-dipped", "is-ducking", "is-popping");
    if (m.dipped) m.dipped = false;
  }
  m.pose = key;
  m.family = family;
  m.eyes = svg ? svg.querySelector(".m-eyes") : null;
  m.gazeEl = null;
  setHands(m, svg);
  if (m.anchor) m.anchor.className = `m-anchor m-anchor--${family}`;
  m.box = null;
  m.bubbleSize = null;
  m.gx = m.gy = null;
  aim(m);
}

function nextLine(m, list) {
  if (!list.length) return "";
  if (list === LOVE_LINES) return LOVE_LINES[Math.floor(Math.random() * LOVE_LINES.length)];
  if (!m.bag.length) {
    m.bag = [...list].sort(() => Math.random() - 0.5);
    if (m.lastSaid && m.bag[0] === m.lastSaid && m.bag.length > 1) m.bag.push(m.bag.shift());
  }
  m.lastSaid = m.bag.shift();
  return m.lastSaid;
}
function onTap(m, ctl) {
  if (m.dead) return;
  const t = now();
  m.taps = m.taps.filter((x) => t - x < 1200);
  m.taps.push(t);
  if (m.taps.length >= 3) {
    m.taps = [];
    react(m, "love");
    if (m.lines.length && Math.random() < 0.5) ctl.say(nextLine(m, LOVE_LINES), m.tapSay || undefined);
    return;
  }
  react(m, "tap");
  // The first tap always gets an answer; after that, now and then.
  if (m.lines.length && !m.bubble && (m.lastLine < 0 || (t - m.lastLine > 6000 && Math.random() < 0.45))) {
    m.lastLine = t;
    ctl.say(nextLine(m, m.lines), m.tapSay || undefined);
  }
}

function destroy(m) {
  if (m.dead) return;
  m.dead = true;
  stopAction(m);
  for (const job of [...m.jobs]) cancel(job);
  for (const off of m.offs) off();
  m.offs.length = 0;
  if (seenIO) seenIO.unobserve(m.el);
  if (dipIO) dipIO.unobserve(m.el);
  if (m.bubbleDone) m.bubbleDone();
  m.bubble = m.bubbleDone = null;
  for (const finish of [...m.fades]) finish();
  if (m.anchor) { m.anchor.remove(); m.anchor = null; }
  anchored.delete(m);
  if (m.think) { m.think.remove(); m.think = null; }
  m.arts.clear();
  live.delete(m);
  m.el.remove();
  if (!live.size) sweepJob = cancel(sweepJob);
}

/** Make a mascot react to an ask box: curious while focused, eyes on the words, a nod when you pause. */
export function watchInput(ctl, input) {
  const m = byCtl.get(ctl);
  if (!m || m.dead || !input) return () => {};
  let typingJob = null;
  let pauseJob = null;
  let queued = false;
  const offs = [];
  const on = (type, fn) => {
    input.addEventListener(type, fn);
    const off = () => input.removeEventListener(type, fn);
    offs.push(off);
    m.offs.push(off);
  };
  // The eyes follow the end of the text, as if reading along.
  const caret = () => {
    const r = input.getBoundingClientRect();
    if (!r.width) return null;
    const len = (input.value || "").length;
    return { x: r.left + Math.min(r.width - 24, 28 + len * 7.5), y: r.top + Math.min(r.height / 2, 24) };
  };
  const reaim = () => {
    if (queued) return;
    queued = true;
    nextFrame(() => { queued = false; aim(m); });
  };
  on("focus", () => {
    m.lookFn = caret;
    if (m.el.dataset.state === "idle") setState(m, "curious");
    else aim(m);
  });
  on("blur", () => {
    m.lookFn = null;
    pauseJob = cancel(pauseJob);
    if (m.el.dataset.state === "curious") setState(m, "idle");
    else aim(m);
  });
  on("input", () => {
    m.el.classList.add("is-typing");
    typingJob = cancel(typingJob);
    typingJob = after(m, 420, () => { typingJob = null; m.el.classList.remove("is-typing"); });
    pauseJob = cancel(pauseJob);
    if ((input.value || "").trim().length > 3) {
      pauseJob = after(m, 1500, () => {
        pauseJob = null;
        if (document.activeElement === input && m.el.dataset.state === "curious" && !still) react(m, "nod");
      });
    }
    reaim();
  });
  if (document.activeElement === input) { m.lookFn = caret; setState(m, "curious"); }
  return () => {
    for (const off of offs) off();
    cancel(typingJob);
    cancel(pauseJob);
    if (m.lookFn === caret) m.lookFn = null;
  };
}

/** For tests and the dev page: how many mascots, timers, frame callbacks and overlay parts are alive. */
export function mascotStats() {
  return {
    live: live.size,
    jobs: jobs.size,
    frames: frameFns.size,
    anchors: anchored.size,
    particles: overlay ? overlay.querySelectorAll(".m-fx").length : 0,
    bubbles: overlay ? overlay.querySelectorAll(".m-bubble").length : 0,
  };
}
