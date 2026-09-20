from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str
    db_host: str
    db_port: int = 5432
    db_user: str = "postgres"
    db_name: str = "postgres"
    db_use_iam_auth: bool = True
    db_region: str = "us-east-1"
    aws_region: str = "eu-west-1"
    aws_s3_bucket: str = ""
    model: str = "gemini-3.1-flash-live-preview"
    max_interview_duration: int = 300
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    max_upload_size_mb: int = 500
    presigned_url_expiry_hours: int = 1
    admin_creation_secret: str = ""

    # Live-interview silence check-in behavior (see app/api/websocket.py).
    checkin_silence_interval_seconds: int = 20
    checkin_wait_seconds: int = 15
    max_checkins: int = 2

    # Evaluation-save robustness (see app/interview/handler.py).
    evaluation_save_max_attempts: int = 3
    evaluation_save_retry_delay_seconds: float = 0.5

    # Feature flags (see app/core/feature_flags.py). Comma-separated flag
    # names, e.g. "new_scoring_ui,beta_dashboard". Empty means every flag is
    # off, which is the default in every environment.
    feature_flags: str = ""

    # Live-interview connect-attempt throttling (see app/interview/handler.py).
    # Each websocket connect opens a brand-new billable Gemini Live session, so
    # unlimited reconnects to one interview session would be an open-ended cost
    # and abuse vector.
    max_connect_attempts_per_session: int = 8
    connect_attempt_window_seconds: int = 600

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
