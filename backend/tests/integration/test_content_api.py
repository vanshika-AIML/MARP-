import asyncio
from datetime import datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import AppConfig, FeatureFlag, Presentation, Slide, Template, Theme
from app.scripts.seed import seed


async def call(client, method, path, payload=None, status=200):
    response = await client.request(method, path, json=payload)
    assert response.status_code == status, response.text
    return response.json() if status != 204 else None


async def create_deck(client, **values):
    return await call(client, "POST", "/presentations", {"title": "Deck", **values}, 201)


async def create_theme(client, slug="editorial", **values):
    return await call(client, "POST", "/themes", {"name": slug, "slug": slug, **values}, 201)


async def test_presentation_crud_and_cascade(client, sessions):
    markdown = "---\nmarp: true\ntheme: editorial\n---\n\n# One\n\n---\n\n# Two"
    deck = await create_deck(client, markdown=markdown)
    assert UUID(deck["id"])
    assert datetime.fromisoformat(deck["created_at"]).utcoffset().total_seconds() == 0
    assert (await call(client, "GET", f"/presentations/{deck['id']}"))["markdown"] == markdown
    slides = await call(client, "GET", f"/presentations/{deck['id']}/slides")
    assert [s["position"] for s in slides] == [0, 1]
    assert [s["raw_markdown"] for s in slides] == ["# One", "# Two"]
    updated = await call(
        client,
        "PATCH",
        f"/presentations/{deck['id']}",
        {
            "title": "Revised",
            "description": "A description",
            "status": "ready",
        },
    )
    assert updated["title"] == "Revised" and updated["status"] == "ready"
    assert updated["updated_at"] >= deck["updated_at"]
    assert updated["markdown"] == markdown
    listing = await call(client, "GET", "/presentations")
    assert len(listing) == 1 and "markdown" not in listing[0]
    await call(client, "DELETE", f"/presentations/{deck['id']}", status=204)
    await call(client, "GET", f"/presentations/{deck['id']}", status=404)
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Slide)) == 0


async def test_slide_crud_sync_and_positions(client):
    header = "---\nmarp: true\npaginate: true\n---"
    deck = await create_deck(client, markdown=header)
    path = f"/presentations/{deck['id']}"
    first = await call(
        client,
        "POST",
        path + "/slides",
        {
            "raw_markdown": "# First",
            "position": 4,
            "speaker_notes": "Discuss this",
            "structured_content": {"paragraph": "First"},
            "visual_config": {"layout": "lead"},
        },
        201,
    )
    second = await call(client, "POST", path + "/slides", {"raw_markdown": "# Second"}, 201)
    assert second["position"] == 5
    await call(client, "POST", path + "/slides", {"position": 4}, 409)
    await call(client, "PATCH", f"/slides/{second['id']}", {"position": 4}, 409)
    edited = await call(
        client,
        "PATCH",
        f"/slides/{first['id']}",
        {
            "raw_markdown": "# Revised",
            "title": "Revised",
            "speaker_notes": None,
        },
    )
    assert edited["speaker_notes"] is None
    assert (await call(client, "GET", path))[
        "markdown"
    ] == header + "\n\n# Revised\n\n---\n\n# Second"
    assert len(await call(client, "GET", path + "/slides?search=Second&limit=1")) == 1
    await call(client, "DELETE", f"/slides/{first['id']}", status=204)
    assert (await call(client, "GET", path))["markdown"] == header + "\n\n# Second"
    await call(client, "DELETE", f"/slides/{second['id']}", status=204)
    assert (await call(client, "GET", path))["markdown"].strip() == header


async def test_atomic_reorder_validates_complete_membership(client):
    deck = await create_deck(client, markdown="# A\n---\n# B\n---\n# C")
    path = f"/presentations/{deck['id']}"
    slides = await call(client, "GET", path + "/slides")
    ids = [s["id"] for s in slides]
    other = await create_deck(client, markdown="# Foreign")
    foreign = (await call(client, "GET", f"/presentations/{other['id']}/slides"))[0]["id"]
    for invalid in (ids[:2], [ids[0], ids[0], ids[2]], [*ids[:2], foreign], []):
        await call(client, "POST", path + "/slides/reorder", {"slide_ids": invalid}, 400)
        assert (await call(client, "GET", path))["markdown"] == deck["markdown"]
    reordered = await call(client, "POST", path + "/slides/reorder", {"slide_ids": ids[::-1]})
    assert [s["id"] for s in reordered] == ids[::-1]
    assert [s["position"] for s in reordered] == [0, 1, 2]
    assert (await call(client, "GET", path))["markdown"] == "# C\n\n---\n\n# B\n\n---\n\n# A"


async def test_whole_markdown_edit_reconciles_slide_rows(client):
    deck = await create_deck(client, markdown="# One\n---\n# Two")
    path = f"/presentations/{deck['id']}"
    initial = await call(client, "GET", path + "/slides")
    for slide in initial:
        await call(client, "PATCH", f"/slides/{slide['id']}", {"structured_content": {"old": True}})
    await call(client, "PATCH", path, {"markdown": "# One\n---\n# Changed\n---\n# Added"})
    slides = await call(client, "GET", path + "/slides")
    assert [s["id"] for s in slides[:2]] == [s["id"] for s in initial]
    assert slides[0]["structured_content"] == {"old": True}
    assert slides[1]["structured_content"] is None
    assert len(slides) == 3
    await call(client, "PATCH", path, {"markdown": ""})
    assert await call(client, "GET", path + "/slides") == []


async def test_template_crud_duplicate_and_multiple_presentations(client):
    theme = await create_theme(client)
    template = await call(
        client,
        "POST",
        "/templates",
        {
            "name": "Brief",
            "category": "business",
            "tags": ["starter"],
            "theme_id": theme["id"],
            "starter_markdown": "---\nmarp: true\n---\n\n# Brief\n\n---\n\n# Details",
            "thumbnail_url": "https://example.org/preview.png",
        },
        201,
    )
    path = f"/templates/{template['id']}"
    assert (await call(client, "GET", path))["tags"] == ["starter"]
    updated = await call(client, "PATCH", path, {"name": "Updated brief", "is_featured": True})
    assert updated["is_featured"]
    duplicate = await call(client, "POST", path + "/duplicate", status=201)
    assert duplicate["id"] != template["id"]
    assert duplicate["starter_markdown"] == template["starter_markdown"]
    assert duplicate["is_featured"] is False
    decks = [
        await call(client, "POST", path + "/create-presentation", status=201) for _ in range(2)
    ]
    assert len({template["id"], decks[0]["id"], decks[1]["id"]}) == 3
    for deck in decks:
        assert deck["theme_id"] == theme["id"]
        assert len(await call(client, "GET", f"/presentations/{deck['id']}/slides")) == 2
    assert (await call(client, "GET", path))["starter_markdown"] == template["starter_markdown"]
    await call(client, "DELETE", path, status=204)
    await call(client, "GET", path, status=404)
    assert len(await call(client, "GET", "/presentations")) == 2


async def test_theme_crud_defaults_conflicts_and_reference_cleanup(client):
    first = await create_theme(client, is_default=True)
    second = await create_theme(
        client, "minimal", config={"accent": "#000"}, css="section {color: black;}"
    )
    assert (await call(client, "GET", f"/themes/{second['id']}"))["config"] == {"accent": "#000"}
    await call(client, "PATCH", f"/themes/{first['id']}", {"is_active": False}, 409)
    await call(client, "DELETE", f"/themes/{first['id']}", status=409)
    await call(
        client,
        "POST",
        "/themes",
        {"name": "Duplicate", "slug": "editorial", "is_default": True},
        409,
    )
    assert (await call(client, "GET", f"/themes/{first['id']}"))["is_default"]
    await call(client, "POST", f"/themes/{second['id']}/set-default")
    assert len([t for t in await call(client, "GET", "/themes") if t["is_default"]]) == 1
    assert not (await call(client, "GET", f"/themes/{first['id']}"))["is_default"]
    duplicate = await call(client, "POST", f"/themes/{second['id']}/duplicate", status=201)
    assert duplicate["slug"] != second["slug"] and not duplicate["is_default"]
    assert duplicate["css"] == second["css"]
    await call(client, "PATCH", f"/themes/{first['id']}", {"name": "Renamed"})
    deck = await create_deck(client, theme_id=first["id"])
    template = await call(
        client, "POST", "/templates", {"name": "Linked", "theme_id": first["id"]}, 201
    )
    await call(client, "DELETE", f"/themes/{first['id']}", status=204)
    assert (await call(client, "GET", f"/presentations/{deck['id']}"))["theme_id"] is None
    assert (await call(client, "GET", f"/templates/{template['id']}"))["theme_id"] is None


async def test_config_flags_upsert_and_secret_rejection(client):
    path = "/admin/config/landing/headline"
    first = await call(
        client, "PUT", path, {"value": {"text": "MARP Studio"}, "description": "Title"}
    )
    updated = await call(client, "PUT", path, {"value": ["New", "Title"]})
    assert first["id"] == updated["id"]
    assert updated["value"] == ["New", "Title"]
    assert (await call(client, "GET", "/admin/config/landing"))[0]["value"] == ["New", "Title"]
    assert len(await call(client, "GET", "/admin/config?search=head&limit=1")) == 1
    await call(client, "PUT", "/admin/config/media/video", {"value": None})
    await call(client, "PUT", "/admin/config/ai/nvidia_api_key", {"value": "forbidden"}, 400)
    await call(
        client,
        "PUT",
        "/admin/config/ai/options",
        {"value": {"nested": {"apiKey": "forbidden"}}},
        400,
    )
    await call(client, "PUT", "/admin/config/general/oversize", {"value": "a" * 100001}, 400)
    flag = await call(
        client,
        "PUT",
        "/admin/feature-flags/animations",
        {"enabled": True, "config": {"duration": 200}},
    )
    replacement = await call(client, "PUT", "/admin/feature-flags/animations", {"enabled": False})
    assert flag["id"] == replacement["id"] and replacement["config"] is None
    assert (await call(client, "GET", "/feature-flags"))[0]["enabled"] is False


async def test_pagination_and_filters(client):
    for i in range(4):
        await create_deck(client, title=f"Report {i}", status="ready" if i % 2 else "draft")
    await create_deck(client, title="100% coverage")
    assert len(await call(client, "GET", "/presentations?status=ready&search=REPORT")) == 2
    assert len(await call(client, "GET", "/presentations?search=%25")) == 1
    all_items = await call(client, "GET", "/presentations")
    page = await call(client, "GET", "/presentations?limit=2&offset=1")
    assert [p["id"] for p in page] == [p["id"] for p in all_items[1:3]]
    for i in range(3):
        await create_theme(client, f"theme-{i}", is_active=i < 2, sort_order=i)
        await call(
            client,
            "POST",
            "/templates",
            {
                "name": f"Template {i}",
                "is_active": i < 2,
                "category": "business" if i else "education",
                "is_featured": i == 1,
            },
            201,
        )
    assert len(await call(client, "GET", "/themes")) == 2
    assert len(await call(client, "GET", "/themes?all=true")) == 3
    assert len(await call(client, "GET", "/themes?active=false")) == 1
    assert len(await call(client, "GET", "/templates")) == 2
    assert len(await call(client, "GET", "/templates?all=true")) == 3
    assert len(await call(client, "GET", "/templates?category=business&featured=true")) == 1
    assert len(await call(client, "GET", "/templates?active=false&search=Template")) == 1


@pytest.mark.parametrize("resource", ["presentations", "templates", "themes"])
async def test_missing_and_invalid_ids(client, resource):
    for resource_id in ("not-a-uuid", str(uuid4())):
        for method, payload in (("GET", None), ("PATCH", {}), ("DELETE", None)):
            response = await call(client, method, f"/{resource}/{resource_id}", payload, 404)
            assert response["error"]["code"] == "http_404"


@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("POST", "/presentations", {"title": " "}),
        ("POST", "/presentations", {"status": "invalid"}),
        ("POST", "/presentations", {"owner_id": "unsupported"}),
        ("POST", "/templates", {"name": "Template", "thumbnail_url": "javascript:alert(1)"}),
        ("POST", "/themes", {"name": "Theme", "slug": "Invalid Slug"}),
        (
            "POST",
            "/themes",
            {"name": "Theme", "slug": "inactive", "is_default": True, "is_active": False},
        ),
        ("GET", "/presentations?limit=0", None),
        ("GET", "/themes?offset=-1", None),
    ],
)
async def test_validation(client, method, path, payload):
    await call(client, method, path, payload, 400)


async def test_invalid_slide_and_patch_inputs_do_not_mutate(client):
    deck = await create_deck(client)
    path = f"/presentations/{deck['id']}"
    await call(client, "PATCH", path, {"title": None}, 400)
    await call(client, "PATCH", path, {"markdown": None}, 400)
    await call(client, "POST", path + "/slides", {"position": -1}, 400)
    await call(client, "POST", path + "/slides", {"position": True}, 400)
    await call(client, "POST", path + "/slides", {"raw_markdown": "# A\n---\n# B"}, 400)
    await call(client, "POST", path + "/slides", {"raw_markdown": "---\nmarp: true\n---\n# A"}, 400)
    await call(client, "PATCH", "/slides/not-a-uuid", {}, 404)
    await call(client, "DELETE", f"/slides/{uuid4()}", status=404)
    await call(client, "POST", f"/presentations/{uuid4()}/slides", {}, 404)
    await call(client, "POST", "/presentations", {"theme_id": str(uuid4())}, 404)
    assert (await call(client, "GET", path))["markdown"] == ""


async def test_catalog_nullable_fields_and_url_limit(client):
    theme = await create_theme(client)
    template = await call(client, "POST", "/templates", {"name": "Template"}, 201)
    await call(client, "PATCH", f"/themes/{theme['id']}", {"config": None}, 400)
    await call(client, "PATCH", f"/templates/{template['id']}", {"description": None}, 400)
    await call(client, "PATCH", f"/templates/{template['id']}", {"tags": None}, 400)
    await call(client, "PATCH", f"/templates/{template['id']}", {"thumbnail_url": None})
    await call(
        client,
        "POST",
        "/templates",
        {
            "name": "Oversize URL",
            "thumbnail_url": "https://example.org/" + "a" * 2060,
        },
        400,
    )


async def test_concurrent_defaults_and_slide_appends(client):
    themes = [await create_theme(client, f"theme-{i}") for i in range(3)]
    results = await asyncio.gather(
        *[client.post(f"/themes/{theme['id']}/set-default") for theme in themes]
    )
    assert [r.status_code for r in results] == [200, 200, 200]
    assert sum(t["is_default"] for t in await call(client, "GET", "/themes")) == 1
    deck = await create_deck(client)
    path = f"/presentations/{deck['id']}"
    results = await asyncio.gather(
        *[client.post(path + "/slides", json={"raw_markdown": f"# {i}"}) for i in range(5)]
    )
    assert all(r.status_code == 201 for r in results)
    slides = await call(client, "GET", path + "/slides")
    assert [s["position"] for s in slides] == list(range(5))
    markdown = (await call(client, "GET", path))["markdown"]
    assert all(f"# {i}" in markdown for i in range(5))


async def test_database_constraints_and_migration(sessions):
    async with sessions() as session:
        assert (
            await session.scalar(text("SELECT version_num FROM alembic_version"))
            == "0006_hardening"
        )
        session.add_all(
            [Theme(name="A", slug="a", is_default=True), Theme(name="B", slug="b", is_default=True)]
        )
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()
        session.add_all([Theme(name="A", slug="same"), Theme(name="B", slug="same")])
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()
        deck = Presentation(title="Deck")
        session.add(deck)
        await session.commit()
        deck_id = deck.id
        session.add_all(
            [Slide(presentation_id=deck_id, position=0), Slide(presentation_id=deck_id, position=0)]
        )
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()
        session.add(Slide(presentation_id=deck_id, position=-1))
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()
        session.add(Slide(presentation_id=uuid4(), position=0))
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()


async def test_seed_is_idempotent_and_preserves_edits(sessions):
    async with sessions() as session:
        await seed(session)
        themes = list(await session.scalars(select(Theme)))
        assert len(themes) == 3 and sum(t.is_default for t in themes) == 1
        template = await session.scalar(select(Template).limit(1))
        template.name = "Custom edit"
        template_id = template.id
        flag = await session.scalar(select(FeatureFlag).where(FeatureFlag.key == "animations"))
        flag.enabled = False
        config = await session.scalar(select(AppConfig).where(AppConfig.key == "headline"))
        config.value = "Custom headline"
        await session.commit()
        await seed(session)
        await session.refresh(template)
        await session.refresh(flag)
        await session.refresh(config)
        assert template.id == template_id and template.name == "Custom edit"
        assert flag.enabled is False and config.value == "Custom headline"
        for model, count in [(Theme, 3), (Template, 3), (FeatureFlag, 8), (AppConfig, 8)]:
            assert await session.scalar(select(func.count()).select_from(model)) == count
