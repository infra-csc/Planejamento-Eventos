# Instalação num VPS (Ubuntu/Debian)

Sai do Replit, vai para um servidor próprio. O app é um Next.js comum: `npm run build` e
`npm run start` atrás do Nginx, como serviço do systemd. Os arquivos citados estão em `deploy/`.

O banco pode continuar no **Neon** (só trocar onde a `DATABASE_URL` é configurada) ou ir para um
**PostgreSQL no próprio VPS** (seção 8). Comece mantendo o Neon: é a migração com menos risco.

## 1. Pré-requisitos

- Ubuntu 22.04/24.04 ou Debian 12, com acesso sudo, e um domínio apontando (registro A) para o IP do VPS.
- 2 GB de RAM no mínimo (o `next build` usa bastante memória; com 1 GB, crie swap).

```bash
sudo apt update && sudo apt install -y git nginx curl ca-certificates
# Node.js 24 (mesma versão do CI)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
# pg_dump/psql para backup completo: na mesma versão major do servidor Postgres (veja "select version()")
sudo apt install -y postgresql-client
```

Se a versão do `postgresql-client` da distribuição for mais antiga que a do servidor, instale a
certa pelo repositório oficial (apt.postgresql.org). Sem `pg_dump` compatível, `npm run backup`
cai sozinho no modo "só dados", que também restaura.

## 2. Usuário e código

```bash
sudo adduser --system --group --home /opt/planejamento-eventos eventos
sudo -u eventos git clone https://github.com/infra-csc/Planejamento-Eventos.git /opt/planejamento-eventos
cd /opt/planejamento-eventos
```

(Repositório privado: use uma deploy key somente leitura do GitHub para o usuário `eventos`.)

## 3. Variáveis (.env)

```bash
sudo -u eventos cp .env.example .env
sudo -u eventos chmod 600 .env
sudo -u eventos nano .env
```

Preencha pelo menos:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a string de conexão do Neon (painel do Neon → Connection string). **Nunca** a coloque em arquivo versionado. |
| `APP_URL` | `https://eventos.seudominio.com.br` |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `BACKUP_DIR` | `/var/backups/planejamento-eventos` |
| `PORTAL_SSO_SECRET` / `PORTAL_URL` | os mesmos de hoje, se a entrada pelo Portal NORTE estiver em uso |

Copie também os demais Secrets que estão configurados hoje no Replit (Tools → Secrets), exceto os
`REPLIT_*`/`REPL_*`, que não são mais lidos.

```bash
sudo mkdir -p /var/backups/planejamento-eventos && sudo chown eventos:eventos /var/backups/planejamento-eventos
```

## 4. Build e primeiro start

```bash
cd /opt/planejamento-eventos
sudo -u eventos npm ci
sudo -u eventos npm run db:migrate     # no banco que já está em produção, só confere (nada pendente)
sudo -u eventos npm run build
```

Os scripts `npm run …` carregam o `.env` sozinhos. **Não** rode `npm run setup`, `db:seed` ou
`db:reset` contra o banco de produção.

## 5. Serviço (systemd)

```bash
sudo cp deploy/systemd/planejamento-eventos*.service deploy/systemd/planejamento-eventos*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now planejamento-eventos
sudo systemctl enable --now planejamento-eventos-backup.timer planejamento-eventos-cron.timer
curl -I http://127.0.0.1:3000/login       # 200
journalctl -u planejamento-eventos -f      # logs do app
```

## 6. Nginx e HTTPS

```bash
sudo cp deploy/nginx/planejamento-eventos.conf /etc/nginx/sites-available/
sudo sed -i 's/eventos.exemplo.com.br/eventos.seudominio.com.br/g' /etc/nginx/sites-available/planejamento-eventos.conf
sudo ln -s /etc/nginx/sites-available/planejamento-eventos.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d eventos.seudominio.com.br
```

Firewall: libere só SSH, 80 e 443 (`sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`).
A porta 3000 fica em 127.0.0.1 e não precisa ser aberta.

Se puser Cloudflare (proxy laranja) na frente, defina `PROXIES_CONFIAVEIS=2` no `.env`.

## 7. Atualizações

```bash
cd /opt/planejamento-eventos && sudo -u eventos ./deploy/atualizar.sh
```

(`git pull`, `npm ci`, migrações, build e reinício. O reinício pede sudo.)

## 8. Opcional: Postgres no próprio VPS

```bash
sudo apt install -y postgresql
sudo -u postgres createuser -P eventos_app
sudo -u postgres createdb -O eventos_app planejamento_eventos
```

Migração dos dados do Neon (com o app parado para não perder escritas):

```bash
sudo systemctl stop planejamento-eventos
pg_dump --no-owner --no-privileges "<URL do Neon>" | gzip > /tmp/neon.sql.gz
gunzip -c /tmp/neon.sql.gz | psql "postgresql://eventos_app:SENHA@localhost/planejamento_eventos"
# troque DATABASE_URL no .env para postgresql://eventos_app:SENHA@localhost/planejamento_eventos
sudo -u eventos npm run db:migrate
sudo systemctl start planejamento-eventos
```

## 9. Corte (sair do Replit)

1. Com o VPS no ar num domínio de teste, entre, abra um evento, a OS, um anexo e a Arena 3D.
2. Confira os arquivos enviados (abaixo).
3. Aponte o domínio definitivo para o VPS, ajuste `APP_URL`, rode `npm run build` e reinicie.
4. Atualize o endereço deste app no Portal NORTE, se ele estiver cadastrado lá.
5. Desligue o deployment do Replit (para não haver dois apps escrevendo no mesmo banco) e o
   Scheduled Deployment de backup/avisos, se existir.
6. Troque a senha do banco no Neon (a string de conexão circulou fora do cofre) e atualize o `.env`.

### Arquivos enviados

Os anexos e plantas ficam no banco. O driver de Object Storage do Replit foi removido; ele nunca
esteve instalado no projeto, mas confira se algum arquivo ficou só lá (o resultado esperado é 0 em tudo):

```sql
select 'anexos' t, count(*) from anexos where substring(conteudo from 1 for 8) = 'npe-ref:'::bytea
union all select 'peca_anexos', count(*) from peca_anexos where substring(conteudo from 1 for 8) = 'npe-ref:'::bytea
union all select 'estoque_anexos', count(*) from estoque_anexos where substring(conteudo from 1 for 8) = 'npe-ref:'::bytea
union all select 'arenas', count(*) from arenas where substring(planta_imagem from 1 for 8) = 'npe-ref:'::bytea;
```
