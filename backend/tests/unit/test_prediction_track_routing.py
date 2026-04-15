from pathlib import Path

import backend.services.model_inference as model_inference_module
from backend.models.enums import Relation, UserGroup
from backend.services.model_inference import ModelInferenceService
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
    monkeypatch.setattr(model_inference_module, "MODEL_ARTIFACT_DIR", tmp_path / "missing")
    monkeypatch.setattr(model_inference_module, "PROJECT_ROOT", Path(tmp_path))

    availability = ModelInferenceService().get_availability()

    assert availability["enabled"] is False
    assert availability["status"] == "artifacts_missing"
    assert availability["missing_paths"]
