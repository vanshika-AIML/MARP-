import asyncio
import hashlib
import io
import os
import re
import warnings
from pathlib import Path

from PIL import Image

from app.core.config import BACKEND_ROOT
from app.services.visuals.interfaces import VisualError

KEY = re.compile(r"^[0-9a-f]{32}\.jpg$")


def validate_image(body, mime, limit):
    if not body or len(body) > limit:
        raise VisualError("media_too_large")
    formats = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
    if mime not in formats:
        raise VisualError("unsupported_media_type")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(body)) as image:
                if image.format != formats[mime] or getattr(image, "n_frames", 1) != 1:
                    raise VisualError("unsupported_media_type")
                width, height = image.size
                if (
                    min(width, height) < 256
                    or max(width, height) > 8192
                    or width * height > 20_000_000
                ):
                    raise VisualError("invalid_media_dimensions")
                image.verify()
            with Image.open(io.BytesIO(body)) as image:
                image.load()
                # Re-encode pixels only: remove EXIF, embedded profiles, animation and metadata.
                output = io.BytesIO()
                if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                    rgba = image.convert("RGBA")
                    clean = Image.new("RGB", image.size, "white")
                    clean.paste(rgba, mask=rgba.getchannel("A"))
                else:
                    clean = image.convert("RGB")
                clean.save(output, format="JPEG", quality=90)
                sanitized = output.getvalue()
        if len(sanitized) > limit:
            raise VisualError("media_too_large")
        return sanitized, width, height, hashlib.sha256(sanitized).hexdigest()
    except VisualError:
        raise
    except Exception:
        raise VisualError("invalid_media_content") from None


class LocalMediaStorageProvider:
    def __init__(self, settings):
        root = Path(settings.media_dir)
        self.root = (root if root.is_absolute() else BACKEND_ROOT / root).resolve()

    def path(self, key):
        if not KEY.fullmatch(key):
            raise VisualError("invalid_media_key")
        target = (self.root / key).resolve()
        if target.parent != self.root:
            raise VisualError("invalid_media_key")
        return target

    async def save(self, key, content):
        target = self.path(key)

        def write():
            self.root.mkdir(parents=True, exist_ok=True)
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            try:
                with os.fdopen(descriptor, "wb") as stream:
                    stream.write(content)
            except BaseException:
                target.unlink(missing_ok=True)
                raise

        await asyncio.to_thread(write)

    async def delete(self, key):
        await asyncio.to_thread(self.path(key).unlink, missing_ok=True)
