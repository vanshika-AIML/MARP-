import json
from uuid import UUID, uuid4

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from app.models import Presentation, Slide
from app.services.ai.nvidia_nim import NvidiaNIMClient
from app.services.marp import split_markdown


def deck(*titles):
    return {
        "title": "Generated",
        "theme": "minimal",
        "slides": [
            {
                "type": "content",
                "title": title,
                "content": [f"Content for {title}"],
                "speaker_notes": "Explain this point",
                "visual_intent": {"type": "none"},
            }
            for title in titles
        ],
    }


@pytest.fixture(autouse=True)
def provider(monkeypatch):
    state = {"responses": [], "calls": [], "callback": None}

    async def handler(request):
        state["calls"].append(json.loads(request.content))
        if state["callback"]:
            callback, state["callback"] = state["callback"], None
            await callback()
        output = state["responses"].pop(0)
        if isinstance(output, int):
            return httpx.Response(output, text="upstream-private-details")
        text = output if isinstance(output, str) else json.dumps(output)
        if json.loads(request.content).get("stream"):
            event = json.dumps({"choices": [{"delta": {"content": text}}]})
            return httpx.Response(200, text=f"data: {event}\n\ndata: [DONE]\n\n")
        return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})

    def factory(settings):
        return NvidiaNIMClient(
            settings.model_copy(
                update={
                    "nvidia_api_key": SecretStr("mock-only"),
                    "ai_max_retries": 0,
                }
            ),
            transport=httpx.MockTransport(handler),
        )

    monkeypatch.setattr("app.main.NvidiaNIMClient", factory)
    return state


async def generate(client, provider, action, output, **kwargs):
    provider["responses"].append(output)
    response = await client.post(
        "/ai/generate",
        json={
            "action": action,
            "prompt": "Explain it clearly",
            **kwargs,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


async def existing(client):
    response = await client.post(
        "/presentations",
        json={
            "title": "Original",
            "markdown": "---\nmarp: true\ntheme: minimal\nheader: Keep\n---"
            "\n\n# First\n\nOriginal first\n\n---\n\n# Second\n\nOriginal second"
            "\n\n---\n\n# Third\n\nOriginal third",
        },
    )
    assert response.status_code == 201
    parent = response.json()
    rows = (await client.get(f"/presentations/{parent['id']}/slides")).json()
    return parent, rows


async def test_full_generation_persists_canonical_and_structured(client, provider, sessions):
    result = await generate(
        client, provider, "generate_full_deck", deck("One", "Two"), options={"slide_count": 2}
    )
    assert result["persisted"] and len(result["slide_ids"]) == 2
    saved = (await client.get("/presentations/" + result["presentation_id"])).json()
    assert saved["markdown"] == result["markdown"]
    async with sessions() as session:
        rows = list(await session.scalars(select(Slide).order_by(Slide.position)))
        assert [row.position for row in rows] == [0, 1]
        assert [row.raw_markdown for row in rows] == split_markdown(result["markdown"]).slides
        assert rows[1].structured_content["title"] == "Two"
        assert rows[0].speaker_notes == "Explain this point"
    assert "Output JSON schema" in provider["calls"][0]["messages"][1]["content"]


async def test_full_generation_ignores_unknown_model_slide_fields(client, provider):
    output = deck("One")
    output["slides"][0]["subtitle"] = "A supporting line"
    output["slides"][0]["author"] = "Model-added metadata"

    result = await generate(
        client, provider, "generate_full_deck", output, options={"slide_count": 1}
    )

    assert result["presentation"]["slides"][0]["title"] == "One"
    assert "Content for One" in result["markdown"]


@pytest.mark.parametrize("action", ["generate_outline", "generate_single_slide"])
async def test_preview_generation(client, provider, sessions, action):
    result = await generate(client, provider, action, deck("Plan"), options={"slide_count": 1})
    assert not result["persisted"]
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Presentation)) == 0


@pytest.mark.parametrize(
    "action",
    [
        "rewrite_slide",
        "shorten_slide",
        "expand_slide",
        "simplify_slide",
        "change_tone",
        "make_professional",
        "make_creative",
        "make_technical",
        "improve_storytelling",
    ],
)
async def test_slide_edit_preserves_unrelated_rows(client, provider, action):
    parent, rows = await existing(client)
    result = await generate(
        client,
        provider,
        action,
        deck("Revised"),
        slide_id=rows[1]["id"],
        options={"tone": "technical"},
    )
    saved = (await client.get(f"/presentations/{parent['id']}/slides")).json()
    assert [row["id"] for row in saved] == [row["id"] for row in rows]
    assert saved[0]["raw_markdown"] == rows[0]["raw_markdown"]
    assert saved[2]["raw_markdown"] == rows[2]["raw_markdown"]
    assert "Content for Revised" in saved[1]["raw_markdown"]
    assert "header: Keep" in result["markdown"]
    assert (
        result["markdown"]
        == (await client.get(f"/presentations/{parent['id']}")).json()["markdown"]
    )
    assert [s["title"] for s in result["presentation"]["slides"]] == ["First", "Revised", "Third"]


@pytest.mark.parametrize(
    "action", ["generate_single_slide", "generate_agenda", "generate_conclusion"]
)
async def test_append_actions_do_not_replace_deck(client, provider, action):
    parent, rows = await existing(client)
    result = await generate(client, provider, action, deck("Added"), presentation_id=parent["id"])
    assert len(result["slide_ids"]) == 4
    assert set(row["id"] for row in rows).issubset(result["slide_ids"])


async def test_split_then_merge_preserves_order(client, provider):
    parent, rows = await existing(client)
    result = await generate(
        client,
        provider,
        "split_slide",
        deck("Part A", "Part B"),
        presentation_id=parent["id"],
        slide_id=rows[1]["id"],
    )
    saved = (await client.get(f"/presentations/{parent['id']}/slides")).json()
    assert [s["title"] for s in result["presentation"]["slides"]] == [
        "First",
        "Part A",
        "Part B",
        "Third",
    ]
    assert [s["position"] for s in saved] == [0, 1, 2, 3]
    assert saved[0]["id"] == rows[0]["id"] and saved[3]["id"] == rows[2]["id"]
    result = await generate(
        client,
        provider,
        "merge_slides",
        deck("Combined"),
        presentation_id=parent["id"],
        options={"slide_ids": [saved[1]["id"], saved[2]["id"]]},
    )
    assert [s["title"] for s in result["presentation"]["slides"]] == ["First", "Combined", "Third"]
    assert result["slide_ids"] == [row["id"] for row in rows]


@pytest.mark.parametrize(
    "action,output",
    [
        ("generate_speaker_notes", {"speaker_notes": "New private presenter notes"}),
        (
            "suggest_visuals",
            {"visual_intent": {"type": "diagram", "query": "a simple flow diagram"}},
        ),
    ],
)
async def test_auxiliary_actions_preserve_content(client, provider, action, output):
    parent, rows = await existing(client)
    metadata = {
        "type": "section",
        "title": "Custom title metadata",
        "visual_config": {"crop": "contain", "accent": "blue"},
        "speaker_notes": "Keep these existing notes",
    }
    assert (
        await client.patch(f"/slides/{rows[0]['id']}", json=metadata)
    ).status_code == 200
    result = await generate(client, provider, action, output, slide_id=rows[0]["id"])
    assert "# First\n\nOriginal first" in result["markdown"]
    assert rows[1]["raw_markdown"] in result["markdown"]
    assert len(result["slide_ids"]) == 3
    saved = (await client.get(f"/presentations/{parent['id']}/slides")).json()
    assert saved[1]["raw_markdown"] == rows[1]["raw_markdown"]
    assert saved[0]["type"] == metadata["type"]
    assert saved[0]["title"] == metadata["title"]
    assert saved[0]["visual_config"]["crop"] == "contain"
    if action == "generate_speaker_notes":
        assert saved[0]["visual_config"] == metadata["visual_config"]
    else:
        assert saved[0]["speaker_notes"] == metadata["speaker_notes"]


async def test_reorder_is_only_a_suggestion(client, provider):
    parent, rows = await existing(client)
    order = [row["id"] for row in reversed(rows)]
    result = await generate(
        client,
        provider,
        "reorder_suggestions",
        {"slide_ids": order, "rationale": "Begin with the conclusion"},
        presentation_id=parent["id"],
    )
    assert not result["persisted"] and result["reorder_suggestions"]["slide_ids"] == order
    assert result["markdown"] == parent["markdown"]


async def test_improve_deck_preserves_ids_and_preview_is_nonmutating(client, provider):
    parent, rows = await existing(client)
    result = await generate(
        client, provider, "improve_entire_deck", deck("A", "B", "C"), presentation_id=parent["id"]
    )
    assert result["slide_ids"] == [row["id"] for row in rows]
    preview = await generate(
        client,
        provider,
        "generate_full_deck",
        deck("Preview"),
        presentation_id=parent["id"],
        options={"slide_count": 1, "persist": False},
    )
    assert not preview["persisted"]
    assert (await client.get(f"/presentations/{parent['id']}")).json()["markdown"] == result[
        "markdown"
    ]


async def test_invalid_output_retries_once_and_rolls_back(client, provider, sessions):
    provider["responses"] += ['{"truncated":', {"title": "Missing slides"}]
    response = await client.post(
        "/ai/generate",
        json={
            "action": "generate_full_deck",
            "prompt": "Create",
            "options": {"slide_count": 1},
        },
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_invalid_structured_output"
    assert len(provider["calls"]) == 2
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Presentation)) == 0
    provider["responses"] += ["not json"]
    result = await generate(
        client, provider, "generate_full_deck", deck("Repaired"), options={"slide_count": 1}
    )
    assert result["persisted"]


async def test_admin_defaults_and_bad_config(client, provider):
    for key, value in [
        ("default_slide_count", 1),
        ("default_tone", "warm"),
        ("temperature", 0.2),
        ("max_tokens", 1234),
        ("timeout_seconds", 10),
        ("prompt_suffix", "Be concise"),
    ]:
        assert (
            await client.put("/admin/config/ai/" + key, json={"value": value})
        ).status_code == 200
    await generate(client, provider, "generate_full_deck", deck("One"))
    payload = provider["calls"][0]
    assert payload["temperature"] == 0.2 and payload["max_tokens"] == 1234
    assert "warm" in payload["messages"][1]["content"]
    assert "Be concise" in payload["messages"][1]["content"]
    await client.put("/admin/config/ai/temperature", json={"value": "invalid"})
    response = await client.post(
        "/ai/generate", json={"action": "generate_full_deck", "prompt": "New"}
    )
    assert response.status_code == 400 and len(provider["calls"]) == 1


async def test_concurrent_manual_edit_is_not_overwritten(client, provider, sessions):
    parent, rows = await existing(client)

    async def concurrent_edit():
        async with sessions() as session:
            row = await session.get(Presentation, UUID(parent["id"]))
            row.title = "User edit while model runs"
            await session.commit()

    provider["callback"] = concurrent_edit
    provider["responses"].append(deck("AI edit"))
    response = await client.post(
        "/ai/generate",
        json={
            "action": "rewrite_slide",
            "prompt": "Rewrite",
            "slide_id": rows[1]["id"],
        },
    )
    assert response.status_code == 409
    saved = (await client.get(f"/presentations/{parent['id']}")).json()
    assert (
        saved["title"] == "User edit while model runs" and saved["markdown"] == parent["markdown"]
    )


async def test_validation_and_foreign_targets_before_nim(client, provider):
    parent, rows = await existing(client)
    response = await client.post("/ai/generate", json={"action": "unsupported", "prompt": "x"})
    assert response.status_code == 422
    response = await client.post(
        "/ai/generate",
        json={
            "action": "rewrite_slide",
            "prompt": "Rewrite",
            "presentation_id": str(uuid4()),
            "slide_id": rows[0]["id"],
        },
    )
    assert response.status_code == 404 and not provider["calls"]
    provider["responses"].append(401)
    response = await client.post(
        "/ai/generate", json={"action": "generate_full_deck", "prompt": "x"}
    )
    assert response.status_code == 502 and "upstream-private" not in response.text


async def test_rewrite_prompt_requests_one_slide(client, provider):
    original, rows = await existing(client)
    await generate(
        client, provider, "rewrite_slide", deck("Revised"),
        presentation_id=original["id"], slide_id=rows[0]["id"],
    )
    prompt = provider["calls"][-1]["messages"][1]["content"]
    assert "Requested output slide count, when applicable: 1." in prompt

async def test_known_presentation_envelope_is_still_schema_validated(client, provider):
    result = await generate(
        client, provider, "generate_full_deck", {"presentation": deck("Wrapped")},
        options={"slide_count": 1},
    )
    assert result["presentation"]["slides"][0]["title"] == "Wrapped"

async def test_block_repair_receives_required_fields(client, provider):
    malformed = deck("Facts")
    malformed["slides"][0]["content"] = [{"kind": "stat", "value": "12%"}]
    provider["responses"].append(malformed)
    result = await generate(
        client, provider, "generate_full_deck", deck("Repaired"), options={"slide_count": 1},
    )
    assert result["persisted"]
    assert "stat block requires: label" in provider["calls"][-1]["messages"][-1]["content"]
