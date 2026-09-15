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
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    max_upload_size_mb: int = 500
    presigned_url_expiry_hours: int = 1
    admin_creation_secret: str = ""
    sapling_api_key: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
