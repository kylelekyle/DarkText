import sys
from pathlib import Path

import pytest

pytest.importorskip("bpy")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pipeline  # noqa: E402
from heli import build, qa  # noqa: E402


def test_default_build_passes_qa():
    build.build()
    failed = [r for r in qa.run() if not r["ok"]]
    assert not failed, failed


def test_qa_catches_bad_model():
    import bpy

    build.build()
    bpy.data.objects["MainRotor"].name = "Cube"
    bpy.data.objects["Fuselage"].scale = (2, 2, 2)
    failed = {r["name"] for r in qa.run() if not r["ok"]}
    assert {"meaningful_names", "transforms_applied"} <= failed


def test_target_dimensions_check():
    build.build()
    assert all(r["ok"] for r in qa.run(target_dims=(10.4, 12.2, 3.07)))
    wrong = {r["name"]: r["ok"] for r in qa.run(target_dims=(5, 5, 5))}
    assert wrong["target_dimensions"] is False


def test_cli_end_to_end(tmp_path):
    code = pipeline.main(["all", "--out", str(tmp_path), "--res", "128", "--set", "blade_count=3"])
    assert code == 0
    assert (tmp_path / "helicopter.glb").stat().st_size > 1000
    assert (tmp_path / "helicopter.blend").exists()
    assert (tmp_path / "renders" / "contact_sheet.png").stat().st_size > 1000
