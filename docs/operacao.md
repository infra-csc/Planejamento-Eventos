# Operação em produção (VPS)

Guia curto para quem mantém o app no ar: backup, avisos agendados, logs e o checklist antes de
liberar para a equipe. Os comandos rodam no servidor, na pasta do app (`/opt/planejamento-eventos`),
como o usuário do serviço — os scripts `npm run …` carregam o `.env` sozinhos. Instalação do
servidor: **docs/vps.md**.

## 1. Backup

```bash
npm run backup
```

- Gera `npe-backup-AAAA-MM-DD_HH-MM-SSZ.sql.gz` (data/hora em UTC) na pasta `BACKUP_DIR`
  (padrão `./.data/backups`, que está fora do Git).
- **Com `pg_dump`** no PATH e `DATABASE_URL` (no VPS: `apt install postgresql-client-<versão>`, na
  mesma versão major do servidor ou mais nova — veja `select version()`): dump completo — estrutura e dados.
- **Sem `pg_dump`**, no PGlite local, ou se o `pg_dump` falhar (ex.: servidor numa versão mais
  nova que o `pg_dump`): exporta **só os dados** (`…-dados.sql.gz`), tabela a tabela em ordem de
  dependência, no formato `COPY … FROM stdin`. O arquivo guarda qual foi a última migração
  aplicada; a restauração exige o banco na mesma versão. Force um modo com `BACKUP_MODO=pg_dump`
  ou `BACKUP_MODO=dados`.
- Mantém os **14** mais recentes na pasta (`BACKUP_MANTER` muda o número) e apaga os demais.

### Onde os arquivos ficam

Na pasta `BACKUP_DIR` do próprio VPS (sugestão: `/var/backups/planejamento-eventos`). Um backup só
no mesmo disco não protege contra a perda do servidor: copie a pasta para fora (rsync/rclone para
outro servidor ou bucket S3, ou o snapshot do provedor).

> Se o banco continuar no Neon, o painel do Neon oferece restauração a um ponto no tempo (dentro da
> janela do plano). O arquivo de backup continua sendo a cópia fora do banco.

### Agendar (diariamente)

`deploy/systemd/planejamento-eventos-backup.timer` roda `npm run backup` todo dia às 03:00 (horário
do servidor). Instalação em docs/vps.md. Para ver a última execução:
`systemctl list-timers` e `journalctl -u planejamento-eventos-backup`.

## 2. Restaurar (e testar a restauração)

```bash
npm run restaurar -- .data/backups/npe-backup-2026-09-23_06-00-00Z.sql.gz          # só mostra o que faria
npm run restaurar -- .data/backups/npe-backup-2026-09-23_06-00-00Z.sql.gz --force  # APAGA e restaura
```

- **Dump completo:** usa `psql` numa transação única (`--single-transaction`): se algo falhar,
  nada muda. Precisa de `DATABASE_URL`.
- **Só dados:** confere se a última migração do banco é a mesma do backup (rode
  `npm run db:migrate` antes; `--ignorar-versao` pula a conferência). Usa `psql` se houver;
  senão, carrega pelo Node — funciona também no PGlite local.
- Em produção: pare o app (`sudo systemctl stop planejamento-eventos`), restaure e suba de novo.

**Teste mensal da restauração (sem tocar em produção).** Um backup que nunca foi restaurado não é
backup. Na sua máquina:

```bash
# Arquivo "-dados": restaura num PGlite separado e abre o app sobre ele
PGLITE_DATA_DIR=./.data/restauro npm run db:migrate
PGLITE_DATA_DIR=./.data/restauro npm run restaurar -- caminho/do/backup-dados.sql.gz --force
PGLITE_DATA_DIR=./.data/restauro npm run dev

# Dump completo: precisa de um Postgres descartável
docker run --rm -d -e POSTGRES_PASSWORD=teste -p 5433:5432 --name restauro postgres:16
DATABASE_URL=postgres://postgres:teste@localhost:5433/postgres npm run restaurar -- caminho/do/backup.sql.gz --force
DATABASE_URL=postgres://postgres:teste@localhost:5433/postgres npm run dev
```

Entre, abra um evento recente e confira ata, OS e solicitações. Para gerar localmente um arquivo
que o PGlite consiga carregar a partir do Postgres de produção, rode no servidor
`BACKUP_MODO=dados npm run backup`.

## 3. Avisos agendados (prazos e lembretes)

As verificações de SLA vencido, prazo próximo e lembrete de reunião rodam em
`GET/POST /api/cron/verificacoes`. A rota:

- responde **503** se `CRON_SECRET` não estiver configurado (fica desligada, não aberta);
- responde **401** sem `Authorization: Bearer <CRON_SECRET>` ou com o segredo errado (comparação em tempo constante);
- responde **200** `{ "ok": true }` depois de rodar.

A mesma verificação continua rodando como reserva depois das navegações (`after()` no layout),
limitada a uma vez a cada 5 minutos por instância. Os avisos têm deduplicação: chamar a rota e
navegar ao mesmo tempo não duplica notificações.

**Configurar:**

1. Gere o segredo: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. Ponha `CRON_SECRET` e `APP_URL` no `.env` do app e reinicie o serviço.
3. Ative `deploy/systemd/planejamento-eventos-cron.timer` (a cada 15 minutos; instalação em docs/vps.md).
   Ele chama `deploy/cron-verificacoes.sh`, que lê o `.env` e faz o `curl` em `http://127.0.0.1:$PORT`.
4. Teste: `sudo systemctl start planejamento-eventos-cron && journalctl -u planejamento-eventos-cron -n 5`
   deve mostrar `{"ok":true,...}`.

## 4. Logs e erros

Erros inesperados viram **uma linha JSON** no log do app (`journalctl -u planejamento-eventos`), no mesmo formato para actions
(`src/lib/action.ts`) e para páginas, rotas e o proxy (`src/instrumentation.ts`):

```json
{"nivel":"erro","ref":"K3F9QX","codigo":null,"origem":"action","acao":"alterarSenha","rota":null,"metodo":null,"usuarioId":"…","tipo":"Error","mensagem":"…","pilha":"…"}
```

A tela de erro mostra o código (`ref` / digest): peça à pessoa o código e procure por ele nos logs.
Os logs nunca levam senha, token, cookie, cabeçalhos, query string nem o objeto cru do erro.

O **histórico** (tabela `historico`) registra também: login (entradas e falhas agregadas por pessoa
e por dia, sem senha), logout, links de acesso gerados, trocas de senha, sessões encerradas e
início/fim de "ver como". Ações feitas por um administrador em "ver como" gravam o perfil assumido
na coluna `ver_como` e a descrição termina com "(pelo administrador, vendo como …)".

## 5. Sessões e senhas

- A sessão expira com **14 dias sem uso** ou **30 dias desde o login**, o que vier primeiro. O uso
  renova a expiração no máximo uma vez por hora (não grava no banco a cada clique).
- **Meu perfil → Encerrar outras sessões** desconecta a conta em todos os outros navegadores.
- **Senha provisória** (`usuarios.trocar_senha`): usuários criados pelo seed, senha definida pelo
  administrador, ou quem entrar com a senha de demonstração (`norte1234`) fora do modo
  demonstração. Até trocar, só **Meu perfil** abre. `npm run admin:senha` define uma senha
  definitiva. No modo demonstração (`EXIBIR_DEMO=true`, ou local sem configuração) a troca não é exigida.
- Limites: login por e-mail+IP (8 falhas/15 min), por e-mail de qualquer IP (20/15 min) e por IP
  (40/15 min); troca da própria senha 5 tentativas/15 min por usuário; redefinições e links de
  acesso 30/hora por administrador. Contagem e registro são atômicos (trava por chave no Postgres).
- O IP desses limites vem do `x-forwarded-for`: o valor que o proxy da frente acrescentou (o último, com
  um proxy só: o Nginx do VPS). Com outro proxy ou CDN na frente (ex.: Cloudflare + Nginx = 2), defina `PROXIES_CONFIAVEIS` com o número
  de proxies; senão o cliente consegue escolher o próprio "IP" e escapar do limite por IP (o limite por
  e-mail continua valendo).

## 6. Segurança HTTP

- **CSP com nonce** montada a cada requisição em `src/proxy.ts` (`src/server/auth/csp.ts`):
  `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`, `connect-src 'self'`, `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`. As rotas de arquivo
  (`/api/anexos/[id]`, planta da arena) mantêm a própria CSP com `sandbox`.
- Páginas com nonce precisam ser renderizadas por requisição (o layout de login chama
  `connection()`); uma página gerada no build sairia sem nonce e ficaria sem JavaScript.
- **Server Actions** aceitas só da própria origem e dos domínios exatos de `APP_URL` e
  `ORIGENS_EXTRAS` — sem curingas. Atrás do Nginx, ele precisa repassar `Host` e
  `X-Forwarded-Host`/`-Proto` (ver `deploy/nginx/planejamento-eventos.conf`).

## 7. Armazenamento de arquivos (anexos e plantas)

Anexos de projeto, de peças, de estoque e plantas de arena passam por `src/server/armazenamento.ts`
e ficam na própria coluna bytea (`anexos.conteudo`, `peca_anexos.conteudo`,
`estoque_anexos.conteudo`, `arenas.planta_imagem`). Entram no backup junto com o resto do banco.

O antigo driver de Object Storage do Replit foi removido. Ele só gravava fora do banco com
`ARMAZENAMENTO=replit` e o pacote `@replit/object-storage` instalado, o que o projeto nunca trouxe.
Se algum valor ainda for uma referência (`npe-ref:replit:…`), o app avisa que o arquivo precisa ser
reenviado. Consulta para conferir: docs/vps.md (§ Arquivos enviados).

## 8. Arena da Eco Run (dados importados)

A arena da Eco Run SP 2026 não é mais código de produção: os dados estão em
`scripts/dados/arena-eco-run-sp-2026.ts` e `npm run importar:arena` a grava na tabela `arenas`
(slug `eco-run-sp-2026`, sem evento; o `npm run setup` já roda). É idempotente — se a arena já está
no banco, não mexe. Enquanto o script não roda num banco, o app lê a mesma arena do arquivo de dados,
com o mesmo endereço (`/arena/eco-run-sp-2026`). No app ela continua "fixa": só leitura (sem troca de
planta nem exclusão); as posições ajustadas no mapa valem nos dois casos.

## 9. Checklist de produção

- [ ] `.env` do servidor: `DATABASE_URL`, `APP_URL` (URL pública com https), `CRON_SECRET`; `EXIBIR_DEMO` ausente ou `false`; `SEED_DEMO` ausente. Permissão `600`.
- [ ] Primeiro administrador criado com `npm run admin:senha -- <email> <senha>`; nenhum usuário do seed de demonstração no banco de produção.
- [ ] `npm run db:migrate` aplicado (o `deploy/atualizar.sh` já faz).
- [ ] Backup diário agendado (timer ativo) e cópia da pasta de backups para fora do VPS.
- [ ] Restauração testada (seção 2) — anote a data do último teste.
- [ ] Avisos agendados: `curl` manual devolve 200; agendamento a cada 15 min ativo.
- [ ] No navegador (produção): login, navegação, menus e diálogos, Arena 3D, impressão da OS e anexos funcionando, sem erros de CSP no console (F12).
- [ ] CI verde no GitHub (typecheck, lint, testes, build).
