# Auditoria de lógica — 28/10/2026 (logic-auditor)

Rodada pedida: app inteiro, todos os elementos e todas as permissões, com atenção especial às mudanças de hoje nas
tendas (quadro de tendas por local, `ajustarTendasDoLocal`, `incluirLinhaAtaAction` com `tenda_fechamento`/`tenda_calha`,
`kitTendaDoProjetoAction`) e ao ajuste de tenda depois da ata gerando várias versões da OS.

Base: `main` em `2bb3745` (árvore limpa; sem `git pull` nesta rodada, para não mexer no checkout que outros 5 agentes usam).
Ambiente: Vitest + PGlite em memória (testes novos `*.auditoria.test.ts`) e o servidor de demonstração compartilhado
`http://localhost:3100` (build de produção, banco `.data/e2e`), só leitura. Nenhum código do app foi alterado.

## Resumo

| # | Gravidade | Achado | Teste |
|---|---|---|---|
| P1-1 | P1 | Duas áreas com tenda no mesmo local: mexer só nos fechamentos tira a tenda de uma área, responde "não atendido" para ela e passa a tenda para a outra | `tendas.auditoria.test.ts` › P1-1 |
| P1-2 | P1 | Fechamentos que não dividem igual entre as tendas marcam o pedido como **parcial** ("1 de 2") e avisam a área, embora as 2 tendas continuem na OS | `tendas.auditoria.test.ts` › P1-2; `ata-pos.auditoria.test.ts` › P2-4b (aviso) |
| P1-3 | P1 | O quadro do local não é atômico: um passo que falha no meio deixa o local pela metade (2 tendas viram 1) e a tela volta a mostrar os números antigos | `tendas.auditoria.test.ts` › P1-3 |
| P2-4 | P2 | Com a ata fechada, um único "Salvar tendas" gera **7 versões da OS** e **7 avisos** para a área (no cenário do teste) | `tendas.auditoria.test.ts` › P2-4; `ata-pos.auditoria.test.ts` › P2-4b |
| P2-5 | P2 | "Incluir item" de tenda com fechamentos depois da ata: 2 versões da OS, e inclusão + ajuste não são uma transação (erro no ajuste deixa a linha sem fechamentos; repetir duplica) | `tendas.auditoria.test.ts` › P2-5 |
| P2-6 | P2 | Projeto editado na Biblioteca muda a OS de evento com ata fechada (nova versão) sem justificativa e sem avisar a área que pediu; a Cenografia faz isso sem ter `ata.ajustar` | `ata-pos.auditoria.test.ts` › P2-6 |
| P3-7 | P3 | A tela da solicitação mostra os fechamentos/calhas do **pedido**, não os decididos na reunião (área vê "sem fechamento" com 4 na OS) | sem teste (leitura de código) |
| P3-8 | P3 | "Completar" acompanhante (cavalete/pé) clicado duas vezes ou por duas pessoas duplica a linha (6 → 12 cavaletes) | `ata-pos.auditoria.test.ts` › P3-8 |
| P3-9 | P3 | Grades "a mais" do prisma aceitam ajuste depois da ata, com justificativa automática e nova versão da OS (a segunda mudança já é recusada) | `ata-pos.auditoria.test.ts` › P3-9 |
| P3-10 | P3 | `ajustarTendasDoLocal` trata papel ausente em `totais` como 0 (calha some), ao contrário do domínio (`totalDoLocal`: ausente = padrão × tendas) | `tendas.auditoria.test.ts` › P3-10 |
| P3-11 | P3 | Estoque da Ativação grava quantidade lida antes (sem trava): duas pessoas ao mesmo tempo perdem uma atualização | hipótese (PGlite serializa; precisa de Postgres) |
| P3-12 | P3 | "Atualizar para vN" depois da ata: sem justificativa, sem aviso à área e sem conferir se a linha está ativa | sem teste (leitura de código) |
| P3-13 | P3 | Reconhecimento de tenda diferente entre telas: solicitação usa o nome (`/^tendas?/`) e sufixo de código; serviço usa o kit (`kitDaTenda`) | sem teste (leitura de código) |

Testes novos (todos falham hoje, cada um descreve o resultado esperado; o último de `tendas` passa e documenta o que foi verificado):

- `src/server/services/tendas.auditoria.test.ts` — 7 casos (6 falham, 1 passa).
- `src/server/services/ata-pos.auditoria.test.ts` — 4 casos (4 falham).

Rodar: `npx vitest run src/server/services/tendas.auditoria.test.ts src/server/services/ata-pos.auditoria.test.ts --maxWorkers=2`
(≈ 25 s; resultado desta rodada: 10 falhas esperadas, 1 aprovado; `tendas-conferencia.test.ts` continua verde).

---

## Achados

### P1-1 · Tendas de áreas diferentes no mesmo local: o quadro tira a tenda de uma área

- **Onde:** `src/server/services/conferencia.ts:575-592` (o quadro casa grupos e linhas pela posição; linhas que sobram
  vão a 0 em `:586`, linhas novas herdam a área da primeira em `:588`), junto com o agrupamento só por local em
  `src/components/eventos/tenda-conferencia.tsx:26-38` e `src/components/eventos/tenda-do-local.ts:18` (linhas de
  pedidos e áreas diferentes entram no mesmo `linhaIds`). Resposta ao pedido em `conferencia.ts:267-287`.
- **Cenário:** Produção pede 1 tenda 5×5 em "GV"; Gráfica pede 1 tenda 5×5 em "GV" (pré-reunião, entram na ata).
  Na conferência, a logística muda só os fechamentos do local para 2 (tendas e calhas iguais).
- **Obtido:** o quadro vira 1 grupo de 2 tendas; a linha da Produção passa de 1 para 2 e a da Gráfica vai a 0. O item
  da Gráfica fica **NAO_ATENDIDO (0)**, a Gráfica recebe "não atendido", e a OS passa a mostrar as 2 tendas como da
  Produção. Os totais da OS batem, mas o dado por área está errado.
- **Esperado:** cada área continua com a sua tenda atendida; os fechamentos são distribuídos sem mudar quantidade nem
  dono das linhas.
- **Teste:** `tendas.auditoria.test.ts` › "P1-1 · duas áreas pediram tenda no mesmo local…" (falha: `b: NAO_ATENDIDO`).
- **Correção sugerida:** distribuir o quadro **por linha**, preservando quantidade e área de cada uma: primeiro cada
  linha recebe a sua parte das tendas (mudança de tendas só mexe nas linhas da logística ou pede escolha), e os
  fechamentos/calhas são redistribuídos dentro de cada linha (dividindo a linha só quando necessário, com a parte nova
  na mesma área e ligada ao mesmo pedido). Alternativa mais simples: o quadro do local agrupa por local **e área**
  (um quadro por área), e só a linha da logística absorve diferenças.

### P1-2 · Fechamentos que não dividem igual marcam o pedido como parcial

- **Onde:** `src/server/services/conferencia.ts:580-583` (a linha do pedido recebe a quantidade do 1º grupo) +
  `:271-287` (quantidade abaixo do pedido vira `PARCIAL`/`responderNaTransacao` com aviso).
- **Cenário:** Produção pede 2 tendas em "Dispersão". Na conferência: 2 tendas e **3** fechamentos.
- **Obtido:** o quadro divide em 1 tenda com 2 fechamentos + 1 tenda com 1; a linha do pedido cai de 2 para 1 e o item
  fica **PARCIAL, 1 de 2**; a segunda tenda vira linha "da logística" sem ligação com o pedido. Com a ata fechada, a área
  recebe "SOL-0001: Tenda 5×5 m — atendido parcialmente · 1 de 2", enquanto a OS leva 3 tendas (teste P2-4b).
- **Esperado:** item continua ATENDIDO (2 de 2): só a composição das tendas mudou.
- **Teste:** `tendas.auditoria.test.ts` › "P1-2 · fechamentos que não dividem igual…" (falha: `PARCIAL, 1`).
- **Correção sugerida:** na divisão, a(s) linha(s) nova(s) do mesmo pedido devem contar para o atendimento (ex.: guardar
  `solicitacaoItemId` também na linha dividida, ou calcular o atendido pela soma das linhas do item), e o ajuste não deve
  chamar `responderNaTransacao` quando o total de tendas do item não muda. Corrigir junto com P1-1.

### P1-3 · Quadro do local sem transação: falha no meio deixa o local pela metade

- **Onde:** `src/server/services/conferencia.ts:521-596` (cada passo — `ajustarPecaDoProjeto`, `ajustarQuantidadeLinha`,
  `incluirLinhaAta`, `conferirTodasLinhas` — abre a própria transação; a leitura das linhas em `:547` é fora de trava).
  A tela da conferência, ao receber erro, volta aos números antigos (`tenda-conferencia.tsx:213-218`), escondendo o
  que já foi gravado.
- **Cenário:** local "Crono" com 2 tendas de um projeto de tenda que a Cenografia inativou depois (caso real: projeto
  substituído na Biblioteca). A logística põe 3 fechamentos (o quadro precisa de uma linha nova).
- **Obtido:** a linha existente é reduzida para 1 tenda com 2 fechamentos (gravado) e a inclusão da segunda falha
  ("Projeto padrão não encontrado"): o local fica com **1 tenda** e a tela mostra erro com "2 tendas". O mesmo vale para
  qualquer erro no meio (linha mudada por outra pessoa entre passos, resposta que não pode ser corrigida etc.).
- **Esperado:** tudo ou nada.
- **Teste:** `tendas.auditoria.test.ts` › "P1-3 · o quadro do local é tudo ou nada…" (falha: `tendas: 1`).
- **Correção sugerida:** fazer `ajustarTendasDoLocal` abrir **uma** transação com `bloquearEvento` e chamar versões
  "na transação" dos passos (`ajustarQuantidadeLinhaTx`, `ajustarPecaDoProjetoTx`, `incluirLinhaAtaTx`), como
  `responderNaTransacao` já faz. Para a linha nova, usar a versão do projeto da linha existente (`snapshotBom(tx,
  projetoId, l0.projetoVersaoId)`, que aceita projeto inativo), não a versão atual. Resolve também P2-4 e P2-5.

### P2-4 · Um salvamento do quadro com a ata fechada gera várias versões da OS e vários avisos

- **Onde:** `conferencia.ts:331-332` (`ajustarQuantidadeLinha` gera versão), `conferencia.ts:450-462`
  (`ajustarPecaDoProjeto` gera versão e avisa), `eventos/ata.ts:246-257` (`incluirLinhaAta` gera versão e avisa);
  `ajustarTendasDoLocal` chama esses passos um a um. Na visão geral, "Editar todos os locais" ainda repete por local
  (`src/components/eventos/acoes-linha-evento.tsx:238-246`).
- **Cenário:** ata fechada, pedido de 2 tendas em "GV". Admin salva o quadro: 3 tendas, 5 fechamentos, 4 calhas.
- **Obtido:** **7 versões novas da OS** para uma decisão (v2…v8, cada uma com um estado intermediário que nunca existiu
  de verdade) e **7 notificações** para a área (fechamento, calha, "atendido parcialmente", 2 × "item novo", mais
  fechamentos…).
- **Esperado:** 1 versão da OS e 1 aviso por salvamento (por local; idealmente 1 por "Salvar N locais").
- **Testes:** `tendas.auditoria.test.ts` › P2-4 (falha: 8 versões em vez de 2) e `ata-pos.auditoria.test.ts` › P2-4b
  (falha: 7 avisos em vez de 1; a mensagem do teste lista os 7).
- **Correção sugerida:** com a transação única de P1-3, passar `{ gerarOs: false, notificar: false }` aos passos e, no
  fim, uma chamada a `gerarOsVersao(tx, …, "AJUSTE_LOGISTICA", …, "Tendas de GV: 2 → 3 tendas, 0 → 5 fechamentos, 2 → 4
  calhas — motivo")` e um `notificarAjusteLinha` com o resumo do local. Para o quadro com vários locais, aceitar a lista de
  locais numa ação só.

### P2-5 · "Incluir item" de tenda com fechamentos depois da ata: duas versões e sem atomicidade

- **Onde:** `src/app/(app)/eventos/actions.ts:126-131` — `incluirLinhaAta` (transação 1, versão da OS e aviso) e depois
  `ajustarTendasDoLocal` (outras transações, outras versões e avisos).
- **Cenário:** ata fechada; incluir 2 tendas em "Médica" com 4 fechamentos e justificativa.
- **Obtido:** +2 versões da OS (a primeira com a tenda **sem** fechamentos). Se o ajuste falhar, a ação devolve erro mas a
  linha já entrou: quem tenta de novo inclui a tenda duas vezes.
- **Esperado:** 1 versão, tudo numa transação.
- **Teste:** `tendas.auditoria.test.ts` › "P2-5 · incluir tenda depois da ata…" (falha: 3 versões em vez de 2).
- **Correção sugerida:** incluir já com o `bomSnapshot` ajustado (calcular `itensDoQuadro` antes e inserir as linhas com
  as peças certas) numa transação só; ou reaproveitar a transação única de P1-3.

### P2-6 · Projeto editado na Biblioteca muda a OS de evento com ata fechada sem avisar a área

- **Onde:** `src/server/services/projetos.ts:231-251` (aviso só para a logística) e
  `src/server/services/eventos/versoes.ts:97` (nova versão da OS em todo evento ABERTO que usa o projeto).
- **Cenário:** ata fechada com 2 stands pedidos pela Produção; a Cenografia (perfil sem `ata.ajustar`) troca a lista de
  peças do stand (4 → 1 peça por stand).
- **Obtido:** sai versão nova da OS no evento (−6 peças), sem justificativa no evento e **sem aviso à área** que pediu
  (só a logística é avisada). Todo outro ajuste depois da ata exige justificativa e avisa a área.
- **Esperado (a decidir):** a regra "projeto editado vale nos eventos" é intencional (comentário de 20/10). O que não
  bate com o resto do app é o aviso e a justificativa.
- **Teste:** `ata-pos.auditoria.test.ts` › P2-6 (falha: 0 avisos para a área).
- **Opções:** (a) manter a atualização automática, mas avisar as áreas com pedido no evento (`notificarAjusteLinha`) e
  levar a observação da versão como motivo — **recomendada**; (b) em evento com ata fechada, não atualizar sozinho: deixar
  "versão defasada" para a logística aplicar com justificativa (como já acontece com peças ajustadas uma a uma);
  (c) atualizar só eventos antes da ata.

### P3-7 · A solicitação mostra os fechamentos do pedido, não os da reunião

- **Onde:** `src/app/(app)/solicitacoes/[id]/page.tsx:62-87` (calcula fechamentos/calhas do `ajustesBom` do item);
  o quadro da conferência grava as peças na linha da ata (`ajustarPecaDoProjeto`), não no item.
- **Cenário:** pedido "2 tendas, sem fechamento"; reunião define 4 fechamentos.
- **Obtido:** a área vê "Por tenda: sem fechamento" e o item ATENDIDO; a OS tem 4 fechamentos.
- **Esperado (a decidir):** ou a tela mostra também "na OS: 4 fechamentos", ou a mudança de peças vira correção visível
  do item. Recomendo a primeira (a tela do pedido mostra o pedido e, ao lado, o que entrou na OS).
- **Teste:** sem teste.

### P3-8 · "Completar" acompanhante duplica com dois cliques

- **Onde:** `src/server/services/conferencia.ts:193-202` — a falta é calculada fora da transação; a inclusão é outra
  transação.
- **Cenário:** ata fechada, 3 cochos incluídos depois (a regra não acompanha mais), falta 6 cavaletes; duas pessoas (ou
  duplo clique) em "Completar".
- **Obtido:** 12 cavaletes na OS. **Esperado:** 6; o segundo deveria dizer "nada a completar".
- **Teste:** `ata-pos.auditoria.test.ts` › P3-8 (falha: 12).
- **Correção sugerida:** recalcular a falta dentro da transação, depois de `bloquearEvento` (incluir via função "na
  transação").

### P3-9 · Grades "a mais" do prisma aceitam ajuste depois da ata

- **Onde:** `src/server/services/conferencia.ts:363-386` (`definirExtraDaRegra` não confere a fase; sem linha "a mais",
  cai em `incluirLinhaAta` com a justificativa automática "Decidido na reunião (além das do prisma)").
- **Cenário:** ata fechada; chamar a ação com 3 grades a mais e motivo vazio.
- **Obtido:** aceita, inclui a linha e gera versão da OS com justificativa que ninguém escreveu. Uma segunda mudança é
  recusada ("A conferência acontece antes de fechar a ata"): comportamento incoerente.
- **Esperado:** recusar depois da ata (é ajuste de conferência) ou exigir justificativa de verdade.
- **Teste:** `ata-pos.auditoria.test.ts` › P3-9 (falha: 1 versão nova). A tela da conferência não oferece o ajuste
  depois da ata; só a chamada direta à ação chega lá.
- **Correção sugerida:** no início, recusar quando o evento não está em PREPARACAO/EM_REUNIAO.

### P3-10 · Papel ausente em `totais` vira 0

- **Onde:** `src/server/services/conferencia.ts:560` (`dados.totais[x.papel] ?? 0`); a ação aceita `totais` parcial
  (`src/app/(app)/eventos/actions.ts:312`).
- **Cenário:** local com 2 tendas 5×5 (2 calhas pelo padrão); chamar o ajuste com `{ fechamento: 2 }`.
- **Obtido:** 0 calhas. **Esperado:** campo ausente = padrão × tendas (como `totalDoLocal` no domínio). As telas de
  hoje sempre mandam os dois campos; o risco é para a próxima tela ou chamada.
- **Teste:** `tendas.auditoria.test.ts` › P3-10 (falha: `calhas: 0`).
- **Correção sugerida:** usar `totalDoLocal`/`itensDoQuadro` com `totais` como veio (sem preencher com 0), ou recusar
  `totais` incompleto na ação.

### P3-11 · Estoque da Ativação: atualização perdida com duas pessoas (hipótese)

- **Onde:** `src/server/services/ativacao.ts:102`, `:181`, `:217` (gravam `item.quantidade ± n` lido antes, sem `for
  update`) e `src/server/services/estoque.ts:108` (grava o número absoluto que veio da tela, sem quantidade esperada).
- **Cenário:** duas pessoas registram retorno/reforma do mesmo item ao mesmo tempo, ou clicam "+" na mesma linha.
- **Esperado:** as duas mudanças somam. **Provável:** a última grava por cima da primeira.
- **Teste:** sem teste — o PGlite tem uma conexão só e serializa as transações; precisa de `concorrencia-postgres.test.ts`
  com `TEST_DATABASE_URL`.
- **Correção sugerida:** `set({ quantidade: sql\`${estoqueItens.quantidade} - ${sai}\` })` (ou `select … for update`), e
  `quantidadeEsperada` no ajuste da tela, como já existe na ata.

### P3-12 · "Atualizar para vN" depois da ata sem justificativa nem aviso

- **Onde:** `src/server/services/eventos/ata.ts:277-312`.
- **Obtido:** com a ata fechada, muda as peças da linha e gera versão da OS sem pedir justificativa, sem avisar a área e
  sem conferir `ativo` da linha (uma linha removida também é atualizada).
- **Esperado:** mesmo padrão dos outros ajustes pós-ata (justificativa + aviso) e recusar linha inativa.
- **Teste:** sem teste.

### P3-13 · Duas regras para "é tenda"

- **Onde:** `src/app/(app)/solicitacoes/[id]/page.tsx:65` (nome começa com "Tenda") e
  `src/server/services/solicitacoes/consultas.ts:448` (`codigo.endsWith("-CALHA") || codigo.startsWith("TND5-")`); o
  resto do app usa `kitDaTenda` (`src/domain/tendas.ts:54`).
- **Risco:** projeto de tenda com outro nome ("Kit tenda 5×5", "Cobertura 5×5") aparece como projeto comum na
  solicitação, mas como tenda na conferência e no quadro.
- **Correção sugerida:** usar `kitDaTenda` sobre a lista de peças da versão também na tela da solicitação.

### Observação de documentação

`docs/01-analise-e-especificacao.md` (RN-09, linha 233) ainda diz que "fechamento de tenda nunca entra em BOM"; desde o
quadro de tendas, fechamento e calha entram como ajuste por tenda na lista de peças da linha. Atualizar a regra.

---

## O que foi verificado e está correto

- **Autosave duplo do quadro** (dois salvamentos do mesmo local quase juntos): resultado coerente, sem linhas
  duplicadas — `tendas.auditoria.test.ts` › "OK · dois salvamentos…" (passa no PGlite; em Postgres, ver P1-3).
- **Permissão no servidor de cada service** (varredura de todas as funções exportadas de `src/server/services/**`):
  toda escrita tem `exigir(...)`, `exigirAtivacao`/`exigirEstoque` (área Ativação ou admin) ou checagem de área
  (`podeEditarSolicitacao`, `carregarEditavel`, `exigirPontoDaArea`). Funções sem checagem são internas (chamadas só
  por outras já checadas) ou leituras chamadas por páginas que checam. `ajustarTendasDoLocal`,
  `ajustarPecaDoProjeto`, `incluirLinhaAta` e `ajustarQuantidadeLinha` exigem `ata.consolidar` e, com a ata fechada,
  `ata.ajustar`; `kitTendaDoProjetoAction` exige sessão e só lê (`projeto.ver` é de todos).
- **Todas as 91 server actions** chamam `requireUsuario`/`requirePermissao` (ou delegam a uma que chama), exceto as de
  login/recuperação, que são públicas por definição.
- **Rotas de API** (16): todas exigem sessão e a permissão certa (`os.exportar`, `arena.ver`, `carga.editar`,
  `historico.ver_tudo`…); `cron/verificacoes` usa segredo; `auth/portal` é a entrada do portal.
- **Máquina de estados do evento** (`domain/evento.ts`, `eventos/transicoes.ts`): perfis e estados batem com a matriz;
  fechar ata exige pré-reunião respondida, linhas conferidas e presentes; rascunho pré-reunião vira alteração no
  fechamento (não se perde); encerrar/cancelar fecham parciais como "não atendido" e cancelam órfãs.
- **Solicitação**: envio idempotente (`RASCUNHO/DEVOLVIDA → ENVIADA` com `where` de status), cancelar/devolver só antes
  de resposta, edição de pré-reunião bloqueada quando a logística já mexeu (inclui `PECA_PROJETO_AJUSTADA`), edição de
  alteração só dentro da janela; área B não altera linha da área A (`prepararItem`).
- **"Ver como"**: permissões e área seguem o perfil visto; o histórico registra o administrador
  (`permissoes-matriz.test.ts` já cobre; código de `session.ts:233-242` conferido).

## Inventário

- **Páginas:** 52 `page.tsx` (lista em `find src/app -name page.tsx`), incluindo 3 de autenticação, 3 de impressão,
  8 que só redirecionam (`/admin/areas`, `/admin/configuracoes`, `/admin/usuarios`, `/catalogo`, `/projetos`, `/estoque`,
  `/eventos/[id]/reuniao` → `/conferencia/[id]`, `/consolidacao/pendencias`) e a 404.
- **Rotas de API:** 16 (`src/app/api/**/route.ts`).
- **Server actions:** 16 arquivos `"use server"`, 91 funções: admin (5), arena (4 + 6), ativação (9), biblioteca (5),
  carga e descarga (5), catálogo (5), eventos (19), notificações (3), pendências (1), perfil (2), projetos (5),
  solicitações (9), ver como (2), autenticação (4).
- **Permissões:** 28 ações em `src/domain/permissions.ts` × 5 perfis.
- **Services auditados (leitura de código):** `conferencia.ts` (inteiro), `os.ts`, `eventos/ata.ts`, `eventos/transicoes.ts`,
  `eventos/reuniao.ts`, `eventos/regras-kit.ts`, `eventos/versoes.ts`, `solicitacoes/{resposta,envio,rascunho}.ts`,
  `fora-catalogo.ts`, `projetos.ts` (edição), `arena.ts`, `ativacao.ts`, `estoque.ts`, `carga-descarga.ts`; domínio
  `tendas.ts`, `os.ts`, `solicitacao.ts`, `evento.ts`, `regras-kit.ts`, `permissions.ts`, `estoque.ts`.
- **Telas de tenda auditadas (código):** `tenda-conferencia.tsx` (quadro da conferência), `acoes-linha-evento.tsx`
  (`EditarTendaDialog`, `QuadroTendasDialog`, `IncluirItemEvento`), `tendas-do-evento.tsx`, `tenda-do-local.ts`,
  `linha-ata-form.tsx` (campos `tenda_*`).

## Matriz tela × perfil (servidor de demonstração, só leitura)

Login real em cada perfil do seed (senha de demonstração) e pedido de cada URL (sem clicar em nada que grave),
2026-10-28, `http://localhost:3100`. Telas com id: as duas primeiras da lista de eventos (EVT aberto e
em preparação), um item da ata, 6 solicitações (inclui um rascunho), um projeto, uma arena e um item da Ativação.

Legenda: ✓ abre · ⛔ barrado (`/sem-permissao` ou 403) · → redireciona · 404/400 status.
O esperado foi calculado a partir de `src/domain/permissions.ts` e de `podeGerenciarEstoque`; células em
**negrito** divergem do esperado.

| Tela | admin | logistica | gestao | cenografia | producao | ativacao | grafica | atendimento |
|---|---|---|---|---|---|---|---|---|
| `/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/novo` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/calendario` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes/nova` | ✓ | ⛔ | ⛔ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/biblioteca` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/biblioteca?aba=pecas` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/catalogo` | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca |
| `/catalogo/nova` | ✓ | ✓ | ⛔ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/projetos` | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca | →/biblioteca |
| `/projetos/novo` | ✓ | ✓ | ⛔ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/arena` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/arena/nova` | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/carga-descarga` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/carga-descarga/cadastro` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/consolidacao` | **404** | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/consolidacao/pendencias` | **404** | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/pendencias` | **404** | **404** | **404** | 404 | 404 | 404 | 404 | 404 |
| `/ativacao` | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ |
| `/ativacao/retornos` | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ |
| `/ativacao/reformas` | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ |
| `/estoque` | →/ativacao | →/ativacao | →/ativacao | →/ativacao | →/ativacao | →/ativacao | →/ativacao | →/ativacao |
| `/historico` | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/notificacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/perfil` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/admin` | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/admin/usuarios` | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin |
| `/admin/areas` | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin |
| `/admin/configuracoes` | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin | →/admin |
| `/rota-que-nao-existe` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/eventos/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/ata` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/os` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/solicitacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/historico` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/editar` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/eventos/:id/carga` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/eventos/:id/reuniao` | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id |
| `/conferencia/:id` | →/eventos/:id/os | →/eventos/:id/os | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/impressao/os/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/impressao/ata/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/api/eventos/:id/ata/excel` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/api/os/:id/excel` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/api/os/:id/complemento` | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 |
| `/eventos/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/ata` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/os` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/solicitacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/historico` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/editar` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/eventos/:id/carga` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/eventos/:id/reuniao` | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id | →/conferencia/:id |
| `/conferencia/:id` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/impressao/os/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/impressao/ata/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/api/eventos/:id/ata/excel` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/api/os/:id/excel` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/api/os/:id/complemento` | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 |
| `/eventos/:id/itens/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ |
| `/solicitacoes/:id` | ✓ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ | ⛔ |
| `/solicitacoes/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ |
| `/solicitacoes/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ |
| `/solicitacoes/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ |
| `/solicitacoes/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ |
| `/projetos/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/projetos/:id/editar` | ✓ | ✓ | ⛔ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/arena/eco-run-sp-2026` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/impressao/arena/eco-run-sp-2026` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/ativacao/itens/:id` | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ |
| `/api/historico/csv` | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/api/carga-descarga/modelo` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |

**Divergências (5) — todas intencionais:** `/consolidacao`, `/consolidacao/pendencias` e `/pendencias` dão 404 para todos,
inclusive admin, logística e gestão, porque estão em `TELAS_INATIVAS` (`src/domain/telas.ts`). Não é bug de permissão;
fica o registro de que `resolverPendenciaAction` continua aceitando chamadas com a tela desligada (exige
`pendencias.resolver`).

Demais conferências: `/solicitacoes/nova` barra Logística e Gestão (`solicitacao.criar` é de requisitante, cenografia e
admin) ✓; o rascunho da Produção só abre para a Produção e o admin (logística, gestão e cenografia não veem rascunho) ✓;
requisitantes de outras áreas não abrem solicitação da Produção ✓; `/conferencia/:id` de evento com ata fechada leva à OS
✓; usuário inativo (tiago.moreira@) fica no login ✓. `/api/os/:id/complemento` responde 400 para todos porque nenhuma OS
desses eventos foi marcada como enviada (esperado). O "Ver como" do admin não entrou nesta varredura.

## O que NÃO foi verificado

- **Elemento por elemento em cada tela** (botões, filtros, modais, uploads, exportações, atalhos, estados vazio/erro/
  muitos registros) nos 9 perfis, em desktop e 375 px: **não feito nesta rodada**. A matriz acima cobre só "o perfil
  abre a tela / é barrado"; o que cada botão faz por perfil foi conferido no código do servidor (seção "verificado"),
  não clicando. Visual, texto e acessibilidade ficaram com os outros agentes.
- **"Ver como"** no navegador (só pelos testes de service existentes e leitura de `session.ts`).
- **Concorrência real em Postgres** (P3-11 e as corridas de P1-3): o PGlite serializa; nada rodou com
  `TEST_DATABASE_URL`.
- **Calendário, painel (contadores), consolidação, carga e descarga (importação), arena 3D, histórico geral e
  notificações**: só a checagem de permissão no servidor; as contas e filtros não foram auditados.
- **Exportações** (Excel da OS/ata, PDF/impressão, CSV do histórico): só permissão; o conteúdo não foi comparado com a OS.
- **Fuso de São Paulo em prazos** (SLA 48 h, janela de alterações, antecedência da reunião): leitura superficial;
  `hojeISO`/`diaBrasilia` usam `America/Sao_Paulo`, sem teste novo.
- **`/catalogo/:id/editar`** não entrou na matriz (o link da peça não foi achado pela varredura na aba Peças);
  permissão conferida só no código (`requirePermissao("catalogo.gerenciar")`).
- **Celular (375 px)**: a matriz foi feita por requisição, sem viewport; a lógica não muda por largura, mas nada foi
  clicado no celular.
- A matriz foi gerada por um script próprio (Playwright para o login + `request.get` por URL, um navegador por vez),
  fora do repositório; o resultado está reproduzido acima.
