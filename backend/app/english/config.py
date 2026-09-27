from datetime import date
from pathlib import Path
from pydantic_settings import BaseSettings

_BASE_DIR = Path(__file__).resolve().parent


class EnglishSettings(BaseSettings):
    auto_placement_enabled: bool = False
    require_seb: bool = False
    seb_browser_exam_key: str = ""
    public_api_url: str = ""

    applicant_token_expiry_days: int = 7
    admin_token_expiry_hours: int = 24

    platform_api_key: str = "dev-platform-key"
    platform_webhook_url: str = ""
    webhook_secret: str = "dev-webhook-secret"

    admin_email: str = "admin@invision.demo"
    admin_password: str = "admin123"

    gemini_model: str = "gemini-2.5-flash"
    whisper_model: str = "small"
    asr_backend: str = "fake"  # "fake" | "whisper"
    languagetool_url: str = "http://localhost:8010"
    languagetool_backend: str = "fake"  # "fake" | "http"

    storage_backend: str = "local"
    storage_local_path: str = "uploads/english"
    s3_bucket: str = ""
    aws_region: str = "us-east-1"

    ielts_verifier: str = "mock"
    ielts_fixtures_path: str = str(_BASE_DIR / "data" / "ielts_fixtures.json")

    application_deadline: date = date(2027, 8, 1)
    ielts_bachelor_min_overall: float = 6.0

    section_seconds: int = 300
    section_grace_seconds: int = 5
    max_attempts: int = 1

    placement_min_mean: int = 4  # B2
    placement_min_skill: int = 3  # B1

    grader_runs: int = 3

    cefr_cuts_path: str = str(_BASE_DIR / "data" / "config" / "cefr_cuts.yaml")
    integrity_weights_path: str = str(_BASE_DIR / "data" / "config" / "integrity.yaml")
    item_bank_dir: str = str(_BASE_DIR / "data" / "item_bank")

    model_config = {"env_file": ".env", "extra": "ignore"}


english_settings = EnglishSettings()
