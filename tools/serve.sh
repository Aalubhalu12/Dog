#!/usr/bin/env bash
# Local dev server — run from anywhere:  bash tools/serve.sh [port]
cd "$(dirname "$0")/.." && python3 -m http.server "${1:-8080}" --bind 0.0.0.0
