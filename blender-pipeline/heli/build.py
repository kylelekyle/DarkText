"""Parametric helicopter blockout.

Conventions: metres, Z up, nose toward +Y, ground at z=0, left/right symmetric about x=0.
Every part is a closed, outward-facing mesh with transforms baked in (scale 1, rotation 0).
Rotors keep their origin at the hub so they can be spun without re-pivoting.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

DEFAULTS = {
    "fuselage_length": 4.2,
    "fuselage_width": 1.6,
    "fuselage_height": 1.9,
    "ground_clearance": 0.5,
    "tail_length": 4.6,
    "rotor_radius": 5.2,
    "blade_count": 4,
    "blade_chord": 0.28,
    "skid_length": 3.6,
    "skid_span": 1.7,
}

ROOT_NAME = "Helicopter"


def _ellipsoid(bm, radii, center, segments=32, rings=16):
    ret = bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    matrix = Matrix.Translation(center) @ Matrix.Diagonal((*radii, 1.0))
    bmesh.ops.transform(bm, matrix=matrix, verts=ret["verts"])


def _box(bm, size, center, rot_z=0.0, bevel=0.0):
    ret = bmesh.ops.create_cube(bm, size=1.0)
    matrix = (
        Matrix.Rotation(rot_z, 4, "Z")
        @ Matrix.Translation(center)
        @ Matrix.Diagonal((*size, 1.0))
    )
    bmesh.ops.transform(bm, matrix=matrix, verts=ret["verts"])
    if bevel > 0:
        edges = list({e for v in ret["verts"] for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2, affect="EDGES")


def _tube(bm, p0, p1, r0, r1, segments=16):
    """Tapered cylinder from p0 (radius r0) to p1 (radius r1)."""
    p0, p1 = Vector(p0), Vector(p1)
    direction = p1 - p0
    up = "X" if abs(direction.normalized().y) > 0.9 else "Y"
    ret = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=r0, radius2=r1, depth=direction.length,
    )
    matrix = Matrix.Translation((p0 + p1) / 2) @ direction.to_track_quat("Z", up).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=matrix, verts=ret["verts"])


def _material(name, color, metallic=0.0, roughness=0.5, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    mat.diffuse_color = (*color, alpha)
    if alpha < 1.0:
        try:
            mat.surface_render_method = "BLENDED"
        except (AttributeError, TypeError):
            pass
    return mat


def _object(name, bm, material, parent, collection, location=(0.0, 0.0, 0.0), smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.parent = parent
    collection.objects.link(obj)
    return obj


def build(params=None):
    """Clear the scene and build the helicopter. Returns the resolved parameters."""
    p = {**DEFAULTS, **(params or {})}
    p["blade_count"] = int(p["blade_count"])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    collection = bpy.data.collections.new(ROOT_NAME)
    scene.collection.children.link(collection)
    root = bpy.data.objects.new(ROOT_NAME, None)
    collection.objects.link(root)

    paint = _material("Paint", (0.16, 0.24, 0.17), roughness=0.45)
    glass = _material("Glass", (0.12, 0.2, 0.28), roughness=0.05, alpha=0.45)
    metal = _material("DarkMetal", (0.07, 0.07, 0.08), metallic=0.8, roughness=0.4)

    length, width, height = p["fuselage_length"], p["fuselage_width"], p["fuselage_height"]
    zc = p["ground_clearance"] + height / 2
    roof = zc + height / 2
    tail_end = -length / 2 - p["tail_length"]
    boom_z = zc + height * 0.15

    bm = bmesh.new()
    _ellipsoid(bm, (width / 2, length / 2, height / 2), (0, 0, zc))
    _object("Fuselage", bm, paint, root, collection, smooth=True)

    bm = bmesh.new()
    _ellipsoid(bm, (width * 0.43, length * 0.28, height * 0.4), (0, length * 0.2, zc + height * 0.12))
    _object("Canopy", bm, glass, root, collection, smooth=True)

    bm = bmesh.new()
    _tube(bm, (0, -length / 2 + 0.4, boom_z), (0, tail_end, boom_z), 0.30, 0.10)
    _object("TailBoom", bm, paint, root, collection, smooth=True)

    bm = bmesh.new()
    _box(bm, (0.05, 0.8, 1.0), (0, tail_end + 0.2, boom_z + 0.5), bevel=0.01)
    _object("TailFin", bm, paint, root, collection)

    bm = bmesh.new()
    _box(bm, (0.015, 0.09, 1.0), (0, 0, 0), bevel=0.003)
    _box(bm, (0.015, 1.0, 0.09), (0, 0, 0), bevel=0.003)
    _object("TailRotor", bm, metal, root, collection, location=(0.07, tail_end + 0.1, boom_z + 0.55))

    bm = bmesh.new()
    _box(bm, (width * 0.55, length * 0.4, 0.4), (0, -0.2, roof + 0.05), bevel=0.06)
    _object("Cowling", bm, paint, root, collection)

    hub_z = roof + 0.61
    bm = bmesh.new()
    _tube(bm, (0, -0.1, roof + 0.1), (0, -0.1, hub_z), 0.07, 0.07)
    _object("Mast", bm, metal, root, collection)

    bm = bmesh.new()
    _tube(bm, (0, 0, -0.06), (0, 0, 0.06), 0.2, 0.2)
    radius, count = p["rotor_radius"], p["blade_count"]
    for i in range(count):
        _box(
            bm, (radius - 0.2, p["blade_chord"], 0.035), ((0.2 + radius) / 2, 0, 0),
            rot_z=i * 2 * math.pi / count, bevel=0.008,
        )
    _object("MainRotor", bm, metal, root, collection, location=(0, -0.1, hub_z))

    bm = bmesh.new()
    half_span, tube_r = p["skid_span"] / 2, 0.04
    skid_half = p["skid_length"] / 2
    for side in (-1, 1):
        _tube(bm, (side * half_span, -skid_half, tube_r), (side * half_span, skid_half, tube_r), tube_r, tube_r, 12)
        for y in (-length * 0.25, length * 0.25):
            _tube(bm, (side * half_span, y, tube_r), (side * width * 0.3, y, p["ground_clearance"] + 0.15), 0.035, 0.035, 12)
    _object("Skids", bm, metal, root, collection)

    return p
