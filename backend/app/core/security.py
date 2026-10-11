import re
import time
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,128}$")


class RequestSecurityMiddleware:
    def __init__(self, app, *, max_bytes: int, production: bool = False):
        self.app = app
        self.max_bytes = max_bytes
        self.production = production

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        request_id = headers.get("x-request-id", "")
        if not REQUEST_ID.fullmatch(request_id):
            request_id = uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        content_length = headers.get("content-length")
        if content_length:
            try:
                too_large = int(content_length) > self.max_bytes
            except ValueError:
                too_large = True
            if too_large:
                response = JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "request_too_large",
                            "message": "Request body is too large",
                        }
                    },
                )
                response.headers["X-Request-ID"] = request_id
                await response(scope, receive, send)
                return

        started = time.monotonic()

        async def secure_send(message):
            if message["type"] == "http.response.start":
                response_headers = MutableHeaders(scope=message)
                response_headers["X-Request-ID"] = request_id
                response_headers["X-Content-Type-Options"] = "nosniff"
                response_headers["X-Frame-Options"] = "DENY"
                response_headers["Referrer-Policy"] = "no-referrer"
                response_headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
                response_headers["Content-Security-Policy"] = (
                    "default-src 'none'; frame-ancestors 'none'"
                )
                if self.production:
                    response_headers["Strict-Transport-Security"] = (
                        "max-age=31536000; includeSubDomains"
                    )
                response_headers["Server-Timing"] = (
                    f"app;dur={(time.monotonic() - started) * 1000:.1f}"
                )
            await send(message)

        await self.app(scope, receive, secure_send)
