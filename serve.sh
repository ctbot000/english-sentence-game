#!/bin/sh
# Serve the game on http://localhost:8000 (browsers block the deck files over file://).
set -e
cd "$(dirname "$0")"
PORT="${1:-8000}"

# The decks live in the sibling english-sentence-data repo, reached through data/.
# A missing or broken symlink shows up in the game as "no decks" rather than an error.
if [ ! -e data/decks.json ]; then
  echo "Cannot read data/decks.json." >&2
  if [ -L data ] && [ ! -e data ]; then
    echo "  data -> $(readlink data) is a broken symlink." >&2
  elif [ ! -e data ]; then
    echo "  There is no data/ here. It should be a symlink to ../english-sentence-data/data" >&2
  fi
  echo "  Clone english-sentence-data next to this repo:" >&2
  echo "    git clone <url> ../english-sentence-data" >&2
  exit 1
fi

# A manifest entry pointing at a file that is not on disk is skipped silently by
# the game, so surface it here instead.
python3 - <<'PY' || true
import json, os, sys
try:
    decks = json.load(open("data/decks.json")).get("decks", [])
except Exception as e:
    sys.exit("data/decks.json is not valid JSON: %s" % e)
missing = [d["file"] for d in decks if d.get("file") and not os.path.exists(os.path.join("data", d["file"]))]
for f in missing:
    print("warning: data/decks.json lists data/%s, which is not on disk" % f)
PY

holder=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)
if [ -n "$holder" ]; then
  echo "Port $PORT is already in use by PID $holder:"
  ps -o command= -p "$holder" | sed 's/^/  /'
  echo
  echo "If that is an earlier ./serve.sh, the game is already at http://localhost:$PORT"
  echo "Otherwise serve on another port:  ./serve.sh 8001"
  exit 1
fi

echo "English Sentence Game → http://localhost:$PORT"
exec python3 -m http.server "$PORT"
