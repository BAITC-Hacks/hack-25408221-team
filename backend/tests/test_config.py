"""Regression test: the app must fail fast if JWT_SECRET isn't configured.

JWT_SECRET used to default to the literal string "change-me-in-production",
which meant a misconfigured deployment would silently sign/verify tokens with
a public, guessable secret instead of refusing to start.
"""

import os
import subprocess
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_missing_jwt_secret_fails_fast():
    env = {
        key: value
        for key, value in os.environ.items()
        if key not in {"JWT_SECRET", "GEMINI_API_KEY", "DB_HOST"}
    }
    env["GEMINI_API_KEY"] = "test-key"
    env["DB_HOST"] = "localhost"

    result = subprocess.run(
        [sys.executable, "-c", "import app.config"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "jwt_secret" in result.stderr.lower()
