#!/usr/bin/env python3
"""Deploy frontend Bacakomix ke Vercel project bacakomix (team zipudenguga-8459)
via MCP create_deployment dengan file inline."""
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path.home() / "workspace" / "bacakomix"

FILES = [
    "index.html",
    "browse.html",
    "detail.html",
    "reader.html",
    "assets/css/style.css",
    "assets/js/api.js",
    "assets/js/common.js",
    "assets/js/home.js",
    "assets/js/browse.js",
    "assets/js/detail.js",
    "assets/js/reader.js",
    "assets/img/logo.svg",
    "assets/img/favicon.svg",
    "README.md",
]

files = []
for rel in FILES:
    p = ROOT / rel
    files.append({
        "file": rel,
        "data": p.read_text(encoding="utf-8"),
        "encoding": "utf-8",
    })

args = {
    "requestBody": {
        "name": "bacakomix",
        "project": "bacakomix",
        "target": "production",
        "files": files,
    },
    "teamId": "team_bzlZ7IFggoPwfl3oClty3fN0",
}
out = subprocess.run(
    ["/opt/hatch/bin/vercel", "call-tool", "--name", "create_deployment",
     "--arguments-json", json.dumps(args)],
    capture_output=True, text=True, timeout=300,
)
print(out.stdout[:3000])
print(out.stderr[:1000], file=sys.stderr)
