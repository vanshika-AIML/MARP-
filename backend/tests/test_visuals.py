import asyncio
import json
import socket
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import SecretStr

from app.schemas.ai import StructuredSlide, VisualIntent
from app.schemas.visuals import MediaReference, VisualSettings
from app.services.presentations.marp_compiler import compile_slide
from app.services.presentations.marp_parser import parse_slide
from app.services.visuals.interfaces import SearchResult, VisualError
from app.services.visuals.network import PublicResolver, SafeHTTP, validate_url
from app.services.visuals.providers import PixabaySearchProvider, StabilityImageGenerationProvider
from app.services.visuals.selection import VisualSelectionService, rank_results
from app.services.visuals.storage import LocalMediaStorageProvider, validate_image
from tests.visual_fixtures import image_bytes


@pytest.mark.parametrize(
    "mode,kind,placement,expected",
    [
        ("none", "content", "split", None),
        ("search", "image_text", "split", "search"),
        ("generate", "title", "hero", "generate"),
        ("search", "code", "split", None),
        ("search", "table", "split", None),
        ("generate", "stats", "split", None),
        ("generate", "quote", "background", "generate"),
        ("search", "code", "framed", "search"),
    ],
)
def test_selection(mode, kind, placement, expected):
    config = VisualSettings(search_enabled=True, generation_enabled=True)
    slide = StructuredSlide(
        type=kind,
        title="Title",
        visual_intent=VisualIntent(
            mode=mode,
            query="Useful subject",
            placement=placement,
        ),
    )
    choice = VisualSelectionService().choose(slide, "minimal", config)
    assert (choice.mode if choice else None) == expected


def test_legacy_intent_and_disabled_provider():
    intent = VisualIntent(type="diagram", query="Connected nodes")
    assert intent.mode == "generate"
    slide = StructuredSlide(title="Test", visual_intent=intent)
    assert VisualSelectionService().choose(slide, "minimal", VisualSettings()) is None


@pytest.mark.parametrize("address", ["64:ff9b::7f00:1", "2002:7f00:1::", "fec0::1"])
def test_transition_and_site_local_addresses_rejected(address):
    from app.services.visuals.network import public_ip

    assert not public_ip(address)


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/a.png",
        "https://localhost/a",
        "https://127.0.0.1/a",
        "https://10.0.0.1/a",
        "https://169.254.169.254/latest/meta-data",
        "https://[::1]/a",
        "https://[::ffff:127.0.0.1]/a",
        "https://host.internal/a",
        "https://example.com:444/a",
        "https://user:secret@example.com/a",
        "file:///etc/passwd",
        "data:image/png;base64,abc",
        "https://example.com/\nbad",
        "https://[fe80::1%25eth0]/a",
        "https://224.0.0.1/a",
    ],
)
def test_unsafe_urls(url):
    with pytest.raises(VisualError):
        validate_url(url)


async def test_dns_rebinding_and_mixed_answers_rejected(monkeypatch):
    resolver = PublicResolver()
    lookup = AsyncMock(
        return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
        ]
    )
    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", lookup)
    result = await resolver.resolve("images.example.com")
    assert result[0]["host"] == "93.184.216.34"
    lookup.assert_awaited_once()
    lookup.return_value.append((socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 443)))
    with pytest.raises(VisualError):
        await resolver.resolve("images.example.com")


async def test_private_redirect_blocked(monkeypatch):
    class Response:
        status = 302
        headers = {"Location": "https://127.0.0.1/secret"}
        url = "https://images.example.com/a"

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    class Client:
        def __init__(self, **kwargs):
            self.connector = kwargs["connector"]

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            await self.connector.close()

        def request(self, *args, **kwargs):
            assert kwargs["allow_redirects"] is False
            return Response()

    monkeypatch.setattr("app.services.visuals.network.aiohttp.ClientSession", Client)
    with pytest.raises(VisualError, match="unsafe_media_url"):
        await SafeHTTP().download("https://images.example.com/a", 1000)


@pytest.mark.parametrize(
    "body,mime",
    [
        (b"<svg><script>bad()</script></svg>", "image/svg+xml"),
        (b"broken", "image/png"),
        (image_bytes(size=(10, 10)), "image/png"),
        (image_bytes(), "image/jpeg"),
    ],
    ids=["svg", "corrupt", "small", "mime-mismatch"],
)
def test_invalid_media(body, mime):
    with pytest.raises(VisualError):
        validate_image(body, mime, 8 * 1024 * 1024)


def test_sanitized_image_and_ranking():
    content, width, height, digest = validate_image(image_bytes(), "image/png", 100000)
    assert content.startswith(b"\xff\xd8") and (width, height) == (1200, 675)
    assert len(digest) == 64
    best = SearchResult("https://example.com/best", "https://example.com", 1600, 900, "Good")
    square = SearchResult("https://example.com/square", "https://example.com", 900, 900, "Square")
    bad = SearchResult("https://example.com/watermark", "https://example.com", 1600, 900, "Bad")
    assert rank_results([square, bad, best], "16:9") == [best, square]


@pytest.mark.parametrize(
    "placement,directive",
    [
        ("full_bleed", "bg cover"),
        ("split", "bg right:45% cover"),
        ("hero", "w:1000 h:300"),
        ("background", "opacity:0.25"),
        ("framed", "w:900 h:420"),
    ],
)
def test_marp_layout_and_media_round_trip(placement, directive):
    asset_id = uuid4()
    slide = StructuredSlide(
        title="Visual",
        content=["Clear text"],
        media=MediaReference(
            asset_id=asset_id,
            url=f"/api/v1/media/{asset_id}/file",
            alt_text="Calm landscape",
            width=1200,
            height=675,
            placement=placement,
            attribution="Artist on provider",
            source_url="https://example.com/source",
        ),
    )
    raw = compile_slide(slide)
    assert directive in raw and "visual-" + placement.replace("_", "-") in raw
    assert "Artist on provider" in raw
    parsed = parse_slide(raw)
    assert parsed.media == slide.media
    assert "Clear text" in str(parsed.content)
    assert compile_slide(parsed) == raw


async def test_adapters_and_safe_parameters():
    http = SimpleNamespace(
        request=AsyncMock(
            return_value=(
                json.dumps(
                    {
                        "hits": [
                            {
                                "largeImageURL": "https://images.example.com/a.png",
                                "pageURL": "https://example.com/a",
                                "imageWidth": 1200,
                                "imageHeight": 675,
                                "user": "Artist",
                            }
                        ]
                    }
                ).encode(),
                "application/json",
            )
        )
    )
    provider = PixabaySearchProvider(SecretStr("test-secret"), http)
    result = await provider.search("City", safe_search=True)
    assert result[0].attribution["licence"] == "Pixabay Content License"
    assert http.request.await_args.kwargs["params"]["safesearch"] == "true"
    http.request.return_value = (image_bytes(), "image/png")
    generated = await StabilityImageGenerationProvider(SecretStr("test-secret"), http).generate(
        "Abstract flow",
        aspect_ratio="16:9",
        style="editorial",
        slide_context="Ideas",
    )
    assert generated.mime_type == "image/png"
    assert http.request.await_args.kwargs["data"].is_multipart
    with pytest.raises(VisualError, match="not_configured"):
        await PixabaySearchProvider(SecretStr("")).search("City", safe_search=True)


async def test_media_storage_path_safety(settings, tmp_path):
    storage = LocalMediaStorageProvider(settings.model_copy(update={"media_dir": str(tmp_path)}))
    with pytest.raises(VisualError):
        storage.path("../private.jpg")
    key = uuid4().hex + ".jpg"
    await storage.save(key, b"test")
    assert storage.path(key).read_bytes() == b"test"
    await storage.delete(key)
    assert not storage.path(key).exists()
