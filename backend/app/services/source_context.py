"""Small, extractive multi-source context; no embedding or invented summaries."""

import json

from fastapi import HTTPException
from sqlalchemy import Integer, cast, select
from sqlalchemy.dialects.postgresql import insert

from app.models import PresentationSource, SourceChunk, UploadedSource


class SourceContextService:
    def __init__(self, session, settings):
        self.session, self.settings = session, settings

    async def validate(self, source_ids, *, lock=False):
        if not source_ids:
            return []
        query = (
            select(UploadedSource)
            .where(UploadedSource.id.in_(source_ids))
            .order_by(UploadedSource.id)
        )
        if lock:
            query = query.with_for_update(read=True)
        rows = list(await self.session.scalars(query))
        by_id = {row.id: row for row in rows}
        if set(source_ids) != set(by_id):
            raise HTTPException(404, "One or more sources were not found")
        if any(row.status != "ready" for row in rows):
            raise HTTPException(409, "All sources must be ready before generation")
        return [by_id[source_id] for source_id in source_ids]

    async def build(self, source_ids):
        sources = await self.validate(source_ids)
        if not sources:
            return None
        budget = self.settings.source_context_chars
        quota = budget // len(sources)
        context, usable = [], False
        for number, source in enumerate(sources, start=1):
            entry = {
                "source": f"S{number}",
                "source_id": str(source.id),
                "filename": source.original_filename,
                "chunks": [],
            }
            chunks = list(
                await self.session.scalars(
                    select(SourceChunk)
                    .where(SourceChunk.source_id == source.id)
                    .order_by(
                        cast(SourceChunk.chunk_metadata["priority"].astext, Integer),
                        SourceChunk.index,
                    )
                    .limit(64)
                )
            )
            for chunk in chunks:
                item = {
                    "citation": f"S{number}:C{chunk.index}",
                    "text": chunk.text,
                    "title": chunk.chunk_metadata.get("title", ""),
                    "reference": chunk.chunk_metadata.get("reference", {}),
                }
                candidate = {**entry, "chunks": [*entry["chunks"], item]}
                excess = len(json.dumps(candidate, ensure_ascii=False)) - quota + 10
                if excess > 0:
                    item["text"] = item["text"][: max(0, len(item["text"]) - excess)]
                if not item["text"].strip():
                    break
                entry["chunks"].append(item)
                usable = True
                if excess > 0:
                    break
            if not entry["chunks"]:
                entry["note"] = (
                    "No extracted text; image/scanned content is not available to this model."
                )
            context.append(entry)
        if not usable:
            raise HTTPException(400, "Sources contain no usable text; OCR is not configured")
        output = json.dumps(context, ensure_ascii=False)
        if len(output) > budget:
            raise HTTPException(400, "Source references exceed the configured context limit")
        return output

    async def attach(self, presentation_id, source_ids):
        await self.validate(source_ids, lock=True)
        if source_ids:
            await self.session.execute(
                insert(PresentationSource)
                .values(
                    [
                        {"presentation_id": presentation_id, "source_id": source_id}
                        for source_id in source_ids
                    ]
                )
                .on_conflict_do_nothing()
            )
