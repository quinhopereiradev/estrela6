#!/usr/bin/env bash
# Formata o arquivo PHP que o Claude Code acabou de editar (Pint) e
# avisa se ele tocar em .env. Recebe o JSON do hook na entrada padrão.
set -euo pipefail
input="$(cat)"
file="$(printf '%s' "$input" | php -r '$j = json_decode(stream_get_contents(STDIN), true); echo $j["tool_input"]["file_path"] ?? "";')"
[ -z "$file" ] && exit 0

case "$file" in
  *.php)
    if [ -x "$CLAUDE_PROJECT_DIR/vendor/bin/pint" ]; then
      "$CLAUDE_PROJECT_DIR/vendor/bin/pint" --quiet "$file" || true
    fi
    ;;
  */.env|*/.env.*)
    if [[ "$file" != *.env.example ]]; then
      echo "Atenção: arquivo .env alterado. Segredos nunca vão para o git." >&2
      exit 2
    fi
    ;;
esac
exit 0
