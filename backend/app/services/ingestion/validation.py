import re
from pathlib import PurePosixPath

from fastapi import HTTPException

MIMES = {
    "pdf": {"application/pdf"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    "pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    "xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    "csv": {"text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"},
    "txt": {"text/plain"},
    "md": {"text/plain", "text/markdown", "text/x-markdown"},
    "json": {"application/json", "text/json"},
    "png": {"image/png"},
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "webp": {"image/webp"},
}


def validate_upload(filename, mime, head):
    if not filename or "\x00" in filename:
        raise HTTPException(400, "Invalid filename")
    name = PurePosixPath(filename.replace("\\", "/")).name
    name = re.sub(r"[\x00-\x1f\x7f]", "", name)
    if not name or len(name) > 255:
        raise HTTPException(400, "Invalid filename")
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in MIMES:
        raise HTTPException(415, "Unsupported file extension")
    declared = (mime or "application/octet-stream").split(";", 1)[0].strip().lower()
    if declared not in MIMES[extension] | {"application/octet-stream"}:
        raise HTTPException(415, "MIME type does not match the file extension")
    if not head:
        raise HTTPException(400, "Empty uploads are not allowed")
    signatures = {
        "pdf": head.startswith(b"%PDF-"),
        "docx": head.startswith(b"PK\x03\x04"),
        "pptx": head.startswith(b"PK\x03\x04"),
        "xlsx": head.startswith(b"PK\x03\x04"),
        "png": head.startswith(b"\x89PNG\r\n\x1a\n"),
        "jpg": head.startswith(b"\xff\xd8\xff"),
        "jpeg": head.startswith(b"\xff\xd8\xff"),
        "webp": head.startswith(b"RIFF") and head[8:12] == b"WEBP",
    }
    if extension in signatures and not signatures[extension]:
        raise HTTPException(400, "File signature does not match the selected format")
    if extension in {"txt", "md", "json", "csv"}:
        try:
            head.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            # A prefix can end in the middle of a valid multibyte character.
            if exc.reason != "unexpected end of data":
                raise HTTPException(400, "Text sources must use UTF-8 encoding") from None
        if b"\x00" in head:
            raise HTTPException(400, "Binary data is not a text source")
    canonical = sorted(MIMES[extension])[0] if declared == "application/octet-stream" else declared
    return name, extension, canonical
