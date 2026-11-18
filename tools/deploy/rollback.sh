#!/usr/bin/env bash
# Volta para a release anterior (sem desfazer migrations; ver skill "release").
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PREV="$(cat "$ROOT/previous")"
[ -d "$PREV" ] || { echo "release anterior não encontrada"; exit 1; }
ln -sfn "$PREV" "$ROOT/current.tmp" && mv -Tf "$ROOT/current.tmp" "$ROOT/current"
cd "$ROOT/current" && php artisan optimize && php artisan queue:restart
sudo systemctl reload php8.4-fpm
echo "rollback para $PREV"
