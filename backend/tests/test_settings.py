import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_local_defaults_and_reserved_nvidia_configuration():
    settings = Settings(_env_file=None)
    assert settings.app_env == "development"
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.frontend_origins == ["http://localhost:5173", "http://localhost:5176"]
    assert settings.nvidia_api_key.get_secret_value() == ""
    assert settings.nvidia_model == "nvidia/nemotron-3-nano-30b-a3b"


def test_env_file_and_environment_precedence(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "APP_ENV=test\nDEBUG=false\nAPI_V1_PREFIX=/custom/v1\n"
        "FRONTEND_ORIGINS=http://localhost:5173, https://portal.example.org/\n"
        "DATABASE_URL=postgresql+asyncpg://user:test-secret@localhost:5432/test_db\n"
        "NVIDIA_API_KEY=reserved-secret\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("APP_ENV", "staging")
    settings = Settings(_env_file=env_file)
    assert settings.app_env == "staging"
    assert settings.debug is False
    assert settings.api_v1_prefix == "/custom/v1"
    assert settings.frontend_origins == ["http://localhost:5173", "https://portal.example.org"]
    assert "test-secret" not in repr(settings)
    assert "reserved-secret" not in settings.model_dump_json()


def test_json_origins_are_supported(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", '["http://localhost:5176"]')
    assert Settings(_env_file=None).frontend_origins == ["http://localhost:5176"]


@pytest.mark.parametrize(
    "values",
    [
        {"database_url": "sqlite:///tmp.db"},
        {"database_url": "postgresql://user:secret@localhost/marp"},
        {"redis_url": "https://localhost"},
        {"frontend_origins": "*"},
        {"frontend_origins": "https://portal.example.org/path"},
        {"frontend_origins": "https://user:secret@portal.example.org"},
        {"api_v1_prefix": "api/v1"},
        {"api_v1_prefix": "/api/v1/"},
        {"dependency_timeout_seconds": 0},
    ],
)
def test_invalid_configuration_fails_early(values):
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, **values)
    assert "user:secret" not in str(error.value)
