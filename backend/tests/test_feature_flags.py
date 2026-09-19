from app.config import settings
from app.core.feature_flags import is_enabled


def test_flags_are_off_by_default():
    assert settings.feature_flags == ""
    assert is_enabled("anything") is False


def test_flag_enabled_via_settings(monkeypatch):
    monkeypatch.setattr(settings, "feature_flags", "new_scoring_ui,beta_dashboard")
    assert is_enabled("new_scoring_ui") is True
    assert is_enabled("beta_dashboard") is True
    assert is_enabled("something_else") is False


def test_flag_lookup_is_case_and_whitespace_insensitive(monkeypatch):
    monkeypatch.setattr(settings, "feature_flags", " New_Scoring_UI , beta_dashboard ")
    assert is_enabled("new_scoring_ui") is True
    assert is_enabled("NEW_SCORING_UI") is True


def test_empty_flag_names_are_ignored(monkeypatch):
    monkeypatch.setattr(settings, "feature_flags", ",,")
    assert is_enabled("") is False
    assert is_enabled("anything") is False
