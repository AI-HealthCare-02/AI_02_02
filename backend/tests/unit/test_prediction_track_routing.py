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
