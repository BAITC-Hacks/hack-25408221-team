import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.user_routes import router as user_router
from app.api.session_routes import router as session_router
from app.api.websocket import router as websocket_router
from app.api.admin_routes import router as admin_router
from app.api.validation_routes import router as validation_router
from app.api.fairness_routes import router as fairness_router
from app.api.demo_routes import router as demo_router
from app.config import settings
from app.infrastructure.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

limiter = Limiter(key_func=get_remote_address)


def create_app() -> FastAPI:
    app = FastAPI(title="inVision Backend", version="2.0.0")

    app.state.limiter = limiter

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

    app.include_router(user_router)
    app.include_router(session_router)
    app.include_router(websocket_router)
    app.include_router(admin_router)
    app.include_router(validation_router)
    app.include_router(fairness_router)
    app.include_router(demo_router)

    @app.on_event("startup")
    async def startup():
        await init_db()

    return app


app = create_app()
