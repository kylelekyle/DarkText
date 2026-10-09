"""Objective checks on the current scene. Each check returns a dict: name, ok, detail."""

import re

import bmesh
import bpy
from mathutils import Vector

DEFAULT_NAME = re.compile(r"^(Cube|Sphere|Cylinder|Cone|Plane|Circle|Torus|Mesh|Empty|Icosphere)(\.\d+)?$")


def _meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def _world_bounds(objs):
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(c[i] for c in corners) for i in range(3)))
    hi = Vector((max(c[i] for c in corners) for i in range(3)))
    return lo, hi


def scene_bounds():
    """World-space (min, max) of all meshes."""
    return _world_bounds(_meshes())


def run(target_dims=None, tolerance=0.05, tri_budget=20000, allow_open=()):
    """target_dims: optional (x, y, z) real-world size in metres (width, length, height)."""
    meshes = _meshes()
    results = []

    def check(name, ok, detail=""):
        results.append({"name": name, "ok": bool(ok), "detail": detail})

    if not meshes:
        check("has_meshes", False, "scene contains no mesh objects")
        return results

    bad = [o.name for o in meshes if any(abs(s - 1) > 1e-4 for s in o.scale) or any(abs(r) > 1e-4 for r in o.rotation_euler)]
    check("transforms_applied", not bad, f"scale/rotation not applied on: {bad}" if bad else "")

    bad = [o.name for o in bpy.context.scene.objects if DEFAULT_NAME.match(o.name)]
    check("meaningful_names", not bad, f"default names: {bad}" if bad else "")

    bad = [o.name for o in meshes if not any(slot.material for slot in o.material_slots)]
    check("materials_assigned", not bad, f"no material: {bad}" if bad else "")

    open_parts, flipped, loose = [], [], []
    for obj in meshes:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        if obj.name not in allow_open:
            if any(not e.is_manifold for e in bm.edges):
                open_parts.append(obj.name)
            if bm.calc_volume(signed=True) <= 0:
                flipped.append(obj.name)
        if any(not v.link_edges for v in bm.verts):
            loose.append(obj.name)
        bm.free()
    check("closed_manifold", not open_parts, f"non-manifold edges on: {open_parts}" if open_parts else "")
    check("normals_outward", not flipped, f"inward or zero volume: {flipped}" if flipped else "")
    check("no_loose_verts", not loose, f"loose verts on: {loose}" if loose else "")

    tris = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        tris += len(obj.data.loop_triangles)
    check("triangle_budget", tris <= tri_budget, f"{tris} tris (budget {tri_budget})")

    lo, hi = _world_bounds(meshes)
    size = hi - lo
    check("grounded", abs(lo.z) < 0.01, f"lowest point z={lo.z:.3f}")
    # Rotors are excluded: an odd blade count is legitimately asymmetric.
    airframe = [o for o in meshes if "Rotor" not in o.name] or meshes
    air_lo, air_hi = _world_bounds(airframe)
    check("centered_x", abs((air_lo.x + air_hi.x) / 2) < 0.01, f"airframe x centre={(air_lo.x + air_hi.x) / 2:.3f}")
    if target_dims:
        errors = [abs(a - b) / b for a, b in zip(size, target_dims)]
        check(
            "target_dimensions", max(errors) <= tolerance,
            f"got {size.x:.2f}x{size.y:.2f}x{size.z:.2f} m, want "
            f"{target_dims[0]}x{target_dims[1]}x{target_dims[2]} m (tol {tolerance:.0%})",
        )
    else:
        check("sane_dimensions", 0.1 < max(size) < 60, f"{size.x:.2f}x{size.y:.2f}x{size.z:.2f} m (width x length x height)")
    return results
