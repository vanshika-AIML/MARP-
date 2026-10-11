from pydantic import SecretStr

from app.core.job_queue import worker_redis_settings


def test_worker_uses_configured_redis_connect_timeout(settings):
    config = worker_redis_settings(settings.model_copy(update={
        "redis_url": SecretStr("redis://127.0.0.1:6380/2"),
        "dependency_timeout_seconds": 12,
    }))
    assert (config.host, config.port, config.database) == ("127.0.0.1", 6380, 2)
    assert config.conn_timeout == 12
