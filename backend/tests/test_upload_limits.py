import pytest
from fastapi import FastAPI, UploadFile
from httpx import ASGITransport, AsyncClient

from app.core.errors import register_exception_handlers
from app.core.upload_limits import UploadSizeLimit


@pytest.mark.parametrize("streaming", [False, True])
async def test_body_limit_before_multipart_parsing(streaming):
    app = FastAPI()
    register_exception_handlers(app)
    app.add_middleware(UploadSizeLimit, path="/uploads", max_bytes=1024)

    @app.post("/uploads")
    async def upload(file: UploadFile):
        return {"size": len(await file.read())}

    body = (
        b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="large.txt"'
        b"\r\nContent-Type: text/plain\r\n\r\n" + b"x" * 100_000 + b"\r\n--boundary--\r\n"
    )

    async def chunks():
        for offset in range(0, len(body), 8192):
            yield body[offset : offset + 8192]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/uploads",
            content=chunks() if streaming else body,
            headers={"Content-Type": "multipart/form-data; boundary=boundary"},
        )
    assert response.status_code == 413
