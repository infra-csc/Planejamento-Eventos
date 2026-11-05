#!/usr/bin/env bash
# Atualiza o app no VPS: código novo, dependências, migrações, build e reinício.
# Rode como o usuário do serviço, na pasta do app:  ./deploy/atualizar.sh
# (o reinício usa sudo systemctl; libere esse comando no sudoers ou rode-o à mão).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm ci
npm run db:migrate
npm run build
sudo systemctl restart planejamento-eventos
echo "Atualizado: $(git log -1 --format='%h %s')"
