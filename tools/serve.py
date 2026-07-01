#!/usr/bin/env python3
"""Static file server with a hardcoded absolute root (avoids os.getcwd())."""
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8124

class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serve with no-store so local development always gets the freshest files."""
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


Handler = functools.partial(NoCacheHandler, directory=ROOT)
httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
print(f"serving {ROOT} at http://127.0.0.1:{PORT}", flush=True)
httpd.serve_forever()
