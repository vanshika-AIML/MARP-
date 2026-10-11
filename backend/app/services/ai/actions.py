"""Action policy is separate from route, prompting, and persistence mechanics."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ActionSpec:
    target: Literal["optional_deck", "deck", "slide", "merge"]
    mode: Literal["deck", "append", "replace", "split", "merge", "notes", "visuals", "reorder"]
    instruction: str
    preview_only: bool = False


ACTIONS = {
    "generate_full_deck": ActionSpec("optional_deck", "deck", "Create a complete new deck."),
    "generate_outline": ActionSpec(
        "optional_deck", "deck", "Create an outline: slide titles and brief talking points.", True
    ),
    "generate_single_slide": ActionSpec("optional_deck", "append", "Create exactly one new slide."),
    "rewrite_slide": ActionSpec("slide", "replace", "Rewrite only the selected slide."),
    "shorten_slide": ActionSpec("slide", "replace", "Reduce words; retain the key meaning."),
    "expand_slide": ActionSpec(
        "slide", "replace", "Add useful explanation without inventing facts."
    ),
    "simplify_slide": ActionSpec("slide", "replace", "Use plain language and explain jargon."),
    "change_tone": ActionSpec("slide", "replace", "Apply the requested tone to this slide."),
    "make_professional": ActionSpec("slide", "replace", "Use a precise professional tone."),
    "make_creative": ActionSpec("slide", "replace", "Use an imaginative but clear approach."),
    "make_technical": ActionSpec("slide", "replace", "Use precise technical language."),
    "improve_storytelling": ActionSpec("slide", "replace", "Improve narrative and logical flow."),
    "generate_agenda": ActionSpec(
        "optional_deck", "append", "Create one agenda slide for the deck."
    ),
    "generate_conclusion": ActionSpec(
        "optional_deck", "append", "Create one conclusion slide with clear takeaways."
    ),
    "generate_speaker_notes": ActionSpec("slide", "notes", "Return speaker notes only."),
    "reorder_suggestions": ActionSpec(
        "deck",
        "reorder",
        "Return every existing slide ID once in suggested order and explain why.",
        True,
    ),
    "split_slide": ActionSpec(
        "slide", "split", "Split the selected slide into 2 to 5 focused slides."
    ),
    "merge_slides": ActionSpec(
        "merge", "merge", "Merge only selected slides into exactly one slide."
    ),
    "improve_entire_deck": ActionSpec(
        "deck", "deck", "Improve the deck while preserving the number and order of slides."
    ),
    "suggest_visuals": ActionSpec(
        "slide", "visuals", "Return only a useful visual intent suggestion."
    ),
}
