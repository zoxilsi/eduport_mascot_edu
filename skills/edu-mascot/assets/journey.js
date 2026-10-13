// Edu's journey: ONE Edu travels with the visitor, instead of a copy in every corner.
//
// On the home page Edu has a few stations, in page order: peeking over the ledge at the
// bottom of the first screen, sitting on each feature card with that card's prop (a book,
// a pencil, a magnifier), and peeking over the footer. As you scroll, Edu travels with you
// along a rail from one station to the next, one continuous motion tied to the scroll (see
// "the rail"): its sprout spins like a rotor (the sprout-copter), it leans into the flight,
// leaves a few puffs behind and sits down with a squash and a settle at each station. It
// never leaves the screen and never fades. The first time it sits somewhere it says one short
// line. Asking a question sends it onto the chat box (#dock-perch); closing the chat brings it
// back. In the chat, chatLife() lets the Edu on the chat box react to what you read and do
// (assets/chat.js).
//
//   const edu = journey({ hero, footer, bento, label, avoid: [askbox, chips, ".bottomnav"] });
//   edu.ctl.say("Hi!");    // the mascot itself (assets/mascot.js)
//   edu.toChat();          // just before chat.open(question): fly onto the chat box
//   edu.intro({ logo, reveal });  // first visit: Edu flies in and brings the logo (resolves when home)
//   const life = chatLife(perch, { sheet, thread, inner, input, form });   // in chat.js
//
// Smooth on a mid-range phone: a seated Edu sits inside its station, so it scrolls with the
// page for free. In the air it is one composited layer (transforms only) moved from mascot.js's
// one animation-frame loop, and the spinning sprout is a separate unfiltered copy, so the felt
// texture is never re-rendered frame by frame. It never covers the ask box or a chip.
// With reduced motion Edu never flies: it is simply at the station nearest you.
// CSP: CSSOM writes and el.animate() only, no style="" markup.

import { mascot, onFrame, nextFrame, later } from "./mascot.js?v=20261012120000";

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let still = motionQuery.matches;

const now = () => performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => u * u * (3 - 2 * u);
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

// The art's geometry (art/mascot/README.md): a sit drawing is 180 x 200, a peek 240 x 120.
const SIT_AR = 200 / 180;
const PEEK_TO_SIT = (40 / 240) / (37.4 / 180); // a flying Edu with the same face as a peek (eye spacing)
const PEEK_EYES = [120.5 / 240, 86.5 / 120];
const SIT_EYES = [90.5 / 180, 95 / 200];
const ROTOR = { left: 71.6 / 180, top: 10.88 / 200, width: 36.8 / 180, height: 33.12 / 200, view: "71.6 10.88 36.8 33.12" };

const isPhone = () => innerWidth <= 767;
// The visible band between the fixed bars, in page px: a flying Edu (and its puffs) stays inside it.
function bandOf(bars) {
  return { top: scrollY + (bars ? bars.top : 0) + 6, bottom: scrollY + innerHeight - (bars ? bars.bottom : 0) - 6 };
}

const FOCUS = 0.5; // where the visitor's eyes are, as a share of the screen height
const LAND_SPEED = 420; // px/s, coming down onto a perch
const SPIN = 34; // rad/s, the sprout-copter at full speed

// The stations and Edu's lines there (Eduport's teacher voice: short, warm, never pushy).
const KINDS = {
  hero: {
    pose: "peek",
    lines: ["Ask me anything!", "Psst… tap a suggestion above!", "Stuck on a doubt? Let's crack it together.",
      "No question is too small. Go on, ask!", "Every topper started with a question."],
  },
  doubt: {
    pose: "sit-book", first: "I explain doubts like a good teacher would!",
    lines: ["Tap the card and I'll explain it, step by step.", "Simpler, deeper, with a diagram… you choose!", "No doubt is too small for me."],
  },
  quiz: {
    pose: "sit-pencil", first: "Try a real NEET question!",
    lines: ["Real NEET and JEE questions, fully worked.", "Pick an answer, then I'll explain it!", "Practice makes toppers!"],
  },
  course: {
    pose: "sit-magnifier", first: "Let's find your course!",
    lines: ["Tell me your class, I'll find your batch.", "Live fees, straight from the Eduport shop.", "Let's find the right course for you!"],
  },
  footer: {
    pose: "peek", first: "See you in class!",
    lines: ["See you in class!", "Thanks for learning with me!", "Scroll up and ask me anything!"],
  },
};

// Keyframes for the moments around a flight (el.animate: allowed by the CSP).
const SETTLE = [
  { transform: "none" }, { offset: 0.14, transform: "rotate(10deg)" }, { offset: 0.32, transform: "rotate(-7deg)" },
  { offset: 0.5, transform: "rotate(4deg)" }, { offset: 0.68, transform: "rotate(-1.5deg)" }, { offset: 0.84, transform: "rotate(0.5deg)" },
  { transform: "none" },
];
const TOUCHDOWN = [
  { transform: "scale(1.17, 0.83)" }, { offset: 0.32, transform: "scale(0.94, 1.07)" },
  { offset: 0.62, transform: "scale(1.03, 0.975)" }, { offset: 0.82, transform: "scale(0.995, 1.005)" }, { transform: "none" },
];
const GRAB = [ // a peek grabbing its ledge after diving behind it
  { transform: "translateY(10%) scale(1.06, 0.94)" }, { offset: 0.42, transform: "translateY(-4%) scale(0.96, 1.05)" },
  { offset: 0.72, transform: "translateY(1%) scale(1.02, 0.985)" }, { transform: "none" },
];
const PROP_IN = [
  { transform: "scale(0.15) rotate(-20deg)", opacity: 0 }, { offset: 0.55, transform: "scale(1.14) rotate(6deg)", opacity: 1 },
  { offset: 0.8, transform: "scale(0.96)", opacity: 1 }, { transform: "none", opacity: 1 },
];
const PROP_OUT = [{ transform: "none", opacity: 1 }, { transform: "scale(0.1) rotate(16deg)", opacity: 0 }];

let J = null; // the one journey on the page
let pendingDock = null; // chatLife() can run before journey()

function make(tag, cls) {
  const n = document.createElement(tag);
  n.className = cls;
  return n;
}

// journey.css, until index.html links it (a stylesheet added from JS is allowed by the CSP).
function ensureStyles() {
  if (document.querySelector('link[href*="journey.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./journey.css?v=20261012120000", import.meta.url).href;
  document.head.appendChild(link);
}

// --- the journey -----------------------------------------------------------------------------
export function journey({ hero = null, footer = null, bento = null, label = "", avoid = [] } = {}) {
  if (J) return J.api;
  ensureStyles();
  const ctl = mascot("peek", { follow: true, label });

  // The sky: a layer over the screen (fixed) that Edu flies in. Flights are worked out in page px
  // and drawn at their place on the screen every frame, so a scroll never drags Edu along with the
  // page for a frame before it is put back (it rides along beside the reader). The puffs it leaves
  // behind are on the page (the trail layer) and scroll away with it.
  const sky = make("div", "edu-sky");
  sky.setAttribute("aria-hidden", "true");
  const trailLayer = make("div", "edu-trail");
  trailLayer.setAttribute("aria-hidden", "true");
  // The ledge layer: while Edu rises out of (or sinks behind) a ledge, its bottom edge is the ledge
  // and it clips everything below; it is set once per ledge, so every frame stays a transform.
  const ledge = make("div", "edu-ledge");
  const flyer = make("div", "edu-flyer");
  const body = make("div", "edu-body");
  const squash = make("div", "edu-squash");
  const rotor = make("span", "edu-rotor");
  const disc = make("span", "edu-disc");
  squash.append(disc, rotor);
  body.appendChild(squash);
  flyer.appendChild(body);
  flyer.hidden = true;
  ledge.appendChild(flyer);
  sky.appendChild(ledge);
  document.body.append(trailLayer, sky);

  J = {
    ctl, el: ctl.el, sky, trail: trailLayer, ledge, flyer, body, squash, rotor, disc, hero, footer, bento, avoid,
    stations: [], at: null, goal: null, home: null, flight: null, said: new Set(), dock: pendingDock, chat: false,
    parts: [], looping: false, landing: [], greet: null, greetShown: null, dockFallback: null, hoverRow: null, queued: false,
    rotorBuilt: false, scrollV: 0, scrollAt: -1e9, introRun: null, rail: railState(),
  };
  pendingDock = null;
  J.api = {
    ctl,
    el: ctl.el,
    /** hero | doubt | quiz | course | footer: where Edu is (or is flying to). */
    get station() { const s = J.at || J.goal; return s ? s.kind : null; },
    get flying() { return !!J.flight; },
    /** A line where Edu sits, placed so it never covers the ask box, a chip or the navigation. */
    say(text) {
      if (!J.at || J.flight) return Promise.resolve(false);
      return ctl.say(text, { place: placesFor(J.at), fits: homeFits });
    },
    toChat,
    /** First visit: Edu flies in, the logo pops up in its wake, and it lands at its ledge (see intro()). */
    intro,
  };

  scan();
  const home = J.stations.find((s) => s.kind === "hero") || J.stations[0];
  if (home) {
    home.seat.appendChild(ctl.el);
    J.at = J.goal = home;
    ctl.setPose(home.pose);
    seated(home, false);
  }

  const queue = (measureToo) => {
    J.measureNext = J.measureNext || measureToo;
    if (J.queued) return;
    J.queued = true;
    nextFrame(() => {
      J.queued = false;
      if (J.measureNext) { J.measureNext = false; measure(); }
      // With reduced motion Edu is simply at the station nearest the reader; otherwise the rail
      // carries it (railTick). A re-measure alone never sends Edu off on a still page.
      if (still) { if (now() - J.scrollAt < 400) pick(false); } else loop();
    });
  };
  // How fast the visitor scrolls: a lift-off rides along with it, so it reads right on screen.
  let lastY = scrollY;
  let lastT = now();
  window.addEventListener("scroll", () => {
    const t = now();
    const y = scrollY;
    const dt = t - lastT;
    const v = dt > 0 ? ((y - lastY) / dt) * 1000 : 0;
    J.scrollV = dt < 160 ? J.scrollV * 0.5 + v * 0.5 : 0;
    J.scrollAt = t;
    lastY = y;
    lastT = t;
    queue(false);
  }, { passive: true });
  window.addEventListener("resize", () => { measure(); if (still) pick(false); else loop(); }, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(() => queue(true)).observe(document.body);
  if (bento) {
    // The cards are drawn again when live prices arrive: their perches are new.
    new MutationObserver(() => { scan(); queue(false); }).observe(bento, { childList: true });
    bento.addEventListener("transitionend", (e) => { if (e.target.classList && e.target.classList.contains("reveal")) queue(true); });
    bento.addEventListener("pointerover", onBentoOver);
    bento.addEventListener("pointerleave", () => { J.hoverRow = null; });
  }
  const onMotion = (e) => {
    still = e.matches;
    if (still && J.flight) land(true);
    if (still) pick(true);
    else if (J.at) railSync(J.at);
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);
  document.addEventListener("visibilitychange", () => { if (document.hidden && J.flight) land(true); });
  // Ready for the first take-off: the flying drawing and the sprout-copter are built while idle.
  const warm = () => { if (!J.rotorBuilt && !still) buildRotor(ctl.prepare("sit")); };
  if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 2500 });
  else later(1500, warm);
  // The page may open scrolled (a reload, a #link): Edu is simply there, no flight.
  nextFrame(() => { measure(); if (!J.flight) pick(true); if (J.at && !J.flight) railSync(J.at); });
  return J.api;
}

// --- stations ----------------------------------------------------------------------------------
function scan() {
  const old = J.stations;
  const list = [];
  const add = (kind, host) => {
    if (!host || !host.isConnected) return;
    const spec = KINDS[kind] || KINDS.doubt;
    const pose = host.dataset.eduPose || spec.pose;
    const family = pose.startsWith("sit") ? "sit" : "peek";
    const prev = old.find((s) => s.host === host);
    if (prev) { list.push(prev); return; }
    // A seat keeps the station's size even while Edu is away, so it can be measured and nothing shifts.
    let seat = host.querySelector(":scope > .edu-seat");
    if (!seat) {
      seat = make("span", `edu-seat edu-seat--${family}`);
      host.appendChild(seat);
    }
    list.push({ kind: KINDS[kind] ? kind : "doubt", host, seat, pose, family, box: null, row: host.closest(".bento-row") });
  };
  add("hero", J.hero);
  if (J.bento) for (const p of J.bento.querySelectorAll(".bento-perch")) add(p.dataset.eduStation || "doubt", p);
  add("footer", J.footer);
  J.stations = list;
  // A card Edu sits on (or flies to) was drawn again: the new card takes its place.
  const twin = (st) => (!st || list.includes(st) ? st : list.find((s) => s.kind === st.kind) || null);
  if (J.at && !list.includes(J.at)) J.at = twin(J.at);
  if (J.goal && J.goal.kind !== "dock" && !list.includes(J.goal)) J.goal = twin(J.goal) || J.at;
  if (J.home && !list.includes(J.home)) J.home = twin(J.home);
  if (J.flight && J.flight.goal.kind !== "dock" && !list.includes(J.flight.goal)) J.flight.goal = twin(J.flight.goal) || J.goal;
  measure();
  if (!J.flight && J.el && (!J.el.isConnected || (J.at && J.el.parentElement !== J.at.seat))) {
    const st = J.at || nearest() || list[0];
    if (st) {
      J.ctl.setPose(st.pose);
      st.seat.appendChild(J.el);
      J.at = J.goal = st;
    }
  }
}

// Where a seat is laid out on the page (px), without the transforms of an entrance in progress
// (a card's reveal): where it will be, so Edu never chases a moving seat and never has to correct.
function measureOne(st) {
  const el = st.seat;
  if (!el.isConnected || !el.offsetWidth) { st.box = null; return null; }
  let x = 0;
  let y = 0;
  for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  st.box = { x, y, w: el.offsetWidth, h: el.offsetHeight };
  return st.box;
}
function measure() {
  for (const st of J.stations) measureOne(st);
  J.bars = guards(); // (kept for take-offs: they never force a layout)
  railMeasure();
}
// The height at which a station meets the visitor's eyes: a ledge, or the body on a card.
const eyeLine = (st) => (st.family === "peek" ? st.box.y + st.box.h : st.box.y + st.box.h * 0.6);

function nearest() {
  const vh = innerHeight;
  const y = scrollY;
  const max = document.documentElement.scrollHeight - vh;
  const B = bandOf(guards());
  const inBand = (s) => eyeLine(s) >= B.top && eyeLine(s) <= B.bottom;
  // A station under a fixed bar is never a goal (Edu would fly under the bar): keep the current one.
  const list = J.stations.filter((s) => s.box && inBand(s));
  if (!list.length) return J.goal || null;
  if (y <= 2 && list[0].kind === "hero") return list[0]; // at the very top: home
  if (max > 0 && y >= max - 2 && list[list.length - 1].kind === "footer") return list[list.length - 1]; // the very bottom
  const focus = y + vh * FOCUS;
  let best = null;
  let bestD = Infinity;
  for (const st of list) {
    const d = Math.abs(eyeLine(st) - focus);
    if (d < bestD) { best = st; bestD = d; }
  }
  // Not clearly nearer than where Edu already is (or is going): stay, so it never flits back and forth.
  const cur = J.goal;
  if (best && cur && cur !== best && cur.box && list.includes(cur) && !(y <= 2 || y >= max - 2)) {
    if (Math.abs(eyeLine(cur) - focus) - bestD < vh * 0.07) return cur;
  }
  return best;
}

function pick(first) {
  if (J.chat || !J.stations.length) return;
  const st = nearest();
  if (!st || st === J.goal) return;
  if (first) settle(st);
  else go(st);
}

// (reduced motion, or a hidden tab: Edu is simply there; otherwise the rail carries it, see railTick)
function go(st) {
  J.goal = st;
  if (J.at === st && !J.flight) return;
  settle(st);
}

// A station whose card was just drawn again has a new seat: use that one (or the nearest).
function live(st) {
  if (st && st.seat.isConnected) return st;
  const ok = J.stations.filter((s) => s.seat.isConnected);
  const near = nearest();
  return (st && ok.find((s) => s.kind === st.kind)) || (ok.includes(near) ? near : ok[0]) || null;
}

// Edu simply appears at a station (reduced motion, a hidden tab, the first look at the page).
function settle(st) {
  st = live(st);
  if (!st) return;
  if (J.flight) endFlight();
  J.ctl.rest();
  J.ctl.setPose(st.pose);
  st.seat.appendChild(J.el);
  J.at = J.goal = st;
  seated(st, true);
  railSync(st);
}

function seated(st, greet) {
  const spec = KINDS[st.kind];
  J.ctl.setLines(spec.lines, { place: placesFor(st), fits: homeFits });
  if (greet) greetOnce(st);
}

// The first time Edu lands at a station it says that station's line (once per visit).
function greetOnce(st) {
  const line = KINDS[st.kind].first;
  if (!line || J.said.has(st.kind)) return;
  J.said.add(st.kind);
  if (J.greet) J.greet();
  J.greet = later(still ? 150 : 380, () => {
    J.greet = null;
    if (J.at !== st || J.flight || J.chat) { J.said.delete(st.kind); return; }
    let shown = false;
    J.ctl.say(line, { place: placesFor(st), fits: (r) => (shown = homeFits(r)) });
    if (!shown) J.said.delete(st.kind); // no room right now: next time
    else J.greetShown = { kind: st.kind, at: now() };
  });
}

function placesFor(st) {
  if (st.kind === "hero") return ["above"];
  if (st.kind === "footer") return ["right", "above"];
  const row = st.row && st.row.getBoundingClientRect();
  const seat = st.seat.getBoundingClientRect();
  const onRight = row && row.width ? seat.left + seat.width / 2 > row.left + row.width / 2 : true;
  return onRight ? ["left", "above"] : ["right", "above"];
}

const hit = (a, b, pad) => b.width > 0 && b.height > 0 && a.left < b.right + pad && a.right > b.left - pad
  && a.top < b.bottom + pad && a.bottom > b.top - pad;
function avoidEls() {
  const out = [];
  for (const x of J.avoid) {
    if (typeof x === "string") out.push(...document.querySelectorAll(x));
    else if (x) out.push(x);
  }
  return out;
}
// A bubble on the home page never covers the ask box, a chip or the navigation.
function homeFits(r) {
  if (r.top < 6 || r.bottom > innerHeight - 6) return false;
  for (const el of avoidEls()) if (hit(r, el.getBoundingClientRect(), 6)) return false;
  return true;
}

// Mouse users: Edu waves when you point at its card, and looks at the one you point at.
function onBentoOver(e) {
  const row = e.target.closest && e.target.closest(".bento-row");
  if (!row || row === J.hoverRow) return;
  J.hoverRow = row;
  if (e.pointerType !== "mouse" || J.flight || J.chat) return;
  const st = J.stations.find((s) => s.row === row);
  if (st && J.at === st) {
    if (!J.el.classList.contains("is-landing") && J.el.dataset.state === "idle") J.ctl.pulse("wave", 1200);
  } else {
    J.ctl.look(row, 900);
  }
}

// --- geometry of a flight ---------------------------------------------------------------------
// A flight moves the feet (the bottom centre of a sit drawing) and the width.
function flyBox(st) {
  const b = st.box;
  if (!b) return null;
  if (st.family === "sit") return { cx: b.x + b.w / 2, fy: b.y + b.h, w: b.w, ledge: null };
  // A peek: a whole Edu whose face is exactly where the peek's face is, the rest behind the ledge.
  const w = b.w * PEEK_TO_SIT;
  const h = w * SIT_AR;
  const ex = b.x + b.w * PEEK_EYES[0];
  const ey = b.y + b.h * PEEK_EYES[1];
  return { cx: ex + w * (0.5 - SIT_EYES[0]), fy: ey + h * (1 - SIT_EYES[1]), w, ledge: b.y + b.h };
}
function dockBox() {
  const d = J.dock;
  if (!d) return null;
  const r = d.ctl.el.getBoundingClientRect();
  if (!r.width) return null;
  let ledge = null;
  if (d.behind && d.wrap) ledge = d.wrap.getBoundingClientRect().top + scrollY; // phones: it stands behind the box
  return { cx: r.left + scrollX + r.width / 2, fy: r.top + scrollY + r.height, w: r.width, ledge };
}
function goalBox(goal) {
  if (goal.kind === "dock") return dockBox();
  return goal.seat.isConnected && measureOne(goal) ? flyBox(goal) : null;
}
function isBehind(d) {
  if (!d.wrap) return false;
  const z = (el) => parseInt(getComputedStyle(el).zIndex, 10) || 0;
  return z(d.host) < z(d.wrap);
}
// The ask box and the chips (and anything else in the page that must stay clear). Fixed bars sit
// above the sky anyway; the lowest edge of those along the top is returned as `top`.
function guards() {
  const out = [];
  out.top = 0;
  out.bottom = 0;
  for (const el of avoidEls()) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (getComputedStyle(el).position === "fixed") {
      if (r.top < 120) out.top = Math.max(out.top, r.bottom);
      else if (r.bottom > innerHeight - 140) out.bottom = Math.max(out.bottom, innerHeight - r.top);
      continue;
    }
    out.push({ left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY });
  }
  return out;
}

// The visitor's scroll speed right now (px/s, down is positive), or 0 when the page is still.
const scrollSpeed = () => (now() - J.scrollAt < 140 ? clamp(J.scrollV, -1600, 1600) : 0);

// --- the rail: Edu travels along with the reader ----------------------------------------------------
// Between two neighbouring stations A and B, where Edu is depends only on how far the page is
// scrolled: at the scroll where A meets the reader's eyes (the focus line) Edu sits at A, at B's
// it sits at B, and in between it flies a gentle curve from one to the other that keeps to the
// side (the right edge on phones, where the perches are) and crosses as few words as it can. So it
// rides along beside the reader, always on screen, and scrolling back plays it all backwards. If
// the scroll stops between two stations, after a moment it glides along the curve to the nearer
// one and sits down: it never hovers over words being read. A critically damped spring takes care
// of anything that is not the scroll (the page changing under it, the way back from the chat), so
// nothing ever snaps, jumps, fades or leaves the screen. Transforms only, from the one frame loop.
const RAIL_DWELL = 0.05; // of each stretch of scroll: Edu stays at the station for this share at either end
const RAIL_IDLE = 250; // ms without scrolling between two stations, then the glide to the nearer one
const RAIL_LAND = 80; // ms at a station, not scrolling, before it sits down there (a fling flies past)
const RAIL_OMEGA = 13; // rad/s: the spring for everything that is not the scroll
const RAIL_RAMP = 0.2; // share of a stretch to get up to speed (and to slow down again)
const RAIL_STEP = 34; // px a frame at most on screen: more (a jump of the scroll, a fling) goes to the spring
const SPRING_KEYS = [["x", "vx"], ["y", "vy"], ["w", "vw"]];

function railState() {
  return { nodes: [], segs: [], g: 0, gs: 0, bias: 0, settle: null, since: 0, ready: false, wMax: 0, last: 0,
    text: null, textAt: -1e9, e: { x: 0, vx: 0, y: 0, vy: 0, w: 0, vw: 0 } };
}

// The page's words (and the ask box and the chips), in page px: what a stretch of the rail avoids.
function textRects() {
  const out = [];
  for (const root of [document.getElementById("main"), document.getElementById("features"), document.querySelector(".footer")]) {
    if (!root) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest(".mascot, .sr-only, .edu-seat, [hidden]")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width > 1 && r.height > 1) out.push({ l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY });
      }
    }
  }
  for (const el of avoidEls()) {
    const r = el.getBoundingClientRect();
    if (r.width && getComputedStyle(el).position !== "fixed") out.push({ l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY });
  }
  return out;
}

// The stations along the page: where each sits (page px) and the scroll at which it meets the eyes.
function railMeasure() {
  const R = J.rail;
  const list = J.stations.filter((st) => st.box && st.seat.isConnected);
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const nodes = list.map((st) => ({ st, box: flyBox(st), Y: clamp(eyeLine(st) - innerHeight * FOCUS, 0, max) }));
  if (nodes.length && nodes[0].st.kind === "hero") nodes[0].Y = 0; // the top of the page is home
  const last = nodes[nodes.length - 1];
  if (last && last.st.kind === "footer") last.Y = max; // and the bottom is the footer
  for (let i = 1; i < nodes.length; i++) nodes[i].Y = Math.max(nodes[i].Y, nodes[i - 1].Y + 24);
  // Edu in the air while the page changes: it stays where it is and the spring takes it to its new place.
  const before = R.ready && J.flight && J.flight.stage === "rail" ? railPoint(R.g) : null;
  const key = `${nodes.length}:${document.documentElement.scrollHeight}:${innerWidth}`;
  if (!R.text || R.textKey !== key || now() - R.textAt > 600) { R.text = textRects(); R.textAt = now(); R.textKey = key; }
  R.nodes = nodes;
  R.wMax = nodes.reduce((m, n) => Math.max(m, n.box.w), 1);
  R.segs = [];
  for (let i = 0; i < nodes.length - 1; i++) R.segs.push(planSeg(nodes[i], nodes[i + 1], R.text));
  R.ready = R.segs.length > 0;
  if (before && R.ready) {
    const p = railPoint(R.g);
    R.e.x += before.cx - p.cx;
    R.e.y += before.fy - p.fy;
    R.e.w += before.w - p.w;
  }
}

// A stretch of the rail: which way it bends. Straight, along either edge of the screen, or through
// either margin beside the content: the one that crosses the fewest words (a detour costs a little).
function planSeg(a, b, text) {
  const A = a.box;
  const B = b.box;
  const seg = { a, b, A, B, shrink: isPhone() ? 0.3 : 0.15, xE: (A.cx + B.cx) / 2,
    liftA: a.st.family === "peek" ? A.fy - A.ledge + A.w * SIT_AR * 0.3 : 0,
    liftB: b.st.family === "peek" ? B.fy - B.ledge + B.w * SIT_AR * 0.3 : 0 };
  const wc = Math.max(A.w, B.w) * (1 - seg.shrink);
  const vw = document.documentElement.clientWidth;
  const lo = scrollX + wc / 2 + 6;
  const hi = scrollX + vw - wc / 2 - 6;
  const straight = (A.cx + B.cx) / 2;
  const options = [straight, hi, lo];
  const col = J.bento && J.bento.getBoundingClientRect();
  if (col && col.width) {
    if (col.left > wc + 20) options.push(scrollX + col.left / 2);
    if (vw - col.right > wc + 20) options.push(scrollX + (col.right + vw) / 2);
  }
  let best = null;
  for (const x of options) {
    seg.xE = clamp(x, lo, hi);
    let cost = Math.abs(seg.xE - straight) * 40;
    for (let i = 1; i < 24; i++) {
      const p = segPoint(seg, i / 24);
      const w = p.w * p.cs;
      const h = w * SIT_AR;
      const l = p.cx - w / 2;
      const r = p.cx + w / 2;
      const top = p.fy - h;
      for (const q of text) {
        const ox = Math.min(r, q.r) - Math.max(l, q.l);
        if (ox <= 0) continue;
        const oy = Math.min(p.fy, q.b) - Math.max(top, q.t);
        if (oy > 0) cost += ox * oy;
      }
    }
    if (!best || cost < best.cost) best = { cost, xE: seg.xE };
  }
  seg.xE = best.xE;
  // Behind a ledge only while rising out of it (until the feet first clear it) and while diving in
  // at the end, never when the curve passes the ledge's line again further on.
  seg.clearA = 0;
  if (a.st.family === "peek") {
    seg.clearA = 0.6;
    for (let i = 1; i <= 60; i++) if (segPoint(seg, i / 100).fy < A.ledge - 0.5) { seg.clearA = i / 100; break; }
  }
  seg.enterB = 1;
  if (b.st.family === "peek") {
    seg.enterB = 0.4;
    for (let i = 99; i >= 40; i--) if (segPoint(seg, i / 100).fy < B.ledge - 0.5) { seg.enterB = i / 100; break; }
  }
  return seg;
}

// Up to speed over the first RAIL_RAMP of a stretch, steady, and down again over the last: Edu
// keeps pace with the scroll in between (a quarter faster, as it sat still at both ends).
function ramped(s) {
  const a = RAIL_RAMP;
  const m = 1 / (1 - a);
  const part = (x) => a * (x * x * x - (x * x * x * x) / 2);
  if (s <= a) return m * part(s / a);
  if (s >= 1 - a) return 1 - m * part((1 - s) / a);
  return m * (a / 2 + s - a);
}
// Out of a ledge first (and into one last): a quick rise that eases off.
const liftOf = (s) => smooth(clamp(s / 0.18, 0, 1)) * (1 - smooth(clamp((s - 0.22) / 0.4, 0, 1)));

// Where Edu is on a stretch at s (0 at A, 1 at B): feet, width, cruise scale and the ledge it is behind.
function segPoint(seg, s) {
  const { A, B } = seg;
  const e = smooth(s);
  const k = 1 - e;
  const cx = k * k * k * A.cx + 3 * k * e * (k + e) * seg.xE + e * e * e * B.cx;
  const fy = A.fy + (B.fy - A.fy) * ramped(s) - seg.liftA * liftOf(s) - seg.liftB * liftOf(1 - s);
  const w = A.w + (B.w - A.w) * e;
  const cs = 1 - seg.shrink * Math.sin(Math.PI * e);
  let behind = null;
  if (seg.clearA != null && s < seg.clearA && seg.a.st.family === "peek" && fy > A.ledge - 0.5) behind = A.ledge;
  else if (seg.enterB != null && s > seg.enterB && seg.b.st.family === "peek" && fy > B.ledge - 0.5) behind = B.ledge;
  return { cx, fy, w, cs, behind, s };
}
function railPoint(g) {
  const R = J.rail;
  const k = clamp(Math.floor(g), 0, R.segs.length - 1);
  return segPoint(R.segs[k], clamp(g - k, 0, 1));
}
// The rail position for a scroll position: whole numbers are the stations.
function railScroll(y) {
  const n = J.rail.nodes;
  if (n.length < 2) return 0;
  let i = 0;
  while (i < n.length - 2 && y >= n[i + 1].Y) i++;
  const span = n[i + 1].Y - n[i].Y;
  const u = span > 0 ? clamp((y - n[i].Y) / span, 0, 1) : 1;
  return i + clamp((u - RAIL_DWELL) / (1 - 2 * RAIL_DWELL), 0, 1);
}
// Edu is at a station (it sat down there, or was put there): the rail continues from it.
function railSync(st) {
  const R = J.rail;
  const i = R.nodes.findIndex((n) => n.st === st);
  R.gs = railScroll(scrollY);
  R.g = i >= 0 ? i : R.gs;
  R.bias = R.g - R.gs;
  R.settle = null;
  R.since = 0;
  for (const k in R.e) R.e[k] = 0;
}

function springStep(e, dt) {
  const k = Math.exp(-RAIL_OMEGA * dt);
  for (const [p, v] of SPRING_KEYS) {
    const j = (e[v] + RAIL_OMEGA * e[p]) * dt;
    e[p] = (e[p] + j) * k;
    e[v] = (e[v] - RAIL_OMEGA * j) * k;
  }
}

// One frame of the rail. Returns true while there is more to do (the loop keeps running).
function railTick(t) {
  const R = J.rail;
  if (still || J.chat || !R.ready || document.hidden || J.introRun) return false;
  if (J.flight && J.flight.stage !== "rail") return false; // another flight has Edu: it hands back when it lands
  const dt = R.last && t - R.last < 200 ? clamp((t - R.last) / 1000, 0, 0.05) : 1 / 60;
  R.last = t;
  const gs = railScroll(scrollY);
  const dgs = gs - R.gs;
  R.gs = gs;
  const idle = now() - J.scrollAt;
  const top = R.nodes.length - 1;
  if (R.settle && Math.abs(dgs) > 1e-6) R.settle = null; // scrolling again: Edu follows the reader
  if (R.settle) {
    const p = clamp((t - R.settle.t0) / (R.settle.T * 1000), 0, 1);
    R.g = R.settle.g0 + (R.settle.g1 - R.settle.g0) * smooth(p);
    if (p >= 1) { R.g = R.settle.g1; R.settle = null; }
    R.bias = R.g - gs;
  } else if (Math.abs(dgs) > 1e-6) {
    // With the scroll. A gap left by a glide closes as the reader scrolls on, and never moves Edu
    // against the scroll.
    R.bias *= Math.exp(-Math.abs(dgs) * 6);
    const want = clamp(gs + R.bias, 0, top);
    R.g = dgs > 0 ? Math.max(R.g, want) : Math.min(R.g, want);
    R.bias = R.g - gs;
  } else if (idle > RAIL_IDLE && Math.abs(R.g - Math.round(R.g)) > 1e-4) {
    // To the nearer station whose seat is wholly in sight between the bars (else simply the nearer).
    const near = Math.round(R.g);
    const far = near > R.g ? Math.floor(R.g) : Math.ceil(R.g);
    const g1 = inSight(R.nodes[near].st) || !inSight(R.nodes[far].st) ? near : far;
    R.settle = { g0: R.g, g1, t0: t, T: 0.18 + 0.7 * Math.abs(g1 - R.g) };
  }
  const gi = Math.round(R.g);
  const on = Math.abs(R.g - gi) < 1e-4;
  const st = R.nodes[gi].st;
  if (!J.flight) {
    if (on && J.at === st) { R.since = 0; return idle < RAIL_IDLE + 100; } // sitting there
    railTakeOff();
    if (!J.flight) return false;
  }
  const f = J.flight;
  J.goal = f.goal = st;
  if (f.poseAt && t >= f.poseAt) { J.ctl.setPose("sit"); f.poseAt = 0; } // the prop is put away: arms free
  springStep(R.e, dt);
  const p = railPoint(R.g);
  let cx = p.cx + R.e.x;
  let fy = p.fy + R.e.y;
  const w = Math.max(8, p.w + R.e.w);
  // Never more than RAIL_STEP px a frame on the screen: anything more (the scroll jumping, a fling)
  // is handed to the spring, which brings Edu there smoothly.
  const sy = scrollY;
  if (f.atY != null) {
    const dx = cx - f.cx;
    const dy = fy - sy - (f.fy - f.atY);
    const d = Math.hypot(dx, dy);
    if (d > RAIL_STEP) {
      const k = RAIL_STEP / d;
      const nx = f.cx + dx * k;
      const ny = f.fy - f.atY + sy + dy * k;
      R.e.x += nx - cx;
      R.e.y += ny - fy;
      cx = nx;
      fy = ny;
    }
  }
  // Never under a fixed bar: its visible part stays in the band between them (with room for the
  // stretch it has and its lean, which lifts a corner: nothing extra when it is at rest).
  const h = w * p.cs * (SIT_AR * Math.max(1, f.sy) + Math.abs(Math.sin((f.tilt * Math.PI) / 180)) * 0.6) + 2;
  const B = bandOf(f.guards);
  const shown = p.behind != null ? Math.min(fy, p.behind) : fy;
  if (shown > B.bottom - 3) fy -= shown - (B.bottom - 3);
  if (fy - h < B.top) fy = B.top + h;
  cx = clamp(cx, scrollX + (w * p.cs) / 2, scrollX + document.documentElement.clientWidth - (w * p.cs) / 2);
  R.e.x = cx - p.cx; // the spring carries on from where Edu really is
  R.e.y = fy - p.fy;
  f.atY = sy; // (the scroll this frame was drawn at)
  const k = Math.min(1, dt * 12);
  f.vx += ((cx - f.cx) / dt - f.vx) * k;
  f.vy += ((fy - f.fy) / dt - f.vy) * k;
  f.cx = cx;
  f.fy = fy;
  f.w = w;
  f.cs = p.cs;
  f.behind = p.behind;
  // The pose follows the motion: it leans into it, stretches a little when fast, the sprout spins
  // while it travels (winding down at a station) and the eyes look where it is going.
  const speed = Math.hypot(f.vx, f.vy);
  const away = on ? 0 : clamp(Math.min(p.s, 1 - p.s) * 6, 0.25, 1);
  f.ttilt = clamp(f.vx / 42, -18, 18);
  f.tsy = 1 + Math.min(0.07, speed / 12000);
  f.tsx = 1 - (f.tsy - 1) * 0.7;
  f.bob = Math.sin((t / 1000) * Math.PI * 2 * 3.1) * 1.8 * clamp(1 - speed / 450, 0, 1) * away;
  if (t - (f.lookAt || 0) > 90) {
    f.lookAt = t;
    J.ctl.glance(speed > 40 ? [Math.round(clamp(f.vx / 520, -1, 1) * 20) / 20, Math.round(clamp(f.vy / 520, -0.7, 1) * 20) / 20] : null);
  }
  f.omega += (SPIN * away - f.omega) * Math.min(1, dt * 8);
  if (t - f.countAt > 2500) { f.count = 0; f.countAt = t; }
  if (away > 0.5) trail(f, t, speed);
  const kk = 1 - Math.exp(-dt * 20);
  f.sx += (f.tsx - f.sx) * kk;
  f.sy += (f.tsy - f.sy) * kk;
  f.tilt += (f.ttilt - f.tilt) * (1 - Math.exp(-dt * 9));
  f.spin += f.omega * dt;
  write(f);
  // At a station and not scrolling for a moment: it sits down (the landing squash, the prop, the grab).
  if (on && Math.abs(dgs) < 1e-6) { if (!R.since) R.since = t; } else R.since = 0;
  const quiet = Math.abs(R.e.x) + Math.abs(R.e.y) < 0.8 && Math.abs(R.e.vx) + Math.abs(R.e.vy) < 12;
  if (R.since && t - R.since >= RAIL_LAND && quiet) railLand(st);
  return true;
}

// Is the seat wholly on screen, between the fixed bars?
function inSight(st) {
  const b = st && st.box;
  if (!b) return false;
  const B = bandOf(J.bars || guards());
  return b.y >= B.top + 2 && b.y + b.h <= B.bottom - 3;
}

// Off its seat and onto the rail, from exactly where it sits.
function railTakeOff() {
  const R = J.rail;
  const seat = J.at;
  const p = railPoint(R.g);
  const from = seat && seat.seat.isConnected && measureOne(seat) ? flyBox(seat) : { cx: p.cx, fy: p.fy, w: p.w, ledge: p.behind };
  startRail(from, seat);
  R.e = { x: from.cx - p.cx, vx: 0, y: from.fy - p.fy, vy: 0, w: from.w - p.w, vw: 0 };
}
function startRail(from, seat) {
  const { ctl, el } = J;
  for (const an of J.landing) an.cancel();
  J.landing = [];
  el.classList.remove("is-landing");
  if (J.greet) { J.greet(); J.greet = null; J.said.delete(J.at ? J.at.kind : ""); }
  if (J.greetShown && now() - J.greetShown.at < 1500) J.said.delete(J.greetShown.kind);
  J.greetShown = null;
  ctl.rest();
  const W = Math.ceil(Math.max(J.rail.wMax, from.w));
  J.flyer.style.width = `${W}px`;
  J.flyer.style.opacity = "";
  J.flyer.hidden = false;
  if (el.parentElement !== J.squash) J.squash.insertBefore(el, J.squash.firstChild);
  el.classList.add("is-flying");
  let poseAt = 0;
  const prop = seat && seat.family === "sit" && seat.pose !== "sit";
  if (prop && !still) { // the prop goes first, then the arms are free to fly
    const pr = el.querySelector("svg .m-prop");
    if (pr) J.landing.push(pr.animate(PROP_OUT, { duration: 130, easing: "ease-in", fill: "forwards" }));
    poseAt = now() + 130;
  } else ctl.setPose("sit"); // from a peek: the same face, now with a body behind the ledge
  buildRotor();
  J.at = null;
  J.flight = {
    goal: seat || J.goal, stage: "rail", t0: now(), last: 0, cx: from.cx, fy: from.fy, w: from.w, W, vx: 0, vy: 0,
    tilt: 0, ttilt: 0, sx: 1, sy: 1, tsx: 1, tsy: 1, grow: 1, spin: 0, omega: 0, seg: null, launched: true,
    behind: from.ledge != null ? from.ledge : null, clipKey: undefined, puffAt: 0, sparkAt: 0, count: 0, countAt: now(),
    lost: 0, guards: J.bars || guards(), cs: 1, poseAt, atY: scrollY,
  };
  J.rail.last = 0;
  write(J.flight);
  loop();
}
// Sits down at a station on the rail.
function railLand(st) {
  const s = live(st);
  if (!s) return;
  endFlight();
  J.ctl.setPose(s.pose);
  s.seat.appendChild(J.el);
  J.at = J.goal = s;
  touchdown(s);
  seated(s, true);
  J.rail.since = 0;
}
// Back on the rail from a spot off it (the chat box), the spring taking it to where the rail is.
function railFrom(from) {
  const R = J.rail;
  if (!R.ready || still) {
    if (J.flight) endFlight();
    const st = nearest() || J.home || J.at;
    if (st) settle(st);
    return;
  }
  R.gs = railScroll(scrollY);
  R.g = R.gs;
  R.bias = 0;
  R.settle = null;
  R.since = 0;
  const p = railPoint(R.g);
  const f = J.flight;
  if (f) { // already in the air (it was still on its way to the chat): it simply carries on, on the rail
    Object.assign(f, { stage: "rail", legs: null, seg: null, dockClip: false, startLedge: null, behind: null,
      goal: R.nodes[Math.round(R.g)].st, w: from.w, cs: 1, W: Math.max(f.W, J.rail.wMax), countAt: now(), atY: scrollY });
    J.flyer.style.width = `${Math.ceil(f.W)}px`;
    J.rail.last = 0;
    loop();
  } else startRail({ cx: from.cx, fy: from.fy, w: from.w, ledge: null }, null);
  R.e = { x: from.cx - p.cx, vx: 0, y: from.fy - p.fy, vy: 0, w: from.w - p.w, vw: 0 };
}

// --- a flight -------------------------------------------------------------------------------------
// A flight has stages: a crouch (or, out of the closing chat, a pop into view), a hop up out of
// the ledge when it starts behind one, the cruise (a curve that leaves going up and arrives coming
// down), and a dive behind the ledge when it lands on a peek. The goal may change at any stage:
// the next stage simply starts from where Edu is, with the speed it has.
const APPROACH = 26; // px above a ledge where the dive behind it starts

function startFlight(a, goal, { prop = false, quick = false, legs = null, exit = "side", v = null, dockClip = false } = {}) {
  const { ctl, el } = J;
  for (const an of J.landing) an.cancel();
  J.landing = [];
  el.classList.remove("is-landing");
  if (J.greet) { J.greet(); J.greet = null; J.said.delete(J.at ? J.at.kind : ""); }
  // Off again right after starting its line there: the line is said again next time.
  if (J.greetShown && now() - J.greetShown.at < 1500) J.said.delete(J.greetShown.kind);
  J.greetShown = null;
  ctl.rest();
  const g = goalBox(goal);
  const bars = guards();
  const W = Math.ceil(Math.max(a.w, g ? g.w : a.w));
  J.flyer.style.width = `${W}px`;
  J.flyer.style.opacity = "";
  J.flyer.hidden = false;
  if (el.parentElement !== J.squash) J.squash.insertBefore(el, J.squash.firstChild);
  el.classList.add("is-flying");
  if (!prop) ctl.setPose("sit"); // from a peek: the same face, now with a body behind the ledge
  else {
    const p = el.querySelector("svg .m-prop");
    if (p && !still) J.landing.push(p.animate(PROP_OUT, { duration: 130, easing: "ease-in", fill: "forwards" }));
  }
  buildRotor();
  J.at = null;
  const moving = !!v && Math.hypot(v.x, v.y) > 30;
  J.flight = {
    goal, t0: now(), last: 0, stage: "crouch", crouch: moving ? 0 : quick ? 40 : prop ? 130 : 95, prop, quick,
    launched: moving, cx: a.cx, fy: a.fy, w: a.w, W, vx: moving ? v.x : 0, vy: moving ? v.y : 0, tilt: 0, ttilt: 0,
    sx: 1, sy: 1, tsx: 1, tsy: 1, grow: 1, spin: 0, omega: moving ? SPIN : 0, seg: null,
    behind: a.ledge != null ? a.ledge : null, clipKey: undefined, puffAt: 0, sparkAt: 0, count: 0, lost: 0, guards: bars, cs: 1,
    legs: legs ? legs.slice() : null, exit, dockClip, startLedge: a.ledge != null ? a.ledge : null, leg: 0,
  };
  write(J.flight);
  loop();
}

function loop() {
  if (J.looping) return;
  J.looping = true;
  onFrame(tick);
}
function tick(t) {
  if (J.flight && J.flight.stage !== "rail") fly(J.flight, t);
  const busy = railTick(t);
  sweepParts();
  if (!J.flight && !J.parts.length && !busy) { J.looping = false; return false; }
  return true;
}

function seg(f, t, x, y, v0, v1, T, w1) {
  const m = Math.hypot(v0.x, v0.y);
  const k = m > 1700 ? 1700 / m : 1;
  return { t0: t, T, p0x: f.cx, p0y: f.fy, v0x: v0.x * k, v0y: v0.y * k, p1x: x, p1y: y, v1x: v1.x, v1y: v1.y, w0: f.w, w1 };
}
// Where the cruise ends: on the seat, or just above the ledge of a peek (the dive goes from there).
const cruiseEnd = (g) => [g.cx, g.ledge != null ? g.ledge - APPROACH : g.fy];

// The next stage, from where Edu is now: out of a ledge first, else the cruise to the goal.
function next(f, t) {
  const g = goalBox(f.goal);
  if (!g) return;
  if (f.behind != null) {
    const dx = g.cx - f.cx;
    f.stage = "pop";
    const sv = scrollSpeed();
    f.seg = seg(f, t, f.cx + clamp(dx * 0.12, -24, 24), f.behind - 10, { x: f.vx * 0.3, y: Math.min(f.vy, -260) + sv },
      { x: clamp(dx * 0.6, -200, 200), y: -240 + sv }, f.quick ? 0.14 : 0.2, f.w);
    return;
  }
  const [x, y] = cruiseEnd(g);
  const dx = x - f.cx;
  const dy = y - f.fy;
  // Lift-off goes up first, like a helicopter (a bigger push when the goal is higher up the page);
  // a new goal mid-air keeps the speed Edu already has.
  // The hop up is only as big as the room above it (never up behind the top bar).
  const room = f.fy - f.w * SIT_AR - scrollY - f.guards.top - 8;
  const hop = Math.min(dy < -40 ? Math.min(900, 380 - dy * 0.9) : 520, Math.max(90, room * 4));
  const v0 = f.launched ? { x: f.vx, y: f.vy } : { x: isPhone() ? 0 : clamp(dx * 0.9, -420, 420), y: -hop + scrollSpeed() };
  f.launched = true;
  f.stage = "cruise";
  const T = clamp(0.36 + Math.hypot(dx, dy) / 1400, 0.42, 0.95); // seconds: a hop is quick, a long glide still short
  f.seg = seg(f, t, x, y, v0, { x: 0, y: g.ledge != null ? 230 : LAND_SPEED }, T, g.w);
}

// A cubic Hermite curve: leaves the start with velocity v0 and arrives with v1.
function hermite(s, u, out) {
  const T = s.T;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  out.cx = h00 * s.p0x + h10 * T * s.v0x + h01 * s.p1x + h11 * T * s.v1x;
  out.fy = h00 * s.p0y + h10 * T * s.v0y + h01 * s.p1y + h11 * T * s.v1y;
  out.vx = (d00 * s.p0x + d10 * T * s.v0x + d01 * s.p1x + d11 * T * s.v1x) / T;
  out.vy = (d00 * s.p0y + d10 * T * s.v0y + d01 * s.p1y + d11 * T * s.v1y) / T;
}

function fly(f, t) {
  const dt = f.last ? clamp((t - f.last) / 1000, 0, 0.05) : 1 / 60;
  f.last = t;
  const g = goalBox(f.goal);
  if (!g) { // the goal is gone for now (a card being drawn again): wait a few frames, then just be there
    if (++f.lost > 30) land(true);
    return;
  }
  f.lost = 0;
  if (f.stage === "crouch") {
    const k = f.crouch > 0 ? clamp((t - f.t0) / f.crouch, 0, 1) : 1;
    const e = Math.sin((k * Math.PI) / 2);
    if (f.crouch > 0) { // anticipation: a little crouch before the lift-off
      f.tsx = 1 + 0.09 * e;
      f.tsy = 1 - 0.12 * e;
    }
    f.omega = Math.max(f.omega, SPIN * 0.75 * k);
    if (k >= 1) {
      if (f.prop) { J.ctl.setPose("sit"); f.prop = false; }
      if (f.legs) introNext(f, t);
      else next(f, t);
    }
  }
  if (f.stage !== "crouch") {
    const s = f.seg;
    // The goal may move (a card sliding in, the chat sheet rising): aim at where it is now.
    if (f.stage === "cruise") { [s.p1x, s.p1y] = cruiseEnd(g); s.w1 = g.w; }
    else if (f.stage === "dive" || (f.stage === "intro" && f.exit === "land" && f.legs && !f.legs.length)) {
      s.p1x = g.cx; s.p1y = g.fy; s.w1 = g.w; // (the last leg onto the chat box follows it as the chat settles)
    }
    if (s.t0 == null) s.t0 = t; // (the intro's first leg: timed from its first frame)
    const u = clamp((t - s.t0) / (s.T * 1000), 0, 1);
    hermite(s, u, f);
    f.w = s.w0 + (s.w1 - s.w0) * smooth(u);
    if (f.stage === "cruise") keepClear(f);
    // Behind an edge: out of the ledge it starts from (first leg), behind the chat box's top edge
    // as it slides onto it (last leg, phones).
    if (f.stage === "intro" && (f.dockClip || f.startLedge != null)) {
      if (f.leg === 1 && f.startLedge != null && f.fy > f.startLedge - 0.5) f.behind = f.startLedge;
      else if (f.dockClip && f.legs && !f.legs.length && g.ledge != null && f.fy > g.ledge - 0.5) f.behind = g.ledge;
      else f.behind = null;
    }
    // Phones: a smaller Edu while it cruises, so it reads as passing by, not as a big shape.
    f.cs = f.stage === "cruise" && isPhone() ? 1 - 0.3 * Math.sin(Math.PI * u) : 1;
    // Inside the band between the fixed bars, always (never a smear under the frosted nav): what
    // shows of it (not the part behind a ledge).
    const B = bandOf(f.guards);
    const hh = f.w * f.cs * SIT_AR;
    const shown = f.behind != null ? Math.min(f.fy, f.behind) : f.fy;
    if (shown > B.bottom) f.fy -= shown - B.bottom;
    if (f.fy - hh < B.top) f.fy = B.top + hh;
    if (f.stage === "pop" && f.behind != null && f.fy < f.behind - 0.5) f.behind = null; // out of the ledge
    if (f.stage === "dive" && g.ledge != null && f.fy > g.ledge) f.behind = g.ledge; // sinking behind it
    const speed = Math.hypot(f.vx, f.vy);
    // Hovering (slow, near a ledge or the end): the gentle bob of a little helicopter.
    f.bob = Math.sin((t / 1000) * Math.PI * 2 * 3.1) * 1.8 * clamp(1 - speed / 450, 0, 1);
    f.tsy = 1 + Math.min(0.07, speed / 12000); // a little stretch when it goes fast
    f.tsx = 1 - (f.tsy - 1) * 0.7;
    f.ttilt = f.stage === "dive" ? 0 : clamp(f.vx / 42, -18, 18); // leans into the flight
    if (t - (f.lookAt || 0) > 90) { // and looks where it is going (down at its seat as it lands)
      f.lookAt = t;
      const lx = clamp(f.vx / 520, -1, 1);
      const ly = f.stage === "dive" ? 0.8 : f.lookDown ? 0.6 : clamp(f.vy / 520, -0.7, 1);
      J.ctl.glance([Math.round(lx * 20) / 20, Math.round(ly * 20) / 20]);
    }
    f.omega += ((f.stage === "dive" ? SPIN * 0.6 : SPIN) - f.omega) * Math.min(1, dt * 10);
    if (f.stage === "cruise" || f.stage === "intro") trail(f, t, speed);
    // The first visit: the logo's letters start popping up as Edu passes the first one.
    if (J.introRun && J.introRun.reveal && f.cx >= J.introRun.revealX) revealLogo();
    if (u >= 1) {
      if (f.stage === "pop") { f.behind = null; next(f, t); }
      else if (f.stage === "intro") introNext(f, t);
      else if (f.stage === "cruise" && g.ledge != null) { // just above the ledge: now the dive behind it
        f.stage = "dive";
        f.seg = seg(f, t, g.cx, g.fy, { x: f.vx * 0.5, y: Math.max(f.vy, 120) }, { x: 0, y: 70 }, 0.26, g.w);
      } else { land(false); return; }
    }
  }
  const k = 1 - Math.exp(-dt * 20);
  f.sx += (f.tsx - f.sx) * k;
  f.sy += (f.tsy - f.sy) * k;
  f.tilt += (f.ttilt - f.tilt) * (1 - Math.exp(-dt * 9));
  f.spin += f.omega * dt;
  write(f);
}

// Never over the ask box or a chip: if the path would cross one, Edu passes below it.
function keepClear(f) {
  const h = f.w * SIT_AR;
  for (const r of f.guards) {
    const left = f.cx - f.w / 2;
    const top = f.fy - h;
    if (left < r.right + 8 && left + f.w > r.left - 8 && top < r.bottom + 8 && f.fy > r.top - 8) f.fy = r.bottom + 8 + h;
  }
}

function write(f) {
  const h = f.w * SIT_AR;
  const s = f.w / f.W;
  const x = f.cx - f.w / 2 - scrollX; // page px to the screen (the sky is fixed)
  const y = f.fy - h - scrollY;
  J.flyer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
  J.body.style.transform = `translateY(${(f.bob || 0).toFixed(2)}px) rotate(${f.tilt.toFixed(2)}deg)`;
  const g = f.grow * (f.cs || 1);
  J.squash.style.transform = `scale(${(f.sx * g).toFixed(4)}, ${(f.sy * g).toFixed(4)})`;
  const power = Math.min(1, f.omega / SPIN);
  J.rotor.style.transform = `scale(${Math.cos(f.spin).toFixed(3)}, ${(1 + 0.1 * power).toFixed(3)})`;
  J.disc.style.opacity = (0.55 * power).toFixed(2);
  const ledgeAt = f.behind != null ? Math.round(f.behind - scrollY) : null; // (on the screen)
  if (ledgeAt !== f.clipKey) { // behind a ledge: everything below it is hidden (set only when it changes)
    f.clipKey = ledgeAt;
    J.ledge.style.height = ledgeAt != null ? `${ledgeAt}px` : "";
    J.ledge.classList.toggle("is-on", ledgeAt != null);
  }
}

// The spinning sprout: an unfiltered copy of the drawing's seedling, laid exactly over it.
function buildRotor(src = J.el.querySelector("svg")) {
  if (J.rotorBuilt) return;
  const acc = src && src.querySelector(".m-accessory");
  if (!acc) return;
  J.rotorBuilt = true;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", ROTOR.view);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const defs = document.createElementNS(NS, "defs");
  const g = acc.cloneNode(true);
  g.removeAttribute("class");
  // Its own copy of the leaf gradient, so it never depends on which drawing is on the page.
  for (const n of g.querySelectorAll("[fill^='url(#']")) {
    const id = n.getAttribute("fill").slice(5, -1);
    const def = src.querySelector(`[id="${id}"]`);
    if (!def) continue;
    const copy = def.cloneNode(true);
    copy.setAttribute("id", `edu-rotor-${id}`);
    defs.appendChild(copy);
    n.setAttribute("fill", `url(#edu-rotor-${id})`);
  }
  svg.append(defs, g);
  J.rotor.appendChild(svg);
}

function land(now_) {
  const f = J.flight;
  if (!f) return;
  if (f.goal.kind !== "dock") {
    const st = live(f.goal);
    if (!st) return; // nowhere to land yet (the page is being drawn): keep flying
    f.goal = st;
  }
  const goal = f.goal;
  introOver(goal.kind === "hero");
  endFlight();
  if (goal.kind === "dock") { arriveDock(); return; }
  const { ctl, el } = J;
  ctl.setPose(goal.pose);
  goal.seat.appendChild(el);
  J.at = J.goal = goal;
  if (!now_) touchdown(goal);
  seated(goal, true);
  railSync(goal);
  loop(); // the rail carries on from here (the reader may have scrolled meanwhile)
}

function endFlight() {
  introOver(false); // an intro cut short (the chat opened, the tab was hidden): the logo shows at once
  J.flight = null;
  J.ctl.glance(null);
  for (const an of J.landing) an.cancel();
  J.landing = [];
  J.el.classList.remove("is-flying");
  J.flyer.hidden = true;
  J.flyer.style.opacity = "";
  J.ledge.style.height = "";
  J.ledge.classList.remove("is-on");
}

// The landing: a squash and a settle where it sits, the prop pops back into its paws, the
// sprout wobbles to a stop.
function touchdown(st) {
  if (still) return;
  const el = J.el;
  const svg = el.querySelector("svg");
  const stage = el.querySelector(".m-stage");
  const anims = [];
  el.classList.add("is-landing");
  if (stage) anims.push(stage.animate(st.family === "peek" ? GRAB : TOUCHDOWN, { duration: st.family === "peek" ? 460 : 520, easing: "ease-out" }));
  const acc = svg && svg.querySelector(".m-accessory");
  if (acc) anims.push(acc.animate(SETTLE, { duration: 1000, easing: "ease-out" }));
  const prop = svg && svg.querySelector(".m-prop");
  if (prop) anims.push(prop.animate(PROP_IN, { duration: 420, easing: "cubic-bezier(.3,.7,.4,1)", delay: 40, fill: "backwards" }));
  const shadow = svg && svg.querySelector(".m-shadow");
  if (shadow) anims.push(shadow.animate([{ opacity: 0, transform: "scale(0.5)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "ease-out" }));
  J.landing = anims;
  Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {
    if (J.landing === anims) { J.landing = []; el.classList.remove("is-landing"); }
  });
  if (prop) {
    const r = prop.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      const a = (-150 + i * 60 + rand(-12, 12)) * (Math.PI / 180);
      spawn("spark", r.left + scrollX + r.width / 2 + Math.cos(a) * r.width * 0.45, r.top + scrollY + r.height / 2 + Math.sin(a) * r.height * 0.45,
        Math.cos(a) * 14, Math.sin(a) * 14, 650);
    }
    loop();
  }
}

// --- the trail: puffs from the rotor and a few sparkles ------------------------------------------
function trail(f, t, speed) {
  if (speed < 160 || f.count > 16) return;
  const h = f.w * SIT_AR;
  const B = bandOf(f.guards);
  if (f.fy - h < B.top + 10 || f.fy > B.bottom - 10) return;
  if (t - f.puffAt > 75) {
    f.puffAt = t;
    f.count++;
    const side = f.count % 2 ? -1 : 1;
    const y = f.fy - h + h * (ROTOR.top + ROTOR.height * 0.35);
    spawn("puff", f.cx + side * f.w * ROTOR.width * 0.5, y, -f.vx * 0.06 + side * 7, 14 + Math.abs(f.vy) * 0.02, 560);
  }
  if (t - f.sparkAt > 230) {
    f.sparkAt = t;
    spawn("spark", f.cx - f.vx * 0.06 + rand(-6, 6), f.fy - h * 0.5 - f.vy * 0.06, -f.vx * 0.05, -f.vy * 0.05 + 6, 620);
  }
}
function spawn(kind, x, y, dx, dy, life) {
  if (still) return;
  const p = make("i", `edu-${kind}`);
  p.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  p.style.setProperty("--dx", `${dx.toFixed(1)}px`);
  p.style.setProperty("--dy", `${dy.toFixed(1)}px`);
  J.trail.appendChild(p);
  J.parts.push({ el: p, until: now() + life });
}
function sweepParts() {
  if (!J.parts.length) return;
  const t = now();
  J.parts = J.parts.filter((p) => {
    if (t < p.until) return true;
    p.el.remove();
    return false;
  });
}

// --- the first visit: Edu brings the logo ---------------------------------------------------------
// Once per session (app.js decides): Edu flies in from the left along the top of the logo, and the
// logo's own entrance (logo.js, held until now) starts as Edu reaches the first letter, so the
// letters pop up in its wake while it glances down at them. Past the logo it swoops down the margin
// beside the ask box and glides to its ledge (wide screens), or, where the ask box spans the screen
// (phones), zips off the right edge and glides back in at the ledge, the way it always travels on a
// phone. It dives in, and the journey takes over. Nothing waits for it: the ask box works at once,
// and Edu never crosses it or a chip (every leg of the path is checked before it starts).
const INTRO_STAGGER = 0.07; // s between two letters popping up (logo.css: --i * 70ms)
const INTRO_LEAD = 0.15; // s from logo.start() to the first letter (logo.css --lg-delay)

/**
 * `logo`: the logo element (logo.js el). `reveal`: starts the logo's entrance (logo.start), called
 * exactly once: as Edu reaches the first letter, or at once when there is no flight.
 * Resolves true when Edu has flown in and landed at its ledge, false when there was no intro.
 */
function intro({ logo = null, reveal = () => {} } = {}) {
  if (!J) { reveal(); return Promise.resolve(false); }
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  if (J.introRun) introOver(false);
  J.introRun = { reveal, revealX: Infinity, resolve };
  const home = J.stations.find((s) => s.kind === "hero");
  const plan = !still && !document.hidden && !J.flight && !J.chat && home && J.at === home && scrollY <= 4
    ? planIntro(home, logo) : null;
  if (!plan) { introOver(false); return done; }
  J.introRun.revealX = plan.revealX;
  startFlight({ cx: plan.p0.x, fy: plan.p0.y, w: plan.w, ledge: null }, home);
  const f = J.flight;
  Object.assign(f, { crouch: 0, launched: true, vx: plan.p0.vx, vy: plan.p0.vy, omega: SPIN, legs: plan.legs, exit: plan.exit, leg: 0 });
  introNext(f, now());
  f.seg.t0 = null; // its clock starts with its first frame, not inside the page's start-up work
  write(f);
  return done;
}

// The path: in from the left edge (slowing down), along the letters at the speed they pop up, then
// down the margin beside the ask box (wide screens) or down the right edge behind it (phones), and
// the glide to the ledge. Null when there is no clear path.
function planIntro(home, logo) {
  if (!logo || !measureOne(home)) return null;
  const g = flyBox(home);
  const lr = logo.getBoundingClientRect();
  const letters = [...logo.querySelectorAll(".lg-l")];
  if (!g || !lr.width || letters.length < 2) return null;
  // (a held letter is scaled about its own middle: its centre is where it will stand)
  const xs = letters.map((n) => { const r = n.getBoundingClientRect(); return r.left + r.width / 2 + scrollX; }).sort((a, b) => a - b);
  const w = g.w;
  const h = w * SIT_AR;
  const bars = guards();
  const B = bandOf(bars);
  if (g.ledge > B.bottom + 4) return null; // its ledge is below the fold (a short screen): no show
  const xe = xs[0];
  const xt = xs[xs.length - 1];
  const v = clamp((xt - xe) / ((xs.length - 1) * INTRO_STAGGER), 240, 720); // px/s, the letters' pace
  // Its feet a little into the top of the letters: they pop up just under and behind it.
  const y = clamp(lr.top + scrollY + lr.height * 0.3, B.top + h + 2, B.bottom);
  const p1 = { x: xe - w * 0.5, y };
  if (p1.x - (scrollX - w * 0.6) < w * 0.4) return null; // no room to come in before the logo
  // It starts out of sight, about 140 ms of flight beyond the left edge: the page is still settling
  // in those first frames (fonts, the feature cards), and a hitch there is never seen.
  const pace = (d) => {
    const T = clamp(Math.max(d / 1200, (2 * d) / (1700 + v)), 0.42, 1.4);
    return { T, vx: Math.max(v, (2 * d) / T - v) }; // slowing down to the letters' pace as it gets there
  };
  const x0 = scrollX - w * 0.6 - 0.14 * pace(p1.x - (scrollX - w * 0.6)).vx;
  const { T: T1, vx } = pace(p1.x - x0);
  const p0 = { x: x0, y: y + 18, vx, vy: -50 };
  const p2 = { x: xt + w * 0.5, y: y - 4 };
  const legs = [
    { x: p1.x, y: p1.y, v: { x: v, y: 0 }, T: T1 },
    { x: p2.x, y: p2.y, v: { x: v, y: -12 }, T: (p2.x - p1.x) / v, look: true },
  ];
  if (!clearLegs(p0, { x: p0.vx, y: p0.vy }, legs, w, bars)) return null;
  // Wide screens: on past the end of the ask box, down the margin beside it and the chips, then
  // the glide to the ledge (the same glide as every flight: see next()).
  let exit = "";
  if (!isPhone() && bars.length) {
    const right = Math.max(...bars.map((r) => r.right));
    const below = Math.max(...bars.map((r) => r.bottom));
    const x = right + w * 0.5 + 18;
    const corner = { x, y: p2.y + 26, v: { x: 150, y: 420 } };
    corner.T = clamp(Math.hypot(corner.x - p2.x, corner.y - p2.y) / 600, 0.28, 0.6);
    const side = { x, y: below + h + 16, v: { x: -60, y: 400 } };
    side.T = clamp(Math.hypot(side.x - corner.x, side.y - corner.y) / 700, 0.3, 0.6);
    const [ex, ey] = cruiseEnd(g);
    const glide = { x: ex, y: ey, v: { x: 0, y: 230 }, T: clamp(0.36 + Math.hypot(ex - side.x, ey - side.y) / 1400, 0.42, 0.95) };
    if (x + w * 0.5 <= scrollX + innerWidth - 8 && side.y < ey - 8 && side.y <= B.bottom
        && clearLegs(legs[1], legs[1].v, [corner, side, glide], w, bars)) {
      legs.push(corner, side);
      exit = "side";
    }
  }
  if (!exit) {
    // Where the ask box spans the screen (phones): down the right edge behind the ask box and the
    // chips (the hero is lifted over Edu's layer for that moment, see heroOver()), then the same
    // glide to the ledge. Never off the screen.
    const below = bars.length ? Math.max(...bars.map((r) => r.bottom)) : y;
    const x = scrollX + innerWidth - w * 0.5 - 4;
    const down = { x, y: below + h + 14, v: { x: 0, y: 420 }, under: true };
    down.T = clamp(Math.hypot(down.x - p2.x, down.y - p2.y) / 700, 0.35, 0.75);
    const [ex, ey] = cruiseEnd(g);
    const glide = { x: ex, y: ey, v: { x: 0, y: 230 }, T: clamp(0.36 + Math.hypot(ex - down.x, ey - down.y) / 1400, 0.42, 0.95) };
    if (down.y >= ey - 8 || down.y > B.bottom || !clearLegs(down, down.v, [glide], w, bars)) return null; // no room: no show
    legs.push(down);
    exit = "side";
  }
  return { w, p0, legs, exit, revealX: xe + w * 0.22 - INTRO_LEAD * v };
}

// Is every leg (each a Hermite curve, from the previous point) clear of the ask box and the chips?
function clearLegs(from, v0, legs, w, rects) {
  const h = w * SIT_AR;
  const o = {};
  let p = from;
  let v = v0;
  for (const leg of legs) {
    const s = { T: leg.T, p0x: p.x, p0y: p.y, v0x: v.x, v0y: v.y, p1x: leg.x, p1y: leg.y, v1x: leg.v.x, v1y: leg.v.y };
    for (let i = 0; i <= 36; i++) {
      hermite(s, i / 36, o);
      const l = o.cx - w / 2;
      const r = o.cx + w / 2;
      const top = o.fy - h;
      for (const g of rects) if (l < g.right + 8 && r > g.left - 8 && top < g.bottom + 8 && o.fy > g.top - 8) return false;
    }
    p = leg;
    v = leg.v;
  }
  return true;
}

// The next leg of the intro; after the last one, the glide to the ledge or the zip off the side.
// The next leg of a flight that has legs (the intro, the way onto the chat box); after the last,
// the glide to the goal ("side": next()) or straight onto it ("land").
function introNext(f, t) {
  const leg = f.legs && f.legs.shift();
  f.lookDown = !!(leg && leg.look);
  if (leg) {
    f.stage = "intro";
    f.leg = (f.leg || 0) + 1;
    if (leg.under) heroOver(true);
    f.seg = seg(f, t, leg.x, leg.y, { x: f.vx, y: f.vy }, leg.v, leg.T, leg.w || f.w);
    return;
  }
  f.legs = null;
  if (f.exit === "land") { land(false); return; }
  next(f, t);
}

// The hero over Edu's layer: Edu passes behind the ask box and the chips (the intro on phones).
function heroOver(on) {
  const hero = J.hero && J.hero.closest(".hero");
  if (hero) hero.classList.toggle("edu-under", on);
}

function revealLogo() {
  const run = J && J.introRun;
  if (!run || !run.reveal) return;
  const fn = run.reveal;
  run.reveal = null;
  try { fn(); } catch (err) { setTimeout(() => { throw err; }); }
}
function introOver(landed) {
  const run = J && J.introRun;
  if (!run) return;
  revealLogo();
  heroOver(false);
  J.introRun = null;
  run.resolve(landed);
}

// --- the chat ------------------------------------------------------------------------------------
// Call just before the chat opens: Edu flies from where it is onto the chat box, and the Edu that
// lives there appears as it lands. Returns false when there is no flight (reduced motion, or
// Edu out of sight); the chat box's Edu is then simply there.
function toChat() {
  if (!J || J.chat) return false;
  J.chat = true;
  const d = J.dock;
  if (!d || still || document.hidden) return false;
  // From exactly where Edu is right now, sitting or in the air (its size as it shows).
  const f = J.flight;
  let a = null;
  if (f) a = { cx: f.cx, fy: f.fy, w: f.w * (f.cs || 1), ledge: f.behind != null ? f.behind : null };
  else if (J.at && measureOne(J.at)) a = flyBox(J.at);
  if (!a) return false;
  const top = a.fy - a.w * SIT_AR - scrollY;
  const bottom = a.fy - scrollY;
  if (bottom < 0 || top > innerHeight) return false;
  const seat = f ? null : J.at;
  const v0 = f ? { x: f.vx || 0, y: f.vy || 0 } : null;
  J.home = J.at || (J.goal && J.goal.kind !== "dock" ? J.goal : null) || nearest();
  d.behind = isBehind(d);
  d.host.classList.add("edu-away");
  J.sky.classList.add("is-over-chat");
  const goal = { kind: "dock" };
  J.goal = goal;
  // The chat box is on screen in the next frame: Edu flies there from where it is (in the air
  // meanwhile it simply holds still for that frame), comes down beside the box and slides onto it
  // along its top edge from the side, never dropping onto it from above and never over the header.
  nextFrame(() => {
    if (!J.chat || J.goal !== goal) return;
    const g = dockBox();
    if (!g) { if (J.flight) endFlight(); revealDock(false); return; }
    startFlight(a, goal, { prop: !!seat && seat.family === "sit" && seat.pose !== "sit", quick: true,
      legs: chatLegs(a, g), exit: "land", v: v0, dockClip: g.ledge != null });
  });
  if (J.dockFallback) J.dockFallback();
  J.dockFallback = later(2800, () => { J.dockFallback = null; if (J.flight && J.flight.goal.kind === "dock") land(true); else revealDock(false); });
  return true;
}

// The way onto the chat box: down (or along) to the box's height beside its seat, on the side Edu
// comes from, then along the box's top edge into the seat.
function chatLegs(a, g) {
  const side = a.cx < g.cx ? -1 : 1;
  const lane = clamp(g.cx + side * Math.max(64, g.w * 1.5), scrollX + g.w * 0.5 + 4, scrollX + innerWidth - g.w * 0.5 - 4);
  const d1 = Math.hypot(lane - a.cx, g.fy - a.fy);
  return [
    { x: lane, y: g.fy, v: { x: -side * 240, y: 40 }, T: clamp(d1 / 950, 0.3, 0.75), w: g.w },
    { x: g.cx, y: g.fy, v: { x: 0, y: 0 }, T: clamp(Math.abs(lane - g.cx) / 360, 0.22, 0.42), w: g.w },
  ];
}

function arriveDock() {
  revealDock(true);
  J.sky.classList.remove("is-over-chat");
  // Edu itself waits at its spot on the page, out of sight behind the chat, for the way back.
  const home = live(J.home);
  if (home) {
    J.ctl.setPose(home.pose);
    home.seat.appendChild(J.el);
    J.at = J.goal = home;
    seated(home, false);
  }
}

function revealDock(landed) {
  if (J.dockFallback) { J.dockFallback(); J.dockFallback = null; }
  const d = J.dock;
  if (!d || !d.host.classList.contains("edu-away")) return;
  d.host.classList.remove("edu-away");
  if (!landed || still) return;
  const el = d.ctl.el;
  const stage = el.querySelector(".m-stage");
  if (stage) stage.animate(TOUCHDOWN, { duration: 520, easing: "ease-out" });
  const acc = el.querySelector("svg .m-accessory");
  if (acc) acc.animate(SETTLE, { duration: 1000, easing: "ease-out" });
  const cloud = el.querySelector(".m-think");
  if (cloud) cloud.animate([{ opacity: 0, transform: "translate(-30%, 30%) scale(0.3)" }, { opacity: 1, transform: "none" }],
    { duration: 450, delay: 120, easing: "cubic-bezier(.3,1.5,.5,1)", fill: "backwards" });
}

// The chat is closing (called before it hides): Edu takes over from the chat box's Edu, right where
// it sits (no pop, no fade), and goes back on the rail beside the reader.
function chatClosing() {
  const d = J.dock;
  const r = d ? d.ctl.el.getBoundingClientRect() : null;
  const seen = !!(r && r.width && d && !d.host.classList.contains("edu-away")
    && r.bottom > 0 && r.top < innerHeight && getComputedStyle(d.ctl.el).visibility !== "hidden");
  revealDock(false);
  J.sky.classList.remove("is-over-chat");
  J.chat = false;
  const f = J.flight;
  if (f && f.goal && f.goal.kind === "dock") { // still on its way there: back on the rail from where it is
    railFrom({ cx: f.cx, fy: f.fy, w: f.w * (f.cs || 1) });
    return;
  }
  if (still || document.hidden || !seen || !J.at) { if (J.at) railSync(J.at); return; }
  const from = { cx: r.left + scrollX + r.width / 2, fy: r.top + scrollY + r.height, w: r.width };
  nextFrame(() => { // the chat is gone by now
    if (J.flight || J.chat || !J.at) return;
    measure();
    railFrom(from);
  });
}

// --- life in the chat: the Edu on the chat box -----------------------------------------------------
const KEY_LINES = ["This one's important!", "Remember this bit!", "This one's worth a note!"];
const STREAK_LINES = ["You're on a roll!", "Look at you go!", "Another one done. Nice!"];
const RIGHT_LINES = ["You got it!", "Yes! Spot on!", "That's it! Well done!"];
const WRONG_LINE = "So close! Let's see why.";
const CLASS_LINE = "Want to see it in class?";
// What someone may be reading or about to tap: a bubble never goes on top of these.
const READING = ".answer > *, .status, .err-line, .actions, .modes, .followups h3, .followups li, .quiz-card, .class-card,"
  + " .sources-list, .feedback-box, .note, .notice, .end-card, .crisis, .lead-wrap, .lead, h2, p, .suggest";

/**
 * The Edu on the chat box (`perch`, from chat.js) comes alive: it glances up while you read
 * back and down at the box when you return, nods at a "Remember this" card now and then,
 * celebrates a right quiz answer and cheers you on after a wrong one, and after a few answers
 * says you're on a roll. Lines are short, rare, and never on top of words being read.
 * When a class video card arrives it looks at it and asks if you want to see it in class; while the
 * class plays it settles down to watch, quiet and still, until you ask again or the card leaves the view.
 * Returns the hooks chat.js calls: asked(), answered({ ok, bot, quiz }), quiz(right), video(card),
 * watching(card), cleared(), closing().
 */
export function chatLife(perch, { sheet = null, thread = null, inner = null, input = null, form = null } = {}) {
  const host = perch.el.parentElement;
  const dock = { ctl: perch, host, wrap: host && host.parentElement ? host.parentElement.querySelector(".dock-wrap") : null, behind: false };
  if (J) J.dock = dock;
  else pendingDock = dock;
  const open = () => !!sheet && !sheet.hidden;
  let answers = 0;
  let nextStreak = 3;
  let keyShown = 0;
  let keySince = 0;
  let keyIO = null;
  let doneAt = 0;
  let up = false;
  let lastTop = 0;
  let queued = false;
  let lastLineAt = -1e9;
  let lineAt = null; // thread.scrollTop when the line on screen appeared
  let lineSeq = 0;
  let waved = true; // the little wave at the end of an answer: once per answer
  let watching = null; // the class card being watched: Edu sits still and says nothing meanwhile
  let watchIO = null;
  // The companion: Edu rides along the chat box edge as you read (left while you are up in the
  // answer, home on the right at the end), in the room kept free under the thread.
  let rideX = 0;
  let rideTo = 0;
  let riding = false;

  // Is this spot free of words someone may be reading (and of the words being typed)?
  const clear = (r) => {
    const tb = thread.getBoundingClientRect();
    if (r.top < tb.top + 6) return false;
    if (input) {
      const ib = input.getBoundingClientRect();
      if (hit(r, { left: ib.left, right: ib.right, top: ib.top + 4, bottom: ib.bottom, width: ib.width, height: ib.height }, 0)) return false;
    }
    for (const row of inner.children) {
      const rb = row.getBoundingClientRect();
      if (rb.bottom < r.top - 8 || rb.top > r.bottom + 8) continue;
      const blocks = row.matches(".msg-user, .note, .notice, .err-line") ? [row] : row.querySelectorAll(READING);
      for (const b of blocks) if (hit(r, b.getBoundingClientRect(), 6)) return false;
    }
    return true;
  };

  // A short line beside Edu, said only where there is a free spot. Otherwise it waits (two lines
  // at most, each for a while) until the visitor is back at the bottom of the chat, where there
  // is room under the last answer; `nudge` makes that room itself when the end is near.
  let waiting = [];
  let retry = null;
  const atBottom = () => thread.scrollHeight - thread.scrollTop - thread.clientHeight < 90;
  function sayNow(text, urgent) {
    const t = now();
    if (!urgent && t - lastLineAt < 6000) return false;
    if (perch.dipped) return false; // Edu is up on the ideas card (assets/host.js): it speaks there
    if (watching) return false; // never a word while the class plays
    let shown = false;
    // Never on the chat box itself: the bubble's bottom stays above its top edge.
    const edge = dock.wrap ? dock.wrap.getBoundingClientRect().top - 3 : null;
    const p = perch.say(text, { place: ["left", "above"], fits: (r) => (shown = clear(r)), maxBottom: edge });
    if (shown) {
      lastLineAt = t;
      const id = ++lineSeq;
      lineAt = thread.scrollTop;
      p.then(() => { if (lineSeq === id) lineAt = null; });
    }
    return shown;
  }
  function queueLine(text, urgent, hold, unless = null) {
    waiting = waiting.filter((w) => w.text !== text);
    waiting.push({ text, urgent, until: now() + hold, unless });
    if (waiting.length > 2) waiting.shift();
    retrySoon();
  }
  // Lines that waited: the first that fits now is said, the other gets another chance a bit later.
  // (A line that has become pointless meanwhile, `unless()`, is dropped.)
  function tryWaiting() {
    const t = now();
    waiting = waiting.filter((w) => w.until > t && !(w.unless && w.unless()));
    waiting.sort((a, b) => Number(b.urgent) - Number(a.urgent)); // quiz feedback first
    for (const w of waiting) {
      if (!sayNow(w.text, w.urgent)) continue;
      waiting = waiting.filter((x) => x !== w);
      break;
    }
    if (waiting.length) retrySoon();
  }
  function retrySoon() {
    if (retry) retry();
    retry = later(6300, () => { retry = null; if (open() && atBottom()) tryWaiting(); });
  }
  function speak(text, { urgent = false, wait = true, nudge = false, hold = urgent ? 5000 : 8000, unless = null } = {}) {
    if (!open()) return false;
    if (sayNow(text, urgent)) {
      waiting = waiting.filter((w) => w.text !== text);
      return true;
    }
    const gap = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    if (nudge && gap > 2 && gap < 260) {
      queueLine(text, urgent, 1600, unless);
      thread.scrollTo({ top: thread.scrollHeight, behavior: still ? "auto" : "smooth" });
    } else if (nudge && gap <= 2 && !thread.classList.contains("edu-room")) {
      thread.classList.add("edu-room"); // room under the last answer for this line
      queueLine(text, urgent, 1600, unless);
      nextFrame(() => thread.scrollTo({ top: thread.scrollHeight, behavior: still ? "auto" : "smooth" }));
    } else if (wait) {
      queueLine(text, urgent, hold, unless);
    }
    return false;
  }

  if (thread) {
    thread.addEventListener("scroll", () => {
      if (queued) return;
      queued = true;
      nextFrame(scrolled);
    }, { passive: true });
  }
  function scrolled() {
    queued = false;
    if (!open()) return;
    const top = thread.scrollTop;
    // Words sliding under a line: it steps aside (only on the way up; the nudge to the end goes down).
    if (lineAt != null && top < lineAt - 12) { lineAt = null; perch.hush(); }
    if (watching) { lastTop = top; return; } // watching the class: it stays put, eyes on the screen
    const bottom = thread.scrollHeight - top - thread.clientHeight < 90;
    ride(top);
    if (bottom) {
      if (up) {
        up = false;
        perch.glance(null);
        if (!waveEnd()) perch.look(form || input, 900); // back down at the box
      } else waveEnd();
      if (waiting.length) tryWaiting(); // lines that waited for room
    } else if (top < lastTop - 16 && !up) { // reading back up: Edu looks up at the words too
      up = true;
      perch.glance([-0.45, -0.9]);
      if (lineAt != null) { lineAt = null; perch.hush(); }
      // and leans back for a look, when it is not busy with something else
      if (perch.el.dataset.state === "idle" && !/\bact-/.test(perch.el.className)) perch.react("look-up");
    }
    lastTop = top;
  }

  // Read to the end of an answer that needed scrolling (down through it, or back down after a look
  // up): a little wave, once per answer.
  let waveJob = null;
  function waveEnd() {
    if (waved || !doneAt || still || perch.dipped) return false;
    const mood = perch.el.dataset.state;
    if ((mood !== "idle" && mood !== "curious") || /\bact-|\bis-typing\b/.test(perch.el.className)) {
      // Busy right now (the hop for the answer, an idle action): again in a moment, if still at the end.
      if (!waveJob) waveJob = later(700, () => { waveJob = null; if (open() && atBottom()) waveEnd(); });
      return false;
    }
    waved = true;
    perch.pulse("wave", 1300);
    return true;
  }

  // Where Edu rides along the box edge: the share of the thread above the reading position.
  function ride(top) {
    const host = dock.host;
    if (!host || still) return;
    const span = thread.scrollHeight - thread.clientHeight;
    const room = Math.min(150, Math.max(0, (dock.wrap ? dock.wrap.getBoundingClientRect().width : 300) * 0.42));
    const p = span > 40 ? clamp(top / span, 0, 1) : 1;
    rideTo = perch.el.querySelector(".m-bubble") || lineAt != null ? rideX : -Math.round((1 - p) * room);
    if (riding) return;
    riding = true;
    onFrame(() => {
      if (!open()) { riding = false; return false; }
      if (lineAt != null) rideTo = rideX; // a line is up: it stays put beside it
      const d = rideTo - rideX;
      rideX += clamp(d * 0.14, -8, 8); // an easy glide, never a dart (at most 8px a frame)
      if (Math.abs(d) < 0.4) rideX = rideTo;
      host.style.transform = rideX ? `translateX(${rideX.toFixed(1)}px)` : "";
      if (rideX === rideTo) { riding = false; return false; }
      return true;
    });
  }
  function rideHome() {
    rideX = rideTo = 0;
    if (dock.host) dock.host.style.transform = "";
  }

  function stopKeys() {
    if (keyIO) { keyIO.disconnect(); keyIO = null; }
  }
  // The "Remember this" card of an answer: a nod and a line when it scrolls into view, now and then.
  function watchKeys(bot) {
    stopKeys();
    if (!("IntersectionObserver" in window) || !thread) return;
    if (keyShown > 0 && (keySince < 3 || Math.random() < 0.4)) return;
    const cards = bot.querySelectorAll(".xb-key");
    if (!cards.length) return;
    keyIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (e.intersectionRatio < 0.6 && e.intersectionRect.height < thread.clientHeight * 0.4) continue;
        stopKeys();
        keyShown++;
        keySince = 0;
        const card = e.target;
        later(Math.max(450, doneAt + 1900 - now()), () => { // after the cheer for the answer
          if (!open() || !card.isConnected) return;
          // Still on screen? (a fling may have carried it away by now): otherwise wait for it again.
          const cr = card.getBoundingClientRect();
          const tr = thread.getBoundingClientRect();
          const seen = Math.max(0, Math.min(cr.bottom, tr.bottom) - Math.max(cr.top, tr.top));
          if (seen < cr.height * 0.6 && seen < tr.height * 0.4) { keyShown--; watchKeys(bot); return; }
          perch.react("spot", { at: card }); // eyes on the card, it points, a twinkle, a knowing nod
          speak(pickOne(KEY_LINES), { wait: false }); // only now, with room, and not right after another line
        });
        break;
      }
    }, { root: thread, threshold: [0, 0.25, 0.6, 1] });
    cards.forEach((c) => keyIO.observe(c));
  }

  function stopWatching() {
    if (!watching) return;
    watching = null;
    if (watchIO) { watchIO.disconnect(); watchIO = null; }
    perch.el.classList.remove("is-watching");
    perch.glance(null);
    perch.autoplay(true);
  }

  function reset() {
    stopWatching();
    waved = true; // no wave while the next answer is on its way
    if (waveJob) { waveJob(); waveJob = null; }
    waiting = [];
    thread.classList.remove("edu-room");
    lineAt = null;
    if (retry) { retry(); retry = null; }
    stopKeys();
    if (up) { up = false; perch.glance(null); }
  }

  return {
    /** A question was sent: a line still on screen goes (the next answer will move under it). */
    asked() { reset(); perch.hush(); },
    /** The answer finished (ok: some words arrived; bot: its row; quiz: it was a quiz card). */
    answered({ ok = false, bot = null, quiz = false } = {}) {
      if (!ok) return;
      answers++;
      keySince++;
      doneAt = now();
      // The wave is for reading through: not when the whole answer is on screen at once (it hops
      // for that) and not for a quiz card (picking an answer has its own cheer). Judged once the
      // answer's buttons are in and the thread has settled.
      waved = true;
      nextFrame(() => { waved = quiz || !open() || atBottom(); });
      if (answers >= nextStreak && !quiz) {
        nextStreak = answers + 4 + Math.floor(Math.random() * 3);
        // When they reach the end of this answer (after reading it), if not right away.
        later(1800, () => { if (open()) speak(pickOne(STREAK_LINES), { hold: 45000 }); });
      }
      if (bot && !quiz) watchKeys(bot);
    },
    /** A quiz option was picked. */
    quiz(right) {
      if (!open()) return;
      waiting = waiting.filter((w) => w.urgent); // quiz feedback wins over a streak line
      // Said beside Edu if there is room; near the end of the chat it makes the room; otherwise it
      // waits a few seconds for the visitor to scroll down to the result.
      if (right) { perch.react("cheer"); speak(pickOne(RIGHT_LINES), { urgent: true, nudge: true }); }
      else { perch.react("nod"); speak(WRONG_LINE, { urgent: true, nudge: true }); }
    },
    /**
     * A class video card arrived: Edu looks at it and asks, once there is room for the line. Not once
     * Edu has asked from the class board itself (host.js board()) or the class has started.
     */
    video(card) {
      if (!open() || !card) return;
      const moot = () => !card.isConnected || card.dataset.asked === "board" || card.classList.contains("is-playing");
      later(Math.max(500, doneAt + 1900 - now()), () => { // after the cheer for the answer
        if (!open() || moot() || watching) return;
        if (!still) perch.react("spot", { at: card }); else perch.look(card, 1600);
        speak(CLASS_LINE, { hold: 15000, nudge: true, unless: moot }); // near the end it makes room for the line
      });
    },
    /** The class started playing: Edu settles down to watch it with them and stops moving. */
    watching(card) {
      if (!card) return;
      waiting = [];
      if (retry) { retry(); retry = null; }
      perch.rest();
      perch.hush();
      perch.autoplay(false);
      perch.state("idle");
      perch.glance(card);
      perch.el.classList.add("is-watching");
      watching = card;
      // Scrolled away from the class (or it was removed): back to normal life.
      watchIO = new IntersectionObserver((entries) => {
        for (const e of entries) if (!e.isIntersecting) stopWatching();
      }, { root: thread, threshold: 0 });
      watchIO.observe(card);
    },
    /** A mode button under the answer (Simpler, Go deeper, Real-life example, Show a diagram). */
    mode(label, btn) {
      if (!open() || still) return;
      const k = String(label).toLowerCase();
      if (k.includes("simpl")) perch.react("nod");
      else if (k.includes("deeper")) perch.react("look-up");
      else if (k.includes("diagram")) perch.react("spot", { at: btn });
      else perch.react("surprise");
    },
    /** New chat. */
    cleared() {
      reset();
      answers = 0;
      nextStreak = 3;
      keyShown = 0;
      keySince = 0;
    },
    /** The chat is about to close. */
    closing() {
      reset();
      perch.hush();
      rideHome();
      if (J) chatClosing();
    },
  };
}

/** For tests and the dev page. */
export function journeyStats() {
  if (!J) return null;
  return {
    station: J.at ? J.at.kind : null,
    goal: J.goal ? J.goal.kind : null,
    flying: !!J.flight,
    stage: J.flight ? J.flight.stage : null,
    rail: J.rail.ready ? { g: Math.round(J.rail.g * 1000) / 1000, gs: Math.round(J.rail.gs * 1000) / 1000, settling: !!J.rail.settle,
      e: [Math.round(J.rail.e.x), Math.round(J.rail.e.y), Math.round(J.rail.e.vx), Math.round(J.rail.e.vy)], } : null,
    parts: J.parts.length,
    stations: J.stations.map((s) => s.kind),
    seats: document.querySelectorAll(".edu-seat").length,
    chat: J.chat,
  };
}
