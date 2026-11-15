#!/usr/bin/env python3
"""Packs the furniture used by the walk-mode interiors (2.75) into web/hex/rooms.bin.
Models come from three KayKit packs (all CC0, github.com/KayKit-Game-Assets):
  KayKit-Dungeon-Remastered-1.0, KayKit-Furniture-Bits-1.0, KayKit-Restaurant-Bits-1.0

Usage: python3 tools/interior-pack.py <folder holding the three cloned packs>

Same layout as kaykit.bin ('KKP1', uint32 index length, JSON index, data) except
  tex: [[off, len], ...] one PNG per pack
  models: { name: { k: texture index, p: [part...] } }, part as in kaykit.bin
  (node transforms are baked into the vertices, so t is always [0,0,0]),
  a part with no texture carries c: '#rrggbb' instead.
"""
import json, struct, sys, os, math

root = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'hex', 'rooms.bin')
PACKS = [
    ('KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf', 'd', [
        'floor_tile_large', 'floor_wood_large', 'floor_wood_large_dark', 'wall', 'wall_doorway', 'wall_window_open', 'wall_corner',
        'pillar_decorated', 'column', 'banner_patternA_red', 'banner_patternB_blue', 'banner_thin_yellow', 'banner_shield_green', 'banner_triple_red',
        'table_long_tablecloth_decorated_A', 'table_long_decorated_A', 'table_long', 'table_medium', 'table_small_decorated_A', 'chair', 'stool',
        'torch_mounted', 'candle_triple', 'candle_lit', 'chest_gold', 'chest', 'sword_shield', 'sword_shield_gold', 'keg_decorated', 'barrel_large',
        'barrel_small_stack', 'bottle_A_green', 'bottle_B_brown', 'plate_food_A', 'plate_food_B', 'box_stacked', 'shelf_small_candles', 'shelves',
        'shelf_large', 'crates_stacked', 'coin_stack_large', 'rubble_half', 'bed_decorated', 'wall_shelves', 'stairs_wood']),
    ('KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf', 'f', [
        'armchair', 'book_set', 'book_single', 'shelf_B_large_decorated', 'shelf_A_big', 'shelf_B_small_decorated', 'table_medium_long', 'table_low',
        'chair_A_wood', 'chair_B_wood', 'lamp_table', 'lamp_standing', 'rug_oval_A', 'rug_rectangle_stripes_A', 'rug_rectangle_A', 'pictureframe_standing_A',
        'pictureframe_large_A', 'pictureframe_medium', 'cabinet_medium_decorated', 'couch_pillows']),
    ('KayKit-Restaurant-Bits-1.0/addons/kaykit_restaurant_bits/Assets/gltf', 'r', [
        'table_round_A_decorated', 'table_round_A', 'chair_B', 'chair_stool', 'stew_pot', 'pot_A_stew', 'crate_carrots', 'crate_potatoes', 'jar_A_large',
        'jar_B_medium', 'food_dinner', 'stew_bowl', 'menu']),
]
FT = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}
SZ = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def read(path):
    raw = open(path, 'rb').read()
    if raw[:4] == b'glTF':
        n = struct.unpack_from('<I', raw, 12)[0]; g = json.loads(raw[20:20 + n]); o = 20 + n
        bl = struct.unpack_from('<I', raw, o)[0]; return g, raw[o + 8:o + 8 + bl]
    g = json.loads(raw); return g, open(os.path.join(os.path.dirname(path), g['buffers'][0]['uri']), 'rb').read()

def acc(g, b, i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; c = SZ[a['type']]; n = a['count'] * c
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride')
    if st and st != c * 4: return [x for k in range(a['count']) for x in struct.unpack_from('<%d%s' % (c, FT[a['componentType']]), b, off + k * st)]
    v = list(struct.unpack_from('<%d%s' % (n, FT[a['componentType']]), b, off))
    if a.get('normalized') and a['componentType'] == 5123: v = [x / 65535 for x in v]
    return v

def mat(n):  # node TRS as a 4x4 (row major)
    if 'matrix' in n: m = n['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    x, y, z, w = n.get('rotation', [0, 0, 0, 1]); sx, sy, sz = n.get('scale', [1, 1, 1]); tx, ty, tz = n.get('translation', [0, 0, 0])
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[0][0] * sx, R[0][1] * sy, R[0][2] * sz, tx], [R[1][0] * sx, R[1][1] * sy, R[1][2] * sz, ty], [R[2][0] * sx, R[2][1] * sy, R[2][2] * sz, tz], [0, 0, 0, 1]]

def mul(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def load(path):
    g, b = read(path); parts = []
    parent = {c: i for i, n in enumerate(g['nodes']) for c in n.get('children', [])}
    def world(i):
        m = [[1 if r == c else 0 for c in range(4)] for r in range(4)]
        while i is not None: m = mul(mat(g['nodes'][i]), m); i = parent.get(i)
        return m
    for ni, node in enumerate(g['nodes']):
        if 'mesh' not in node: continue
        M = world(ni)
        for pr in g['meshes'][node['mesh']]['primitives']:
            at = pr['attributes']; pos = acc(g, b, at['POSITION']); nrm = acc(g, b, at['NORMAL'])
            P, N = [], []
            for k in range(len(pos) // 3):
                x, y, z = pos[k * 3:k * 3 + 3]; P += [M[r][0] * x + M[r][1] * y + M[r][2] * z + M[r][3] for r in range(3)]
                a, bb, c = nrm[k * 3:k * 3 + 3]; v = [M[r][0] * a + M[r][1] * bb + M[r][2] * c for r in range(3)]; l = math.sqrt(sum(q * q for q in v)) or 1; N += [q / l for q in v]
            m = g['materials'][pr['material']] if 'material' in pr else {}; pb = m.get('pbrMetallicRoughness', {})
            col = None
            if 'baseColorTexture' not in pb or 'TEXCOORD_0' not in at:
                f = pb.get('baseColorFactor', [1, 1, 1, 1]); col = '#%02x%02x%02x' % tuple(round(min(1, max(0, c)) ** (1 / 2.2) * 255) for c in f[:3])
            uv = acc(g, b, at['TEXCOORD_0']) if 'TEXCOORD_0' in at else [0] * (len(pos) // 3 * 2)
            parts.append({'pos': P, 'nrm': N, 'uv': uv, 'idx': acc(g, b, pr['indices']), 'col': col})
    img = None
    if g.get('images'):
        im = g['images'][0]
        if 'bufferView' in im: bv = g['bufferViews'][im['bufferView']]; img = b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        else: img = open(os.path.join(os.path.dirname(path), im['uri']), 'rb').read()
    return parts, img

q16 = lambda v: max(0, min(65535, round(v * 65535)))
q8 = lambda v: max(-127, min(127, round(v * 127)))
data = bytearray(); models = {}; texs = []
def put(bs):
    while len(data) % 4: data.append(0)
    o = len(data); data.extend(bs); return o

for ti, (folder, pre, names) in enumerate(PACKS):
    d = os.path.join(root, folder); tex = None
    for name in names:
        f = next((os.path.join(d, name + e) for e in ('.gltf.glb', '.glb', '.gltf') if os.path.exists(os.path.join(d, name + e))), None)
        if not f: raise SystemExit('missing ' + name)
        parts, img = load(f); tex = tex or img; ps = []
        for p in parts:
            n = len(p['pos']) // 3; w = 2 if n < 65536 else 4
            bs = struct.pack('<%df' % (n * 3), *p['pos'])
            bs += b''.join(struct.pack('<4b', q8(p['nrm'][k * 3]), q8(p['nrm'][k * 3 + 1]), q8(p['nrm'][k * 3 + 2]), 0) for k in range(n))
            bs += struct.pack('<%dH' % (n * 2), *[q16(x) for x in p['uv']])
            bs += struct.pack('<%d%s' % (len(p['idx']), 'H' if w == 2 else 'I'), *p['idx'])
            e = {'t': [0, 0, 0], 'm': '', 'n': n, 'i': len(p['idx']), 'o': put(bs), 'w': w}
            if p['col']: e['c'] = p['col']
            ps.append(e)
        models[pre + '_' + name] = {'k': ti, 'p': ps}
    if tex is None: tex = open(os.path.join(d, [x for x in os.listdir(d) if x.endswith('.png')][0]), 'rb').read()
    texs.append([put(tex), len(tex)])

idx = json.dumps({'tex': texs, 'models': models}, separators=(',', ':')).encode()
while (8 + len(idx)) % 4: idx += b' '
with open(out, 'wb') as fh: fh.write(b'KKP1' + struct.pack('<I', len(idx)) + idx + data)
print('wrote', out, len(models), 'models', 8 + len(idx) + len(data), 'bytes')
