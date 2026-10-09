"""Save the .blend and export a glTF binary."""

from pathlib import Path

import bpy


def save_blend(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    return str(path)


def export_glb(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    try:
        import addon_utils
        addon_utils.enable("io_scene_gltf2", default_set=False)
    except Exception:
        pass  # already registered when running inside the Blender app
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_apply=True, export_yup=True)
    return str(path)
