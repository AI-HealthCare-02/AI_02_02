from fastapi import APIRouter

from app.apis.v1.analysis_routers import analysis_router
from app.apis.v1.auth_routers import auth_router
from app.apis.v1.chat_routers import chat_router
from app.apis.v1.challenge_routers import challenge_router
from app.apis.v1.dashboard_routers import dashboard_router
from app.apis.v1.health_routers import health_router
from app.apis.v1.integration_routers import integration_router
from app.apis.v1.internal_routers import internal_router
from app.apis.v1.onboarding_routers import onboarding_router
from app.apis.v1.platform_routers import platform_router
from app.apis.v1.risk_routers import risk_router
from app.apis.v1.settings_routers import settings_router
from app.apis.v1.user_routers import user_router

v1_routers = APIRouter(prefix="/api/v1")
v1_routers.include_router(analysis_router)
v1_routers.include_router(auth_router)
v1_routers.include_router(chat_router)
v1_routers.include_router(health_router)
v1_routers.include_router(dashboard_router)
v1_routers.include_router(challenge_router)
v1_routers.include_router(integration_router)
v1_routers.include_router(internal_router)
v1_routers.include_router(onboarding_router)
v1_routers.include_router(platform_router)
v1_routers.include_router(risk_router)
v1_routers.include_router(settings_router)
v1_routers.include_router(user_router)
