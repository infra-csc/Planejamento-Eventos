#!/usr/bin/env bash
# Chama a rota de verificações agendadas no próprio servidor (sem passar pelo Nginx).
# Lê CRON_SECRET e PORT do .env da pasta do app. Usado pelo planejamento-eventos-cron.timer.
set -euo pipefail
cd "$(dirname "$0")/.."
ler() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
SEGREDO="$(ler CRON_SECRET)"
PORTA="$(ler PORT)"
if [ -z "$SEGREDO" ]; then echo "CRON_SECRET vazio no .env" >&2; exit 1; fi
curl -fsS -X POST -H "Authorization: Bearer ${SEGREDO}" "http://127.0.0.1:${PORTA:-3000}/api/cron/verificacoes"
echo
