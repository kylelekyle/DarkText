---
name: blender-helicopter
description: Build, check, render and export helicopter (and similar hard-surface vehicle) models in Blender via the headless pipeline in blender-pipeline/. Use when asked to model, tweak, review or export a helicopter or other rotorcraft asset.
---

# Blender helicopter pipeline

Pipeline lives in `blender-pipeline/`. It builds the model with bmesh, runs objective QA, renders six views plus one contact sheet, and exports `.blend` + `.glb`.

## Run it

```bash
cd blender-pipeline
python pipeline.py all --out out/heli                          # bpy module, Python 3.11
blender -b -P pipeline.py -- all --out out/heli                # Blender app, headless
python pipeline.py all --set rotor_radius=5.5 --set blade_count=3 --dims 10.4x11.8x3.2
```

Exit code is 1 when QA fails. `--dims WxLxH` (metres, width x length x height) checks overall size against a real-world target.

## Loop (do not skip the looking step)

1. **Pin down the target.** Get reference images and real dimensions if the user has them. If not, say which real helicopter you are approximating and its dimensions, and pass them with `--dims`.
2. **Build** with `--set` parameters first. If the shape needs something the parameters cannot express, edit `heli/build.py` (add a part function and register it in `build()`), not ad-hoc scene edits.
3. **Look.** Read `out/.../renders/contact_sheet.png` and compare against the reference. Name concrete defects ("tail boom too thin, skids too short") before changing anything.
4. **Fix one or two defects per iteration**, rerun, look again.
5. **QA must pass** before export. Never loosen a check to get green; fix the model.
6. **Export** (`all` does it). Hand over `helicopter.glb`, `helicopter.blend`, and the contact sheet.

## Conventions (the QA enforces most of these)

- Metres, Z up, nose toward +Y, ground at z=0, symmetric about x=0.
- One object per part with a meaningful name (`MainRotor`, not `Cube.003`), all parented under the `Helicopter` empty.
- Transforms baked into geometry (scale 1, rotation 0). Rotors are the exception for origin only: origin sits at the hub.
- Closed, manifold, outward-facing parts with a material assigned. Bake bevels into geometry; do not rely on modifiers, since the exporter and QA read the base mesh.
- Triangle budget defaults to 20k (`--tri-budget`).

## bpy habits

- Prefer `bmesh` and the data API over `bpy.ops`; operators depend on context and break headless.
- Never leave default names, unapplied transforms, or n-gons you did not intend.
- Mirror by building both sides in code, not with a modifier you forget to apply.
- `import bpy` must come before `bmesh`/`mathutils` when using the bpy wheel (handled in `heli/__init__.py`).
- Workbench rendering needs OpenGL; Cycles (default) runs on CPU anywhere. Use `--engine workbench` only on a machine with a GPU/GL.

## Live session instead of headless

If a Blender MCP bridge is connected, use it for interactive tweaks and screenshots, but still finish with the pipeline's QA and export so the result is reproducible.
