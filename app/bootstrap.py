from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from app.api.router import api_v1_router
from app.core.config import config
from app.db.databases import initialize_tortoise


def create_app() -> FastAPI:
    app = FastAPI(
        title=config.APP_NAME,
        version=config.APP_VERSION,
        default_response_class=ORJSONResponse,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    initialize_tortoise(app)
    app.include_router(api_v1_router)
    return app
