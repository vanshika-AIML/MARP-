"""Limit the HTTP body before Starlette spools multipart file data."""

from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse


class UploadTooLarge(HTTPException):
    def __init__(self):
        super().__init__(413, "Upload is too large")


class UploadSizeLimit:
    def __init__(self, app, *, path, max_bytes):
        self.app, self.path, self.max_bytes = app, path, max_bytes + 64 * 1024

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or (scope["path"].rstrip("/") != self.path)
        ):
            return await self.app(scope, receive, send)
        total = 0

        async def bounded_receive():
            nonlocal total
            message = await receive()
            total += len(message.get("body", b""))
            if total > self.max_bytes:
                raise UploadTooLarge()
            return message

        try:
            for name, value in scope["headers"]:
                if name.lower() == b"content-length":
                    try:
                        length = int(value)
                    except ValueError:
                        length = -1
                    if length < 0:
                        return await JSONResponse(
                            status_code=400,
                            content={
                                "error": {
                                    "code": "invalid_length",
                                    "message": "Invalid content length",
                                }
                            },
                        )(scope, receive, send)
                    if length > self.max_bytes:
                        raise UploadTooLarge()
            await self.app(scope, bounded_receive, send)
        except UploadTooLarge:
            await JSONResponse(
                status_code=413,
                content={"error": {"code": "upload_too_large", "message": "Upload is too large"}},
            )(scope, receive, send)
