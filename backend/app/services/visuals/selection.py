import json
import re
from dataclasses import dataclass


def normalize_query(value):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s.,'-]", " ", value or "")).strip()[:1500]


@dataclass
class VisualPlan:
    mode: str
    query: str
    aspect_ratio: str
    style: str
    placement: str
    context: str


class VisualSelectionService:
    def choose(self, slide, theme, config):
        intent = slide.visual_intent
        if intent.mode == "none" or config.max_visuals_per_deck == 0:
            return None
        # Tables, stats and code usually carry their own visual information.
        if slide.type in {"stats", "table", "code"} and intent.placement != "framed":
            return None
        mode = intent.mode
        if config.preferred_strategy != "auto":
            mode = config.preferred_strategy
        if not (config.search_enabled if mode == "search" else config.generation_enabled):
            return None
        query = normalize_query(intent.prompt if mode == "generate" else intent.query)
        query = query or normalize_query(intent.query or intent.prompt)
        if not query:
            return None
        context = json.dumps(
            {
                "title": slide.title,
                "type": slide.type,
                "theme": theme,
                "content": [
                    block if isinstance(block, str) else block.model_dump(mode="json")
                    for block in slide.content[:5]
                ],
            },
            ensure_ascii=False,
        )[:3000]
        return VisualPlan(
            mode,
            query[:100] if mode == "search" else query,
            intent.aspect_ratio,
            intent.style or config.default_image_style,
            intent.placement,
            context,
        )


def rank_results(results, aspect_ratio):
    width, height = map(int, aspect_ratio.split(":"))
    target = width / height
    usable = [
        item
        for item in results
        if item.safe
        and not item.watermarked
        and item.width >= 800
        and item.height >= 450
        and not any(term in item.url.lower() for term in ("watermark", "watermarked"))
        and item.width >= item.height
    ]
    return sorted(
        usable,
        key=lambda item: (
            abs(item.width / item.height - target),
            -min(item.width * item.height, 8_000_000),
        ),
    )
