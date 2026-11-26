"""Author the two Afterlife set pieces. Run with Blender in background mode."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

output = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
parts = {}
palette = {
    "bronze": 0x52706A, "patina": 0x36514F, "brass": 0xAA8652,
    "iron": 0x373747, "wood": 0x4B3035, "walnut": 0x70474A,
    "canvas": 0x29233B, "border": 0x9C7550, "paint": 0x4A405D,
}
materials = {}
for name, color in palette.items():
    material = bpy.data.materials.new(name.title())
    material.diffuse_color = tuple(((color >> (8 * i)) & 255) / 255 for i in (2, 1, 0)) + (1,)
    materials[name] = material


def register(name, group, material):
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(materials[material])
    parts.setdefault(group, []).append(obj)
    return obj


def cube(name, group, material, position, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = register(name, group, material)
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Worn edges", "BEVEL")
    bevel.width = min(.023, min(size) / 4)
    bevel.segments = 1
    return obj


def torus(name, group, material, radius, section, position, ratio=1):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=5,
                                    location=position, major_radius=radius, minor_radius=section)
    obj = register(name, group, material)
    obj.scale.y = ratio
    return obj


def jewel(name, group, material, position, size):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=position)
    register(name, group, material).scale = size


# The crown starts just under its pivot. The return wall creates a genuinely
# hollow lip so the low shot can see the clapper and the inside of the bell.
profile = [
    (.10, -.10), (.20, -.11), (.32, -.20), (.40, -.30),
    (.44, -.47), (.48, -.65), (.57, -.80), (.71, -.89),
    (.73, -.95), (.66, -.97), (.62, -.90), (.53, -.83),
    (.44, -.67), (.38, -.48), (.32, -.28), (.18, -.20), (.08, -.18)
]
segments = 32
vertices = [(r*math.cos(a),r*math.sin(a),z) for r,z in profile
            for a in (i*math.tau/segments for i in range(segments))]
faces = [(k*segments+i,k*segments+(i+1)%segments,(k+1)*segments+(i+1)%segments,(k+1)*segments+i)
         for k in range(len(profile)-1) for i in range(segments)]
mesh = bpy.data.meshes.new("Cast profile with return wall")
mesh.from_pydata(vertices, [], [tuple(reversed(face)) for face in faces])
bell = bpy.data.objects.new("Hollow cast bell", mesh)
scene.collection.objects.link(bell)
parts["bell"] = [bell]
for name in ("bronze","patina","brass"):
    mesh.materials.append(materials[name])
for polygon in mesh.polygons:
    band = polygon.index // segments
    polygon.material_index = 2 if band in (6,8) else 1 if band >= 9 or polygon.index % segments in (3,14,23) else 0
for z,r in [(-.38,.425),(-.72,.518),(-.92,.724)]:
    torus("Cast band", "bell", "brass", r,.012,(0,0,z))
jewel("Clapper", "bell", "iron", (0,0,-.93),(.105,.105,.15))
cube("Clapper stem","bell","iron",(0,0,-.56),(.04,.04,.64))
cube("Yoke","bell","walnut",(0,0,-.055),(1.35,.22,.16))
for x in (-.50,.50):
    jewel("Yoke rivet","bell","brass",(x,-.118,-.05),(.065,.037,.065))

# Portrait front faces -Y in Blender, which is +Z in Afterlife.
cube("Backboard","portrait","canvas",(0,.022,.01),(1.34,.075,1.85))
for x in (-.72,.72):
    cube("Side stile","portrait","wood",(x,-.031,.01),(.16,.15,2.08))
    cube("Gilt bead","portrait","border",(x*.91,-.113,.01),(.032,.042,1.94))
for z in (-.97,.99):
    cube("Cross rail","portrait","walnut",(0,-.031,z),(1.57,.15,.16))
    cube("Rail bead","portrait","border",(0,-.114,z*.914),(1.33,.039,.037))
    for x in (-.72,.72):
        jewel("Corner rosette","portrait","brass",(x,-.14,z),(.086,.034,.086))
for x in (-.37,.37):
    strip=cube("Painted curtain","portrait","paint",(x,-.022,.30),(.23,.012,1.02))
    strip.rotation_euler.y=x*.13
crest=cube("Crest shield","portrait","border",(0,-.12,1.082),(.25,.12,.25))
crest.rotation_euler.y=math.pi/4
jewel("Crest inlay","portrait","wood",(0,-.19,1.082),(.084,.028,.084))

for x in (-.57,.57):
    cube("Easel foot","portrait","wood",(x,.09,-1.18),(.14,.47,.13))
    rear=cube("Easel leg","portrait","wood",(x,.15,-.76),(.11,.12,.86))
    rear.rotation_euler.x=.18
cube("Easel stretcher","portrait","walnut",(0,.13,-1.06),(1.24,.11,.14))

preview_offset = Vector((2.1,0,-.08))
for obj in parts["portrait"]:
    obj.location += preview_offset
depsgraph = bpy.context.evaluated_depsgraph_get()
payload = {"materials":palette,"props":{}}
for group, objects in parts.items():
    batches = {}
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        for tri in mesh.loop_triangles:
            color = obj.data.materials[tri.material_index].name.lower()
            for vertex in tri.vertices:
                point = obj.matrix_world @ mesh.vertices[vertex].co
                if group == "portrait":
                    point -= preview_offset
                batches.setdefault(color, []).extend(round(v,5) for v in (point.x,point.z,-point.y))
        evaluated.to_mesh_clear()
    payload["props"][group] = batches
    print(group, sum(len(v)//9 for v in batches.values()),"triangles")

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output / "Bell and portrait.blend"))
(output / "bell-and-portrait.json").write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
