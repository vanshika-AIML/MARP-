"""Reusable NIM chat client. No credentials, prompt text, or response bodies are logged."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass

import httpx

from app.core.config import Settings

logger = logging.getLogger("marp.ai.nvidia")
TRANSIENT_STATUS = {408, 429, 500, 502, 503, 504}


@dataclass
class AIProviderError(Exception):
    status_code: int
    code: str
    message: str
    retryable: bool = False

    def __str__(self):
        return self.message


def status_error(status: int) -> AIProviderError:
    if status in {401, 403}:
        return AIProviderError(502, "ai_authentication_failed", "AI provider rejected credentials")
    if status == 429:
        return AIProviderError(429, "ai_rate_limited", "AI provider rate limit reached", True)
    if status == 202:
        return AIProviderError(503, "ai_pending", "AI provider did not finish synchronously", True)
    if status in TRANSIENT_STATUS:
        return AIProviderError(503, "ai_unavailable", "AI provider is unavailable", True)
    return AIProviderError(502, "ai_provider_error", "AI provider request failed")


class NvidiaNIMClient:
    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self.settings, self._sleep = settings, sleep
        self._client = httpx.AsyncClient(
            base_url=settings.nvidia_base_url.rstrip("/") + "/",
            timeout=settings.ai_timeout_seconds,
            transport=transport,
            trust_env=False,
            follow_redirects=False,
        )

    def ensure_configured(self):
        self._headers()

    def _headers(self, stream=False):
        key = self.settings.nvidia_api_key.get_secret_value()
        if not key.strip():
            raise AIProviderError(503, "ai_not_configured", "AI provider is not configured")
        return {
            "Authorization": "Bearer " + key,
            "Accept": "text/event-stream" if stream else "application/json",
        }

    def _payload(
        self,
        messages,
        temperature,
        max_tokens,
        *,
        stream=False,
        json_output=True,
        enable_thinking=None,
    ):
        payload = {
            "model": self.settings.nvidia_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        # Hosted Nano's documented contract does not promise response_format support.
        # Structured schemas are always sent in prompts and validated by the service.
        if json_output and self.settings.nvidia_json_mode:
            payload["response_format"] = {"type": "json_object"}
        if enable_thinking is not None:
            payload["chat_template_kwargs"] = {"enable_thinking": enable_thinking}
        return payload

    async def _backoff(self, attempt, retry_after=None):
        delay = min(0.25 * 2**attempt, 4)
        if retry_after:
            try:
                delay = min(max(float(retry_after), 0), 5)
            except ValueError:
                pass
        await self._sleep(delay)

    async def _request(self, payload, timeout_seconds):
        headers = self._headers()
        attempts = self.settings.ai_max_retries + 1
        for attempt in range(attempts):
            try:
                response = await self._client.post(
                    "chat/completions", headers=headers, json=payload, timeout=timeout_seconds
                )
            except httpx.RequestError as exc:
                if attempt + 1 < attempts:
                    logger.warning("NVIDIA transport retry %d", attempt + 1)
                    await self._backoff(attempt)
                    continue
                if isinstance(exc, httpx.TimeoutException):
                    raise AIProviderError(
                        504, "ai_timeout", "AI provider timed out", True
                    ) from None
                raise AIProviderError(
                    502, "ai_unavailable", "AI provider unavailable", True
                ) from None
            if response.status_code == 200:
                return response
            if response.status_code in TRANSIENT_STATUS and attempt + 1 < attempts:
                logger.warning("NVIDIA HTTP %d; retry %d", response.status_code, attempt + 1)
                await self._backoff(attempt, response.headers.get("retry-after"))
                continue
            raise status_error(response.status_code)
        raise AssertionError("unreachable")

    async def complete(
        self, messages, *, temperature, max_tokens, json_output=True, timeout_seconds=None
    ) -> str:
        timeout_seconds = timeout_seconds or self.settings.ai_timeout_seconds
        try:
            async with asyncio.timeout(timeout_seconds):
                response = await self._request(
                    self._payload(
                        messages,
                        temperature,
                        max_tokens,
                        json_output=json_output,
                        enable_thinking=False,
                    ),
                    timeout_seconds,
                )
        except TimeoutError:
            raise AIProviderError(504, "ai_timeout", "AI provider timed out", True) from None
        try:
            if len(response.content) > 2_000_000:
                raise ValueError("Oversized response")
            choice = response.json()["choices"][0]
            if choice.get("finish_reason") in {"length", "content_filter"}:
                raise ValueError("Incomplete response")
            content = choice["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Missing content")
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            raise AIProviderError(
                502, "ai_invalid_response", "AI provider returned an invalid or incomplete response"
            ) from None
        return content

    async def stream(
        self,
        messages,
        *,
        temperature,
        max_tokens,
        http_timeout: httpx.Timeout | None = None,
        total_timeout_seconds: float | None = None,
        enable_thinking: bool | None = None,
        on_response: Callable[[int], None] | None = None,
    ) -> AsyncIterator[str]:
        """Future streaming adapter; never replay a stream after yielding tokens."""
        # Per-call diagnostic overrides; normal streaming/generation defaults stay intact.
        payload = self._payload(
            messages,
            temperature,
            max_tokens,
            stream=True,
            json_output=False,
            enable_thinking=enable_thinking,
        )
        request_options = {"timeout": http_timeout} if http_timeout is not None else {}
        deadline = (
            self.settings.ai_timeout_seconds
            if total_timeout_seconds is None
            else total_timeout_seconds
        )
        emitted = False
        try:
            async with asyncio.timeout(deadline):
                for attempt in range(self.settings.ai_max_retries + 1):
                    try:
                        async with self._client.stream(
                            "POST",
                            "chat/completions",
                            headers=self._headers(stream=True),
                            json=payload,
                            **request_options,
                        ) as response:
                            if on_response:
                                on_response(response.status_code)
                            if response.status_code != 200:
                                if (
                                    response.status_code in TRANSIENT_STATUS
                                    and attempt < self.settings.ai_max_retries
                                ):
                                    await self._backoff(attempt)
                                    continue
                                raise status_error(response.status_code)
                            async for line in response.aiter_lines():
                                if not line.startswith("data:"):
                                    continue
                                event = line[5:].strip()
                                if event == "[DONE]":
                                    return
                                try:
                                    data = json.loads(event)
                                    if data.get("choices") == [] and "usage" in data:
                                        continue
                                    content = data["choices"][0]["delta"].get("content")
                                    if content is not None and not isinstance(content, str):
                                        raise ValueError("Invalid token")
                                except (
                                    ValueError,
                                    KeyError,
                                    IndexError,
                                    TypeError,
                                    AttributeError,
                                ):
                                    raise AIProviderError(
                                        502, "ai_invalid_response", "AI stream was malformed"
                                    ) from None
                                if content:
                                    emitted = True
                                    yield content
                            raise AIProviderError(
                                502, "ai_incomplete_stream", "AI stream ended unexpectedly"
                            )
                    except httpx.RequestError as exc:
                        if not emitted and attempt < self.settings.ai_max_retries:
                            await self._backoff(attempt)
                            continue
                        if isinstance(exc, httpx.TimeoutException):
                            raise AIProviderError(
                                504, "ai_timeout", "AI provider timed out"
                            ) from None
                        raise AIProviderError(
                            502, "ai_unavailable", "AI stream interrupted"
                        ) from None
        except TimeoutError:
            raise AIProviderError(504, "ai_timeout", "AI provider timed out") from None

    async def close(self):
        await self._client.aclose()
