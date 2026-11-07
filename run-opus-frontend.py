#!/usr/bin/env python3
"""Run agy Opus 5.5 (Medium) non-interactively for the Bacakomix frontend.
Prompt is read from docs/BACAKOMIX_FRONTEND_PROMPT.md (no shell quoting issues).
Mirrors the VYBE runner pattern (run-argon-phase*.py)."""
import subprocess, pathlib
root = pathlib.Path.home() / "workspace" / "bacakomix"
prompt = (root / "docs" / "BACAKOMIX_FRONTEND_PROMPT.md").read_text()
log_path = root / "logs" / "opus-frontend.log"
with open(log_path, "w") as log:
    proc = subprocess.run(
        ["/home/hatch/.local/bin/agy",
         "--model", "claude-opus-5-5-medium",
         "--dangerously-skip-permissions",
         "--print", prompt],
        cwd=str(root), stdout=log, stderr=subprocess.STDOUT, text=True,
    )
    print(f"agy exit code: {proc.returncode}", file=log)
print(f"done, exit={proc.returncode}, log={log_path}")
