#!/usr/bin/env python3
# Implementation: MIT. Edu drawing geometry/artistic data: reserved; see ARTWORK-RIGHTS.md.
"""Eduport mascot "felt sprout" (Pip): generator for the final SVG set.

    python3 -I build.py        writes ../*.svg

Every shape is computed here and written as absolute path data, so the SVGs
carry no transform attributes, and every id is pose-prefixed (M-p-, M-s-, ...).
"""
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)


# ---------------------------------------------------------------- numbers, paths
def f(x):
    x = round(float(x), 2)
    if abs(x) < 0.005:
        return '0'
    s = ('%.2f' % x).rstrip('0').rstrip('.')
    if s.startswith('0.'):
        s = s[1:]
    elif s.startswith('-0.'):
        s = '-' + s[2:]
    return s


def pp(x, y):
    return f(x) + ',' + f(y)


class Path:
    def __init__(self):
        self.d = []

    def M(self, x, y):
        # never emit "M-" (keeps the id-prefix swap a plain string replace)
        self.d.append(('M ' if round(x, 2) < 0 else 'M') + pp(x, y))
        return self

    def L(self, x, y):
        self.d.append('L' + pp(x, y))
        return self

    def C(self, a, b, c):
        self.d.append('C' + pp(*a) + ' ' + pp(*b) + ' ' + pp(*c))
        return self

    def Q(self, a, b):
        self.d.append('Q' + pp(*a) + ' ' + pp(*b))
        return self

    def A(self, rx, ry, rot, large, sweep, x, y):
        self.d.append('A%s,%s %s %d %d %s' % (f(rx), f(ry), f(rot), large, sweep, pp(x, y)))
        return self

    def Z(self):
        self.d.append('Z')
        return self

    def __str__(self):
        return ''.join(self.d)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def bez(seg, t):
    p0, p1, p2, p3 = seg
    a, b, c = lerp(p0, p1, t), lerp(p1, p2, t), lerp(p2, p3, t)
    return lerp(lerp(a, b, t), lerp(b, c, t), t)


def split(seg, t):
    p0, p1, p2, p3 = seg
    a, b, c = lerp(p0, p1, t), lerp(p1, p2, t), lerp(p2, p3, t)
    d, e = lerp(a, b, t), lerp(b, c, t)
    g = lerp(d, e, t)
    return (p0, a, d, g), (g, e, c, p3)


def t_at_y(seg, y):
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if bez(seg, mid)[1] < y:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def mapsegs(segs, fn):
    return [tuple(fn(*p) for p in s) for s in segs]


def truncate(segs, y):
    """Cut a top-to-bottom right-half outline at height y."""
    out = []
    for s in segs:
        if s[3][1] <= y:
            out.append(s)
            continue
        if s[0][1] < y:
            out.append(split(s, t_at_y(s, y))[0])
        break
    return out


def outline(right, cx):
    """Close a right-half outline (top centre -> bottom) by mirroring it."""
    p = Path().M(*right[0][0])
    for s in right:
        p.C(s[1], s[2], s[3])
    end = right[-1][3]
    if abs(end[0] - cx) > 0.01:
        p.L(2 * cx - end[0], end[1])
    for s in reversed(right):
        m = [(2 * cx - x, y) for (x, y) in s]
        p.C(m[2], m[1], m[0])
    return str(p.Z())


def x_at_y(segs, y):
    for s in segs:
        if s[0][1] <= y <= s[3][1]:
            return bez(s, t_at_y(s, y))[0]
    return None


def ell_path(cx, cy, rx, ry, rot):
    t = math.radians(rot)
    ux, uy = math.cos(t) * rx, math.sin(t) * rx
    return str(Path().M(cx - ux, cy - uy).A(rx, ry, rot, 0, 1, cx + ux, cy + uy)
               .A(rx, ry, rot, 0, 1, cx - ux, cy - uy).Z())


def capsule(c1, r1, c2, r2, grow=0.0, off=(0.0, 0.0)):
    """Tapered capsule hugging two circles (outer tangents + end arcs)."""
    x1, y1 = c1[0] + off[0], c1[1] + off[1]
    x2, y2 = c2[0] + off[0], c2[1] + off[1]
    r1, r2 = r1 + grow, r2 + grow
    dx, dy = x2 - x1, y2 - y1
    d = math.hypot(dx, dy)
    ux, uy = dx / d, dy / d
    a = math.asin((r1 - r2) / d)

    def rot(ang):
        return (ux * math.cos(ang) - uy * math.sin(ang), ux * math.sin(ang) + uy * math.cos(ang))

    n1, n2 = rot(math.pi / 2 - a), rot(-(math.pi / 2 - a))
    p1 = (x1 + n1[0] * r1, y1 + n1[1] * r1)
    p2 = (x2 + n1[0] * r2, y2 + n1[1] * r2)
    q2 = (x2 + n2[0] * r2, y2 + n2[1] * r2)
    q1 = (x1 + n2[0] * r1, y1 + n2[1] * r1)
    return str(Path().M(*p1).L(*p2).A(r2, r2, 0, 1 if a < 0 else 0, 0, *q2)
               .L(*q1).A(r1, r1, 0, 1 if a > 0 else 0, 0, *p1).Z())


def rotp(p, c, deg):
    t = math.radians(deg)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(t) - y * math.sin(t), c[1] + x * math.sin(t) + y * math.cos(t))


# ---------------------------------------------------------------- palette
FELT = ['#FF9C5E', '#FD7631', '#F9661A', '#DD510E']   # highlight, light, mid (brand), edge
CORE = '#8E2F04'      # core shadow, bottom right
AO = '#5E1E03'        # contact / ambient occlusion
RIM = '#FFD4B2'       # rim light
CHEEK = '#FF7A5E'     # warm coral blush
LEAF = ['#AFD38A', '#6FAA52', '#3F7A3A']
STEM = '#5E9A46'
RIB = '#E6F2CF'
THREAD = '#4A1806'    # smile thread
STITCH = '#A8400A'    # finger stitches
GLOW = '#FFC266'


# ---------------------------------------------------------------- shared defs
def g_fill(P):
    return ('<radialGradient id="%sfill" cx=".4" cy=".28" r=".82" fx=".36" fy=".2">'
            '<stop offset="0" stop-color="%s"/><stop offset=".38" stop-color="%s"/>'
            '<stop offset=".72" stop-color="%s"/><stop offset="1" stop-color="%s"/></radialGradient>'
            % (P, *FELT))


def g_core(P):
    return ('<radialGradient id="%score" cx=".82" cy=".98" r=".72"><stop offset="0" stop-color="%s" stop-opacity=".5"/>'
            '<stop offset=".55" stop-color="%s" stop-opacity=".16"/><stop offset="1" stop-color="%s" stop-opacity="0"/>'
            '</radialGradient>' % (P, CORE, CORE, CORE))


def g_ao(P, a=.42, start=.7):
    return ('<linearGradient id="%sao" x1="0" y1="0" x2="0" y2="1"><stop offset="%s" stop-color="%s" stop-opacity="0"/>'
            '<stop offset="1" stop-color="%s" stop-opacity="%s"/></linearGradient>' % (P, f(start), AO, AO, f(a)))


def g_hi(P):
    return ('<radialGradient id="%shi"><stop offset="0" stop-color="#FFC9A0" stop-opacity=".6"/>'
            '<stop offset=".6" stop-color="#FFB27D" stop-opacity=".2"/><stop offset="1" stop-color="#FFB27D" stop-opacity="0"/>'
            '</radialGradient>' % P)


def g_rim(P):
    return ('<linearGradient id="%srim" x1="0" y1="1" x2="1" y2="0"><stop offset=".4" stop-color="%s" stop-opacity="0"/>'
            '<stop offset="1" stop-color="%s"/></linearGradient>' % (P, RIM, RIM))


def g_cheek(P, a=.6):
    return ('<radialGradient id="%scheek"><stop offset="0" stop-color="%s" stop-opacity="%s"/>'
            '<stop offset=".5" stop-color="%s" stop-opacity="%s"/><stop offset="1" stop-color="%s" stop-opacity="0"/>'
            '</radialGradient>' % (P, CHEEK, f(a), CHEEK, f(a * .52), CHEEK))


def g_leaf(P):
    return ('<linearGradient id="%sleaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%s"/>'
            '<stop offset=".5" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>' % (P, *LEAF))


def g_bead(P):
    return ('<radialGradient id="%sbead" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#594640"/>'
            '<stop offset=".45" stop-color="#1C1412"/><stop offset="1" stop-color="#090605"/></radialGradient>' % P)


def g_sock(P):
    return ('<radialGradient id="%ssock"><stop offset=".55" stop-color="#4A1803" stop-opacity=".42"/>'
            '<stop offset="1" stop-color="#4A1803" stop-opacity="0"/></radialGradient>' % P)


def g_glow(P):
    return ('<radialGradient id="%sglow"><stop offset="0" stop-color="%s" stop-opacity=".72"/>'
            '<stop offset=".5" stop-color="%s" stop-opacity=".26"/><stop offset="1" stop-color="%s" stop-opacity="0"/>'
            '</radialGradient>' % (P, GLOW, GLOW, GLOW))


def g_dot(P, name, color, a):
    """Soft radial blot (contact shadows, occlusion) without a blur filter."""
    return ('<radialGradient id="%s%s"><stop offset="0" stop-color="%s" stop-opacity="%s"/>'
            '<stop offset=".45" stop-color="%s" stop-opacity="%s"/><stop offset="1" stop-color="%s" stop-opacity="0"/>'
            '</radialGradient>' % (P, name, color, f(a), color, f(a * .55), color))


def g_limb(P, name, c, r, stops, fx=None, fy=None):
    """userSpaceOnUse radial for limbs, so overlapping arm + mitt shapes shade as one piece."""
    foc = '' if fx is None else ' fx="%s" fy="%s"' % (f(fx), f(fy))
    s = ''.join('<stop offset="%s" stop-color="%s"/>' % (f(o), col) for o, col in stops)
    return ('<radialGradient id="%s%s" gradientUnits="userSpaceOnUse" cx="%s" cy="%s" r="%s"%s>%s</radialGradient>'
            % (P, name, f(c[0]), f(c[1]), f(r), foc, s))


LIT = [(0, '#FFAE76'), (.42, '#FD7631'), (.78, '#E85B12'), (1, '#C7480B')]
SHADE = [(0, '#FF9F5F'), (.42, '#F66A20'), (.78, '#D9520E'), (1, '#AE3E08')]


def felt(P, bf=.75, k1=.18, k2=.92, fib=-2.12, disp=1.6):
    return ('<filter id="%sfelt" x="-8%%" y="-8%%" width="116%%" height="116%%" color-interpolation-filters="sRGB">'
            '<feTurbulence type="turbulence" baseFrequency="%s" numOctaves="2" seed="4" result="n"/>'
            '<feColorMatrix in="n" values="0 0 0 -1.2 1.1 0 0 0 -1.2 1.1 0 0 0 -1.2 1.1 0 0 0 0 1" result="g"/>'
            '<feComposite in="SourceGraphic" in2="g" operator="arithmetic" k1="%s" k2="%s" result="t"/>'
            '<feTurbulence type="fractalNoise" baseFrequency=".9" seed="12" result="f"/>'
            '<feColorMatrix in="f" values="0 0 0 0 1 0 0 0 0 .78 0 0 0 0 .6 0 0 0 3 %s" result="l"/>'
            '<feComposite in="l" in2="SourceAlpha" operator="in" result="m"/>'
            '<feComposite in="m" in2="t" result="u"/>'
            '<feTurbulence type="fractalNoise" baseFrequency="1.4" seed="9" result="d"/>'
            '<feDisplacementMap in="u" in2="d" scale="%s" xChannelSelector="R" yChannelSelector="G"/>'
            '</filter>' % (P, f(bf), f(k1), f(k2), f(fib), f(disp)))


def soft(P, sd=2.2, name='soft'):
    return ('<filter id="%s%s" x="-50%%" y="-50%%" width="200%%" height="200%%"><feGaussianBlur stdDeviation="%s"/></filter>'
            % (P, name, f(sd)))


# ---------------------------------------------------------------- parts
def sprout(P, bx, by, s):
    """Seedling on the crown. Returns (contact shadow element, m-accessory group).

    Local frame: stem base at (0,0), up is -y. The invisible rect keeps the
    group's box centred on the stem, so fill-box 50% 100% is the stem base.
    """
    T = lambda x, y: (bx + s * x, by + s * y)
    top = (0.5, -20.5)
    stem = Path().M(*T(0, 0)).C(T(0, -7), T(-1.1, -13.5), T(*top))

    def leaf(sign, ang, scale, jx):
        a = math.radians(ang)
        ax, ay = -sign * math.cos(a), -math.sin(a)          # axis, up and outward
        nx, ny = (-ay, ax) if sign > 0 else (ay, -ax)        # normal toward the sky
        J = (top[0] + jx, top[1] + .3)
        L = lambda u, v: T(J[0] + scale * (u * ax + v * nx), J[1] + scale * (u * ay + v * ny))
        pts = [(0, 0), (2.4, 2.6), (7.4, 5.9), (11.8, 5.7), (16.2, 5.5), (18.4, 2.4), (17.8, -.6),
               (17.2, -3.6), (13.8, -5.1), (9.8, -4.5), (5.8, -3.9), (2.2, -2), (0, 0)]
        p = Path().M(*L(*pts[0]))
        for i in range(1, 13, 3):
            p.C(L(*pts[i]), L(*pts[i + 1]), L(*pts[i + 2]))
        rib = Path().M(*L(1.6, .1)).Q(L(7.5, 1.1), L(13.4, .6))
        return str(p.Z()), str(rib)

    l1, r1 = leaf(1, 24, 1.0, -.6)
    l2, r2 = leaf(-1, 30, .96, .6)
    x0, y0 = T(-20, -36)
    x1, _ = T(20, 0)
    acc = ('<g class="m-accessory"><rect x="%s" y="%s" width="%s" height="%s" fill="none"/>'
           '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round"/>'
           '<path d="%s%s" fill="url(#%sleaf)"/>'
           '<path d="%s%s" fill="none" stroke="%s" stroke-opacity=".45" stroke-width="%s" stroke-linecap="round"/></g>'
           % (f(x0), f(y0), f(x1 - x0), f(by - y0), stem, STEM, f(3 * s), l1, l2, P, r1, r2, RIB, f(.8 * s)))
    cx, cy = T(0, 1.4)
    contact = '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="url(#%sdot)"/>' % (f(cx), f(cy), f(6.5 * s), f(2.6 * s), P)
    return contact, acc


def eye(P, cx, cy, r):
    return ('<circle cx="%s" cy="%s" r="%s" fill="url(#%ssock)"/>'
            '<circle cx="%s" cy="%s" r="%s" fill="url(#%sbead)"/>'
            '<path d="%s" fill="none" stroke="#FF9A5C" stroke-opacity=".5" stroke-width="%s" stroke-linecap="round"/>'
            '<circle cx="%s" cy="%s" r="%s" fill="#fff"/>'
            % (f(cx + .09 * r), f(cy + .16 * r), f(1.42 * r), P, f(cx), f(cy), f(r), P,
               str(Path().M(cx + .745 * r, cy + .2 * r).A(.76 * r, .76 * r, 0, 0, 1, cx + .127 * r, cy + .764 * r)),
               f(.2 * r), f(cx - .345 * r), f(cy - .364 * r), f(.29 * r)))


def eyes(P, e1, e2, r):
    return ('<g class="m-eyes"><g class="m-gaze">%s%s</g></g>' % (eye(P, e1[0], e1[1], r), eye(P, e2[0], e2[1], r)))


def mouths(cx, y, w, sw):
    """Default stitched smile (m-mouth) + hidden open smile (m-mouth-open)."""
    smile = '<path class="m-mouth" d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round"/>' % (
        str(Path().M(cx - w, y).Q((cx, y + .94 * w), (cx + w, y))), THREAD, f(sw))
    h = 1.25 * w
    o = Path().M(cx - w, y).Q((cx, y + .36 * w), (cx + w, y)).C((cx + w * .98, y + h * .72), (cx + w * .52, y + h),
                                                               (cx, y + h)).C((cx - w * .52, y + h), (cx - w * .98, y + h * .72), (cx - w, y)).Z()
    t = Path().M(cx - .56 * w, y + h * .84).C((cx - .3 * w, y + h * .55), (cx + .3 * w, y + h * .55), (cx + .56 * w, y + h * .84)) \
        .C((cx + .36 * w, y + h * .99), (cx - .36 * w, y + h * .99), (cx - .56 * w, y + h * .84)).Z()
    opn = ('<g class="m-mouth-open" display="none"><path d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>'
           '<path d="%s" fill="#F27A62"/></g>' % (o, THREAD, THREAD, f(sw * .5), t))
    return smile + opn


def cheeks(P, c1, c2, rx, ry):
    return ('<g class="m-cheeks"><ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="url(#%scheek)"/>'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="url(#%scheek)"/></g>'
            % (f(c1[0]), f(c1[1]), f(rx), f(ry), P, f(c2[0]), f(c2[1]), f(rx), f(ry), P))


def svg(vb, body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s">\n%s\n</svg>\n' % (vb, body)


# ---------------------------------------------------------------- body outlines
SIT_R = [((90, 44), (120, 44), (139, 63), (143, 90)),
         ((143, 90), (146, 110), (161, 128), (163, 152)),
         ((163, 152), (165, 180), (138, 199.5), (90, 199.5))]


PK, PT = 1.16, 29.0


def peek_map(x, y):
    return (120 + PK * (x - 90), PT + PK * (y - 44))


# ---------------------------------------------------------------- SIT
def sit_parts(P, arms=True):
    """Shared sitting body. Returns dict of SVG fragments used by sit + prop poses."""
    bp = outline(SIT_R, 90)
    contact, acc = sprout(P, 90, 44, .92)
    feet = []
    for sx in (-1, 1):
        cx = 90 + sx * 22
        feet.append('<path d="%s" fill="url(#%s%s)"/>' % (ell_path(cx, 188, 17, 11.6, sx * 12), P, 'footL' if sx < 0 else 'footR'))
        feet.append('<path d="%s" fill="url(#%ssole)"/>' % (ell_path(cx - sx * .6, 189.2, 8.6, 5.6, sx * 12), P))
    felt_body = ('<g filter="url(#%sfelt)">'
                 '<use href="#%sbp" fill="url(#%sfill)"/>'
                 '<g clip-path="url(#%scb)">'
                 '<use href="#%sbp" fill="url(#%score)"/>'
                 '<use href="#%sbp" fill="url(#%sao)"/>'
                 '<ellipse cx="72" cy="66" rx="30" ry="22" fill="url(#%shi)"/>'
                 '<ellipse class="m-glow" cx="90" cy="150" rx="40" ry="30" fill="url(#%sglow)" opacity=".4"/>'
                 '<use href="#%sbp" fill="none" stroke="url(#%srim)" stroke-width="8" filter="url(#%ssoft)"/>'
                 '<ellipse cx="90" cy="190" rx="58" ry="10" fill="url(#%sfao)"/>'
                 '%s</g>%s%s%s</g>'
                 % (P, P, P, P, P, P, P, P, P, P, P, P, P, P, contact, acc,
                    cheeks(P, (55.9, 107.7), (124.1, 107.7), 11, 7), ''.join(feet)))
    shadow = ('<g class="m-shadow"><ellipse cx="90" cy="198" rx="82" ry="6.5" fill="url(#%sgnd)"/>'
              '<ellipse cx="90" cy="199.6" rx="58" ry="2.6" fill="url(#%sgnd)"/></g>' % (P, P))
    return dict(bp=bp, felt_body=felt_body, shadow=shadow)


SHOULDER = (143.5, 112)          # right shoulder; the left one mirrors about x = 90


def arm_end(side, ang=60, length=22):
    a = math.radians(ang)
    S = (SHOULDER[0] if side > 0 else 180 - SHOULDER[0], SHOULDER[1])
    return S, (S[0] + side * length * math.cos(a), S[1] + length * math.sin(a))


def reach(S, H, r2=10.2):
    """Radius an unpainted pivot circle needs to contain the arm and its occlusion."""
    return math.ceil(math.hypot(H[0] - S[0], H[1] - S[1]) + r2 + 4.5)


def hand(P, side, S, H, r1=7.6, r2=10.2, pivot_r=36, before='', top=''):
    """Arm group: invisible pivot circle on the shoulder (fill-box centre = shoulder),
    a soft occlusion crescent, then the felt arm. `before` sits under the arm (a held prop)."""
    name = 'limbR' if side > 0 else 'limbL'
    pivot_r = max(pivot_r, reach(S, H, r2))
    occ = capsule(S, r1, H, r2, grow=1.6, off=(-side * 1.4, 1.8))
    return ('<g class="m-hand-%s"><circle cx="%s" cy="%s" r="%s" fill="none"/>'
            '<path d="%s" fill="%s" opacity=".42" filter="url(#%sblur)"/>%s'
            '<path d="%s" fill="url(#%s%s)" filter="url(#%sfelt)"/>%s</g>'
            % ('r' if side > 0 else 'l', f(S[0]), f(S[1]), f(pivot_r), occ, AO, P, before,
               capsule(S, r1, H, r2), P, name, P, top))


def lin(P, name, a, b, stops):
    s = ''.join('<stop offset="%s" stop-color="%s"/>' % (f(o), c) for o, c in stops)
    return ('<linearGradient id="%s%s" gradientUnits="userSpaceOnUse" x1="%s" y1="%s" x2="%s" y2="%s">%s</linearGradient>'
            % (P, name, f(a[0]), f(a[1]), f(b[0]), f(b[1]), s))


def linbb(P, name, x2, y2, stops):
    s = ''.join('<stop offset="%s" stop-color="%s"/>' % (f(o), c) for o, c in stops)
    return '<linearGradient id="%s%s" x2="%s" y2="%s">%s</linearGradient>' % (P, name, f(x2), f(y2), s)


def t_at_x(seg, x):
    lo, hi = 0.0, 1.0
    inc = seg[3][0] > seg[0][0]
    for _ in range(60):
        mid = (lo + hi) / 2
        if (bez(seg, mid)[0] < x) == inc:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def thru(a, m, b):
    """Quadratic through three points."""
    c = (2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2)
    return Path().M(*a).Q(c, b)


# ---- props (cream / cocoa / coral felt, one orange touch) ----
PAPER = [(0, '#FFF7EC'), (.62, '#F7E9D6'), (1, '#DCC3A4')]


def book(P):
    gx = 90
    top = ((gx, 129), (76, 124.2), (58, 121.6), (45, 124.4))     # left page, gutter -> outer corner

    def page(side, dx=0.0, dy=0.0):
        o = (lambda x: x + dx) if side < 0 else (lambda x: 2 * gx - x - dx)
        q = lambda x, y: (o(x), y + dy)
        return str(Path().M(*q(gx, 129)).C(q(76, 124.2), q(58, 121.6), q(45, 124.4))
                   .C(q(44, 137), q(44.6, 152), q(46.4, 165.4))
                   .C(q(60, 163.6), q(78, 165.4), q(gx, 169.6)).Z())

    cover = (Path().M(gx, 134).C((74, 128.4), (55, 125.2), (40.4, 127.4)).C((39.4, 141), (40.4, 157), (42.4, 170.6))
             .C((58, 169.6), (77, 171.6), (gx, 175.6)).C((103, 171.6), (122, 169.6), (137.6, 170.6))
             .C((139.6, 157), (140.6, 141), (139.6, 127.4)).C((125, 125.2), (106, 128.4), (gx, 134)).Z())

    def line(side, dy, x0, x1):
        o = (lambda x: x) if side < 0 else (lambda x: 2 * gx - x)
        pts = []
        for x in (x0, (x0 + x1) / 2, x1):
            y = bez(top, t_at_x(top, x))[1] + dy + (x - 45) / 45 * 1.6
            pts.append((o(x), y))
        return str(thru(*pts))

    ink = ''.join(line(-1, dy, 51.5, x1) for dy, x1 in ((14.5, 84), (20, 84), (25.5, 84), (31, 73)))
    ink += ''.join(line(1, dy, 51.5, x1) for dy, x1 in ((17, 84), (22.5, 84), (28, 76)))
    head = line(-1, 8.2, 53, 72)
    wave = str(Path().M(97, 138.2).Q((100.4, 133.4), (103.8, 137.6)).Q((107.2, 141.8), (110.6, 137.2))
               .Q((114, 132.6), (117.4, 136.8)))
    ribbon = str(Path().M(87.7, 168.5).L(92.3, 168.5).L(92.3, 183.2).L(90, 180.6).L(87.7, 183.2).Z())
    return ('<g class="m-prop"><ellipse cx="90" cy="127" rx="50" ry="8" fill="url(#%sfao)"/>'
            '<g filter="url(#%sfelt)"><path d="%s" fill="url(#%scov)"/>'
            '<path d="%s" fill="#DDC6A8"/><path d="%s" fill="#D3BA9A"/>'
            '<path d="%s" fill="url(#%spgl)"/><path d="%s" fill="url(#%spgr)"/>'
            '<path d="%s" fill="url(#%srib)"/></g>'
            '<path d="M90,129.6V169" stroke="#B4967A" stroke-opacity=".7" stroke-width=".9"/>'
            '<path d="%s" fill="none" stroke="#C4A78A" stroke-opacity=".85" stroke-width="1.15" stroke-linecap="round"/>'
            '<path d="%s%s" fill="none" stroke="#FB6514" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>'
            % (P, P, cover, P, page(-1, -1.3, 2), page(1, -1.3, 2), page(-1), P, page(1), P, ribbon, P,
               ink, head, wave))


def book_defs(P):
    return [linbb(P, 'cov', 1, 1, [(0, '#9A6347'), (.55, '#7A4A33'), (1, '#55301F')]),
            linbb(P, 'pgl', 1, 0, PAPER),
            linbb(P, 'pgr', 1, 0, [(0, '#D9BFA0'), (.36, '#F1E1CC'), (1, '#FBEFE0')]),
            linbb(P, 'rib', 0, 1, [(0, '#FF8A45'), (1, '#E0560D')])]


def magnifier(P, paw, tilt=12):
    u = (math.sin(math.radians(tilt)), math.cos(math.radians(tilt)))      # ring -> paw
    C = (paw[0] - 40 * u[0], paw[1] - 40 * u[1])
    at = lambda k: (C[0] + k * u[0], C[1] + k * u[1])
    ro, ri = 19, 13.6

    def circ(r, sweep):
        return Path().M(C[0] - r, C[1]).A(r, r, 0, 1, sweep, C[0] + r, C[1]).A(r, r, 0, 1, sweep, C[0] - r, C[1]).Z()

    ring = str(circ(ro, 1)) + str(circ(ri, 1))
    a0, a1 = math.radians(200), math.radians(258)
    hl = str(Path().M(C[0] + 9.6 * math.cos(a0), C[1] + 9.6 * math.sin(a0))
             .A(9.6, 9.6, 0, 0, 1, C[0] + 9.6 * math.cos(a1), C[1] + 9.6 * math.sin(a1)))
    b0, b1 = math.radians(18), math.radians(62)
    hl2 = str(Path().M(C[0] + 9.8 * math.cos(b0), C[1] + 9.8 * math.sin(b0))
              .A(9.8, 9.8, 0, 0, 1, C[0] + 9.8 * math.cos(b1), C[1] + 9.8 * math.sin(b1)))
    felt_part = ('<g filter="url(#%sfelt)"><path d="%s" fill="url(#%shdl)"/><path d="%s" fill="url(#%sring)"/>'
                 '<path d="%s" fill="url(#%sring)" fill-rule="evenodd"/></g>'
                 % (P, capsule(at(18), 3.3, at(47), 3.9), P, capsule(at(17.2), 4.7, at(23.4), 4.7), P, ring, P))
    glass = ('<circle cx="%s" cy="%s" r="%s" fill="url(#%sgls)"/>'
             '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="#8C6B52" stroke-opacity=".3" stroke-width="1.4"/>'
             '<path d="%s" fill="none" stroke="#fff" stroke-opacity=".95" stroke-width="2.6" stroke-linecap="round"/>'
             '<path d="%s" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/>'
             % (f(C[0]), f(C[1]), f(ri + .2), P, f(C[0]), f(C[1]), f(ri - .5), hl, hl2))
    defs = ['<radialGradient id="%sgls" gradientUnits="userSpaceOnUse" cx="%s" cy="%s" r="%s">'
            '<stop offset="0" stop-color="#F6FAFD"/><stop offset=".5" stop-color="#DCE8F1"/>'
            '<stop offset="1" stop-color="#AFC4D5"/></radialGradient>' % (P, f(C[0] - 5), f(C[1] - 6), f(21)),
            lin(P, 'hdl', (C[0] - 5 * u[1], 0), (C[0] + 5 * u[1], 0), [(0, '#A9714F'), (.5, '#7E4D34'), (1, '#4E2D1E')]),
            lin(P, 'ring', (C[0] - 14, C[1] - 16), (C[0] + 14, C[1] + 16), [(0, '#FFF8EE'), (.5, '#F0DCC2'), (1, '#CDAE8C')])]
    return '<g class="m-prop">%s%s</g>' % (felt_part, glass), defs, C


def pencil(P, B=(150, 199), lean=7, W=1.13, L=.95):
    """Plush pencil standing on its eraser. W scales width, L scales length."""
    t = math.radians(lean)
    d, n = (math.sin(t), -math.cos(t)), (math.cos(t), math.sin(t))
    at = lambda s_, w: (B[0] + L * s_ * d[0] + W * w * n[0], B[1] + L * s_ * d[1] + W * w * n[1])

    def poly(*pts):
        p = Path().M(*at(*pts[0]))
        for q in pts[1:]:
            p.L(*at(*q))
        return p.Z()

    eraser = (Path().M(*at(12.5, -7.3)).L(*at(4.4, -7.3)).C(at(1.2, -7.3), at(0, -4.6), at(0, 0))
              .C(at(0, 4.6), at(1.2, 7.3), at(4.4, 7.3)).L(*at(12.5, 7.3)).Z())
    ferrule = (Path().M(*at(11.6, -7.6)).Q(at(11.6, -7.95), at(12.2, -7.95)).L(*at(24, -7.95)).Q(at(24.6, -7.95), at(24.6, -7.6))
               .L(*at(24.6, 7.6)).Q(at(24.6, 7.95), at(24, 7.95)).L(*at(12.2, 7.95)).Q(at(11.6, 7.95), at(11.6, 7.6)).Z())
    body = poly((24, -7.5), (101, -7.5), (101, 7.5), (24, 7.5))
    cone = (Path().M(*at(101, -7.5)).L(*at(119.2, -2.6)).L(*at(119.2, 2.6)).L(*at(101, 7.5))
            .Q(at(97.2, 5), at(101, 2.5)).Q(at(97.2, 0), at(101, -2.5)).Q(at(97.2, -5), at(101, -7.5)).Z())
    lead = Path().M(*at(119, -2.7)).L(*at(125.6, -.85)).Q(at(127.6, 0), at(125.6, .85)).L(*at(119, 2.7)).Z()
    ridges = Path().M(*at(15.6, -7.95)).L(*at(15.6, 7.95)).M(*at(20.6, -7.95)).L(*at(20.6, 7.95))
    facets = Path().M(*at(24.5, -2.5)).L(*at(100, -2.5)).M(*at(24.5, 2.5)).L(*at(100, 2.5))
    shade = Path().M(*at(4, 2.4)).L(*at(110, 2.4))
    a, b = at(60, -7.5), at(60, 7.5)
    defs = [lin(P, 'pb', a, b, [(0, '#FFF6EA'), (.3, '#FAE9D4'), (.36, '#F0DABF'), (.64, '#E8CFB0'), (.7, '#D6BA98'), (1, '#C7A985')]),
            lin(P, 'pw', at(110, -6), at(110, 6), [(0, '#F4D9B2'), (.55, '#E2B985'), (1, '#C2915C')]),
            lin(P, 'pf', at(18, -8), at(18, 8), [(0, '#EEE3D6'), (.45, '#C9B9A6'), (1, '#8F8070')]),
            lin(P, 'pe', at(6, -7.3), at(6, 7.3), [(0, '#FFA48A'), (.5, '#F47C62'), (1, '#CF5A43')]),
            lin(P, 'pl', at(122, -3), at(122, 3), [(0, '#5A4F4A'), (1, '#29221F')])]
    g = ('<g class="m-prop"><path d="%s" fill="none" stroke="%s" stroke-opacity=".38" stroke-width="%s" stroke-linecap="round" filter="url(#%sblur)"/>'
         '<g filter="url(#%sfelt)"><path d="%s" fill="url(#%spe)"/><path d="%s" fill="url(#%spb)"/>'
         '<path d="%s" fill="url(#%spw)"/><path d="%s" fill="url(#%spl)"/><path d="%s" fill="url(#%spf)"/>'
         '<path d="%s" fill="none" stroke="#7D6F62" stroke-opacity=".55" stroke-width=".9"/>'
         '<path d="%s" fill="none" stroke="#B89A78" stroke-opacity=".32" stroke-width=".7"/></g></g>'
         % (shade, AO, f(15 * W), P, P, eraser, P, body, P, cone, P, lead, P, ferrule, P, ridges, facets))
    return g, defs, at


def sit_defs(P, limbs=None, extra=()):
    lb = {'limbL': ((30, 116), 30, LIT, (27, 112)), 'limbR': ((148, 114), 30, SHADE, (146, 110))}
    lb.update(limbs or {})
    return ('<defs>\n<path id="%sbp" d="%s"/>\n<clipPath id="%scb"><use href="#%sbp"/></clipPath>\n'
            % (P, outline(SIT_R, 90), P, P)
            + '\n'.join([g_fill(P), g_core(P), g_ao(P), g_hi(P), g_rim(P), g_cheek(P), g_leaf(P), g_bead(P), g_sock(P),
                         g_glow(P), g_dot(P, 'dot', AO, .5), g_dot(P, 'fao', AO, .42), g_dot(P, 'gnd', '#000', .6),
                         '<radialGradient id="%ssole" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#FDB182"/>'
                         '<stop offset="1" stop-color="#F7955C"/></radialGradient>' % P]
                        + [g_limb(P, k, v[0], v[1], v[2], *v[3]) for k, v in lb.items()]
                        + ['<radialGradient id="%sfootL" cx=".38" cy=".22" r=".9"><stop offset="0" stop-color="#FFA66C"/>'
                           '<stop offset=".45" stop-color="#FD7631"/><stop offset="1" stop-color="#D9500E"/></radialGradient>' % P,
                           '<radialGradient id="%sfootR" cx=".38" cy=".22" r=".9"><stop offset="0" stop-color="#FF9D5E"/>'
                           '<stop offset=".45" stop-color="#F86C24"/><stop offset="1" stop-color="#C64A0C"/></radialGradient>' % P,
                           felt(P), soft(P), soft(P, 1.5, 'blur')]
                        + list(extra))
            + '\n</defs>')


SIT_PREFIX = {'sit': 'M-s-', 'book': 'M-sb-', 'magnifier': 'M-sm-', 'pencil': 'M-sp-'}


def build_sit(kind='sit'):
    P = SIT_PREFIX[kind]
    parts = sit_parts(P)
    SL, HL = arm_end(-1)
    SR, HR = arm_end(1)
    limbs, extra, prop, gaze = {}, [], '', (0, 0)
    hl = hand(P, -1, SL, HL)
    hr = hand(P, 1, SR, HR)
    if kind == 'book':
        HL, HR = (43.5, 141), (136.5, 141)
        limbs = {'limbL': ((36, 122), 28, LIT, (33, 118)), 'limbR': ((142, 122), 28, SHADE, (139, 118))}
        hl = hand(P, -1, SL, HL)
        hr = hand(P, 1, SR, HR)
        prop = book(P)
        extra = book_defs(P)
    elif kind == 'magnifier':
        a = math.radians(-48)
        HR = (SR[0] + 22 * math.cos(a), SR[1] + 22 * math.sin(a))
        mg, extra, C = magnifier(P, HR)
        limbs = {'limbR': ((148, 100), 26, SHADE, (146, 97))}
        pr = math.ceil(math.hypot(C[0] - SR[0], C[1] - SR[1]) + 21)
        hl = hand(P, -1, SL, HL, pivot_r=pr)          # equal pivots keep m-body centred
        hr = hand(P, 1, SR, HR, pivot_r=pr, before=mg)
        gaze = (1.5, -1.1)
    elif kind == 'pencil':
        prop, extra, at = pencil(P)
        HR = at(68, 0)
        limbs = {'limbR': ((150, 118), 28, SHADE, (148, 114))}
        pr = reach(SR, HR)
        hl = hand(P, -1, SL, HL, pivot_r=pr)
        hr = hand(P, 1, SR, HR, pivot_r=pr)
    body = ('%s\n%s\n<g class="m-body">\n%s\n%s\n%s\n%s\n%s\n%s\n</g>'
            % (sit_defs(P, limbs, extra), parts['shadow'], parts['felt_body'], prop, hl, hr,
               mouths(90, 102.8, 5.1, 1.9),
               eyes(P, (71.3 + gaze[0], 94.5 + gaze[1]), (108.7 + gaze[0], 94.5 + gaze[1]), 5.5)))
    return svg('0 0 180 200', body)


# ---------------------------------------------------------------- PEEK
def mitt_path(cx, top, base, w, rc=9.0, grow=0.0, off=(0.0, 0.0), sag=1.4, lean=0.0):
    """Paw pressed on the ledge: round dome (crown shifted by `lean`), rounded corners,
    base gently convex down to `base`."""
    cx, top, w = cx + off[0], top + off[1] - grow, w + grow
    h = base - top
    b = base - sag
    t = cx + lean
    return str(Path().M(cx - w + rc, b)
               .C((cx - w + rc * .4, b), (cx - w, b - rc * .5), (cx - w, b - rc))
               .C((cx - w, top + h * .3), (t - w * .62, top), (t, top))
               .C((t + w * .62, top), (cx + w, top + h * .3), (cx + w, b - rc))
               .C((cx + w, b - rc * .5), (cx + w - rc * .4, b), (cx + w - rc, b))
               .C((cx + w * .3, base), (cx - w * .3, base), (cx - w + rc, b)).Z())


def build_peek():
    P = 'M-p-'
    right = truncate(mapsegs(SIT_R, peek_map), 120)
    bp = outline(right, 120)
    contact, acc = sprout(P, 120, PT, .8)
    hands = []
    for sx in (-1, 1):
        # one bean-shaped forelimb: the outer end is the paw on the ledge, the inner end
        # tucks into the body side, where it pivots (the shoulder)
        S = (120 + sx * 54, 92)
        mc, w, top, base, ln = 120 + sx * 70.5, 24, 93.6, 120, sx * 3.6
        name = 'limbR' if sx > 0 else 'limbL'
        occ = mitt_path(mc, top, base, w, rc=9.5, grow=1.8, off=(-sx * 2.4, 0), lean=ln)
        paw = mitt_path(mc, top, base, w, rc=9.5, lean=ln)
        k = mc + sx * 7.5
        st = (Path().M(k - 5.3, base - 10).Q((k - 6, base - 6.3), (k - 5.5, base - 2.8))
              .M(k + 5.3, base - 10).Q((k + 6, base - 6.3), (k + 5.5, base - 2.8)))
        hx0 = S[0] - 46
        hands.append(
            '<g class="m-hand-%s"><rect x="%s" y="%s" width="92" height="%s" fill="none"/>'
            '<path d="%s" fill="%s" opacity=".5" filter="url(#%sblur)"/>'
            '<g filter="url(#%sfelt)"><path d="%s" fill="url(#%s%s)"/><path d="%s" fill="url(#%smao)"/></g>'
            '<path d="%s" fill="none" stroke="%s" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round"/></g>'
            % ('r' if sx > 0 else 'l', f(hx0), f(2 * S[1] - 120), f(2 * (120 - S[1])),
               occ, AO, P, P, paw, P, name, paw, P, str(st), STITCH))
    shadow = ('<g class="m-shadow"><ellipse cx="48" cy="120" rx="26" ry="4.5" fill="url(#%sgnd)"/>'
              '<ellipse cx="192" cy="120" rx="26" ry="4.5" fill="url(#%sgnd)"/></g>' % (P, P))
    defs = ('<defs>\n<path id="%sbp" d="%s"/>\n<clipPath id="%scb"><use href="#%sbp"/></clipPath>\n' % (P, bp, P, P)
            + '\n'.join([g_fill(P), g_core(P), g_ao(P, .34, .72), g_hi(P), g_rim(P), g_cheek(P), g_leaf(P), g_bead(P),
                         g_sock(P), g_glow(P), g_dot(P, 'dot', AO, .5), g_dot(P, 'gnd', '#000', .55),
                         '<linearGradient id="%smao" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="%s" stop-opacity="0"/>'
                         '<stop offset="1" stop-color="%s" stop-opacity=".36"/></linearGradient>' % (P, AO, AO),
                         g_limb(P, 'limbL', (44, 101), 32, LIT, 40, 98),
                         g_limb(P, 'limbR', (192, 101), 32, SHADE, 188, 98),
                         felt(P), soft(P), soft(P, 1.8, 'blur')])
            + '\n</defs>')
    felt_body = ('<g filter="url(#%sfelt)"><use href="#%sbp" fill="url(#%sfill)"/><g clip-path="url(#%scb)">'
                 '<use href="#%sbp" fill="url(#%score)"/><use href="#%sbp" fill="url(#%sao)"/>'
                 '<ellipse cx="102" cy="54" rx="33" ry="22" fill="url(#%shi)"/>'
                 '<ellipse class="m-glow" cx="120" cy="106" rx="42" ry="14" fill="url(#%sglow)" opacity=".4"/>'
                 '<use href="#%sbp" fill="none" stroke="url(#%srim)" stroke-width="9" filter="url(#%ssoft)"/>%s</g>%s%s</g>'
                 % (P, P, P, P, P, P, P, P, P, P, P, P, P, contact, acc,
                    cheeks(P, (83.4, 99.4), (156.6, 99.4), 11.6, 7.4)))
    body = ('%s\n%s\n<g class="m-body">\n%s\n%s\n%s\n%s\n%s\n</g>'
            % (defs, shadow, felt_body, hands[0], hands[1], mouths(120, 94.4, 5.4, 1.8),
               eyes(P, (100, 85.6), (140, 85.6), 5.9)))
    return svg('0 0 240 120', body)


# ---------------------------------------------------------------- HEAD
HK, HT = .68, 27.0


def head_map(x, y):
    return (50 + HK * (x - 90), HT + HK * (y - 44))


def build_head(small=False):
    P = 'M-hs-' if small else 'M-h-'
    right = truncate(mapsegs(SIT_R, head_map), 104)
    bp = outline(right, 50)
    contact, acc = sprout(P, 50, HT, .8)
    er = 6.6 if small else 6.2
    if small:
        fx = ''
        rim = ('<use href="#%sbp" fill="url(#%srimg)"/>' % (P, P))
        extra = ('<radialGradient id="%srimg" cx=".3" cy=".42" r=".8"><stop offset=".72" stop-color="%s" stop-opacity="0"/>'
                 '<stop offset="1" stop-color="%s" stop-opacity=".55"/></radialGradient>' % (P, RIM, RIM))
    else:
        fx = ' filter="url(#%sfelt)"' % P
        rim = '<use href="#%sbp" fill="none" stroke="url(#%srim)" stroke-width="5" filter="url(#%ssoft)"/>' % (P, P, P)
        extra = felt(P, bf=.62, k1=.14, k2=.93, fib=-2.2, disp=1.1) + '\n' + soft(P, 1.6)
    defs = ('<defs>\n<path id="%sbp" d="%s"/>\n<clipPath id="%scb"><use href="#%sbp"/></clipPath>\n' % (P, bp, P, P)
            + '\n'.join([g_fill(P), g_core(P), g_hi(P)] + ([] if small else [g_rim(P)]) + [g_cheek(P, .66 if small else .6), g_leaf(P), g_bead(P),
                         g_sock(P), g_glow(P), g_dot(P, 'dot', AO, .5), extra])
            + '\n</defs>')
    felt_body = ('<g%s><use href="#%sbp" fill="url(#%sfill)"/><g clip-path="url(#%scb)">'
                 '<use href="#%sbp" fill="url(#%score)"/>'
                 '<ellipse cx="38" cy="42" rx="20" ry="13" fill="url(#%shi)"/>'
                 '<ellipse class="m-glow" cx="50" cy="88" rx="30" ry="12" fill="url(#%sglow)" opacity=".4"/>'
                 '%s%s</g>%s%s</g>'
                 % (fx, P, P, P, P, P, P, P, rim, contact, acc,
                    cheeks(P, (24.5, 70), (75.5, 70), 8.6, 5.6)))
    body = ('%s\n<g class="m-body">\n%s\n%s\n%s\n</g>'
            % (defs, felt_body, mouths(50, 67.2, 4.4 if small else 4.2, 2.7 if small else 2.4),
               eyes(P, (36, 60), (64, 60), er)))
    return svg('0 0 100 100', body)


# ---------------------------------------------------------------- main
FILES = {}


def main():
    FILES['peek.svg'] = build_peek()
    FILES['sit.svg'] = build_sit()
    FILES['head.svg'] = build_head()
    FILES['head-sm.svg'] = build_head(small=True)
    FILES['sit-book.svg'] = build_sit('book')
    FILES['sit-magnifier.svg'] = build_sit('magnifier')
    FILES['sit-pencil.svg'] = build_sit('pencil')
    for name, s in FILES.items():
        with open(os.path.join(OUT, name), 'w') as fh:
            fh.write(s)
        print('%-18s %6d B' % (name, len(s.encode())))


if __name__ == '__main__':
    main()
