from fastapi import APIRouter

from app.api.v1.ai import router as ai_router
from app.api.v1.configuration import router as configuration_router
from app.api.v1.health import router as health_router
from app.api.v1.job_websocket import router as job_websocket_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.media import router as media_router
from app.api.v1.presentations import router as presentations_router
from app.api.v1.source_websocket import router as source_websocket_router
from app.api.v1.templates import router as templates_router
from app.api.v1.themes import router as themes_router
from app.api.v1.uploads import router as uploads_router

router = APIRouter()
router.include_router(media_router)
router.include_router(health_router)
router.include_router(presentations_router)
router.include_router(templates_router)
router.include_router(themes_router)
router.include_router(configuration_router)
router.include_router(ai_router)
router.include_router(jobs_router)
router.include_router(job_websocket_router)
router.include_router(uploads_router)
router.include_router(source_websocket_router)
