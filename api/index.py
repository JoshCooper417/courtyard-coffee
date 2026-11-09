"""Vercel Python Serverless Function entrypoint for Courtyard Coffee (/api/*)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.handler import CourtyardRequestHandler


class handler(CourtyardRequestHandler):
    """Vercel @vercel/python BaseHTTPRequestHandler entrypoint."""

    pass
