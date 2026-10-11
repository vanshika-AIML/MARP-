import pytest

from app.core.config import Settings


class FakeRatePipeline:
    def __init__(self, store):
        self.store = store
        self.key = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    def incr(self, key):
        self.key = key

    def ttl(self, _key):
        return None

    async def execute(self):
        self.store[self.key] = self.store.get(self.key, 0) + 1
        return [self.store[self.key], 60]


class FakeRateRedis:
    def __init__(self):
        self.store = {}

    def pipeline(self, transaction=True):
        assert transaction
        return FakeRatePipeline(self.store)

    async def expire(self, _key, _seconds):
        return True

class StubDependency:
    def __init__(self) -> None:
        self.available = True
        self.ping_count = 0
        self.closed = False
        self.client = FakeRateRedis()

    async def ping(self) -> bool:
        self.ping_count += 1
        if not self.available:
            raise ConnectionError("postgresql://user:do-not-leak@internal-host/private")
        return True

    async def close(self) -> None:
        self.closed = True


@pytest.fixture(autouse=True)
def clean_settings_environment(monkeypatch):
    # Never depend on a developer's .env or configured production services.
    for name in Settings.model_fields:
        monkeypatch.delenv(name.upper(), raising=False)
        monkeypatch.delenv(name.lower(), raising=False)


@pytest.fixture
def settings():
    return Settings(_env_file=None, app_env="test", dependency_timeout_seconds=0.1)


@pytest.fixture
def app_factory(monkeypatch, settings):
    from app.main import create_app

    database = StubDependency()
    redis = StubDependency()
    monkeypatch.setattr("app.main.Database", lambda _settings: database)
    monkeypatch.setattr("app.main.RedisClient", lambda _settings: redis)

    def factory(overrides=None):
        return create_app(overrides or settings)

    return factory, database, redis
