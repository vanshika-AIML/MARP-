import asyncio
import json
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.schemas.ai import (
    GenerationRequest,
    StructuredBlock,
    StructuredPresentation,
    StructuredSlide,
)
from app.services.ai.json_output import parse_json
from app.services.ai.nvidia_nim import AIProviderError, NvidiaNIMClient
from app.services.marp import split_markdown
from app.services.presentations.marp_compiler import compile_presentation, compile_slide
from app.services.presentations.marp_parser import parse_markdown


async def no_sleep(_seconds):
    return None


def nim(settings, handler, **overrides):
    settings = settings.model_copy(update={"nvidia_api_key": SecretStr("test-key"), **overrides})
    return NvidiaNIMClient(settings, transport=httpx.MockTransport(handler), sleep=no_sleep)


async def test_nim_contract_and_transient_retry(settings):
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(503, text="secret upstream error body")
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"ok":true}'}}]})

    client = nim(settings, handler)
    try:
        assert (
            await client.complete(
                [{"role": "user", "content": "JSON please"}], temperature=0.5, max_tokens=256
            )
            == '{"ok":true}'
        )
        assert len(calls) == 2
        assert str(calls[0].url) == "https://integrate.api.nvidia.com/v1/chat/completions"
        payload = json.loads(calls[0].content)
        assert payload["model"] == "nvidia/nemotron-3-nano-30b-a3b"
        assert payload["stream"] is False
        assert "response_format" not in payload
    finally:
        await client.close()


@pytest.mark.parametrize(
    "status,expected,code,attempts",
    [
        (400, 502, "ai_provider_error", 1),
        (401, 502, "ai_authentication_failed", 1),
        (403, 502, "ai_authentication_failed", 1),
        (422, 502, "ai_provider_error", 1),
        (429, 429, "ai_rate_limited", 3),
        (500, 503, "ai_unavailable", 3),
        (202, 503, "ai_pending", 1),
        (302, 502, "ai_provider_error", 1),
    ],
)
async def test_nim_http_mapping(settings, status, expected, code, attempts, caplog):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, text="do-not-log-this-secret")

    client = nim(settings, handler)
    try:
        with pytest.raises(AIProviderError) as error:
            await client.complete([], temperature=0, max_tokens=256)
        assert (error.value.status_code, error.value.code) == (expected, code)
        assert len(calls) == attempts
        assert "do-not-log-this-secret" not in caplog.text + str(error.value)
        assert "test-key" not in caplog.text
    finally:
        await client.close()


@pytest.mark.parametrize(
    "failure,code", [(httpx.ReadTimeout, "ai_timeout"), (httpx.ConnectError, "ai_unavailable")]
)
async def test_nim_transport_error(settings, failure, code):
    def handler(request):
        raise failure("secret transport detail", request=request)

    client = nim(settings, handler)
    try:
        with pytest.raises(AIProviderError, match="AI provider") as error:
            await client.complete([], temperature=0, max_tokens=256)
        assert error.value.code == code
        assert "secret" not in str(error.value)
    finally:
        await client.close()


async def test_nim_total_timeout_and_missing_key(settings):
    async def handler(_request):
        await asyncio.sleep(1)

    client = nim(settings, handler)
    try:
        with pytest.raises(AIProviderError) as error:
            await client.complete([], temperature=0, max_tokens=256, timeout_seconds=0.01)
        assert error.value.code == "ai_timeout"
    finally:
        await client.close()
    client = NvidiaNIMClient(settings)
    try:
        with pytest.raises(AIProviderError) as error:
            await client.complete([], temperature=0, max_tokens=256)
        assert error.value.code == "ai_not_configured"
    finally:
        await client.close()


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"choices": []},
        {"choices": [{"message": {"content": None}}]},
        {"choices": [{"message": {"content": "{}"}, "finish_reason": "length"}]},
    ],
)
async def test_nim_rejects_invalid_envelopes(settings, body):
    client = nim(settings, lambda _r: httpx.Response(200, json=body))
    try:
        with pytest.raises(AIProviderError) as error:
            await client.complete([], temperature=0, max_tokens=256)
        assert error.value.code == "ai_invalid_response"
    finally:
        await client.close()


async def test_streaming_adapter(settings):
    events = (
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
        'data: {"choices":[],"usage":{"total_tokens":1}}\n\n'
        "data: [DONE]\n\n"
    )
    client = nim(settings, lambda _r: httpx.Response(200, text=events))
    try:
        assert [token async for token in client.stream([], temperature=0, max_tokens=256)] == [
            "Hello"
        ]
    finally:
        await client.close()


def test_safe_json_repair_preserves_quoted_text():
    assert parse_json('```json\n{"text": "keep ,}", "items": [1,],}\n```') == {
        "text": "keep ,}",
        "items": [1],
    }
    assert parse_json('<think>reasoning</think>{"ok": true}') == {"ok": True}
    for value in (
        '{"a":1,"a":2}',
        '{"n":NaN}',
        '{"incomplete":',
        'Here is prose {"ok":true}',
        "{'python': True}",
    ):
        with pytest.raises(ValueError):
            parse_json(value)


def test_marp_structured_round_trip():
    deck = StructuredPresentation(
        title="Sample",
        subtitle="A subtitle",
        theme="minimal",
        slides=[
            StructuredSlide(
                type="table",
                title="Compare",
                content=[
                    StructuredBlock(kind="table", headers=["A", "B"], rows=[["1 | 2", "3"]]),
                    StructuredBlock(kind="bullets", items=["First", "Second"]),
                    StructuredBlock(kind="quote", text="A useful thought"),
                    StructuredBlock(
                        kind="image", alt="Diagram", url="https://example.org/image.png"
                    ),
                ],
                speaker_notes="Notes\n---\nDo not show on slide",
            ),
            StructuredSlide(
                type="code",
                title="Code",
                content=[
                    StructuredBlock(kind="code", text='print("ok")\n````', language="python"),
                ],
            ),
        ],
    )
    markdown = compile_presentation(deck)
    parsed = parse_markdown(markdown)
    assert parsed.title == deck.title and parsed.subtitle == deck.subtitle
    assert parsed.slides[0].speaker_notes == deck.slides[0].speaker_notes
    assert parsed.slides[0].content[0].rows == [["1 | 2", "3"]]
    assert parsed.slides[1].content[0].text == 'print("ok")\n````'
    assert len(split_markdown(markdown).slides) == 2
    assert not any("Notes" in str(block) for block in parsed.slides[0].content)


def test_metadata_updates_preserve_literal_code_comments():
    from app.schemas.ai import VisualIntent
    from app.services.presentations.marp_compiler import update_notes, update_visual

    literal = (
        "```html\n<!-- speaker notes\nCode example\n-->\n"
        '<!-- marp-visual: {"type": "none"} -->\n```'
    )
    raw = "# Notes\n\n" + literal + "\n\n<!-- speaker notes\nOld actual notes\n-->"
    revised = update_notes(raw, "New actual notes")
    revised = update_visual(revised, VisualIntent(type="diagram", query="Flow"))
    assert literal in revised
    assert "Old actual notes" not in revised
    assert revised.count("New actual notes") == 1
    assert parse_markdown(revised).slides[0].speaker_notes == "New actual notes"


def test_compiler_neutralizes_model_html_and_slide_breaks():
    slide = StructuredSlide(
        title="<script>alert(1)</script>",
        content=[
            "safe\n---\n<!-- _class: hacked -->",
            StructuredBlock(kind="code", text="---\nmarp: true\n---"),
            StructuredBlock(kind="image", alt="Planned diagram"),
        ],
    )
    raw = compile_slide(slide)
    assert "<script>" not in raw and "<!-- _class: hacked -->" not in raw
    assert len(split_markdown(raw).slides) == 1
    assert "Image placeholder" in raw
    with pytest.raises(ValidationError):
        StructuredBlock(kind="image", alt="Bad", url="javascript:alert(1)")
    with pytest.raises(ValidationError):
        StructuredBlock(kind="table", headers=["a", "b"], rows=[["a"]])


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "unknown"},
        {"action": "rewrite_slide"},
        {"action": "merge_slides", "presentation_id": str(uuid4())},
        {"action": "generate_full_deck", "slide_id": str(uuid4())},
    ],
)
def test_action_validation(payload):
    with pytest.raises(ValidationError):
        GenerationRequest(prompt="Work on this", **payload)
