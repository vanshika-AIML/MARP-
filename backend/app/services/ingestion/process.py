import asyncio
import os
import sys

from app.core.config import BACKEND_ROOT
from app.schemas.sources import ExtractionResult
from app.services.ingestion.extractors import ExtractionError


async def extract_isolated(path, extension, title, *, deadline):
    # The parser does not need application secrets, DATABASE_URL, or NVIDIA_API_KEY.
    allowed = {"SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "LANG", "LC_ALL"}
    environment = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    environment["PYTHONIOENCODING"] = "utf-8"
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "app.services.ingestion.runner",
        str(path),
        extension,
        title,
        cwd=BACKEND_ROOT,
        env=environment,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        async with asyncio.timeout(deadline):
            output, _ = await process.communicate()
        if process.returncode or len(output) > 2_000_000:
            raise ExtractionError("File could not be extracted within the supported limits")
        return ExtractionResult.model_validate_json(output)
    except TimeoutError:
        raise ExtractionError("Extraction exceeded its time limit") from None
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
