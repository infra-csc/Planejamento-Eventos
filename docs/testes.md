# Testes

Seis camadas, da mais rápida para a mais lenta. As quatro primeiras rodam juntas em `npm test`
(Vitest, PGlite em memória, sem nada instalado além das dependências); concorrência precisa de um
Postgres de verdade; E2E precisa do Chromium do Playwright.

| Camada | Onde | Banco | Comando |
| --- | --- | --- | --- |
| Domínio | `src/domain/**/*.test.ts`, `src/lib/*.test.ts`, `src/server/auth/{csp,cron,politica-sessao}.test.ts`, `src/server/export/*.test.ts` | nenhum | `npm test` |
| Integração | `src/server/services/{integracao,notificacoes,arenas}.test.ts`, `src/server/auth/{sessao-integracao,ver-como}.test.ts` | PGlite em memória (`memory://`) com as migrações reais | `npm test` |
| Matriz de permissões | `src/server/services/permissoes-matriz.test.ts` | PGlite em memória | `npm test` |
| Rotas de API | `src/app/api/**/route.test.ts` | PGlite em memória | `npm test` |
| Concorrência | `src/server/services/concorrencia-postgres.test.ts` | Postgres descartável (`TEST_DATABASE_URL`) | ver abaixo |
| E2E + acessibilidade | `e2e/*.spec.ts` | PGlite novo em `.data/e2e` | `npm run test:e2e` |

Além delas: `npm run test:smoke` (fluxos de serviço contra o banco atual, logo depois do `npm run setup`),
`npm run typecheck` e `npm run lint`.

## Domínio, integração, matriz e rotas — `npm test`

```bash
npm test                                   # tudo (Vitest)
npx vitest run src/server/services/permissoes-matriz.test.ts   # um arquivo
npx vitest src/domain                      # modo watch numa pasta
```

- **Domínio**: regras puras (estados do evento e da solicitação, cálculo da OS, tendas, descrições por
  unidade, ajustes de peças, CSP, política de sessão). Sem banco.
- **Integração**: services de verdade contra PGlite em memória. Cada arquivo escolhe o banco num
  `vi.hoisted` antes de importar `@/server/db` e aplica as migrações de `./drizzle`
  (`migrarBanco()` em `src/test/apoio.ts`). Os fixtures de `src/test/apoio.ts` usam os mesmos
  services do app, então o estado montado é o que a aplicação produz.
- **Matriz de permissões**: cada service que altera dados é chamado por cada perfil; o que
  `src/domain/permissions.ts` permite tem de passar, o que proíbe tem de lançar `SemPermissaoError`.
  Ao criar uma ação nova, inclua-a na matriz.
- **Rotas**: os route handlers (`/api/os/[id]/excel`, `/estrutura`, `/complemento`, CSV por setor,
  ata em Excel, anexos, planta da arena, busca, cron) chamados como funções, com sessão criada no banco.

Variáveis: nenhuma. Os arquivos forçam `PGLITE_DATA_DIR=memory://` e apagam `DATABASE_URL`.

## Concorrência — Postgres real

O PGlite tem uma conexão só e serializa tudo; as travas (`for update`, `bloquearEvento`) só são
postas à prova com várias conexões. Sem `TEST_DATABASE_URL` o arquivo é pulado.

```bash
# banco DESCARTÁVEL: as migrações são aplicadas e o teste grava dados (nomes únicos, nada é apagado)
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=npe postgres:16
TEST_DATABASE_URL=postgres://postgres:ci@localhost:5432/npe npx vitest run src/server/services/concorrencia-postgres.test.ts

# só para validar o próprio teste sem Postgres (sem concorrência real):
CONCORRENCIA_EM_PGLITE=1 npx vitest run src/server/services/concorrencia-postgres.test.ts
```

## E2E + acessibilidade — `npm run test:e2e`

Playwright no Chromium, em dois projetos: **desktop** (1280×800) e **celular** (375×812, toque).
O `webServer` do `playwright.config.ts` roda `e2e/servidor.mjs`, que:

1. apaga e recria o banco PGlite em `.data/e2e` (o banco local `.data/pglite` não é tocado);
2. roda `db:migrate`, `db:seed`, `importar:catalogo` e `importar:arena` com `PGLITE_DATA_DIR=.data/e2e`;
3. roda `npm run build` e `npm run start` na porta 3100, com `EXIBIR_DEMO=true` (os usuários do seed
   entram com `norte1234` sem a troca obrigatória de senha) e sem `DATABASE_URL`.

```bash
npx playwright install chromium            # uma vez por máquina (no Linux do CI: --with-deps)
npm run test:e2e                           # os dois projetos
npm run test:e2e -- --project=desktop      # só desktop
npm run test:e2e -- e2e/conferencia.spec.ts --headed
npx playwright show-report                 # relatório HTML (playwright-report/)
```

| Variável | Efeito |
| --- | --- |
| `E2E_PORT` | outra porta (padrão 3100) |
| `E2E_SEM_BUILD=1` | pula o `npm run build` e usa o `.next` atual (iteração local) |
| `E2E_REUSAR_SERVIDOR=1` | usa um app já rodando na porta, sem recriar o banco |
| `CI` | `retries: 1`, proíbe `test.only`, reporter do GitHub |

Fluxos (seletores só por papel e rótulo acessível — `getByRole`/`getByLabel`, nunca classes CSS):

| Arquivo | O que cobre |
| --- | --- |
| `solicitante.spec.ts` | Paulo (requisitante) escolhe um evento em preparação no combobox, adiciona um projeto com quantidade 2, descreve as 2 unidades, envia e vê a solicitação **Na ata** |
| `logistica.spec.ts` | Paulo pede uma alteração num evento com ata fechada; Marina (logística) abre pela fila, atende item a item e a OS ganha uma versão nova |
| `conferencia.spec.ts` | Marina cria um evento, Paulo pede 3 itens, Marina inicia a reunião, marca uma linha, confere as restantes, preenche os dados da reunião e fecha a ata (vai para a OS v1) |
| `exportacoes.spec.ts` | OS em Excel, planilha de estrutura e ata em Excel respondem 200, `content-type` xlsx e assinatura ZIP |
| `acessibilidade.spec.ts` | axe-core (WCAG 2.0/2.1/2.2 A e AA) em Painel, Eventos, Solicitações, Nova solicitação, Evento e Conferência |
| `eventos.spec.ts` | `test.fixme`: criar evento com "Alterações até" em branco (bug conhecido, descrito no arquivo) |

Bugs do app encontrados pelo E2E (23/09/2026), marcados com `test.fixme` até a correção:

- **Criar/editar evento sem "Alterações até"** falha ("Não foi possível concluir a operação"; log
  `RangeError: Invalid time value`): em `src/lib/schemas.ts` o `.refine` de `dataISO` roda no Zod 4
  mesmo com o `.regex` falhando e chama `toISOString()` numa data inválida. Os fluxos preenchem o campo.
- **Conferência**: o filtro de área (`<Select>` "Todas as áreas" em `conferencia-ata.tsx`) não tem nome
  acessível — `button-name`, critical, desktop e celular.
- **Evento no celular**: o link "Eventos" da trilha (`trilha.tsx`) é menor que 24×24 px — `target-size`, serious.

Os dois de acessibilidade ficam em `CONHECIDAS` no `acessibilidade.spec.ts`: o elemento sai da auditoria
normal da tela (o resto continua valendo) e um `test.fixme` audita a tela inteira.

Os testes que alteram dados criam o que precisam (evento, solicitação) com nomes únicos, porque desktop
e celular rodam o mesmo arquivo contra o mesmo banco. Rodam em sequência (`workers: 1`): um servidor
com PGlite tem uma conexão só.

**Acessibilidade**: o teste falha só com violações `serious` ou `critical`. Todas as encontradas
(inclusive `moderate`/`minor`) saem no console como `[axe] projeto · tela · impacto · regra`, ficam
anexadas ao relatório (`axe-<tela>.json`, com seletor e HTML de até 5 ocorrências por regra) e somadas
em `test-results/axe-violacoes.jsonl`.

`playwright-report/` traz os scripts do visualizador de traces: apague a pasta antes de `npm run lint`
(o ESLint não lê o `.gitignore`).

**Bug do app encontrado por um teste**: marque o teste com `test.fixme(...)` e um comentário dizendo
o que falha e onde; não mude o teste para passar.

**CI**: o job `e2e` do `.github/workflows/ci.yml` instala o Chromium (`npx playwright install --with-deps chromium`),
roda `npm run test:e2e` e, se falhar, publica `playwright-report/` e `test-results/` (traces e
screenshots) como artefato `playwright-report`. Para abrir um trace baixado: `npx playwright show-trace <arquivo>.zip`.

## Roteiro de teste manual antes de entregas

O que a automação não pega bem: tempo real entre pessoas, sessão e celular de verdade. Rode com
`npm run setup` num banco limpo (ou no ambiente de demonstração) e marque cada item.

1. **Duas abas no mesmo rascunho.** Paulo abre `Nova solicitação`, adiciona um item (o rascunho é salvo
   sozinho) e abre o mesmo rascunho em outra aba (`Solicitações` → rascunho → `Editar itens`). Mude a
   quantidade numa aba e o título na outra; envie por uma delas. Esperado: nada some em silêncio — a
   outra aba avisa que a solicitação mudou/já foi enviada ao salvar, e o que foi enviado é o que aparece
   em `/solicitacoes/<id>`.
2. **Dois logísticos na mesma linha.** Marina e Rafael (navegadores diferentes) abrem a conferência do
   mesmo evento em reunião. Os dois abrem `Ajustar quantidade` da mesma linha; Marina salva primeiro.
   Esperado: o ajuste do Rafael é recusado com mensagem clara (a quantidade mudou), sem sobrescrever o
   da Marina; o histórico da linha mostra só o ajuste válido. Repita com os dois respondendo o mesmo
   item de uma alteração (`Atender` ao mesmo tempo): só uma resposta vale e só uma versão de OS nasce.
3. **Sessão expirando com formulário cheio.** Preencha uma solicitação inteira (itens, descrições,
   título) sem enviar. Em outra aba, clique em `Sair` (ou, como administrador, `Encerrar sessões` do
   usuário). Volte e clique em `Enviar`. Esperado: aviso de sessão expirada e caminho para entrar de
   novo; depois do login o rascunho salvo automaticamente continua lá (nada do que foi digitado some).
4. **Tenda por local → planilha.** Em `Nova solicitação`, num projeto de tenda use `Pedir por local`,
   distribua tendas por 2 ou 3 locais com fechamento/calha e envie. Na reunião, confira e feche a ata.
   Esperado: a OS e a `Planilha de estrutura` (.xlsx) trazem uma linha por local com as peças extras
   somadas, e os totais batem com a visão "Totais por peça".
5. **Projeto inativado com pedido aberto.** Paulo envia um pedido com um projeto; Bruno (cenografia)
   inativa esse projeto no catálogo antes da resposta. Esperado: o projeto some da busca de novos
   pedidos, mas o pedido aberto continua respondível pela logística, a ata/OS mostram o projeto na
   versão pedida e as exportações não quebram.
6. **Celular.** Num celular de verdade (não só o emulador): login, `Nova solicitação` com a barra de
   envio fixa no rodapé (ela não pode cobrir o último campo), combobox de evento com o teclado aberto,
   conferência com o check de 40 px, diálogo de ajuste e menu lateral (abre, fecha no Esc/fundo e ao
   navegar). Gire a tela uma vez no meio do formulário.

Anote o que falhar com tela, perfil, passo e horário (o código `ref` da tela de erro localiza a linha no log).
