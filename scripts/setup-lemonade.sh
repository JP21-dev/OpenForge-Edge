#!/usr/bin/env bash
set -euo pipefail

LEMONADE_URL="${1:-http://localhost:13305}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if ! command -v lemonade >/dev/null 2>&1; then
  echo "The 'lemonade' CLI was not found. Install Lemonade from https://lemonade-server.ai and reopen this shell." >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  echo ".env already exists; leaving it unchanged. Compare it with .env.lemonade.example if you want the Lemonade settings."
else
  cp "$ROOT/.env.lemonade.example" "$ENV_FILE"
  echo "Created .env from .env.lemonade.example."
fi

env_value() {
  grep -E "^\s*$1\s*=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '[:space:]' || true
}

CHAT_MODEL="$(env_value LLM_MODEL)"
EMBED_MODEL="$(env_value EMBED_MODEL)"
CHAT_MODEL="${CHAT_MODEL:-Qwen3-8B-GGUF}"
EMBED_MODEL="${EMBED_MODEL:-nomic-embed-text-v1-GGUF}"

for model in "$CHAT_MODEL" "$EMBED_MODEL"; do
  echo "Pulling $model ..."
  lemonade pull "$model"
done

if models="$(curl -fsS --max-time 5 "$LEMONADE_URL/api/v1/models")"; then
  echo "Lemonade is running at $LEMONADE_URL with models:"
  echo "$models" | python3 -c 'import json,sys; [print("  " + m["id"]) for m in json.load(sys.stdin).get("data", [])]' 2>/dev/null || echo "$models"
else
  echo "Lemonade is not responding at $LEMONADE_URL. Start the Lemonade server, then re-run this script or check the URL." >&2
  exit 1
fi

echo
echo "Next:"
echo "  docker compose up -d --build"
echo "  docker compose exec backend python ingest.py --reset"
