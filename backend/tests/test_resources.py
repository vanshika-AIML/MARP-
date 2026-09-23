from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.database import get_db_session


@pytest.mark.parametrize("fail", [False, True])
async def test_request_session_closes_and_rolls_back_failures(fail):
    session = AsyncMock()
    context = AsyncMock()
    context.__aenter__.return_value = session
    context.__aexit__.return_value = False
    factory = MagicMock(return_value=context)
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(database=SimpleNamespace(session_factory=factory))
        )
    )
    dependency = get_db_session(request)
    assert await anext(dependency) is session
    if fail:
        with pytest.raises(ValueError, match="request failed"):
            await dependency.athrow(ValueError("request failed"))
        session.rollback.assert_awaited_once()
    else:
        with pytest.raises(StopAsyncIteration):
            await anext(dependency)
        session.rollback.assert_not_awaited()
    context.__aexit__.assert_awaited_once()
    session.commit.assert_not_awaited()
