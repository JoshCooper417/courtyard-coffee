"""Local HTTP server on 127.0.0.1:3000 for Courtyard Coffee."""
from __future__ import annotations

import os
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.db import get_db_path, init_db
from api.handler import CourtyardRequestHandler


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def main() -> None:
    port = int(os.environ.get("PORT", "3000"))
    host = os.environ.get("HOST", "127.0.0.1")
    db_path = get_db_path()
    init_db(db_path=db_path, reset=False)
    CourtyardRequestHandler.db_path = db_path
    server = ReusableThreadingHTTPServer((host, port), CourtyardRequestHandler)
    print(f"Courtyard Coffee server listening on http://{host}:{port} (db={db_path})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
