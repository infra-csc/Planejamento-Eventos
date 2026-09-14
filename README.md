# Norte Mkt · Planejamento de Eventos

Sistema de OS, ata e estrutura para eventos: catálogo de peças → projetos padrão com lista de peças (BOM) → evento → ata da reunião → OS gerada automaticamente → solicitações de alteração respondidas item a item → encerramento pela logística.

Interface recriada a partir do handoff do Claude Design ([docs/design-handoff/README.md](docs/design-handoff/README.md)): desktop, largura mínima de 1000 px.

Especificação completa: [docs/01-analise-e-especificacao.md](docs/01-analise-e-especificacao.md). Entregáveis, decisões e testes: [docs/02-entregaveis.md](docs/02-entregaveis.md).

## Stack

- Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind CSS 4
- Drizzle ORM sobre PostgreSQL. Sem `DATABASE_URL`, usa PostgreSQL embutido (PGlite) em `./.data/pglite` — nada para instalar localmente.
- Autenticação própria (sessão em cookie HttpOnly), permissões verificadas no servidor.
- Testes: Vitest (domínio) e teste de fumaça dos serviços (`npm run test:smoke`).

## Rodando localmente

```bash
npm install
npm run setup      # migrações + dados de demonstração
npm run dev        # http://localhost:3000
```

Usuários de demonstração (senha de todos: `norte1234`). Fora de produção, a tela de login mostra o bloco "Demonstração — entrar como" com um clique por perfil:

| Perfil | E-mail |
|---|---|
| Logística | marina.castro@nortemkt.com.br · rafael.nunes@nortemkt.com.br |
| Gestão | helena.prado@nortemkt.com.br |
| Cenografia (biblioteca de projetos) | bruno.tavares@nortemkt.com.br |
| Requisitante (Produção) | paulo.ribeiro@nortemkt.com.br |
| Requisitante (Ativação / Gráfica / Atendimento) | julia.fontes@ · diego.sampaio@ · lucia.barros@nortemkt.com.br |
| Administrador | admin@nortemkt.com.br |

Recomeçar do zero: `npm run db:reset && npm run setup`.

## Códigos e rotas

- Códigos sequenciais: eventos `EVT-0001`, solicitações `SOL-0001`, projetos `PRJ-0001`.
- `/` painel por perfil · `/eventos` · `/eventos/[id]` (visão geral, ata, consolidar ata, solicitações, OS, histórico) · `/solicitacoes` (`?filtro=ABERTAS|ATRASADAS|RASCUNHO|RESPONDIDA|TODAS`, `?fila=1` no detalhe) · `/solicitacoes/nova` (`?evento=` e `?rascunho=`) · `/biblioteca` (`?aba=pecas`) · `/consolidacao` (`?dias=15|30|60`) · `/admin` (`?aba=areas|config`) · `/notificacoes`.
- Busca global: `Ctrl/⌘ + K`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento / build de produção / servidor de produção |
| `npm run db:generate` | gera migração SQL a partir de `src/server/db/schema.ts` |
| `npm run db:migrate` | aplica migrações (PGlite ou Postgres, conforme `DATABASE_URL`) |
| `npm run db:seed` | dados de demonstração (só em banco vazio) |
| `npm run db:reset` | apaga tudo |
| `npm test` | testes unitários do domínio |
| `npm run test:smoke` | cenários de negócio contra o banco (rode após `setup`) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |

## Deploy no Replit

1. Importe o repositório no Replit. O arquivo `.replit` já define Node 24, PostgreSQL 16, build (`npm ci && npm run build`) e run (`npm run db:migrate && npm run start`) para deployment Autoscale, porta 3000.
2. Crie o banco PostgreSQL do Replit (aba Database). A variável `DATABASE_URL` é injetada automaticamente.
3. Em Secrets, defina `APP_SECRET` (valor aleatório) e `APP_URL` (URL pública do deployment). Opcional: `EXIBIR_DEMO=true` mostra o bloco de login de demonstração também em produção (útil para apresentar com os dados do seed; não use com dados reais).
4. No Shell do Replit, rode uma vez: `npm run setup` (migrações + dados de demonstração). Para produção sem dados fictícios, rode só `npm run db:migrate` e crie o primeiro usuário administrador com `npm run db:seed` seguido de limpeza, ou ajuste o seed.
5. Publique o deployment.

Sem SMTP no MVP: a recuperação de senha gera um link registrado no log do servidor (e exibido na tela fora de produção). Ao criar um usuário, o administrador recebe na tela um link de acesso (válido por 7 dias, uso único) para enviar à pessoa definir a senha. Configure e-mail antes de liberar para todos.

## Estrutura

```
src/
  app/            rotas (App Router): (auth), (app), api, impressao
  components/     ui/ (primitivas) e por funcionalidade (eventos, solicitacoes, projetos, ...)
  domain/         regras puras + testes: permissões, máquinas de estado, cálculo de OS, consolidação
  server/         auth, db (drizzle), services (casos de uso), jobs (verificações de prazo)
  lib/            formatação, schemas zod, helpers de action
scripts/          migrate, seed, reset, smoke
drizzle/          migrações SQL
docs/             especificação, entregáveis e design-handoff/ (protótipo e especificação visual)
```
