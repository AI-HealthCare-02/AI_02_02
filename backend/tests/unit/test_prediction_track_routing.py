import importlib
import sys
import types
from pathlib import Path

from backend.models.enums import Relation, UserGroup
from backend.services.prediction import (
    DIABETIC_TRACK,
    NON_DIABETIC_TRACK,
    resolve_model_track,
)


def test_resolve_model_track_for_diagnosed_relation():
    assert resolve_model_track(relation=Relation.DIAGNOSED) == DIABETIC_TRACK


def test_resolve_model_track_for_prediabetes_relation():
    assert resolve_model_track(relation=Relation.PREDIABETES) == DIABETIC_TRACK


def test_resolve_model_track_for_group_b():
    assert resolve_model_track(user_group=UserGroup.B) == DIABETIC_TRACK


def test_resolve_model_track_for_group_c():
    assert resolve_model_track(user_group=UserGroup.C) == NON_DIABETIC_TRACK


def test_resolve_model_track_defaults_to_non_diabetic():
    assert resolve_model_track() == NON_DIABETIC_TRACK


def test_model_inference_reports_missing_artifacts(tmp_path, monkeypatch):
    fake_joblib = types.SimpleNamespace(load=lambda *_args, **_kwargs: None)
    fake_pandas = types.SimpleNamespace(DataFrame=lambda *_args, **_kwargs: None)
    monkeypatch.setitem(sys.modules, "joblib", fake_joblib)
    monkeypatch.setitem(sys.modules, "pandas", fake_pandas)

    model_inference_module = importlib.import_module("backend.services.model_inference")
    monkeypatch.setattr(model_inference_module, "MODEL_ARTIFACT_ROOT", tmp_path / "missing")
    monkeypatch.setattr(model_inference_module, "PROJECT_ROOT", Path(tmp_path))

    availability = model_inference_module.ModelInferenceService().get_availability()

    assert availability["enabled"] is False
    assert availability["status"] == "artifacts_missing"
    assert availability["missing_paths"]
