#!/usr/bin/env bash
# Ativa uma release no servidor. Uso: activate.sh <staging|production> <pasta-da-release>
# Estrutura: /var/www/estrela6/<amb>/{releases/<sha>, shared/{.env,storage}, current -> releases/<sha>}
set -euo pipefail
ENV="$1"; NEW="$2"
ROOT="/var/www/estrela6/$ENV"
cd "$NEW"

rm -rf storage && ln -s "$ROOT/shared/storage" storage
ln -sf "$ROOT/shared/.env" .env

php artisan migrate --force
php artisan optimize
php artisan filament:optimize
php artisan storage:link --force >/dev/null

cp "$NEW/tools/deploy/rollback.sh" "$ROOT/rollback.sh"
PREV="$(readlink -f "$ROOT/current" || true)"
[ -n "$PREV" ] && echo "$PREV" > "$ROOT/previous"
ln -sfn "$NEW" "$ROOT/current.tmp" && mv -Tf "$ROOT/current.tmp" "$ROOT/current"

php artisan queue:restart
sudo systemctl reload php8.4-fpm

# guarda as 5 últimas
ls -1dt "$ROOT"/releases/* | tail -n +6 | xargs -r rm -rf
echo "ativa: $NEW"
