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

    # Settings loads from backend/.env via `env_file=".env"`. If a real
    # backend/.env exists locally (created for docker compose), it would
    # supply JWT_SECRET and mask the missing-env case. Temporarily hide it
    # so the test verifies the no-file + no-env fail-fast path.
    dot_env = os.path.join(BACKEND_DIR, ".env")
    dot_env_bak = dot_env + ".bak_test"
    moved = False
    if os.path.exists(dot_env):
        os.rename(dot_env, dot_env_bak)
        moved = True
    try:
        result = subprocess.run(
            [sys.executable, "-c", "import app.config"],
            cwd=BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
        )
    finally:
        if moved:
            os.rename(dot_env_bak, dot_env)

    assert result.returncode != 0
    assert "jwt_secret" in result.stderr.lower()
