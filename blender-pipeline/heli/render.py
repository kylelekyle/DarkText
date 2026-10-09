"""Render a fixed set of views plus a single contact sheet Claude can inspect in one look."""

import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

from .qa import scene_bounds

# name -> (direction from the model toward the camera, orthographic?)
VIEWS = {
    "front": (Vector((0, 1, 0)), True),
    "side": (Vector((1, 0, 0)), True),
    "top": (Vector((0, 0, 1)), True),
    "three_quarter": (Vector((1, 1, 0.6)), False),
    "rear_three_quarter": (Vector((-1, -1, 0.5)), False),
    "underside": (Vector((0.6, 0.6, -0.8)), False),
}
SHEET_ORDER = ["front", "side", "top", "three_quarter", "rear_three_quarter", "underside"]


def _setup_scene(engine, res, samples):
    scene = bpy.context.scene
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("Studio")
    scene.world.color = (0.32, 0.34, 0.37)
    if engine == "cycles":
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = samples
        scene.view_settings.view_transform = "Standard"
        scene.world.use_nodes = True
        background = scene.world.node_tree.nodes["Background"]
        background.inputs["Color"].default_value = (0.32, 0.34, 0.37, 1.0)
        background.inputs["Strength"].default_value = 1.4
        for name, energy, rotation in (("Key", 4.0, (0.9, 0.2, 0.6)), ("Fill", 1.5, (-0.8, 0.1, -2.4))):
            sun = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
            sun.data.energy = energy
            sun.rotation_euler = rotation
            scene.collection.objects.link(sun)
    else:
        scene.render.engine = "BLENDER_WORKBENCH"
        shading = scene.display.shading
        shading.light = "STUDIO"
        shading.color_type = "MATERIAL"
        shading.show_object_outline = True
        scene.display.render_aa = "8"


def _camera(name, center, size, direction, ortho):
    cam_data = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    direction = direction.normalized()
    if ortho:
        # fit the two axes visible from this direction
        visible = [size[i] for i in range(3) if abs(direction[i]) < 0.5]
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = max(visible) * 1.12
        dist = max(size) * 2
    else:
        cam_data.lens = 50
        half_fov = math.atan(cam_data.sensor_width / 2 / cam_data.lens)
        dist = 0.42 * size.length / math.sin(half_fov)
    cam.location = center + direction * dist
    if direction.z > 0.999:  # straight down: default orientation, nose toward image top
        cam.rotation_euler = (0, 0, 0)
    else:
        cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    cam_data.clip_end = dist * 4
    return cam


def _contact_sheet(paths, out_path, cols=3):
    images = [bpy.data.images.load(str(p)) for p in paths]
    w, h = images[0].size
    tiles = [np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4) for img in images]
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    sheet = np.vstack(rows[::-1])  # Blender pixel rows run bottom-up
    out = bpy.data.images.new("contact_sheet", sheet.shape[1], sheet.shape[0], alpha=False)
    out.pixels = sheet.ravel()
    out.filepath_raw = str(out_path)
    out.file_format = "PNG"
    out.save()
    for img in images + [out]:
        bpy.data.images.remove(img)


def render_views(out_dir, engine="cycles", res=512, samples=24):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    _setup_scene(engine, res, samples)
    lo, hi = scene_bounds()
    center, size = (lo + hi) / 2, hi - lo

    paths = {}
    for name in SHEET_ORDER:
        direction, ortho = VIEWS[name]
        cam = _camera(f"Cam_{name}", center, size, direction, ortho)
        scene.camera = cam
        path = out_dir / f"{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths[name] = path
    sheet = out_dir / "contact_sheet.png"
    _contact_sheet([paths[n] for n in SHEET_ORDER], sheet)
    return {"views": {k: str(v) for k, v in paths.items()}, "contact_sheet": str(sheet)}
