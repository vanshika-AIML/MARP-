"""Idempotent, non-destructive development data: python -m app.scripts.seed."""

import asyncio
import logging
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import Settings
from app.core.database import Database
from app.core.logging import configure_logging
from app.models import AppConfig, FeatureFlag, Template, Theme
from app.repositories.content import ContentRepository
from app.services.content import transaction

THEMES = [
    {
        "name": "Editorial",
        "slug": "editorial",
        "config": {
            "background": "#faf8f5",
            "foreground": "#20242a",
            "accent": "#3158a5",
            "fontFamily": "Georgia, serif",
            "layout": "editorial",
        },
    },
    {
        "name": "Midnight",
        "slug": "midnight",
        "config": {
            "background": "#151a26",
            "foreground": "#f5f7fc",
            "accent": "#b6c7ff",
            "fontFamily": "Inter, sans-serif",
            "layout": "cinematic",
        },
    },
    {
        "name": "Minimal",
        "slug": "minimal",
        "config": {
            "background": "#ffffff",
            "foreground": "#171717",
            "accent": "#526556",
            "fontFamily": "Inter, sans-serif",
            "layout": "minimal",
        },
    },
]
TEMPLATES = [
    (
        "project-brief",
        "Project Brief",
        "business",
        "editorial",
        "# Project Brief\n\nA clear idea, ready to share.\n\n---\n\n## The opportunity\n\n"
        "- What matters\n- What we can improve\n\n---\n\n## Next steps\n\n"
        "Define the first milestone.",
    ),
    (
        "product-story",
        "Product Story",
        "product",
        "midnight",
        "# A New Perspective\n\nIntroduce your product.\n\n---\n\n## The problem\n\n"
        "Describe the challenge.\n\n---\n\n## The solution\n\nShow how it works.",
    ),
    (
        "lesson-plan",
        "Lesson Plan",
        "education",
        "minimal",
        "# Learn Something New\n\nOne idea at a time.\n\n---\n\n## Key concepts\n\n"
        "- Understand\n- Practice\n- Reflect\n\n---\n\n## Try it yourself\n\n"
        "Put the idea into practice.",
    ),
]
CONFIG = {
    "landing": {"headline": "MARP Studio", "tagline": "Turn ideas into presentations."},
    "dashboard": {"default_tab": "home"},
    "animations": {"enabled": True, "respect_reduced_motion": True},
    "ai": {"enabled": False},
    "general": {"app_name": "MARP Studio"},
    "media": {"learn_video_url": None},
}
FLAGS = {
    "create_with_ai": False,
    "upload_template": False,
    "explore_templates": True,
    "learn_with_video": True,
    "ai_agent": False,
    "custom_themes": True,
    "exports": False,
    "animations": True,
}


def seed_id(kind: str, key: str):
    return uuid5(NAMESPACE_URL, f"https://marp.studio/development-seed/{kind}/{key}")


async def seed(session):
    async with transaction(session):
        repo = ContentRepository(session)
        await repo.lock_themes()
        themes = {}
        for order, data in enumerate(THEMES):
            await session.execute(
                insert(Theme)
                .values(
                    id=seed_id("themes", data["slug"]),
                    sort_order=order,
                    description=f"{data['name']} presentation style",
                    **data,
                )
                .on_conflict_do_nothing()
            )
            themes[data["slug"]] = await session.scalar(
                select(Theme).where(Theme.slug == data["slug"])
            )
        if await repo.default_theme() is None:
            candidate = next(
                (theme for theme in themes.values() if theme and theme.is_active), None
            )
            if candidate:
                candidate.is_default = True
                await session.flush()
        for order, (key, name, category, slug, body) in enumerate(TEMPLATES):
            theme = themes[slug]
            await session.execute(
                insert(Template)
                .values(
                    id=seed_id("templates", key),
                    name=name,
                    category=category,
                    description=f"A starting point for your {name.lower()}.",
                    theme_id=theme.id if theme else None,
                    tags=[category, "starter"],
                    starter_markdown=(
                        f"---\nmarp: true\ntheme: {slug}\npaginate: true\n---\n\n{body}"
                    ),
                    is_featured=True,
                    sort_order=order,
                )
                .on_conflict_do_nothing()
            )
        for namespace, values in CONFIG.items():
            for key, value in values.items():
                await session.execute(
                    insert(AppConfig)
                    .values(
                        namespace=namespace,
                        key=key,
                        value=value,
                    )
                    .on_conflict_do_nothing(index_elements=[AppConfig.namespace, AppConfig.key])
                )
        for key, enabled in FLAGS.items():
            await session.execute(
                insert(FeatureFlag)
                .values(key=key, enabled=enabled)
                .on_conflict_do_nothing(index_elements=[FeatureFlag.key])
            )


async def main():
    settings = Settings()
    configure_logging(settings.log_level)
    logger = logging.getLogger("marp.seed")
    if settings.app_env not in {"development", "test"}:
        logger.error("Development seed is disabled outside development/test")
        raise SystemExit(1)
    database = Database(settings)
    try:
        async with database.session_factory() as session:
            await seed(session)
        logger.info("Development seed complete; existing records preserved")
    except Exception as exc:
        logger.error(
            "Seed failed (%s); check database availability and migrations", type(exc).__name__
        )
        raise SystemExit(1) from None
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
