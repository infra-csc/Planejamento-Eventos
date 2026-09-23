# Operação em produção (Replit)

Guia curto para quem mantém o app no ar: backup, avisos agendados, logs e o checklist antes de
liberar para a equipe. Os comandos rodam no **Shell** do Replit (ou localmente).

## 1. Backup

```bash
npm run backup
```

- Gera `npe-backup-AAAA-MM-DD_HH-MM-SSZ.sql.gz` (data/hora em UTC) na pasta `BACKUP_DIR`
  (padrão `./.data/backups`, que está fora do Git).
- **Com `pg_dump`** no PATH e `DATABASE_URL` (o caso do Replit: o módulo `postgresql-16` do
  `.replit` fornece `pg_dump` e `psql`): dump completo — estrutura e dados.
- **Sem `pg_dump`**, no PGlite local, ou se o `pg_dump` falhar (ex.: servidor numa versão mais
  nova que o `pg_dump`): exporta **só os dados** (`…-dados.sql.gz`), tabela a tabela em ordem de
  dependência, no formato `COPY … FROM stdin`. O arquivo guarda qual foi a última migração
  aplicada; a restauração exige o banco na mesma versão. Force um modo com `BACKUP_MODO=pg_dump`
  ou `BACKUP_MODO=dados`.
- Mantém os **14** mais recentes na pasta (`BACKUP_MANTER` muda o número) e apaga os demais.

### Onde os arquivos ficam

| Onde roda | O arquivo sobrevive? |
|---|---|
| Shell do workspace | Sim, em `.data/backups` do workspace. Baixe (clique direito → Download) e guarde fora do Replit. |
| Deployment (Scheduled ou Autoscale) | **Não.** O disco do deployment é descartado ao fim da execução. Use o Object Storage. |

**Object Storage do Replit (recomendado para o backup agendado).** O projeto não traz o pacote como
dependência; para ligar:

1. Abra a ferramenta **Object Storage** do Replit e crie um bucket (vira o bucket padrão do Repl).
2. `npm install @replit/object-storage` e faça commit do `package.json`/`package-lock.json`.
3. Defina `BACKUP_OBJECT_STORAGE=true` nos Secrets do deployment que roda o backup.

Com isso, `npm run backup` envia o arquivo para `backups/` no bucket e mantém lá também só os
`BACKUP_MANTER` mais recentes. Com `BACKUP_OBJECT_STORAGE=true`, qualquer falha no envio faz o
comando terminar com erro (o agendamento aparece como falho, em vez de "dar certo" sem cópia).
Sem a variável, o envio só acontece se o pacote estiver instalado, e falhas viram aviso.

> Além do arquivo, confira no painel **Database** do Replit se o seu plano oferece restauração a um
> ponto no tempo (útil para desfazer um erro de ontem). O arquivo de backup continua sendo a cópia
> fora do banco.

### Agendar (diariamente)

Replit → **Deploy** → **Scheduled**:

- **Build command:** `npm ci`
- **Run command:** `npm run backup`
- **Schedule:** todo dia às 03:00 de Brasília (`0 6 * * *` em UTC).
- **Secrets:** `DATABASE_URL` (a mesma do app), `BACKUP_OBJECT_STORAGE=true`.

Se o Repl do app já usa o deployment Autoscale e o Replit não permitir um segundo deployment no
mesmo Repl, crie um Repl só de tarefas (importando o mesmo repositório do GitHub) com esses Secrets
e os dois agendamentos deste guia.

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
- Em produção: pare o deployment (ou faça fora do horário de uso), restaure pelo Shell e publique de novo.

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
que o PGlite consiga carregar a partir do Postgres de produção, rode no Shell
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
2. Adicione `CRON_SECRET` nos Secrets do **deployment do app** (Autoscale) e do agendamento.
3. Replit → Deploy → **Scheduled** (no Repl de tarefas, se for o caso):
   - **Run command:** `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/verificacoes"`
   - **Schedule:** a cada 15 minutos (`*/15 * * * *`) — ou de hora em hora, se o custo pesar.
   - **Secrets:** `CRON_SECRET`, `APP_URL` (URL pública do app, sem barra no fim).
4. Teste no Shell com o mesmo `curl`: deve voltar `{"ok":true,...}`.

Alternativa sem Replit: um workflow agendado do GitHub Actions (`on: schedule`) com o mesmo `curl`
e o segredo em *Actions secrets*.

## 4. Logs e erros

Erros inesperados viram **uma linha JSON** no log do deployment, no mesmo formato para actions
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

## 6. Segurança HTTP

- **CSP com nonce** montada a cada requisição em `src/proxy.ts` (`src/server/auth/csp.ts`):
  `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`, `connect-src 'self'`, `worker-src 'self' blob:`,
  `frame-ancestors 'none'` (no workspace do Replit, o iframe do editor continua liberado),
  `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`. As rotas de arquivo
  (`/api/anexos/[id]`, planta da arena) mantêm a própria CSP com `sandbox`.
- Páginas com nonce precisam ser renderizadas por requisição (o layout de login chama
  `connection()`); uma página gerada no build sairia sem nonce e ficaria sem JavaScript.
- **Server Actions** aceitas só da própria origem e dos domínios exatos de `REPLIT_DOMAINS`,
  `REPLIT_DEV_DOMAIN` e `APP_URL` — sem curingas.

## 7. Checklist de produção

- [ ] Secrets do deployment: `APP_URL` (URL pública), `CRON_SECRET`; `EXIBIR_DEMO` ausente ou `false`; `SEED_DEMO` ausente.
- [ ] Primeiro administrador criado com `npm run admin:senha -- <email> <senha>`; nenhum usuário do seed de demonstração no banco de produção.
- [ ] `npm run db:migrate` aplicado (o run do deployment já faz).
- [ ] Backup diário agendado **com Object Storage** e um backup manual baixado para fora do Replit.
- [ ] Restauração testada (seção 2) — anote a data do último teste.
- [ ] Avisos agendados: `curl` manual devolve 200; agendamento a cada 15 min ativo.
- [ ] No navegador (produção): login, navegação, menus e diálogos, Arena 3D, impressão da OS e anexos funcionando, sem erros de CSP no console (F12).
- [ ] CI verde no GitHub (typecheck, lint, testes, build).
