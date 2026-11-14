#!/usr/bin/env python3
"""Packs the KayKit Medieval Hexagon pack (CC0, github.com/KayKit-Game-Assets/
KayKit-Medieval-Hexagon-Pack-1.0) into one small file the app loads: web/hex/kaykit.bin.

Usage: python3 tools/kaykit-pack.py <path to the pack's addons/kaykit_medieval_hexagon_pack/Assets/gltf>

File layout: 'KKP1', uint32 index length, JSON index, padding to 4, then the data.
Index: { tex: [off, len], models: { name: { p: [part...], c?: { red|green|yellow: [diff...] } } } }
  part: { t: [x,y,z] node offset, n: vertex count, i: index count, o: data offset, w: 2|4 index bytes }
    data at o: position float32 x3 * n, normal int8 x4 * n, uv uint16 x2 * n, then indices
  diff (house colours share the blue model and only change some UVs): [off, count] of
    (uint16 vertex, uint16 u, uint16 v) triples, per part in order
"""
import json, struct, sys, os, glob

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'hex', 'kaykit.bin')
FT = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}
SZ = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def acc(g, b, i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; n = a['count'] * SZ[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return list(struct.unpack_from('<%d%s' % (n, FT[a['componentType']]), b, off))

def load(path):
    g = json.load(open(path)); b = open(path[:-5] + '.bin', 'rb').read(); parts = []
    parent = {c: i for i, n in enumerate(g['nodes']) for c in n.get('children', [])}
    def world(i):  # node translations add up through the parents (no rotations or scales in this pack)
        t = [0, 0, 0]
        while i is not None:
            n = g['nodes'][i]
            if 'rotation' in n or 'scale' in n or 'matrix' in n: raise SystemExit('unsupported node transform in ' + path)
            t = [a + c for a, c in zip(t, n.get('translation', [0, 0, 0]))]; i = parent.get(i)
        return t
    for ni, node in enumerate(g['nodes']):
        if 'mesh' not in node: continue
        for pr in g['meshes'][node['mesh']]['primitives']:
            at = pr['attributes']
            parts.append({'t': [round(x, 5) for x in world(ni)], 'nm': node.get('name', ''), 'pos': acc(g, b, at['POSITION']),
                          'nrm': acc(g, b, at['NORMAL']), 'uv': acc(g, b, at['TEXCOORD_0']), 'idx': acc(g, b, pr['indices'])})
    return parts

q16 = lambda v: max(0, min(65535, round(v * 65535)))
q8 = lambda v: max(-127, min(127, round(v * 127)))
data = bytearray(); models = {}
def put(bs):
    while len(data) % 4: data.append(0)
    o = len(data); data.extend(bs); return o

def add(name, parts):
    ps = []
    for p in parts:
        n = len(p['pos']) // 3; w = 2 if n < 65536 else 4
        bs = struct.pack('<%df' % (n * 3), *p['pos'])
        bs += b''.join(struct.pack('<4b', q8(p['nrm'][k * 3]), q8(p['nrm'][k * 3 + 1]), q8(p['nrm'][k * 3 + 2]), 0) for k in range(n))
        bs += struct.pack('<%dH' % (n * 2), *[q16(x) for x in p['uv']])
        bs += struct.pack('<%d%s' % (len(p['idx']), 'H' if w == 2 else 'I'), *p['idx'])
        ps.append({'t': p['t'], 'm': p['nm'], 'n': n, 'i': len(p['idx']), 'o': put(bs), 'w': w})
    models[name] = {'p': ps}

for f in sorted(glob.glob(os.path.join(src, '**', '*.gltf'), recursive=True)):
    rel = os.path.relpath(f, src).replace('\\', '/')
    if '/waterless/' in rel or rel.startswith('buildings/red') or rel.startswith('buildings/green') or rel.startswith('buildings/yellow'): continue
    name = os.path.basename(f)[:-5]
    if rel.startswith('buildings/blue'): name = name[:-5]  # building_home_A_blue -> building_home_A
    parts = load(f); add(name, parts)
    if rel.startswith('buildings/blue'):
        c = {}
        for col in ('red', 'green', 'yellow'):
            other = load(os.path.join(src, 'buildings', col, '%s_%s.gltf' % (name, col))); diffs = []
            for pa, pb in zip(parts, other):
                tri = []
                for k in range(len(pa['uv']) // 2):
                    a, b = (q16(pa['uv'][k * 2]), q16(pa['uv'][k * 2 + 1])), (q16(pb['uv'][k * 2]), q16(pb['uv'][k * 2 + 1]))
                    if a != b: tri += [k, b[0], b[1]]
                diffs.append([put(struct.pack('<%dH' % len(tri), *tri)), len(tri) // 3])
            c[col] = diffs
        models[name]['c'] = c

tex = open(os.path.join(src, '..', '..', 'Textures', 'hexagons_medieval.png'), 'rb').read()
idx = json.dumps({'tex': [put(tex), len(tex)], 'models': models}, separators=(',', ':')).encode()
while (8 + len(idx)) % 4: idx += b' '
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'wb') as fh: fh.write(b'KKP1' + struct.pack('<I', len(idx)) + idx + data)
print('wrote', out, len(models), 'models', 8 + len(idx) + len(data), 'bytes')
