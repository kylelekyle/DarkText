"""Helicopter pipeline CLI.

  python pipeline.py all --out out/heli                      # bpy module (Python 3.11)
  blender -b -P pipeline.py -- all --out out/heli            # Blender app, headless

Steps: build, qa, render, export (or `all`). Exit code 1 if QA fails.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from heli import build, export, qa, render  # noqa: E402


def _parse(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["build", "qa", "render", "export", "all"])
    ap.add_argument("--out", default="out/helicopter", help="output directory")
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE",
                    help=f"override a build parameter; keys: {', '.join(build.DEFAULTS)}")
    ap.add_argument("--dims", metavar="WxLxH", help="real-world target size in metres, e.g. 10.4x11.8x3.2")
    ap.add_argument("--tol", type=float, default=0.05, help="dimension tolerance (default 0.05 = 5%%)")
    ap.add_argument("--engine", choices=["workbench", "cycles"], default="cycles",
                    help="cycles runs anywhere (CPU); workbench is faster but needs OpenGL")
    ap.add_argument("--res", type=int, default=512)
    ap.add_argument("--tri-budget", type=int, default=20000)
    return ap.parse_args(argv)


def _overrides(pairs):
    out = {}
    for pair in pairs:
        key, _, value = pair.partition("=")
        if key not in build.DEFAULTS:
            sys.exit(f"unknown parameter {key!r}; valid: {', '.join(build.DEFAULTS)}")
        out[key] = float(value)
    return out


def main(argv):
    args = _parse(argv)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    steps = ["build", "qa", "render", "export"] if args.step == "all" else [args.step]
    report = {}

    # Every run starts from a fresh build so steps are reproducible from parameters alone.
    report["params"] = build.build(_overrides(args.set))

    if "qa" in steps:
        dims = tuple(float(v) for v in args.dims.lower().split("x")) if args.dims else None
        report["qa"] = qa.run(target_dims=dims, tolerance=args.tol, tri_budget=args.tri_budget)
        for r in report["qa"]:
            print(f"[{'PASS' if r['ok'] else 'FAIL'}] {r['name']}: {r['detail']}")
    if "render" in steps:
        report["render"] = render.render_views(out / "renders", engine=args.engine, res=args.res)
        print("contact sheet:", report["render"]["contact_sheet"])
    if "export" in steps:
        report["blend"] = export.save_blend(out / "helicopter.blend")
        report["glb"] = export.export_glb(out / "helicopter.glb")
        print("wrote", report["blend"], "and", report["glb"])

    (out / "report.json").write_text(json.dumps(report, indent=2))
    return 0 if all(r["ok"] for r in report.get("qa", [])) else 1


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    sys.exit(main(argv))
