# Blender 5.x headless: crater-lake terrain + torii + stone lanterns -> lake.glb
# usage: blender -b --factory-startup -P build_lake.py -- <out.glb>
import bpy, bmesh, math, sys, random
from mathutils import Vector, noise

out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(7)

def col_attr(me, fn):
    a = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    me.update()
    for v in me.vertices:
        a.data[v.index].color = (*fn(v.co, v.normal), 1.0)

# ---------- terrain: a ring of hills around a round lake, far ridges behind ----------
N, S = 150, 260.0
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=N, y_segments=N, size=S / 2)
for v in bm.verts:
    x, y = v.co.x, v.co.y
    r = math.hypot(x, y)
    n1 = noise.fractal(Vector((x * .03, y * .03, 0)), 1.0, 2.0, 5)
    n2 = noise.noise(Vector((x * .11, y * .11, 3.3)))
    rim = math.exp(-((r - 52) / 13) ** 2) * (15 + 7 * n1)          # the crater rim
    far = max(0, (r - 75) / 50) ** 1.3 * (28 + 14 * n1)            # distant ranges
    bowl = -4 * max(0, 1 - r / 40) ** 2                             # lake floor
    h = rim + far + bowl + 1.6 * n2
    if r < 36: h = min(h, -0.6)                                     # keep the lake open
    v.co.z = h
me = bpy.data.meshes.new("terrain")
bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new("terrain", me)
bpy.context.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
mod = ob.modifiers.new("dec", "DECIMATE"); mod.ratio = 0.2
bpy.ops.object.modifier_apply(modifier="dec")
for p in me.polygons: p.use_smooth = True
def tcol(v, nrm):
    k = max(0.0, min(1.0, (v.z + 2) / 30))
    slope = 1 - abs(nrm.z)
    base = Vector((0.10, 0.11, 0.20)).lerp(Vector((0.30, 0.24, 0.36)), k)   # indigo foot -> dusk-lit ridge
    base = base.lerp(Vector((0.06, 0.08, 0.12)), slope * .5)                 # cliffs darker
    if v.z < 0.4: base = Vector((0.14, 0.12, 0.16))                          # shoreline
    return tuple(base)
col_attr(me, tcol)

# ---------- torii standing in the lake ----------
VERM, DARK = (0.78, 0.17, 0.10), (0.08, 0.06, 0.07)
parts = []
def add(prim, loc, scale, rot=(0, 0, 0), color=VERM, **kw):
    prim(location=loc, rotation=rot, **kw)
    o = bpy.context.active_object; o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o["c"] = color; parts.append(o); return o
cyl = bpy.ops.mesh.primitive_cylinder_add
cube = bpy.ops.mesh.primitive_cube_add
for sx in (-1, 1):
    add(cyl, (sx * 2.1, 0, 2.6), (1, 1, 1), vertices=20, radius=0.26, depth=5.8)          # hashira
    add(cyl, (sx * 2.1, 0, -0.1), (1, 1, 1), color=DARK, vertices=20, radius=0.34, depth=0.9)  # kamaki
add(cube, (0, 0, 4.25), (2.9, 0.16, 0.16))                                               # nuki
add(cube, (0, 0, 4.95), (0.18, 0.14, 0.42))                                              # gakuzuka
# kasagi: an upswept top beam (bent cube)
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 5.55))
kg = bpy.context.active_object; kg.scale = (3.6, 0.32, 0.17)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.subdivide(number_cuts=14); bpy.ops.object.mode_set(mode="OBJECT")
for v in kg.data.vertices: v.co.z += 0.045 * v.co.x ** 2
kg["c"] = DARK; parts.append(kg)
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 5.25))
sm = bpy.context.active_object; sm.scale = (3.2, 0.24, 0.13)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.subdivide(number_cuts=12); bpy.ops.object.mode_set(mode="OBJECT")
for v in sm.data.vertices: v.co.z += 0.03 * v.co.x ** 2
sm["c"] = VERM; parts.append(sm)
for o in parts:
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.03; bv.segments = 1
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier="b")
    c = o["c"]; col_attr(o.data, lambda v, n, c=c: c)
bpy.ops.object.select_all(action="DESELECT")
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
torii = bpy.context.active_object; torii.name = "torii"
# placed in the lake by the film (JS)

# ---------- stone lanterns (toro) on the shore ----------
parts = []
STONE = (0.32, 0.31, 0.33)
add(cyl, (0, 0, 0.15), (1, 1, 1), color=STONE, vertices=6, radius=0.55, depth=0.3)
add(cyl, (0, 0, 0.9), (1, 1, 1), color=STONE, vertices=12, radius=0.16, depth=1.3)
add(cyl, (0, 0, 1.6), (1, 1, 1), color=STONE, vertices=6, radius=0.45, depth=0.2)
add(cube, (0, 0, 1.98), (0.32, 0.32, 0.28), color=(1.0, 0.78, 0.42))                     # fire box (lit)
add(cyl, (0, 0, 2.38), (1, 1, 1), color=STONE, vertices=6, radius=0.7, depth=0.14)
add(bpy.ops.mesh.primitive_cone_add, (0, 0, 2.62), (1, 1, 1), color=STONE, vertices=6, radius1=0.62, radius2=0.05, depth=0.4)
for o in parts:
    c = o["c"]; col_attr(o.data, lambda v, n, c=c: c)
bpy.ops.object.select_all(action="DESELECT")
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
toro = bpy.context.active_object; toro.name = "toro"
# placed along the shore by the film (JS)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True,
                          export_materials="NONE", export_texcoords=False, export_normals=False, export_vertex_color="ACTIVE", export_active_vertex_color_when_no_material=True,
                          export_all_vertex_colors=False, export_yup=True)
print("WROTE", out, sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"), "faces")
