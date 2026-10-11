import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.services.ai.nvidia_nim import AIProviderError

logger = logging.getLogger("marp.errors")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AIProviderError)
    async def ai_provider_error_handler(_request: Request, exc: AIProviderError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content={
                "error": {
                    "code": f"http_{exc.status_code}",
                    "message": exc.detail if isinstance(exc.detail, str) else "Request failed",
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request validation failed",
                    # Never echo request values or exception context.
                    "details": [
                        {"location": list(error["loc"]), "type": error["type"]}
                        for error in exc.errors()
                    ],
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled request error (%s)", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "Internal server error"}},
        )
