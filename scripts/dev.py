"""Start the local API, queue worker and Vite together; Ctrl+C stops all three."""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"


def main():
    configured = dotenv_values(BACKEND / ".env", encoding="utf-8-sig")
    environment = {**os.environ, **{k: v for k, v in configured.items() if v is not None}}
    environment["DEBUG"] = configured.get("DEBUG") or "true"
    if environment.get("APP_ENV", "development") != "development":
        raise RuntimeError("dev:all only runs against a development environment.")
    for key in ("DATABASE_URL", "REDIS_URL"):
        if urlsplit(environment.get(key, "")).hostname not in {None, "localhost", "127.0.0.1"}:
            raise RuntimeError(f"dev:all requires a local {key}.")
    environment["POSTGRES_PORT"] = str(urlsplit(environment.get("DATABASE_URL", "")).port or 5432)
    environment["REDIS_PORT"] = str(urlsplit(environment.get("REDIS_URL", "")).port or 6379)
    subprocess.run(
        ["docker", "compose", "-f", str(BACKEND / "docker-compose.yml"), "up", "-d", "--wait"],
        cwd=ROOT, env=environment, check=True,
    )
    for args in (["alembic", "upgrade", "head"], ["app.scripts.seed"]):
        subprocess.run([sys.executable, "-m", *args], cwd=BACKEND, env=environment, check=True)
    commands = [
        ([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], BACKEND),
        ([sys.executable, "-m", "arq", "app.workers.settings.WorkerSettings"], BACKEND),
        (["node", str(ROOT / "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--strictPort"], ROOT),
    ]
    children = []
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        for command, cwd in commands:
            children.append(subprocess.Popen(command, cwd=cwd, env=environment))
        print("MARP Studio: http://localhost:5173 (Ctrl+C to stop)", flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(0.5)
        raise RuntimeError("A development service stopped. Check the error above.")
    except KeyboardInterrupt:
        pass
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()


if __name__ == "__main__":
    main()
