#!/usr/bin/env python3
"""Contract audit for the final mascot SVGs (read-only).

    python3 -I check.py            (audits ../*.svg)
Exit status 1 if any hard violation is found.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.dirname(HERE)
NS = '{http://www.w3.org/2000/svg}'
KNOWN = {'m-body', 'm-eyes', 'm-gaze', 'm-hand-l', 'm-hand-r', 'm-mouth', 'm-mouth-open', 'm-cheeks',
         'm-accessory', 'm-shadow', 'm-glow', 'm-prop'}
FORBID = ['style=', '<style', '<script', '<image', '<text', '<foreignObject', 'xlink:', 'javascript:', '@import',
          'http://', 'https://', 'data:']
bad_total = 0


def hard(msg):
    global bad_total
    bad_total += 1
    print('  !! ' + msg)


for name in sorted(n for n in os.listdir(D) if n.endswith('.svg')):
    raw = open(os.path.join(D, name)).read()
    print('== %s  %d B' % (name, len(raw.encode())))
    if len(raw.encode()) > 12 * 1024:
        hard('over 12 KB')
    # forbidden strings (the xmlns URL is the only allowed http)
    probe = raw.replace('xmlns="http://www.w3.org/2000/svg"', '')
    for b in FORBID:
        if b in probe:
            hard('forbidden %r x%d' % (b, probe.count(b)))
    root = ET.fromstring(raw)
    if root.tag != NS + 'svg':
        hard('root is not svg')
    if set(root.attrib) != {'viewBox'}:
        hard('root attributes %s (want only viewBox + xmlns)' % sorted(root.attrib))
    print('  viewBox', root.get('viewBox'))
    # ids
    ids = [e.get('id') for e in root.iter() if e.get('id')]
    pref = sorted({re.match(r'(M-[a-z]+-)', i).group(1) if re.match(r'M-[a-z]+-', i) else i for i in ids})
    print('  ids %d, prefixes %s' % (len(ids), pref))
    for i in ids:
        if not i.startswith('M-'):
            hard('id without M- prefix: ' + i)
    if len(pref) != 1:
        hard('more than one pose prefix: %s' % pref)
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        hard('duplicate ids %s' % dup)
    refs = set(re.findall(r'url\(#([^)]+)\)', raw)) | set(re.findall(r'href="#([^"]+)"', raw))
    miss = sorted(r for r in refs if r not in ids)
    if miss:
        hard('unresolved refs %s' % miss)
    unused = sorted(i for i in ids if i not in refs)
    if unused:
        print('  (unused ids %s)' % unused)
    ext = [u for u in re.findall(r'(?:href|src)="([^"]+)"', raw) if not u.startswith('#')]
    if ext:
        hard('external refs %s' % ext)
    # prefix swap safety: every "M-" is inside id=", url(#, href="#
    stripped = re.sub(r'(id="M-|url\(#M-|href="#M-)', '', raw)
    stray = [m.start() for m in re.finditer('M-', stripped)]
    if stray:
        hard('stray "M-" outside id/url/href: %s' % [stripped[max(0, k - 12):k + 8] for k in stray[:4]])
    # transforms anywhere (we bake all geometry)
    tf = [e.tag.replace(NS, '') for e in root.iter() if e.get('transform') or e.get('gradientTransform') or e.get('patternTransform')]
    if tf:
        hard('transform attributes on %s' % tf)
    # classes
    classes = {}
    parent = {c: p for p in root.iter() for c in p}
    for e in root.iter():
        for c in (e.get('class') or '').split():
            classes.setdefault(c, []).append(e)
    unknown = sorted(set(classes) - KNOWN)
    if unknown:
        hard('unknown classes %s' % unknown)
    for c in ('m-body', 'm-eyes', 'm-gaze', 'm-mouth', 'm-cheeks', 'm-accessory'):
        if c not in classes:
            hard('missing class ' + c)
    if len(classes.get('m-body', [])) != 1:
        hard('m-body must be unique')
    print('  classes', ' '.join('%s%s' % (c, '' if len(v) == 1 else 'x%d' % len(v)) for c, v in sorted(classes.items())))
    body = classes['m-body'][0]

    def ancestors(e):
        while e in parent:
            e = parent[e]
            yield e

    # eyes: no filter inside or above, drawn last inside m-body
    for e in classes.get('m-eyes', []):
        if any(x.get('filter') for x in e.iter()):
            hard('filter inside m-eyes')
        if any(a.get('filter') for a in ancestors(e)):
            hard('m-eyes under a filtered ancestor')
        kids = list(body)
        if kids[-1] is not e:
            hard('m-eyes is not the last child of m-body')
        g = [x for x in e if 'm-gaze' in (x.get('class') or '')]
        if not g:
            hard('m-gaze not directly inside m-eyes')
    # shadow outside m-body; hands inside m-body, each with a fill="none" pivot first
    for e in classes.get('m-shadow', []):
        if body in list(ancestors(e)):
            hard('m-shadow inside m-body')
    for c in ('m-hand-l', 'm-hand-r'):
        for e in classes.get(c, []):
            if body not in list(ancestors(e)):
                hard('%s outside m-body' % c)
            first = list(e)[0]
            if first.get('fill') != 'none' or first.tag.replace(NS, '') not in ('circle', 'rect'):
                hard('%s first child is not an unpainted pivot' % c)
    for e in classes.get('m-accessory', []):
        first = list(e)[0]
        if first.get('fill') != 'none':
            hard('m-accessory first child is not an unpainted pivot')
    for e in classes.get('m-mouth-open', []):
        if e.get('display') != 'none':
            hard('m-mouth-open should be display="none" by default')
    if 'm-hand-l' in classes and 'm-shadow' not in classes:
        hard('posed figure without m-shadow')
    nfilt = sum(1 for e in root.iter() if e.get('filter'))
    nfelt = sum(1 for e in root.iter() if 'felt)' in (e.get('filter') or ''))
    print('  filter uses: %d (felt %d)' % (nfilt, nfelt))

print('\n%s' % ('ALL CLEAR' if not bad_total else '%d HARD VIOLATIONS' % bad_total))
sys.exit(1 if bad_total else 0)
