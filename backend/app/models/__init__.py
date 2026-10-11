"""Model registry: import future model classes here for Alembic discovery."""

from app.models.base import Base
from app.models.content import AppConfig, FeatureFlag, Presentation, Slide, Template, Theme
from app.models.generation_job import GenerationJob
from app.models.media import MediaAsset, MediaCache
from app.models.sources import PresentationSource, SourceChunk, UploadedSource

__all__ = [
    "AppConfig",
    "Base",
    "FeatureFlag",
    "GenerationJob",
    "MediaAsset",
    "MediaCache",
    "Presentation",
    "Slide",
    "Template",
    "Theme",
    "PresentationSource",
    "SourceChunk",
    "UploadedSource",
]
