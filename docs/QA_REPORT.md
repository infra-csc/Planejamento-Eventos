# Relatório de QA

Registro das rodadas de QA: o que foi mapeado, o que foi executado, o que passou, o que falhou, o que foi
corrigido e o que ficou sem validação. Sem senhas, tokens ou dados pessoais: os testes usam o banco de
demonstração (`scripts/seed.ts`, senha pública de demonstração) ou cópia local, só leitura, quando dito.

## Rodada 1 — 26/10/2026

### Ambiente e ferramentas

| Item | Situação |
| --- | --- |
| Stack | Next.js 16 (App Router, Turbopack), React 19, Drizzle ORM, PGlite (local/testes) e PostgreSQL/Neon (produção), Tailwind 4 |
| Autenticação | Sessão própria por cookie (`npe_sessao`) + entrada pelo Portal NORTE; perfis ADMIN, LOGISTICA, GESTAO, CENOGRAFIA, REQUISITANTE (por área) |
| Autorização | Matriz `src/domain/permissions.ts` (`pode`) conferida nos services (`exigir`); escopo por área nas solicitações; "ver como" do admin |
| Testes existentes | Vitest (domínio, integração com PGlite em memória, matriz de permissões, rotas de API); Playwright (fluxos E2E + axe) em desktop 1280×800 e celular 375×812 |
| Navegador | Chromium do Playwright (instalado nesta rodada: faltava a versão 1248 exigida pelo Playwright 1.64) e Chrome real para inspeção manual |
| Dados | E2E: banco PGlite novo a cada execução (`.data/e2e`), com seed de demonstração. Nada foi executado contra produção |

### Inventário

48 páginas (`src/app/**/page.tsx`) e 15 rotas de API. Telas cobertas pela varredura (todas abertas por
cada perfil, desktop e celular):

- Fixas: `/`, `/eventos`, `/eventos/novo`, `/calendario`, `/solicitacoes`, `/solicitacoes/nova`,
  `/biblioteca` (projetos e peças), `/catalogo`, `/catalogo/nova`, `/projetos`, `/projetos/novo`, `/arena`,
  `/arena/nova`, `/carga-descarga`, `/carga-descarga/cadastro`, `/consolidacao`, `/consolidacao/pendencias`,
  `/pendencias`, `/estoque`, `/historico`, `/notificacoes`, `/perfil`, `/admin`, `/admin/usuarios`,
  `/admin/areas`, `/admin/configuracoes`, rota inexistente (404).
- Com id: evento (visão geral, ata, OS, solicitações, histórico, editar, carga, reunião), conferência,
  linha da ata, impressão da OS e da ata, solicitação, projeto (ver, editar, duplicar), peça (editar),
  arena e impressão da arena.
- Perfis: admin, logística, gestão, cenografia, requisitante da Produção e requisitante da Ativação.

Fluxos de ponta a ponta (Playwright, `e2e/*.spec.ts`): solicitante envia necessidade pré-reunião com
descrição por unidade; logística atende alteração item a item e a OS ganha versão nova; logística confere
a ata, registra a reunião e fecha a ata; exportações (Excel da OS, OS de estrutura, Excel da ata); criação
de evento sem "Alterações até"; acessibilidade (axe, WCAG 2.2 A/AA) em 6 telas.

### Achados e correções

| # | Prioridade | Achado | Reprodução | Causa | Correção | Teste |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | P1 | `npm run db:seed` (e portanto `npm run setup` e toda a suíte E2E) caía com "Cannot read properties of undefined (reading 'id')" | `npm run db:seed` num banco novo | O catálogo renomeou "Estande 9×6 m" para "Stand 9×6 m" e o seed procurava o nome antigo | Seed usa o nome novo e, se um projeto sumir do catálogo, para com mensagem clara ("projeto X não está no catálogo") | E2E sobe de novo (o `webServer` roda o seed) |
| 2 | P1 | Seed parava em "Só solicitações enviadas e ainda sem resposta podem ser devolvidas" | idem, depois do #1 | Regra nova: alteração dentro da janela entra direto na OS; o evento de demonstração não tinha janela, e o cenário devolve uma alteração | Evento de demonstração EVT-0001 com a janela de alterações encerrada (as alterações passam pela logística, como o cenário espera) | idem |
| 3 | P2 | No celular, as listas (eventos, solicitações, biblioteca) não tinham link para teclado e leitor de tela: a linha abria só com toque | Celular 375 px, `/eventos`: nenhum link "Abrir EVT-…" acessível | `LinhaLink` punha o link oculto na 1ª célula, que no celular é a coluna do código (`hidden sm:table-cell`); além disso a escolha da célula comparava identidade de props, que não vale para elementos vindos do servidor | O link vai para o cabeçalho da linha (`th scope="row"`) ou a primeira célula visível em todas as larguras, escolhida pela posição | E2E `logistica.spec.ts` no celular; varredura reprova link de linha em célula escondida |
| 4 | P2 | Página 404 bloqueada pela CSP (scripts sem nonce; erro no console em toda rota inexistente) | Abrir qualquer rota inexistente com o console aberto | `src/app/not-found.tsx` era pré-renderizada estática, sem o nonce que a CSP exige | A página passa a ser renderizada por requisição (`connection()`) | Varredura (rota inexistente, sem erro no console) |
| 5 | P2 | Acessibilidade (axe, *serious*): o botão do menu do usuário tinha nome acessível diferente do texto visível (WCAG 2.5.3) — em todas as telas | axe em qualquer tela autenticada | `aria-label="Menu de {nome}"` sobrepunha o texto visível (iniciais, nome, perfil) | Nome acessível = nome e perfil visíveis + ", menu da conta"; iniciais decorativas; no celular o nome fica só para o leitor de tela | `e2e/acessibilidade.spec.ts` |
| 6 | P3 | Listas padrão da área apontam projetos por código fixo (PRJ-0033/0006 tendas, PRJ-0018/0019 stands); num banco em que o código é de outro projeto, o projeto errado aparecia (e duplicado com o catálogo) | Banco de demonstração: Produção via "Palco 8×4 m" no bloco Tendas | Código fixo sem conferência | O projeto achado pelo código só entra se o nome bater ("Tenda…", "Stand…") | E2E `conferencia.spec.ts` |
| 6b | P3 | Acessibilidade (axe, *serious*): na lista padrão da área, campos de quantidade zerados esmaecidos (opacidade 55%) ficavam abaixo do contraste mínimo (WCAG 1.4.3) | axe na nova solicitação de uma área com lista padrão | `opacity-55` no campo zerado | Opacidade 75% (continua discreto, contraste suficiente) | `e2e/acessibilidade.spec.ts` |
| 7 | — | Testes E2E desatualizados em relação às telas (título "Outros itens" para área com lista padrão; "OS de estrutura"; campo "Onde vai ficar" que saiu do cartão; título "Conferência da ata"; nome do item com o pedido de origem; "✓ Salvo") | — | Telas mudaram, testes não | Testes atualizados | — |
| 8 | — | Ações novas fora da matriz de permissões (estrutura locada, excluir grupo de prova, grades a mais do prisma, item do estoque) | — | Faltava incluir | Incluídas: cada perfil tenta cada uma; o que a matriz proíbe precisa lançar `SemPermissaoError` | `permissoes-matriz.test.ts` (310 casos) |

### Testes automatizados adicionados

- `e2e/varredura.spec.ts`: cada perfil abre todas as telas (fixas e uma de cada tipo com id), em desktop
  e celular, e reprova: resposta 5xx, tela de erro, 404 inesperado, erro de JavaScript, erro no console,
  página mais larga que a tela no celular, link de linha em célula escondida. Grava cada visita em
  `test-results/varredura.jsonl` (rota, onde foi parar, status, título).
- `src/server/services/permissoes-matriz.test.ts`: 4 ações novas.
- Regressões de produto desta semana (já no `npm test`): grades do prisma somadas, OS com nomes atuais do
  catálogo, estrutura locada, excluir grupo, testeira a definir, regras nas atas fechadas.

### Execução final (26/10/2026, depois das correções)

| Suíte | Resultado |
| --- | --- |
| `npm run typecheck` | ok |
| `npm run lint` | ok |
| `npm test` (Vitest: domínio, integração, matriz de permissões, rotas) | 709 passaram, 3 pulados (concorrência sem Postgres), 0 falhas |
| `npm run test:e2e` (Playwright, desktop + celular, banco novo) | 38 passaram, 0 falhas |
| Varredura (dentro do E2E) | 552 visitas (46 telas × 6 perfis × 2 larguras): nenhuma resposta 5xx, tela de erro, erro de JavaScript, erro no console, página mais larga que a tela no celular ou link de linha escondido |
| Acessibilidade (axe, WCAG 2.2 A/AA, 6 telas × 2 larguras) | 0 violações *serious*/*critical* |

Antes das correções: o seed não rodava (o E2E nem subia); depois de corrigido o seed, 3 de 38 passavam
(falta do navegador da versão do Playwright), depois 28 e 34, até 38/38.

Acesso por perfil (rotas que cada perfil não abre, conferido pela varredura; telas de admin redirecionam
para `/admin` com "Seu perfil não acessa esta página"): bate com `src/domain/permissions.ts` — por exemplo,
estoque só Ativação e admin; conferência e carga só logística e admin; edição de projetos só cenografia e
admin; solicitação de outra área não abre para requisitante.

### Pendências (não corrigidas nesta rodada)

- P3: em telas de solicitação, a mesma peça/projeto pode aparecer na lista padrão da área e na busca do
  catálogo com o mesmo nome acessível ("Quantidade de Stand 9×6 m"); funciona, mas leitor de tela ouve dois
  campos iguais em regiões diferentes.
- P3: botões e campos esmaecidos no hover da busca do catálogo (`opacity-60`) não foram apontados pelo axe
  (sem hover no teste); vale conferir contraste se virarem padrão.
- Grades × prisma: regra conferida em todos os eventos abertos, mas o tema segue para revisão com a equipe
  (ver histórico de commits de 22–23/10).

### Riscos e limitações

- Concorrência real (várias conexões) só roda com `TEST_DATABASE_URL` apontando para um Postgres
  descartável — não havia um nesta máquina; o teste existe (`concorrencia-postgres.test.ts`) e foi pulado.
- A varredura só abre telas (não grava); formulários e fluxos de escrita são cobertos pelos E2E de fluxo e
  pelos testes de service/matriz. Casos de rede lenta/queda e sessão expirada no meio de uma ação não foram
  automatizados nesta rodada.
- Dados reais: a lógica de grades/prismas e cavaletes foi conferida contra a produção em modo somente
  leitura (ver histórico de commits); nada de produção foi alterado pelos testes.
- Envio de e-mail (SMTP) e entrada pelo Portal NORTE não foram exercitados de ponta a ponta (dependem de
  serviços externos).
