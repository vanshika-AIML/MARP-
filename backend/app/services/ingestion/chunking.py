"""Section-aware bounded text with overlap and durable references."""

from app.schemas.sources import ExtractionResult

CHUNK_SIZE = 1800
OVERLAP = 200
MAX_CHUNKS = 256


def chunk_document(source_id, result: ExtractionResult, *, size=CHUNK_SIZE, overlap=OVERLAP):
    if size < 100 or size > 4000 or not 0 <= overlap < size:
        raise ValueError("Invalid chunk size or overlap")
    chunks = []
    for section_index, section in enumerate(result.sections):
        text = (section.text or section.title).strip()
        offset = 0
        while offset < len(text):
            if len(chunks) >= MAX_CHUNKS:
                return chunks
            end = min(offset + size, len(text))
            if end < len(text):
                split = max(text.rfind("\n", offset, end), text.rfind(" ", offset, end))
                if split > offset + size // 2:
                    end = split
            priority = (
                0
                if any(
                    term in section.title.lower()
                    for term in (
                        "summary",
                        "abstract",
                        "conclusion",
                        "key finding",
                    )
                )
                else (1 if offset == 0 else 2)
            )
            chunks.append(
                {
                    "source_id": source_id,
                    "index": len(chunks),
                    "text": text[offset:end],
                    "chunk_metadata": {
                        "title": section.title,
                        "kind": section.kind,
                        "reference": section.reference,
                        "section": section_index + 1,
                        "start": offset,
                        "end": end,
                        "priority": priority,
                    },
                }
            )
            if end == len(text):
                break
            offset = max(offset + 1, end - overlap)
    return chunks
