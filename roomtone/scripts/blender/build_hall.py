"""Builds the RoomTone concert hall and exports public/models/hall.gltf.json.

Run with Blender (or the `bpy` module):
    blender -b -P scripts/blender/build_hall.py
    python scripts/blender/build_hall.py            # with `pip install bpy`

Style reference: a shoebox symphony hall (colossal cream columns, two balcony tiers, coffered timber ceiling
with downlights, tiered stage, choir seats, arched clerestory). Scale matches RoomTone: 1 unit = 1 m, +Y up in
the GLB (Blender +Z up is converted by the exporter), stage at -Z, audience toward +Z.
Objects are joined per material to keep draw calls low; seats are linked duplicates exported as GPU instances.
"""
import math
import os
import bpy

# Embedded glTF (JSON with base64 buffers) saved with a .json name: static hosts that refuse .glb/.gltf
# still serve it, and GLTFLoader detects the format from the content, not the extension.
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models', 'hall.gltf.json')

# Hall extents in RoomTone coordinates (x, y-up, z). Blender: (x, -z, y).
W = 18.0          # inner width
Z_BACK = -14.0    # stage back wall
Z_FRONT = 22.0    # audience back wall
H = 13.0          # ceiling height
STAGE_Y = 0.55
STAGE_FRONT = -2.0
BAL_Y = (3.4, 6.6)  # balcony floor heights
BAL_X = 6.9         # balcony front line (|x|)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def v(x, y, z):
    """RoomTone (x, y-up, z) -> Blender (x, y, z-up)."""
    return (x, -z, y)


MATS = {}


def mat(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    r, g, bl = (int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    # glTF stores linear colours; convert from sRGB hex.
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    b.inputs['Base Color'].default_value = (lin(r), lin(g), lin(bl), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        er, eg, eb = (int(emit[i:i + 2], 16) / 255 for i in (1, 3, 5))
        b.inputs['Emission Color'].default_value = (lin(er), lin(eg), lin(eb), 1)
        b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m


PLASTER = mat('plaster', '#e9dcc4', 0.82)
STONE = mat('stone_trim', '#d8c7a6', 0.7)
CEIL = mat('wood_ceiling', '#c98a52', 0.45)
CEIL_DARK = mat('wood_ceiling_dark', '#8f5a32', 0.55)
PANEL = mat('wood_panel', '#b07440', 0.4)
STAGE = mat('stage_floor', '#8a5530', 0.32)
FLOOR = mat('floor', '#6b4a33', 0.5)
SEAT = mat('seat_fabric', '#cfae7c', 0.92)
SEAT_FRAME = mat('wood_dark', '#5a3a24', 0.5)
BRASS = mat('brass', '#d9a441', 0.3, 1.0)
DOWNLIGHT = mat('emit_downlight', '#fff2d8', 0.4, 0, '#fff2d8', 12.0)
WINDOW = mat('emit_window', '#ffd9a0', 0.6, 0, '#ffcf8a', 3.0)
DARK = mat('shadow_gap', '#2a1d16', 0.9)

objects = []


def box(name, m, x0, y0, z0, x1, y1, z1):
    """Axis-aligned box from RoomTone min/max corners."""
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=v(cx, cy, cz))
    o = bpy.context.active_object
    o.name = name
    o.scale = (abs(x1 - x0), abs(z1 - z0), abs(y1 - y0))
    o.data.materials.append(m)
    objects.append(o)
    return o


def cyl(name, m, x, y0, z, r, h, verts=24, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=v(x, y0 + h / 2, z))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=v(x, y0 + h / 2, z))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(m)
    objects.append(o)
    return o


# ---------------------------------------------------------------- shell
box('floor', FLOOR, -W / 2, -0.1, Z_BACK, W / 2, 0, Z_FRONT)
box('ceiling_slab', CEIL_DARK, -W / 2, H, Z_BACK, W / 2, H + 0.3, Z_FRONT)
for s in (-1, 1):
    box('side_wall', PLASTER, s * W / 2, 0, Z_BACK, s * (W / 2 + 0.3), H, Z_FRONT)
    # Rusticated base course and string courses
    box('base_course', STONE, s * (W / 2 - 0.05), 0, Z_BACK, s * W / 2, 1.0, Z_FRONT)
box('back_wall', PLASTER, -W / 2, 0, Z_BACK - 0.3, W / 2, H, Z_BACK)
box('front_wall', PLASTER, -W / 2, 0, Z_FRONT, W / 2, H, Z_FRONT + 0.3)
for x in (-1.2, 1.2):  # doors at the audience end
    box('door', PANEL, x - 0.7, 0, Z_FRONT - 0.05, x + 0.7, 2.6, Z_FRONT)

# ---------------------------------------------------------------- stage and risers
box('stage', STAGE, -W / 2 + 0.3, 0, Z_BACK, W / 2 - 0.3, STAGE_Y, STAGE_FRONT)
box('stage_lip', PANEL, -W / 2 + 0.3, 0, STAGE_FRONT, W / 2 - 0.3, STAGE_Y + 0.03, STAGE_FRONT + 0.08)
for i, (zf, zb, y) in enumerate([(-6.0, -8.0, 0.25), (-8.0, -10.0, 0.5), (-10.0, -11.2, 0.75)]):
    box(f'riser_{i}', STAGE, -6.5 + i * 0.4, STAGE_Y, zb, 6.5 - i * 0.4, STAGE_Y + y, zf)
    box(f'riser_edge_{i}', PANEL, -6.5 + i * 0.4, STAGE_Y, zf - 0.04, 6.5 - i * 0.4, STAGE_Y + y, zf)
# Choir seating: rising rows behind the orchestra
for r in range(4):
    y = STAGE_Y + 1.1 + r * 0.42
    z0 = -11.2 - r * 0.7
    box(f'choir_step_{r}', PANEL, -7.5, STAGE_Y, z0 - 0.7, 7.5, y, z0)

# ---------------------------------------------------------------- balconies (two tiers, sides and choir end)
for level, by in enumerate(BAL_Y):
    for s in (-1, 1):
        box(f'balcony_{level}', PANEL, s * BAL_X, by - 0.35, Z_BACK + 2.5, s * (W / 2), by, Z_FRONT)
        box(f'balcony_front_{level}', PANEL, s * (BAL_X - 0.08), by, Z_BACK + 2.5, s * BAL_X, by + 1.0, Z_FRONT)
        box(f'balcony_rail_{level}', BRASS, s * (BAL_X - 0.12), by + 1.0, Z_BACK + 2.5, s * (BAL_X - 0.04), by + 1.06, Z_FRONT)
        # Raised panels on the balcony fronts
        z = Z_BACK + 3.0
        while z < Z_FRONT - 1.0:
            box('balcony_panel', CEIL, s * (BAL_X - 0.12), by + 0.2, z, s * (BAL_X - 0.08), by + 0.8, z + 1.6)
            z += 2.4
    # Rear balcony across the audience end
    box(f'rear_balcony_{level}', PANEL, -W / 2, by - 0.35, Z_FRONT - 3.0, W / 2, by, Z_FRONT)
    box(f'rear_front_{level}', PANEL, -BAL_X, by, Z_FRONT - 3.08, BAL_X, by + 1.0, Z_FRONT - 3.0)

# ---------------------------------------------------------------- colossal columns
COL_TOP = 11.6
z = Z_BACK + 2.6
col_z = []
while z < Z_FRONT - 0.5:
    col_z.append(z)
    z += 2.4
for s in (-1, 1):
    for zc in col_z:
        x = s * (BAL_X + 0.35)
        cyl('column_base', STONE, x, 0, zc, 0.5, 0.5, 8)
        cyl('column_shaft', PLASTER, x, 0.5, zc, 0.36, COL_TOP - 1.4, 24, 0.31)
        cyl('column_neck', BRASS, x, COL_TOP - 0.9, zc, 0.33, 0.08, 24)
        cyl('column_capital', STONE, x, COL_TOP - 0.82, zc, 0.33, 0.82, 16, 0.55)
        box('abacus', STONE, x - 0.6, COL_TOP, zc - 0.6, x + 0.6, COL_TOP + 0.15, zc + 0.6)
    # Entablature running above the columns
    box('architrave', STONE, s * (BAL_X - 0.3), COL_TOP + 0.15, Z_BACK + 1.6, s * (BAL_X + 1.0), COL_TOP + 0.8, Z_FRONT)
    box('cornice', CEIL, s * (BAL_X - 0.5), COL_TOP + 0.8, Z_BACK + 1.6, s * (W / 2), COL_TOP + 1.05, Z_FRONT)
    # Pilasters on the side walls between balcony bays
    for zc in col_z:
        box('pilaster', STONE, s * (W / 2 - 0.25), 0, zc - 0.3, s * (W / 2), COL_TOP, zc + 0.3)

# ---------------------------------------------------------------- clerestory arches behind the choir
for i in range(9):
    x = -7.2 + i * 1.8
    box('window_glow', WINDOW, x - 0.55, 8.2, Z_BACK + 0.02, x + 0.55, 10.4, Z_BACK + 0.06)
    cyl('window_arch', WINDOW, x, 10.4, Z_BACK + 0.04, 0.55, 0.04, 16).rotation_euler = (math.pi / 2, 0, 0)
    box('window_mullion', STONE, x - 0.04, 8.2, Z_BACK + 0.06, x + 0.04, 10.9, Z_BACK + 0.1)
    box('window_pier', STONE, x + 0.62, 7.8, Z_BACK, x + 1.18, 11.4, Z_BACK + 0.25)
box('window_sill', STONE, -W / 2, 7.8, Z_BACK, W / 2, 8.2, Z_BACK + 0.4)
box('organ_case', CEIL_DARK, -3.6, STAGE_Y + 3.0, Z_BACK, 3.6, 7.6, Z_BACK + 0.35)
for i in range(15):  # organ pipes
    hgt = 2.2 + 1.6 * math.sin(i / 14 * math.pi)
    cyl('organ_pipe', BRASS, -3.2 + i * (6.4 / 14), STAGE_Y + 3.4, Z_BACK + 0.55, 0.11, hgt, 12)

# ---------------------------------------------------------------- coffered ceiling
CELL = 2.25
x_lines = [-W / 2 + i * CELL for i in range(int(W / CELL) + 1)]
z_lines = []
z = Z_BACK
while z <= Z_FRONT + 0.01:
    z_lines.append(z)
    z += CELL
for x in x_lines:
    box('beam_x', CEIL, x - 0.16, H - 0.9, Z_BACK, x + 0.16, H, Z_FRONT)
    box('beam_x_fillet', CEIL_DARK, x - 0.24, H - 0.9, Z_BACK, x + 0.24, H - 0.82, Z_FRONT)
for z in z_lines:
    box('beam_z', CEIL, -W / 2, H - 0.9, z - 0.16, W / 2, H, z + 0.16)
    box('beam_z_fillet', CEIL_DARK, -W / 2, H - 0.9, z - 0.24, W / 2, H - 0.82, z + 0.24)
# Two deep transverse girders like the reference photo's main beams
for x in (-2.25, 2.25):
    box('girder', CEIL_DARK, x - 0.3, H - 1.6, Z_BACK, x + 0.3, H - 0.9, Z_FRONT)
# Recessed panel + downlight in every cell
for i in range(len(x_lines) - 1):
    for j in range(len(z_lines) - 1):
        cx = (x_lines[i] + x_lines[i + 1]) / 2
        cz = (z_lines[j] + z_lines[j + 1]) / 2
        box('coffer_panel', CEIL, cx - 0.75, H - 0.35, cz - 0.75, cx + 0.75, H - 0.3, cz + 0.75)
        cyl('downlight', DOWNLIGHT, cx, H - 0.37, cz, 0.09, 0.03, 12)

# ---------------------------------------------------------------- seats (linked duplicates -> GPU instances)
def make_seat():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    cush = bpy.context.active_object
    cush.scale = (0.5, 0.45, 0.1)
    cush.location = v(0, 0.42, 0)
    bpy.ops.mesh.primitive_cube_add(size=1)
    back = bpy.context.active_object
    back.scale = (0.5, 0.08, 0.5)
    back.location = v(0, 0.68, 0.22)
    back.rotation_euler = (0.15, 0, 0)
    for o in (cush, back):
        o.data.materials.append(SEAT)
    bpy.ops.mesh.primitive_cube_add(size=1)
    frame = bpy.context.active_object
    frame.scale = (0.06, 0.5, 0.42)
    frame.location = v(0.26, 0.21, 0.02)
    frame.data.materials.append(SEAT_FRAME)
    for o in (cush, back, frame):
        o.select_set(True)
    bpy.context.view_layer.objects.active = cush
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    seat = bpy.context.active_object
    seat.name = 'seat'
    bpy.ops.object.select_all(action='DESELECT')
    return seat


seat_proto = make_seat()
seat_coll = bpy.data.collections.new('seats')
scene.collection.children.link(seat_coll)
seat_count = 0


def place_seat(x, y, z, rot=0.0):
    global seat_count
    o = seat_proto.copy()  # shares mesh data -> instanced on export
    o.location = v(x, y, z)
    o.rotation_euler = (0, 0, rot)
    seat_coll.objects.link(o)
    seat_count += 1


# Stalls: centre block and two side blocks, rows facing the stage (-Z).
for r in range(17):
    zr = 1.6 + r * 1.0
    for c in range(11):
        place_seat(-3.0 + c * 0.6, 0, zr)
    for s in (-1, 1):
        for c in range(5):
            place_seat(s * (3.8 + c * 0.58), 0, zr)
# Balconies: two rows facing the hall centre.
for by in BAL_Y:
    for s in (-1, 1):
        z = Z_BACK + 3.0
        while z < Z_FRONT - 3.4:
            for row in range(2):
                place_seat(s * (BAL_X + 0.55 + row * 0.75), by + row * 0.25, z, s * math.pi / 2)
            z += 0.62
# Choir rows behind the orchestra, facing the audience.
for r in range(4):
    y = STAGE_Y + 1.1 + r * 0.42
    z0 = -11.2 - r * 0.7 - 0.35
    for c in range(24):
        place_seat(-7.0 + c * 0.6, y, z0, math.pi)
seat_proto.location = v(0, -50, 0)  # parked out of sight; the prototype itself is exported once
print('seats', seat_count)

# ---------------------------------------------------------------- join static meshes per material
bpy.ops.object.select_all(action='DESELECT')
by_mat = {}
for o in objects:
    if o.name not in bpy.data.objects:
        continue
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.select_set(False)
    by_mat.setdefault(o.data.materials[0].name, []).append(o)
for name, objs in by_mat.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = f'hall_{name}'
    bpy.ops.object.shade_flat()

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT[: -len('.gltf.json')] + '.glb',
    export_format='GLB',
    export_apply=True,
    export_gpu_instances=True,
    export_yup=True,
    export_lights=False,
    export_cameras=False,
)
# Blender 5 dropped embedded-glTF export: unpack the GLB (JSON chunk + BIN chunk) into one JSON file.
import base64, json, struct
glb_path = OUT[: -len('.gltf.json')] + '.glb'
with open(glb_path, 'rb') as fh:
    data = fh.read()
json_len = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + json_len])
bin_start = 20 + json_len
bin_len = struct.unpack_from('<I', data, bin_start)[0]
gltf['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(data[bin_start + 8:bin_start + 8 + bin_len]).decode()
with open(OUT, 'w') as fh:
    json.dump(gltf, fh, separators=(',', ':'))
os.remove(glb_path)
print('exported', OUT, os.path.getsize(OUT) // 1024, 'KB')
