"""Optional, small streaming connectivity check; never prints credentials or output."""

import asyncio
import time

import httpx

from app.core.config import Settings
from app.services.ai.nvidia_nim import AIProviderError, NvidiaNIMClient


async def main() -> int:
    settings = Settings()
    if not settings.nvidia_api_key:
        print("NVIDIA_API_KEY is empty; manual NIM test skipped", flush=True)
        return 0
    # A smoke check needs one diagnostic attempt, not normal generation retry policy.
    client = NvidiaNIMClient(settings.model_copy(update={"ai_max_retries": 0}))
    started = time.monotonic()
    received = False

    def progress(message):
        print(f"{message} ({time.monotonic() - started:.1f}s)", flush=True)

    def response_status(status):
        progress("connected / HTTP 200" if status == 200 else f"provider HTTP {status}")

    try:
        progress("connecting")
        async for token in client.stream(
            [{"role": "user", "content": "Reply with exactly OK."}],
            temperature=0,
            max_tokens=16,
            enable_thinking=False,
            http_timeout=httpx.Timeout(connect=10, read=180, write=10, pool=10),
            total_timeout_seconds=200,
            on_response=response_status,
        ):
            if token and not received:
                received = True
                progress("first token received")
        if not received:
            progress("failed / ai_empty_response: stream completed without output")
            return 1
        progress("completed")
        return 0
    except AIProviderError as exc:
        # These codes/messages are locally defined; never print raw provider exceptions.
        progress(f"failed / {exc.code}: {exc.message}")
        return 1
    finally:
        await client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
