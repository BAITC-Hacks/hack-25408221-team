.PHONY: test test-backend test-frontend lint-frontend typecheck-frontend

test: test-backend test-frontend

test-backend:
	cd backend && python3 -m pytest

test-frontend:
	cd frontend && pnpm test

lint-frontend:
	cd frontend && pnpm install --frozen-lockfile && pnpm run lint

typecheck-frontend:
	cd frontend && pnpm install --frozen-lockfile && pnpm exec tsc --noEmit
