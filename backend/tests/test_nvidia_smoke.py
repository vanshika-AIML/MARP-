import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from app.scripts import test_nvidia as smoke
from app.services.ai.nvidia_nim import NvidiaNIMClient


@pytest.mark.parametrize("outcome", ["success", "http_error", "timeout"])
async def test_smoke_streaming_overrides_and_safe_output(settings, monkeypatch, capsys, outcome):
    configured = settings.model_copy(
        update={"nvidia_api_key": SecretStr("fake-secret"), "ai_timeout_seconds": 0.001}
    )
    requests = []

    async def handler(request):
        requests.append(request)
        # The smoke deadline must not inherit the short normal-generation timeout.
        await asyncio.sleep(0.01)
        if outcome == "timeout":
            raise httpx.ReadTimeout("private transport detail", request=request)
        if outcome == "http_error":
            return httpx.Response(401, text="private provider detail")
        return httpx.Response(
            200,
            text='data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n',
        )

    monkeypatch.setattr(smoke, "Settings", lambda: configured)
    monkeypatch.setattr(
        smoke,
        "NvidiaNIMClient",
        lambda value: NvidiaNIMClient(value, transport=httpx.MockTransport(handler)),
    )
    result = await smoke.main()
    output = capsys.readouterr().out
    assert result == (0 if outcome == "success" else 1)
    assert len(requests) == 1
    request = requests[0]
    payload = json.loads(request.content)
    assert payload["stream"] is True and payload["max_tokens"] == 16
    assert payload["chat_template_kwargs"] == {"enable_thinking": False}
    assert payload["model"] == configured.nvidia_model
    assert request.extensions["timeout"] == {"connect": 10, "read": 180, "write": 10, "pool": 10}
    assert request.headers["Authorization"] == "Bearer fake-secret"
    assert "fake-secret" not in output and "private" not in output
    assert configured.ai_timeout_seconds == 0.001 and configured.ai_max_retries == 2
    if outcome == "success":
        assert "connected / HTTP 200" in output
        assert "first token received" in output and "completed" in output
    elif outcome == "http_error":
        assert "provider HTTP 401" in output and "ai_authentication_failed" in output
    else:
        assert "ai_timeout" in output
