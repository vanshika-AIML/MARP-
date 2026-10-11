"""Concrete adapters are registered here; selection and persistence know no vendor APIs."""

import json

import aiohttp

from app.services.visuals.interfaces import GeneratedImage, SearchResult, VisualError
from app.services.visuals.network import SafeHTTP


class PixabaySearchProvider:
    name, version = "pixabay", "photos-v1-safe"

    def __init__(self, key, http=None):
        self.key, self.http = key, http or SafeHTTP()

    async def search(self, query, *, safe_search=True):
        if not self.key.get_secret_value():
            raise VisualError("visual_provider_not_configured")
        if not safe_search:
            raise VisualError("safe_search_required")
        body, _ = await self.http.request(
            "GET",
            "https://pixabay.com/api/",
            params={
                "key": self.key.get_secret_value(),
                "q": query[:100],
                "safesearch": "true",
                "image_type": "photo",
                "orientation": "horizontal",
                "min_width": 800,
                "min_height": 450,
                "per_page": 20,
                "order": "popular",
            },
        )
        try:
            results = json.loads(body)["hits"]
            return [
                SearchResult(
                    url=item["largeImageURL"],
                    source_url=item["pageURL"],
                    width=item["imageWidth"],
                    height=item["imageHeight"],
                    alt_text=item.get("tags", query)[:300],
                    attribution={
                        "credit": "Photo by "
                        + str(item.get("user", "Contributor"))[:100]
                        + " on Pixabay",
                        "licence": "Pixabay Content License",
                        "licence_url": "https://pixabay.com/service/license-summary/",
                    },
                )
                for item in results[:20]
            ]
        except (KeyError, ValueError, TypeError):
            raise VisualError("visual_provider_response_invalid") from None


class StabilityImageGenerationProvider:
    name, version = "stability", "stable-image-core-v2beta"

    def __init__(self, key, http=None):
        self.key, self.http = key, http or SafeHTTP()

    async def generate(self, prompt, *, aspect_ratio, style, slide_context):
        if not self.key.get_secret_value():
            raise VisualError("visual_provider_not_configured")
        form = aiohttp.FormData()
        # A filename-free bytes field forces multipart, as required by this API.
        form.add_field(
            "prompt",
            f"{prompt}\nVisual style: {style}\nContext: {slide_context}"[:5000],
            content_type="text/plain",
        )
        form.add_field("aspect_ratio", aspect_ratio)
        form.add_field("output_format", "png")
        body, mime = await self.http.request(
            "POST",
            "https://api.stability.ai/v2beta/stable-image/generate/core",
            headers={"Authorization": "Bearer " + self.key.get_secret_value(), "Accept": "image/*"},
            data=form,
            max_bytes=8 * 1024 * 1024,
            deadline_seconds=35,
        )
        return GeneratedImage(body, mime)


class ProviderRegistry:
    def __init__(self, settings, *, searches=None, generators=None, vision=None):
        self.searches = (
            searches
            if searches is not None
            else {
                "pixabay": PixabaySearchProvider(settings.pixabay_api_key),
            }
        )
        self.generators = (
            generators
            if generators is not None
            else {
                "stability": StabilityImageGenerationProvider(settings.stability_api_key),
            }
        )
        self.vision = vision

    def get(self, mode, config):
        name = config.search_provider if mode == "search" else config.generation_provider
        provider = (self.searches if mode == "search" else self.generators).get(name)
        if provider is None:
            raise VisualError("visual_provider_not_configured")
        return provider
