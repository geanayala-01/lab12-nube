#!/usr/bin/env bash
# Compara 1 y 3 réplicas en un proyecto aparte con base de datos limpia. No toca el stack principal.
# Uso: bash tests/run-stress.sh [usuarios_pico]
set -euo pipefail
cd "$(dirname "$0")/.."

export HTTP_PORT=8081
PEAK="${1:-300}"
compose() { docker compose -p pronostica-test "$@"; }

for replicas in 1 3; do
  export API_REPLICAS="$replicas"
  compose down -v
  compose up -d --build --wait
  echo "=== $replicas réplica(s), $PEAK usuarios pico"
  compose --profile stress run --rm -e PEAK="$PEAK" k6 \
    run --quiet --summary-export="/tests/results-$replicas.json" /tests/stress.js || true
done

compose down -v
