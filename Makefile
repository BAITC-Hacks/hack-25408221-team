.PHONY: test test-backend lint-frontend typecheck-frontend

test: test-backend

test-backend:
	cd backend && pip install -q -r requirements-dev.txt && python -m pytest

lint-frontend:
	cd frontend && pnpm install --frozen-lockfile && pnpm run lint

typecheck-frontend:
	cd frontend && pnpm install --frozen-lockfile && pnpm exec tsc --noEmit
