# Norte Mkt · Planejamento de Eventos

Sistema de OS, ata e estrutura para eventos: catálogo de peças → projetos padrão com lista de peças (BOM) → evento → ata da reunião → OS gerada automaticamente → solicitações de alteração respondidas item a item → encerramento pela logística.

Interface recriada a partir do handoff do Claude Design ([docs/design-handoff/README.md](docs/design-handoff/README.md)): desktop, largura mínima de 1000 px.

Especificação completa: [docs/01-analise-e-especificacao.md](docs/01-analise-e-especificacao.md). Entregáveis, decisões e testes: [docs/02-entregaveis.md](docs/02-entregaveis.md).

## Stack

- Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind CSS 4
- Drizzle ORM sobre PostgreSQL. Sem `DATABASE_URL`, usa PostgreSQL embutido (PGlite) em `./.data/pglite` — nada para instalar localmente.
- Autenticação própria (sessão em cookie HttpOnly; expira com 14 dias sem uso ou 30 dias desde o login), permissões verificadas no servidor, CSP com nonce por requisição (`src/proxy.ts`).
- Testes: Vitest (domínio + integração dos services com PGlite em memória) e teste de fumaça contra o banco (`npm run test:smoke`). CI em `.github/workflows/ci.yml`.

## Rodando localmente

```bash
npm install
npm run setup      # migrações + dados de demonstração
npm run dev        # http://localhost:3000
```

Usuários de demonstração (senha de todos: `norte1234`). Localmente, a tela de login mostra o bloco "Demonstração — entrar como" com um clique por perfil:

| Perfil | E-mail |
|---|---|
| Logística | marina.castro@nortemkt.com.br · rafael.nunes@nortemkt.com.br |
| Gestão | helena.prado@nortemkt.com.br |
| Cenografia (biblioteca de projetos) | bruno.tavares@nortemkt.com.br |
| Requisitante (Produção) | paulo.ribeiro@nortemkt.com.br |
| Requisitante (Ativação / Gráfica / Atendimento) | julia.fontes@ · diego.sampaio@ · lucia.barros@nortemkt.com.br |
| Administrador | admin@nortemkt.com.br |

As datas do seed são relativas ao dia em que ele roda (reunião "hoje", prazos vencendo). Para uma apresentação, recarregue os dados **no dia**: `npm run db:reset && npm run setup` (local).

## Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `DATABASE_URL` | Replit (automática) | PostgreSQL. Vazia = PGlite local. |
| `PGLITE_DATA_DIR` | local, opcional | Pasta do PGlite (padrão `./.data/pglite`; `memory://` nos testes). |
| `APP_URL` | produção | URL pública: links de acesso gerados pelo administrador e origem liberada para Server Actions. |
| `EXIBIR_DEMO` | opcional | `true` mostra o login de demonstração no Replit/produção (qualquer pessoa com o link entra como qualquer perfil, inclusive Administrador). O `.replit` deixa `false`. Local já aparece. |
| `DB_POOL_MAX` | opcional | Conexões do pool por instância (padrão 10). No Autoscale cada instância abre o seu: instâncias × `DB_POOL_MAX` precisa caber no limite de conexões do Postgres. |
| `SEED_DEMO` | opcional | `true` permite rodar o seed fora da máquina local (Replit, Postgres, produção). Só num ambiente de demonstração. |
| `CRON_SECRET` | produção | Segredo da rota `/api/cron/verificacoes` (avisos de prazo e lembretes). Sem ele a rota responde 503. Veja docs/operacao.md. |
| `PORTAL_SSO_SECRET` | produção | Entrada pelo Portal NORTE (NORTE-App-Hub): igual ao `SESSION_SECRET` do hub, 32+ caracteres. O portal abre `/api/auth/portal?portal_sso=<token>`; o papel escolhido lá vira o perfil aqui a cada entrada. Vazio = desligado. |
| `PORTAL_URL` | opcional | Endereço do portal, para o link "Entre pelo Portal NORTE" na tela de login. |
| `BACKUP_DIR` / `BACKUP_MANTER` | opcional | Pasta dos backups (padrão `./.data/backups`) e quantos manter (padrão 14). |
| `BACKUP_OBJECT_STORAGE` | opcional | `true` exige enviar o backup ao Object Storage do Replit (precisa do pacote `@replit/object-storage`). |
| `ARMAZENAMENTO` | opcional | `replit` grava anexos e plantas novos no Object Storage (precisa do pacote `@replit/object-storage`); ausente = no banco. Veja docs/operacao.md §7. |

## Regras de negócio que mais importam

- **Fases do evento:** Preparação (áreas enviam necessidades) → Em reunião (logística consolida a ata) → Aberto a alterações (ata fechada, OS v1) → Encerrado. Só a gestão reabre. Cancelar cancela o que estiver em aberto.
- **Resposta por item:** atendido, parcial (quantidade + motivo) ou não atendido (motivo). Cada resposta a uma alteração pós-ata gera uma nova versão da OS; "Atender tudo" gera uma só.
- **Efeito na ata:** respostas, correções e "desfazer" aplicam só a diferença na linha, sem apagar mudanças feitas depois por outra solicitação ou por ajuste da logística, e nunca trazem de volta uma linha que outra ação removeu (`calcularEfeitoLinha`, em `src/domain/solicitacao.ts`).
- **Concorrência:** toda mutação que mexe na ata, na OS ou na fase trava o evento (`bloquearEvento`): duas pessoas na reunião respondem uma depois da outra, sem linha duplicada.
- **Fechamentos automáticos:** fechar a ata cancela necessidades pré-reunião que ficaram em rascunho; encerrar com o bloqueio desligado cancela solicitações sem resposta (com aviso à área).
- **Visibilidade:** requisitante e cenografia veem só as solicitações e o histórico da própria área.
- **Administrador:** acesso total. Vê e executa tudo o que os outros perfis fazem (responder, fechar ata, reabrir, cadastrar peças e projetos) e, ao criar uma solicitação, escolhe em nome de qual área. As ações ficam no histórico com o nome dele.

## Códigos e rotas

- Códigos sequenciais: eventos `EVT-0001`, solicitações `SOL-0001`, projetos `PRJ-0001`.
- `/` painel por perfil · `/eventos` · `/eventos/[id]` (visão geral, ata, consolidar ata, solicitações, OS, histórico) · `/solicitacoes` (`?filtro=ABERTAS|ATRASADAS|RASCUNHO|RESPONDIDA|TODAS`, `?fila=1` no detalhe) · `/solicitacoes/nova` (`?evento=` e `?rascunho=`) · `/biblioteca` (`?aba=pecas`) · `/consolidacao` (`?dias=15|30|60`) · `/admin` (`?aba=areas|config`) · `/notificacoes`.
- `/arena` Arena 3D do evento (primeiro caso: Eco Run SP 2026, a partir do mapa de arena R03 e da ata de OS). **Os dados da arena ficam em `scripts/dados/arena-eco-run-sp-2026.ts`** e `npm run importar:arena` os grava na tabela `arenas` (sem evento; até lá, o app lê o arquivo como reserva) — docs/operacao.md §8. Vistas Perspectiva / De cima / Planta; **modo conferência** lista as divergências entre planta e ata (`Arena.divergencias`, `src/domain/arena/conferencia.ts`) e acende só os pontos divergentes. Detalhes em docs/02-entregaveis.md §18.
- Busca global: `Ctrl/⌘ + K`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento / build de produção / servidor de produção |
| `npm run db:generate` | gera migração SQL a partir de `src/server/db/schema.ts` |
| `npm run db:migrate` | aplica migrações (PGlite ou Postgres; no Postgres com advisory lock) |
| `npm run db:seed` | dados de demonstração (só em banco vazio) |
| `npm run db:reset` | **apaga tudo**. Com `DATABASE_URL`, exige `-- --force` |
| `npm test` | testes de domínio e de integração (PGlite em memória, não toca no seu banco) |
| `npm run test:smoke` | cenários de negócio contra o banco atual — **altera os dados**; rode logo após `setup` |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run backup` | backup do banco em `.sql.gz` com data no nome (pg_dump quando houver; senão, só os dados), mantém os 14 últimos |
| `npm run restaurar -- <arquivo> --force` | restaura um backup (**apaga os dados atuais**); sem `--force` só mostra o que faria |

## Replit

**Botão Run.** O `.replit` roda `npm run db:migrate && npm run build && npm run start` na porta 3000, com `EXIBIR_DEMO="false"`. O Run **não** roda o seed nem a importação do catálogo (criavam usuários com senha fixa e reescreviam o catálogo). Para atualizar:

```bash
git pull && npm install && npm run db:migrate
```

Depois clique em Stop/Run. Peças e projetos novos do catálogo real entram com `npm run importar:catalogo` (rode quando o catálogo do repositório mudar). Os **eventos reais de 2026** (um por OS de estrutura do SharePoint, com a ata montada a partir dos projetos e das tendas por local) entram com `npm run importar:eventos`; o script é idempotente (identifica cada evento pelo arquivo da OS) e `npm run importar:eventos -- --desfazer` remove tudo que ele criou.

**Primeiro administrador (banco novo).** `npm run admin:senha -- voce@empresa.com.br UmaSenhaForte` cria (ou redefine) o administrador; os demais usuários são convidados em Administração. Enquanto não houver nenhum usuário ativo, a tela de login mostra esse comando. **Senhas provisórias** (usuários do seed, senha definida pelo administrador, ou quem entrar com a senha de demonstração fora do modo demonstração) só abrem **Meu perfil** até a pessoa definir a própria senha. O seed de demonstração só roda fora da máquina local com `SEED_DEMO=true` — use apenas num Repl separado, nunca com dados reais.

**Deployment (Autoscale).** Build `npm ci && npm run build`; run `npm run db:migrate && npm run start`. Em Secrets, defina `APP_URL` com a URL pública e `CRON_SECRET` (avisos agendados). Para produção sem dados fictícios, rode só `npm run db:migrate` e crie o primeiro administrador com `npm run admin:senha -- <email> <senha>`.

**Login falhando com "Invalid Server Actions request".** A origem do navegador não está liberada. As origens vêm de `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` e `APP_URL` (`next.config.ts`); o `proxy.ts` registra `[origem-action]` no console com origin e host quando eles divergem.

**Sem e-mail no MVP.** Ao criar um usuário, o administrador recebe um link de acesso (7 dias, uso único) para enviar à pessoa. "Esqueci minha senha" não mostra link: avisa os administradores, que geram um novo link na tela de usuários.

**Backup, avisos agendados e checklist de produção.** O banco do Replit é a única cópia: `npm run backup` gera o arquivo, `npm run restaurar` o devolve. Como agendar o backup e os avisos (Scheduled Deployments), onde os arquivos ficam e como testar a restauração: **docs/operacao.md**.

## Estrutura

```
src/
  app/            rotas (App Router): (auth), (app), api, impressao
  components/     ui/ (primitivas) e por funcionalidade (eventos, solicitacoes, projetos, arena, ...)
  domain/         regras puras + testes: permissões, máquinas de estado, cálculo de OS, efeito na ata, consolidação
  server/         auth, db (drizzle), services (casos de uso + integracao.test.ts), jobs (verificações de prazo)
  lib/            formatação, schemas zod, helpers de action e redirecionamento seguro
scripts/          migrate, seed, reset, smoke
drizzle/          migrações SQL
docs/             especificação, entregáveis e design-handoff/ (protótipo e especificação visual)
```
