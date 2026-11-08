"""HTTP handler stub for Courtyard Coffee (Milestone 1 RED)."""
from http.server import SimpleHTTPRequestHandler

class CourtyardRequestHandler(SimpleHTTPRequestHandler):
    db_path = None

    def do_GET(self):
        self.send_response(501)
        self.end_headers()

    def do_PUT(self):
        self.send_response(501)
        self.end_headers()

    def do_POST(self):
        self.send_response(501)
        self.end_headers()

    def do_PATCH(self):
        self.send_response(501)
        self.end_headers()
