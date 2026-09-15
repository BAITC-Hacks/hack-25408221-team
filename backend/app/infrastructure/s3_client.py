import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

_LOCAL_DIR = Path("uploads")


class S3Client:
    def __init__(self):
        self.bucket = settings.aws_s3_bucket
        self._local_mode = not self.bucket

        if self._local_mode:
            _LOCAL_DIR.mkdir(parents=True, exist_ok=True)
            logger.info("S3 not configured — using local file storage at ./uploads/")
        else:
            import boto3
            from botocore.config import Config

            self._s3 = boto3.client(
                "s3",
                region_name=settings.aws_region,
                config=Config(
                    retries={"max_attempts": 3, "mode": "standard"},
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                ),
            )

    async def upload_file(
        self, file_key: str, file_content: bytes, content_type: str = "video/webm"
    ) -> str:
        if self._local_mode:
            dest = _LOCAL_DIR / file_key
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(file_content)
            logger.info(f"Saved locally: {dest}")
            return file_key

        from botocore.exceptions import ClientError

        try:
            self._s3.put_object(
                Bucket=self.bucket,
                Key=file_key,
                Body=file_content,
                ContentType=content_type,
            )
            logger.info(f"Uploaded to S3: {file_key}")
            return file_key
        except ClientError as e:
            logger.error(f"S3 upload error: {e}")
            raise

    async def get_presigned_url(self, file_key: str, expiration: int = 3600) -> str:
        if self._local_mode:
            return f"/api/uploads/{file_key}"

        from botocore.exceptions import ClientError

        try:
            url = self._s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": file_key},
                ExpiresIn=expiration,
            )
            return url
        except ClientError as e:
            logger.error(f"S3 presigned URL error: {e}")
            raise


s3_client = S3Client()
