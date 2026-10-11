"""Typed environment configuration; secret values are redacted in representations."""

import json
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        hide_input_in_errors=True,
    )

    app_env: Literal["development", "test", "staging", "production"] = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    database_url: SecretStr = SecretStr(
        "postgresql+asyncpg://marp:change-me-local-only@localhost:5432/marp"
    )
    redis_url: SecretStr = SecretStr("redis://localhost:6379/0")
    frontend_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:5176"]
    )
    dependency_timeout_seconds: float = Field(default=3, gt=0, le=30)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    nvidia_api_key: SecretStr = SecretStr("")
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "nvidia/nemotron-3-nano-30b-a3b"
    nvidia_json_mode: bool = False
    ai_temperature: float = Field(default=0.5, ge=0, le=1)
    ai_max_tokens: int = Field(default=8192, ge=256, le=32768)
    ai_timeout_seconds: float = Field(default=90, gt=0, le=300)
    ai_max_retries: int = Field(default=2, ge=0, le=5)
    ai_default_slide_count: int = Field(default=10, ge=1, le=40)
    ai_default_tone: str = Field(default="professional", min_length=1, max_length=50)
    storage_provider: Literal["local"] = "local"
    upload_dir: str = "./data/uploads"
    max_upload_mb: int = Field(default=25, ge=1, le=100)
    source_context_chars: int = Field(default=24_000, ge=2000, le=60_000)
    ingestion_timeout_seconds: float = Field(default=60, gt=0, le=120)
    media_dir: str = "./data/media"
    max_media_mb: int = Field(default=8, ge=1, le=20)
    visual_budget_seconds: float = Field(default=45, gt=0, le=45)
    pixabay_api_key: SecretStr = SecretStr("")
    stability_api_key: SecretStr = SecretStr("")

    @field_validator("api_v1_prefix")
    @classmethod
    def validate_prefix(cls, value: str) -> str:
        parts = value.removeprefix("/").split("/")
        if not value.startswith("/") or any(
            not part or not part.replace("-", "").replace("_", "").isalnum() for part in parts
        ):
            raise ValueError("API prefix must be an absolute path without a trailing slash")
        return value

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        try:
            url = make_url(value.get_secret_value())
            valid = url.drivername == "postgresql+asyncpg" and bool(url.host and url.database)
        except Exception:
            valid = False
        if not valid:
            raise ValueError("DATABASE_URL must be a PostgreSQL asyncpg URL with host and database")
        return value

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: SecretStr) -> SecretStr:
        try:
            url = urlsplit(value.get_secret_value())
            valid = url.scheme in {"redis", "rediss"} and bool(url.hostname)
            _ = url.port
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("REDIS_URL must use redis:// or rediss:// with a host")
        return value

    @field_validator("nvidia_base_url")
    @classmethod
    def validate_nvidia_base_url(cls, value: str) -> str:
        try:
            url = urlsplit(value)
            valid = (
                url.scheme in {"http", "https"}
                and bool(url.hostname)
                and not url.username
                and not url.password
                and not url.query
                and not url.fragment
            )
            _ = url.port
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("NVIDIA_BASE_URL must be an HTTP(S) URL without credentials or query")
        return value.rstrip("/")

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            if value.strip().startswith("["):
                return json.loads(value)
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("frontend_origins")
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        normalized = []
        for origin in origins:
            try:
                url = urlsplit(origin)
                valid = (
                    url.scheme in {"http", "https"}
                    and bool(url.hostname)
                    and url.hostname != "*"
                    and not url.username
                    and not url.password
                    and url.path in {"", "/"}
                    and not url.query
                    and not url.fragment
                )
                _ = url.port
            except ValueError:
                valid = False
            if not valid:
                raise ValueError("CORS origins must be explicit HTTP(S) origins without paths")
            normalized.append(origin.rstrip("/"))
        return list(dict.fromkeys(normalized))
