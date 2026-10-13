# Edu, Eduport's study buddy (final mascot)

Edu artwork is reserved. See [artwork rights](../../ARTWORK-RIGHTS.md) before reusing the character.

1. Edu is a small study buddy sewn from Eduport-orange felt: a soft pear with a two-leaf seedling on its crown, because learning grows.
2. It is calm and kind, never loud. It has low-set bead eyes, coral cheeks and a stitched smile. It peeks over an ask box, perches on cards and waves hello.
3. It is pure SVG. Layered gradients give the volume, one felt filter textures the body, and the glossy bead eyes sit on top. One stylesheet animates every pose.

Name: **Edu**, the orange "edu" of the eduport logo come to life as a little sprout that grows with you.

## Files

| File | viewBox | Id prefix | Size | Use |
|---|---|---|---|---|
| `peek.svg` | `0 0 240 120` | `M-p-` | 9.1 KB | Hero: rises over the bottom edge. y = 120 is the ledge, and the paws rest on it. |
| `sit.svg` | `0 0 180 200` | `M-s-` | 9.0 KB | Cards: perched on a card's top edge. y = 200 is the surface. |
| `sit-book.svg` | `0 0 180 200` | `M-sb-` | 11.3 KB | Feature card: holds an open book to the reader (lessons). |
| `sit-magnifier.svg` | `0 0 180 200` | `M-sm-` | 10.6 KB | Feature card: holds up a magnifying glass (search). |
| `sit-pencil.svg` | `0 0 180 200` | `M-sp-` | 11.5 KB | Feature card: stands a big pencil beside it (practice). |
| `head.svg` | `0 0 100 100` | `M-h-` | 5.8 KB | Avatar at 48 px or more, with felt texture. Crop round: `border-radius: 50%; overflow: hidden; background: #191816`. |
| `head-sm.svg` | `0 0 100 100` | `M-hs-` | 4.8 KB | Avatar at 40 px or less (chat lists). Same drawing with no filters at all. |
| `src/` | | | | Generator and checks (see the end). |

The four sitting files share one viewBox and the same body coordinates, so at the same CSS width Edu is the same size on every card. Suggested sizes are 150 px wide for the hero peek (96 px on phones), 120–180 px for cards, 32–40 px for `head-sm.svg` and 64–96 px for `head.svg`.

## Palette

| Role | Colour |
|---|---|
| Felt highlight, light, mid (≈ brand `#FB6514`), edge | `#FF9C5E`, `#FD7631`, `#F9661A`, `#DD510E` |
| Core shadow (bottom right) / contact and occlusion | `#8E2F04` / `#5E1E03` |
| Rim light (right edge) | `#FFD4B2` |
| Arms, lit side → shade side | `#FFAE76` → `#FD7631` → `#E85B12` → `#C7480B`; shade arm `#FF9F5F` → `#AE3E08` |
| Sole pads | `#FDB182` → `#F7955C` |
| Seedling leaves (muted sage) | `#AFD38A` → `#6FAA52` → `#3F7A3A`; stem `#5E9A46`; midrib `#E6F2CF` at 45 % |
| Cheeks (warm coral) | `#FF7A5E`, at most 60 % opacity, soft edge |
| Bead eyes | `#594640` → `#1C1412` → `#090605`, white glint, warm bounce `#FF9A5C` |
| Smile thread / open mouth / tongue | `#4A1806` / `#4A1806` / `#F27A62` |
| Finger stitches (peek paws) | `#A8400A` at 55 % |
| Inner glow (`m-glow`) | `#FFC266` |
| Props: paper | `#FFF7EC` → `#F7E9D6` → `#DCC3A4` |
| Props: cocoa (book cover, magnifier handle) | `#9A6347` → `#7A4A33` → `#55301F` |
| Props: cream felt (magnifier ring) / glass | `#FFF8EE` → `#CDAE8C` / `#F6FAFD` → `#AFC4D5` |
| Props: pencil body, wood, lead, ferrule, eraser | `#FFF6EA` → `#C7A985`, `#F4D9B2` → `#C2915C`, `#5A4F4A` → `#29221F`, `#EEE3D6` → `#8F8070`, `#FFA48A` → `#CF5A43` |
| Props: bookmark ribbon and lesson ink | brand `#FB6514` |

The props stay in warm neutrals (paper, cocoa, cream, coral), so the orange is still the one accent. The only cool note is the pale glass of the magnifier.

## Groups and classes

Every file follows the same paint order: `m-shadow` (outside the body), then `m-body` containing the felt group, any prop, the arms, the mouth and finally the eyes.

```
peek.svg                               sit.svg  (sit-book / sit-magnifier / sit-pencil add m-prop)
g.m-shadow      2 contact ellipses     g.m-shadow      ground shadow (2 ellipses)
g.m-body                               g.m-body
  g[filter=felt]  body, clip shading     g[filter=felt]  body, clip shading, feet
    ellipse.m-glow  (opacity .4)           ellipse.m-glow  (opacity .4)
    g.m-accessory   seedling               g.m-accessory   seedling
    g.m-cheeks                             g.m-cheeks
  g.m-hand-l  rect pivot, crease,        g.m-prop          book (sit-book) or pencil (sit-pencil)
              felt paw, stitches         g.m-hand-l  circle pivot, occlusion, felt arm
  g.m-hand-r  (same)                     g.m-hand-r  (same; in sit-magnifier it also holds g.m-prop,
  path.m-mouth                                        the magnifier, under the paw)
  g.m-mouth-open  display="none"         path.m-mouth
  g.m-eyes > g.m-gaze                    g.m-mouth-open  display="none"
                                         g.m-eyes > g.m-gaze
head.svg / head-sm.svg: g.m-body > felt group (head.svg only) with m-glow, m-accessory and m-cheeks,
then m-mouth, m-mouth-open and m-eyes > m-gaze. No hands, no shadow.
```

| Class | In | What it is |
|---|---|---|
| `m-body` | all | The whole character. Its box bottom is exactly the edge: y = 120 in peek, y = 200 in every sit file. |
| `m-eyes` > `m-gaze` | all | Both beads, sockets and glints. Unfiltered and drawn last. |
| `m-hand-l`, `m-hand-r` | peek, sit, prop poses | One arm each (the viewer's left and right). The first child is an unpainted pivot shape centred on the shoulder. |
| `m-accessory` | all | The seedling. The first child is an unpainted rect whose bottom centre is the stem base. |
| `m-cheeks` | all | Both blush ovals, inside the felt. |
| `m-mouth` | all | The default stitched smile. |
| `m-mouth-open` | all | An open smile for talking and cheering. Hidden with the `display="none"` presentation attribute; CSS overrides it. |
| `m-glow` | all | A warm core glow, faint by default (`opacity=".4"`). Pulse it for "thinking". |
| `m-shadow` | peek, sit, prop poses | Contact shadows, outside `m-body`, so they stay on the ledge or floor. |
| `m-prop` | prop poses | The book, the magnifier or the pencil. |

## One stylesheet for every pose

```css
.m-body, .m-accessory { transform-box: fill-box; transform-origin: 50% 100%; }
.m-eyes, .m-hand-l, .m-hand-r, .m-shadow { transform-box: fill-box; transform-origin: 50% 50%; }
.m-mouth-open { transform-box: fill-box; transform-origin: 50% 0; }
```

Why these work everywhere:

- **Hands:** each `m-hand-*` starts with an unpainted shape centred on the shoulder that contains the whole arm. In sit it is a circle. In peek it is a rect whose bottom is the ledge, so `m-body` never reaches below y = 120. The fill-box centre is therefore the shoulder in every pose. Shoulders: sit (36.5, 112) and (143.5, 112); peek (66, 92) and (174, 92).
- **Body:** `m-body`'s box bottom is the edge or seat, so `50% 100%` anchors any squash on the ground.
- **Seedling:** the box bottom centre of `m-accessory` is the stem base, so it sways from the root.
- **No transform attributes:** there are none anywhere (geometry is baked into the paths). A blanket `svg * { transform-box: fill-box }` rule cannot displace any part.

### Motion recipes

| State | How | Notes |
|---|---|---|
| Idle breathe | `.m-body` `scale(1.006,.994)` ↔ `scale(.994,1.01)`, 3.6 s, alternate | Use this in every pose. The paws (peek) and feet (sit) stay planted. Do not `translateY` the peek body for an idle bob, because it would lift the paws off the ledge. |
| Blink | `.m-eyes` `scaleY(.08)` for about 120 ms, every 4–6 s | |
| Look around | `.m-gaze` translate up to ±3 px x, ±1.5 px y | |
| Seedling sway | `.m-accessory` `rotate(-4deg)` ↔ `rotate(4deg)`, 4.4 s | After a hop or wave, play a springy settle: `0 → 10 → -7 → 4 → -1.5 → 0deg` over about 1.1 s. |
| Wave | `.m-hand-r` `0 → -130deg`, wiggle `-118 ↔ -140deg`, then back to 0 | The angles are the same in peek and sit. `-130deg` points the arm straight up in both (sit −70°, peek −86°). `.m-hand-l` mirrors with positive angles. |
| Cheer | both hands ±132deg, `.m-body` `translateY(-8px)`, `.m-shadow` `scale(.8)` with opacity .6, and the open mouth | Sit only. |
| Rise (peek) | `.m-body` `translateY(124px) → 0` | The inline SVG clips at the ledge. Starting at `92px` lets the seedling poke up first. Fade `.m-shadow` in as the paws land. |
| Talking | hide `.m-mouth`, show `.m-mouth-open` (`display: inline`), `scaleY(.55)` ↔ `scaleY(1)` every 0.36 s | Use while an answer streams. |
| Thinking | `.m-glow` opacity `.4 → 1`, 1.4 s, alternate | Edu glows warm while it looks through the lessons. Good on the chat avatar too. |

Prop poses: in `sit-book.svg` both paws hold the book, so don't wave. In `sit-magnifier.svg` and `sit-pencil.svg`, wave with the free hand (`.m-hand-l`, `+130deg`). The magnifier's own paw can do a small "searching" wiggle of `rotate(±6deg)`. Under `prefers-reduced-motion: reduce`, turn every animation off.

## Using the files on the page

- **Inline for motion:** CSS cannot reach into an `<img>`. A static `<img src="sit.svg">` also renders correctly.
- **Swap the prefix per inline copy:** replace `id="M-`, `url(#M-` and `href="#M-` with a unique prefix such as `M7-`. Every `M-` in these files sits in one of those three places, and path data never contains `M-`, so a plain string replace of `M-` is also safe. Because every pose has its own namespace (`M-p-`, `M-s-` …), two different poses on one page never share defs even before the swap.
- **Size with CSS:** set `width` and leave `height: auto`. The root has only `xmlns` and `viewBox`.
- **CSP:** the files have no `style` attributes, `<style>`, `<script>`, `<image>`, `<text>` or external references. They use presentation attributes only.
- **Accessibility:** add `role="img" aria-label="Edu, the Eduport mascot"` on the inline `<svg>`, or `aria-hidden="true"` where it is decorative.

## Performance

- **Filter count:**
  - Peek and sit use three felt instances: one group for the body, seedling, cheeks and feet, plus one per arm.
  - The prop poses add one for the prop (four in total).
  - `head.svg` uses one. `head-sm.svg` uses none.
  - Blur is limited to the rim light and the arm occlusion. The other soft shadows are radial gradients, not blurs.
- **Why the arms keep their own filter:** a waving arm keeps its felt grain and fuzzy edge. If the arms were inside the body's filter group, the texture would swim across the arm as it turns. This is the one place we kept a separate filter on purpose.
- **Long idle loops on low-end phones:** put the breathe on the outer `<svg>` element, which is composited and costs no re-filter. Keep `m-*` animations for short events such as a blink, a wave or talking.
- **Chat lists:** use `head-sm.svg`. At 32–40 px the grain is invisible, and it saves the noise passes on every message.


## Rebuilding

Run `python3 art/mascot/src/build.py` from the repo root, then `python3 scripts/build_art.py`. Audit with `python3 scripts/check.py`. Runtime motion in `assets/mascot.js` and `assets/mascot.css` is authoritative; the recipes above describe the rig conceptually.
