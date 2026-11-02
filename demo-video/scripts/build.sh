#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
video_python="demo-video/.venv/bin/python"
if [ ! -x "$video_python" ]; then
  python3 -m venv demo-video/.venv
  "$video_python" -m pip install -r demo-video/scripts/requirements.lock.txt
fi
if [ ! -x demo-video/.tools/ffprobe ]; then
  "$video_python" demo-video/scripts/download-tools.py
fi
# Exact public narration only. Neither Python nor record.ts loads .env.local.
"$video_python" demo-video/scripts/narrate.py
node --import tsx demo-video/scripts/record.ts
"$video_python" demo-video/scripts/render.py
"$video_python" demo-video/scripts/validate.py
