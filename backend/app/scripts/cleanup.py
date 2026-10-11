"""Explicit, bounded maintenance cleanup. Dry-run is the default."""

import argparse
import asyncio
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import exists, func, select

from app.core.config import Settings
from app.core.database import Database
from app.models import (
    GenerationJob,
    MediaAsset,
    MediaCache,
    PresentationSource,
    Slide,
    UploadedSource,
)
from app.services.storage import get_storage
from app.services.visuals.storage import LocalMediaStorageProvider

BATCH_LIMIT = 1000
MAX_REFERENCE_SCAN = 10_000


async def cleanup(*, apply: bool, older_than_hours: int) -> dict[str, int | bool]:
    settings = Settings()
    database = Database(settings)
    cutoff = datetime.now(UTC) - timedelta(hours=older_than_hours)
    source_files: list[str] = []
    media_files: list[str] = []
    counts = {"expired_cache": 0, "terminal_jobs": 0, "failed_sources": 0, "orphan_media": 0}
    try:
        async with database.session_factory() as session:
            caches = list(
                await session.scalars(
                    select(MediaCache)
                    .where(MediaCache.expires_at < datetime.now(UTC))
                    .limit(BATCH_LIMIT)
                )
            )
            jobs = list(
                await session.scalars(
                    select(GenerationJob)
                    .where(
                        GenerationJob.status.in_(["completed", "failed", "cancelled"]),
                        GenerationJob.updated_at < cutoff,
                    )
                    .limit(BATCH_LIMIT)
                )
            )
            sources = list(
                await session.scalars(
                    select(UploadedSource)
                    .where(
                        UploadedSource.status == "failed",
                        UploadedSource.updated_at < cutoff,
                        ~exists(
                            select(PresentationSource.source_id).where(
                                PresentationSource.source_id == UploadedSource.id
                            )
                        ),
                    )
                    .limit(BATCH_LIMIT)
                )
            )
            counts.update(
                expired_cache=len(caches),
                terminal_jobs=len(jobs),
                failed_sources=len(sources),
            )

            slide_count = await session.scalar(select(func.count()).select_from(Slide)) or 0
            assets: list[MediaAsset] = []
            if slide_count <= MAX_REFERENCE_SCAN:
                configs = list(
                    await session.scalars(
                        select(Slide.visual_config).where(Slide.visual_config.is_not(None))
                    )
                )
                referenced = {
                    str(media["asset_id"])
                    for config in configs
                    if isinstance(config, dict)
                    and isinstance((media := config.get("media")), dict)
                    and media.get("asset_id")
                }
                candidates = list(
                    await session.scalars(
                        select(MediaAsset)
                        .where(MediaAsset.created_at < cutoff)
                        .limit(BATCH_LIMIT)
                    )
                )
                assets = [asset for asset in candidates if str(asset.id) not in referenced]
                counts["orphan_media"] = len(assets)

            if apply:
                for row in [*caches, *jobs, *sources, *assets]:
                    await session.delete(row)
                source_files = [source.stored_filename for source in sources]
                media_files = [asset.stored_path for asset in assets]
                await session.commit()

        if apply:
            source_storage = get_storage(settings)
            media_storage = LocalMediaStorageProvider(settings)
            for key in source_files:
                await source_storage.delete(key)
            for key in media_files:
                await media_storage.delete(key)
        return {
            **counts,
            "applied": apply,
            "reference_scan_bounded": slide_count > MAX_REFERENCE_SCAN,
        }
    finally:
        await database.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean bounded stale MARP Studio data")
    parser.add_argument("--apply", action="store_true", help="perform deletion; default is dry-run")
    parser.add_argument("--older-than-hours", type=int, default=24 * 30)
    args = parser.parse_args()
    if args.older_than_hours < 24:
        parser.error("--older-than-hours must be at least 24")
    result = asyncio.run(cleanup(apply=args.apply, older_than_hours=args.older_than_hours))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
