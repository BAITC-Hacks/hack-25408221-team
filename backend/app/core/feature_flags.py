"""Feature flags: every flag defaults to off. Enable one for an environment
by adding its name to the comma-separated FEATURE_FLAGS env var (see
app/config.py and .env.example). No flag names are hardcoded here -- callers
pass whatever name they choose, e.g. is_enabled("new_scoring_ui")."""

from app.config import settings


def is_enabled(flag_name: str) -> bool:
    enabled = {
        name.strip().lower()
        for name in settings.feature_flags.split(",")
        if name.strip()
    }
    return flag_name.strip().lower() in enabled
