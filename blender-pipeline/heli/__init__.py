"""Headless Blender helicopter pipeline: build -> qa -> render -> export."""

import bpy  # noqa: F401  (must load before bmesh/mathutils are importable with the bpy wheel)
