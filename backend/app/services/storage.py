"""Storage keys never contain a user filename or absolute path."""

import asyncio
import os
import re
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import BACKEND_ROOT, Settings

KEY = re.compile(r"^[0-9a-f]{32}\.(pdf|docx|pptx|xlsx|csv|txt|md|json|png|jpg|jpeg|webp)$")


class StorageProvider(ABC):
    @abstractmethod
    async def save(self, upload: UploadFile, key: str, limit: int) -> int: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    def local_copy(self, key: str): ...


class LocalStorageProvider(StorageProvider):
    def __init__(self, root: Path):
        self.root = root.resolve()

    def resolve(self, key: str) -> Path:
        if not KEY.fullmatch(key):
            raise ValueError("Invalid storage key")
        path = (self.root / key).resolve()
        if path.parent != self.root:
            raise ValueError("Storage path escapes the configured directory")
        return path

    async def save(self, upload, key, limit):
        path = self.resolve(key)
        await asyncio.to_thread(self.root.mkdir, parents=True, exist_ok=True)
        size = 0
        descriptor = await asyncio.to_thread(
            os.open,
            path,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
        try:
            with os.fdopen(descriptor, "wb") as target:
                while chunk := await upload.read(1024 * 1024):
                    size += len(chunk)
                    if size > limit:
                        raise HTTPException(413, "Upload exceeds MAX_UPLOAD_MB")
                    await asyncio.to_thread(target.write, chunk)
            if not size:
                raise HTTPException(400, "Empty uploads are not allowed")
            return size
        except BaseException:
            await asyncio.to_thread(path.unlink, missing_ok=True)
            raise

    async def delete(self, key):
        await asyncio.to_thread(self.resolve(key).unlink, missing_ok=True)

    @asynccontextmanager
    async def local_copy(self, key):
        # An S3 provider can download to a private temporary file here.
        yield self.resolve(key)


def get_storage(settings: Settings) -> StorageProvider:
    root = Path(settings.upload_dir)
    return LocalStorageProvider(root if root.is_absolute() else BACKEND_ROOT / root)
