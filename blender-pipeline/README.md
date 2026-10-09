# Blender helicopter pipeline

Headless, reproducible helicopter modeling: **build → QA → render → export**.
Claude drives it through the `blender-helicopter` skill in `.claude/skills/`.

## Setup

```bash
python3.11 -m venv .venv && . .venv/bin/activate     # the bpy wheel needs Python 3.11
pip install -r requirements.txt
python pipeline.py all --out out/heli
```

Or with the Blender app (no pip needed): `blender -b -P pipeline.py -- all --out out/heli`.

Outputs in `out/heli/`: `helicopter.blend`, `helicopter.glb`, `renders/contact_sheet.png` (six views), `report.json`.

## Options

| Flag | Meaning |
|---|---|
| `--set KEY=VALUE` | override a parameter (`rotor_radius`, `blade_count`, `fuselage_length`, `tail_length`, ...) |
| `--dims WxLxH` | real-world target size in metres; QA fails if off by more than `--tol` (default 5%) |
| `--engine` | `cycles` (default, CPU, runs anywhere) or `workbench` (fast, needs OpenGL) |
| `--tri-budget` | max triangles (default 20000) |

## What QA checks

Transforms applied, no default object names, materials assigned, closed manifold meshes, outward normals, no loose vertices, triangle budget, model sits on the ground and is centred on x, and overall dimensions.

## Tests

```bash
pip install -r requirements-dev.txt && pytest
```

## Optional: live Blender control

For interactive work, add a Blender MCP bridge such as [blender-claude-mcp](https://github.com/Gaius114/blender-claude-mcp) or [claude-blender](https://github.com/minihellboy/claude-blender) (follow each repo's README; they run arbitrary Python inside Blender, so read the code first). Use `fake-bpy-module` in the dev requirements for editor autocompletion.
