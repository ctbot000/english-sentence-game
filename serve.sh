#!/bin/sh
# Serve the game on http://localhost:8000 (browsers block the deck files over file://).
set -e
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo "English Sentence Game → http://localhost:$PORT"
exec python3 -m http.server "$PORT"
