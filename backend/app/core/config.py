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
