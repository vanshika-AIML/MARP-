import io
import zipfile
from uuid import uuid4

import pytest
from defusedxml.common import DefusedXmlException
from fastapi import HTTPException, UploadFile
from PIL import UnidentifiedImageError
from pypdf.errors import PdfReadError

from app.schemas.ai import GenerationRequest
from app.schemas.sources import ExtractionResult, Section
from app.services.ingestion.chunking import chunk_document
from app.services.ingestion.extractors import EXTRACTORS, ExtractionError, extract_document
from app.services.ingestion.process import extract_isolated
from app.services.ingestion.validation import validate_upload
from app.services.storage import LocalStorageProvider
from tests.source_fixtures import source_bytes


@pytest.mark.parametrize("extension", EXTRACTORS)
def test_real_formats(tmp_path, extension):
    path = tmp_path / ("sample." + extension)
    path.write_bytes(source_bytes(extension))
    result = extract_document(path, extension, "Sample")
    if extension in {"png", "jpg", "jpeg", "webp"}:
        assert result.metadata["width"] == 16 and result.metadata["height"] == 12
        assert result.metadata["ocr"] == "unavailable" and not result.text
    else:
        assert result.text and result.sections
        assert "12" in result.text
    if extension == "pdf":
        assert result.sections[0].reference == {"page": 1}
    if extension == "pptx":
        assert "Verified by finance" in result.text and "North" in result.text
        assert result.sections[0].reference == {"slide": 1}
    if extension == "docx":
        assert "- Supported finding" in result.text and "North" in result.text
    if extension == "xlsx":
        assert not result.metadata["truncated"]
        assert result.sections[0].reference["sheet"] == "Revenue"


@pytest.mark.parametrize(
    "name,mime,head",
    [
        ("x.exe", "application/octet-stream", b"MZbinary"),
        ("x.pdf", "image/png", b"%PDF-1.7"),
        ("x.png", "image/png", b"not an image"),
        ("x.txt", "text/plain", b""),
        ("x.txt", "text/plain", b"binary\x00data"),
        ("x.txt", "text/plain", b"\xff"),
    ],
)
def test_upload_validation(name, mime, head):
    with pytest.raises(HTTPException):
        validate_upload(name, mime, head)


def test_filename_safety():
    name, extension, _ = validate_upload("../../private/hello.txt", "text/plain", b"safe")
    assert name == "hello.txt" and extension == "txt"
    assert validate_upload("C:\\private\\hello.txt", "text/plain", b"safe")[0] == "hello.txt"


@pytest.mark.parametrize(
    "member,payload",
    [
        ("../escape.xml", b"<safe/>"),
        ("word/vbaProject.bin", b"macro"),
        ("word/extra.xml", b'<!DOCTYPE x [<!ENTITY a "boom">]><x>&a;</x>'),
        ("word/bomb.bin", b"a" * 1_000_000),
    ],
    ids=["traversal", "macro", "entities", "compression-bomb"],
)
def test_unsafe_office_packages(tmp_path, member, payload):
    path = tmp_path / "unsafe.docx"
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<document/>")
        archive.writestr(member, payload)
    with pytest.raises((ExtractionError, DefusedXmlException)):
        extract_document(path, "docx", "Unsafe")


@pytest.mark.parametrize(
    "extension,content",
    [
        ("pdf", b"%PDF-1.7 corrupt"),
        ("docx", b"PKbroken"),
        ("json", b'{"invalid": NaN}'),
        ("png", b"\x89PNG\r\n\x1a\ncorrupt"),
    ],
)
def test_corrupt_formats(tmp_path, extension, content):
    path = tmp_path / ("bad." + extension)
    path.write_bytes(content)
    with pytest.raises((PdfReadError, zipfile.BadZipFile, ValueError, UnidentifiedImageError)):
        extract_document(path, extension, "Bad")


def test_chunk_overlap_and_references():
    source_id = uuid4()
    result = ExtractionResult(
        title="Test",
        text="x" * 4200,
        sections=[
            Section(title="Summary", text="x" * 4200, reference={"page": 2}),
        ],
    )
    chunks = chunk_document(source_id, result)
    assert [c["index"] for c in chunks] == [0, 1, 2]
    assert all(len(c["text"]) <= 1800 for c in chunks)
    assert chunks[1]["chunk_metadata"]["start"] == 1600
    assert chunks[0]["chunk_metadata"]["reference"] == {"page": 2}
    assert chunks[0]["chunk_metadata"]["priority"] == 0


def test_source_ids_unique_and_bounded():
    source_id = uuid4()
    with pytest.raises(ValueError):
        GenerationRequest(action="generate_full_deck", prompt="Test", source_ids=[source_id] * 2)
    with pytest.raises(ValueError):
        GenerationRequest(
            action="generate_full_deck", prompt="Test", source_ids=[uuid4() for _ in range(11)]
        )


async def test_storage_safety_and_cleanup(tmp_path):
    storage = LocalStorageProvider(tmp_path)
    key = uuid4().hex + ".txt"
    with pytest.raises(ValueError):
        async with storage.local_copy("../secret.txt"):
            pass
    with pytest.raises(HTTPException) as error:
        await storage.save(UploadFile(io.BytesIO(b"x" * 100)), key, 20)
    assert error.value.status_code == 413
    assert not list(tmp_path.iterdir())
    with pytest.raises(HTTPException):
        await storage.save(UploadFile(io.BytesIO(b"")), key, 20)
    await storage.save(UploadFile(io.BytesIO(b"safe")), key, 20)
    await storage.delete(key)
    assert not list(tmp_path.iterdir())


async def test_isolated_extraction_and_timeout(tmp_path):
    path = tmp_path / "source.txt"
    path.write_text("Isolated content", encoding="utf-8")
    result = await extract_isolated(path, "txt", "Test", deadline=10)
    assert result.text == "Isolated content"
    with pytest.raises(ExtractionError):
        await extract_isolated(path, "txt", "Test", deadline=0.00001)


def test_spreadsheet_rows_bounded(tmp_path):
    path = tmp_path / "table.csv"
    path.write_text("Year,Growth\n" + "2025,12\n" * 1000, encoding="utf-8")
    result = extract_document(path, "csv", "Table")
    assert result.metadata["truncated"]
    assert result.sections[0].reference["row_end"] == 101
