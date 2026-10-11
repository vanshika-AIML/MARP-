"""Vendor-neutral visual contracts. No credentials in results or public metadata."""

from dataclasses import dataclass, field
from typing import Protocol


class VisualError(Exception):
    """Intentionally carries only a stable, public-safe code."""

    def __init__(self, code="visual_unavailable"):
        self.code = code
        super().__init__(code)


@dataclass
class SearchResult:
    url: str
    source_url: str
    width: int
    height: int
    alt_text: str
    attribution: dict = field(default_factory=dict)
    safe: bool = True
    watermarked: bool = False


@dataclass
class GeneratedImage:
    content: bytes
    mime_type: str
    metadata: dict = field(default_factory=dict)


class ImageSearchProvider(Protocol):
    name: str
    version: str

    async def search(self, query: str, *, safe_search: bool) -> list[SearchResult]: ...


class ImageGenerationProvider(Protocol):
    name: str
    version: str

    async def generate(
        self, prompt: str, *, aspect_ratio: str, style: str, slide_context: str
    ) -> GeneratedImage: ...


class VisionProvider(Protocol):
    name: str
    version: str

    async def suitable(self, image: bytes, *, slide_context: str) -> bool: ...


class MediaStorageProvider(Protocol):
    async def save(self, key: str, content: bytes) -> None: ...
    async def delete(self, key: str) -> None: ...
    def path(self, key: str): ...
