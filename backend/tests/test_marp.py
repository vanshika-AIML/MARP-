import pytest

from app.services.marp import compile_markdown, split_markdown, validate_slide


def test_frontmatter_and_code_and_comments_round_trip():
    header = '---\nmarp: true\ntheme: "minimal"\npaginate: true\n---'
    first = "# First\n\n```yaml\n---\nkey: value\n```\n\n<!--\n---\n-->"
    second = "# Second\n\n    ---\n\n> ---\n\n~~~\n---\n~~~"
    markdown = f"{header}\n\n{first}\n\n---\n\n{second}"
    document = split_markdown(markdown)
    assert document.frontmatter == header
    assert document.slides == [first, second]
    assert compile_markdown(document.frontmatter, document.slides) == markdown


def test_empty_and_crlf_and_blank_slides():
    assert split_markdown("").slides == []
    doc = split_markdown("\ufeff---\r\nmarp: true\r\n---\r\n\r\n# One\r\n---\r\n")
    assert doc.slides == ["# One", ""]
    assert split_markdown("---\nmarp: true\n---").slides == []
    assert split_markdown("---\n# Not a YAML mapping\n---\n# Another").frontmatter == ""


def test_fences_use_matching_character_and_length():
    markdown = "````md\n```\n---\n~~~\n````\n---\n# Two"
    assert len(split_markdown(markdown).slides) == 2


@pytest.mark.parametrize("raw", ["# One\n---\n# Two", "---\nmarp: true\n---\n# One"])
def test_slide_input_rejects_decks(raw):
    with pytest.raises(ValueError):
        validate_slide(raw)


def test_invalid_yaml_and_slide_limit():
    with pytest.raises(ValueError, match="Invalid YAML"):
        split_markdown("---\nmarp: [\n---\n# One")
    with pytest.raises(ValueError, match="at most"):
        split_markdown("\n---\n".join(["# Slide"] * 1001))
