"""Isolated parser process: bounded output, no provider credentials, no raw error text."""

import json
import sys
from pathlib import Path


def main():
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (45, 45))
    try:
        from app.services.ingestion.extractors import extract_document

        path = Path(sys.argv[1])
        result = extract_document(path, sys.argv[2], sys.argv[3])
        print(result.model_dump_json())
        return 0
    except Exception:
        print(
            json.dumps(
                {
                    "error": {
                        "code": "extraction_failed",
                        "message": "File is corrupt, protected, or exceeds extraction limits",
                    }
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
