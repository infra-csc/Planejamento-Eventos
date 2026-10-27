# Design log

Registro das revisões de design/UX: telas revisadas, problemas por prioridade, o que mudou, como foi
validado e o que ficou pendente. Uma seção por data. Prioridade: **P1** atrapalha concluir a tarefa da
tela; **P2** custa esforço ou leitura; **P3** acabamento/consistência.

## Checklist da revisão tela a tela (26/10/2026)

Ordem: telas críticas primeiro, depois o resto. Status: `[ ]` a revisar · `[x]` revisada (com mudanças ou
"sem mudanças", ver a seção da tela abaixo).

**Críticas**

- [x] 1. Nova solicitação — `/solicitacoes/nova`
- [x] 2. Conferência da ata — `/conferencia/[id]` (e o redirecionamento `/eventos/[id]/reuniao`)
- [x] 3. OS do evento — `/eventos/[id]/os` + folha de separação `/impressao/os/[id]`
- [x] 4. Lista de eventos — `/eventos`
- [x] 5. Evento — `/eventos/[id]` (visão geral) e abas: ata `/eventos/[id]/ata`, solicitações `/eventos/[id]/solicitacoes`, histórico `/eventos/[id]/historico`, carga `/eventos/[id]/carga`, linha da ata `/eventos/[id]/itens/[linhaId]`, editar `/eventos/[id]/editar`
- [x] 6. Solicitações — `/solicitacoes` e `/solicitacoes/[id]`
- [x] 7. Biblioteca — `/biblioteca` (projetos e peças; `/catalogo` e `/projetos` só redirecionam)
- [x] 8. Painel — `/` (por perfil)

**Demais**

- [x] 9. Novo evento — `/eventos/novo`
- [x] 10. Impressão da ata — `/impressao/ata/[id]`
- [x] 11. Projeto padrão — `/projetos/[id]`, `/projetos/[id]/editar`, `/projetos/novo` (e duplicar `?de=`)
- [x] 12. Peça do catálogo — `/catalogo/nova`, `/catalogo/[id]/editar`
- [x] 13. Calendário — `/calendario`
- [x] 14. Carga e descarga — `/carga-descarga`, `/carga-descarga/cadastro`
- [x] 15. Arena 3D — `/arena`, `/arena/nova`, `/arena/[slug]`, impressão `/impressao/arena/[slug]`
- [x] 16. Consolidação — `/consolidacao` (`/consolidacao/pendencias` só redireciona)
- [x] 17. Pendências — `/pendencias`
- [x] 18. Estoque — `/estoque`
- [x] 19. Histórico geral — `/historico`
- [x] 20. Notificações — `/notificacoes`
- [x] 21. Perfil — `/perfil`
- [x] 22. Admin — `/admin` (abas usuários, áreas, configurações; `/admin/usuarios|areas|configuracoes` só redirecionam)
- [x] 23. Sem permissão — `/sem-permissao`; 404 (`not-found.tsx`); erro (`error.tsx`)
- [x] 24. Autenticação — `/login`, `/recuperar-senha`, `/redefinir-senha/[token]` (fora do escopo: a tela de login não é alterada)

## 26/10/2026 — revisão tela a tela

Ambiente da inspeção: app com o banco de demonstração do E2E (`.data/e2e`, `EXIBIR_DEMO=true`, porta 3100),
screenshots com Playwright/Chromium em 1280×800 (desktop), 375×812 (`devices["Pixel 5"]`) e, quando a
largura importava, 1680×900. Screenshots fora do repositório, em
`C:\Users\YAN~1.ARA\AppData\Local\Temp\claude\design-review\` (`antes-*` e `depois-*`, com perfil e tamanho
no nome). As primeiras fotos "antes" são do build de produção; as "depois", do `next dev` (o círculo "N"
no canto inferior esquerdo é o indicador do modo de desenvolvimento, não faz parte do app).

### 1. Nova solicitação — `/solicitacoes/nova`

Vista: requisitante Produção (área com lista padrão) e Gráfica (sem lista), sem evento e com evento
escolhido, com um item adicionado; desktop e celular.

- P2 — O vazio do passo "Detalhe cada item" mandava buscar "no passo 2", mas quando a área tem lista padrão
  a busca é o passo 3 (o 2 é a lista da área). Quem segue a instrução procura no lugar errado.
  **Resolvido:** o texto usa os números reais dos passos ("Ponha a quantidade na lista do passo 2 ou busque
  no passo 3…"; sem lista, "Busque no passo 2…").
- P3 — Na lista da área, o número das linhas automáticas (cavalete do cocho) ficava alinhado à direita,
  fora da coluna dos steppers. **Resolvido:** centralizado na largura do stepper (110 px; 130 px no celular).
- Sem mudança: hierarquia (passos numerados, resumo fixo com "Para enviar, falta"), barra fixa de envio no
  celular, aviso "Já pedido", toasts com "Descrever" — funcionam bem.

Arquivos: `src/components/solicitacoes/nova-solicitacao-form.tsx`, `src/components/solicitacoes/nova/lista-itens.tsx`,
`src/components/solicitacoes/nova/itens-da-area.tsx`.
Validação: tsc, eslint dos arquivos; screenshots `antes-producao-*-solicitacoes_nova*`, `antes-grafica-*`,
`depois-producao-*-solicitacoes_nova_evento_EVT_0002.png`.

### 2. Conferência da ata — `/conferencia/[id]`

Vista: logística (Marina), EVT-0002 em preparação; desktop 1280, 1680 e celular; modais Ajustar quantidade,
Incluir linha e Conferir as restantes. `/eventos/[id]/reuniao` só redireciona para cá.

- P1 — Em 1280 px (notebook comum na reunião), o painel "Dados da reunião" ao lado deixa a lista com ~600 px,
  mas a grade de colunas (item · local · qtd · ações) era escolhida pela largura da **tela** (`md:`). A
  coluna do item ficava com ~130 px: "Produção · Paulo Ribeiro · SOL-0023" e as descrições das unidades
  quebravam palavra por palavra, a página passava de 3.900 px de altura e "Ajustar/Peças" ficavam longe do
  item. **Resolvido:** a grade passa a ser escolhida pela largura da **própria lista** (consulta de
  contêiner `@3xl`, 768 px): em 1280 px a lista usa o cartão compacto (o mesmo do celular, com o local e as
  ações abaixo do item); em 1680 px volta a tabela com as colunas. A tela de 1280 caiu para ~1.560 px de
  altura, com a descrição legível em uma linha.
- P3 — Confirmação "Conferir as restantes" dizia "As 1 opcionais … ficam como estão". **Resolvido:**
  singular/plural.
- Sem mudança: barra fixa de progresso, "Próxima a conferir", atalhos ↑/↓, modais (foco no campo, motivo
  opcional, `motivoDesabilitado` em "Salvar ajuste"), banner escuro da reunião.
- Pendente (P3): no celular, o seletor "Projeto padrão / Peça do catálogo / Item avulso" do modal Incluir
  linha quebra em duas linhas; funciona, mas poderia caber numa só.

Arquivo: `src/components/eventos/conferencia-ata.tsx`.
Validação: tsc, eslint; screenshots `antes-logistica-*-conferencia_EVT_0002.png`,
`depois-logistica-{desktop,largo,celular}-conferencia_EVT_0002*.png` (inclui os três modais).

### 3. OS do evento — `/eventos/[id]/os` e folha de separação `/impressao/os/[id]`

Vista: logística, EVT-0001 (aberto, v9, 9 versões) e EVT-0002 (prévia, sem versão); folha de separação da
v9; desktop e celular.

- P1 — No celular, "Envio ao carregamento" (a ação principal, "Marcar v9 como enviada") e "Exportar"
  (Excel, OS de estrutura/marcenaria, Imprimir) ficavam depois da OS inteira — a página tem ~7.600 px; quem
  está no galpão precisava rolar tudo para enviar ou baixar. **Resolvido:** no celular a ordem é envio →
  exportar → folha de separação → o que mudou → OS → versões. No desktop nada muda de lugar (grade de duas
  linhas: a OS ocupa a coluna da esquerda; à direita, envio/exportar/separação em cima e versões embaixo).
  Na prévia (sem versão), o mesmo: aviso → exportar → prévia. O DOM segue a ordem do celular.
  Efeito colateral aceito: no desktop com versões, o bloco da direita deixou de ser fixo ao rolar (com as
  versões ele já passava da altura da tela, e o fim da lista de versões só aparecia no fim da página).
- P2 — "O que mudou na vN" no celular rolava de lado e cortava o nome da peça (6 colunas com largura mínima
  de 640 px). **Resolvido:** a tabela é `data-responsiva`; no celular, situação e código descem para baixo do
  nome; ficam peça, antes, depois e "Dif.".
- P2 — Folha de separação imprimia "1520" enquanto a tela da OS mostra "1.520". **Resolvido:** milhar com
  ponto nas quantidades (também nos itens fora do catálogo).
- P3 — Na tela da folha aberta no celular, a coluna Obs. (em branco, para escrever no papel) espremia o nome
  da peça. **Resolvido:** Obs. some só na tela do celular (continua na impressão). "Fora do catálogo" ganhou
  colunas mais equilibradas (item com mais espaço) e rola de lado no celular.
- Pendente (decisão): a folha mostra peça e quantidade, sem o código da peça (BOX-2000…). Foi decisão
  registrada no código ("só o total, peça e quantidade"); se a separação no galpão procura pelo código,
  vale incluir.

Arquivos: `src/app/(app)/eventos/[id]/os/page.tsx`, `src/components/eventos/diff-os.tsx`,
`src/app/impressao/os/[id]/page.tsx`.
Validação: tsc, eslint; medição no navegador (tabela da diferença com 341 px no celular, sem rolagem lateral);
screenshots `antes-logistica-*-eventos_evento_os.png`, `antes-logistica-*-impressao_os_evento.png`,
`depois-logistica-{desktop,celular}-eventos_evento_os.png`, `depois-logistica-*-eventos_EVT_0002_os.png`,
`depois-logistica-*-impressao_os_evento.png`.

### 4. Lista de eventos — `/eventos`

Vista: requisitante Produção e logística; desktop e celular; abas de fase, filtros, paginação.

- P2 — No celular, busca + três listas (reunião, data, responsável) vinham empilhadas, uma por linha: quatro
  campos de 40 px antes do primeiro evento. **Resolvido:** grade de duas colunas no celular — busca na linha
  toda, "Reunião" e "Data" lado a lado, "Responsável" e os avisos na linha toda. No desktop a barra continua
  numa linha.
- Sem mudança: tabela com `LinhaLink`, fase com barra de progresso, "áreas que pediram", contagem por aba,
  ordenação e vazios por caso (busca, filtro, sem eventos) — consistentes com o padrão de lista.
- Pendente (P3): a coluna "Pendências" mostra "em dia" em quase todas as linhas; é informação, mas ocupa
  espaço. Fica como está até a equipe dizer se prefere vazio quando não há pendência.

Arquivo: `src/app/(app)/eventos/page.tsx`.
Validação: tsc, eslint; screenshots `antes-producao-*-eventos.png`, `depois-logistica-{desktop,celular}-eventos.png`.

### 5. Evento — `/eventos/[id]` e abas (ata, solicitações, histórico, carga, linha da ata, editar)

Vista: logística em EVT-0001 (aberto, ata fechada) e EVT-0002 (preparação); requisitante Produção em
EVT-0002; abas Visão geral, Ata, Solicitações, OS (item 3), Carga (vazio), Histórico, Editar e a página da
linha da ata (`/eventos/[id]/itens/[linhaId]`); desktop e celular. `/eventos/[id]/reuniao` redireciona para a
conferência (item 2).

- P2 — `Aviso` (componente compartilhado) com ação: no celular a ação ficava à direita e espremia o texto
  numa coluna estreita ("5 itens mudaram depois da reunião" em 5 linhas, "Precisa mudar algo…" em 7).
  **Resolvido no componente:** abaixo de `sm` as ações descem para baixo do texto, alinhadas a ele. Vale
  para todos os avisos com ação (ata, OS, linha da ata, solicitação, banner da reunião, lista da área…).
- P2 — "O que mudou depois da reunião" (visão geral): no celular o link "Ver a diferença na OS" ficava ao
  lado do título e o espremia em 3 linhas. **Resolvido:** em cartão estreito o link desce para baixo do resumo.
- P3 — Aba Solicitações no celular: respondidas mostravam um "—" solto ao lado do selo de status.
  **Resolvido:** o traço só aparece no desktop (coluna Prazo); no cartão do celular some quando não há prazo.
- P3 — Cartões de resumo: "1984 peças" e "20 un." sem separador de milhar. **Resolvido:** pt-BR (1.984).
- Sem mudança: cabeçalho com fases, abas com contagem, aba Ata (somente leitura, exportações agrupadas),
  linha da ata (quem pediu, peças, linha do tempo), editar (barra fixa de salvar, zona de exceção),
  carga vazia (vazio com ação), histórico.
- Pendente (P3): "Encerrar evento" bloqueado explica o motivo só no `title` (passar o mouse); no celular
  não há como ver o porquê (a fase mostra "1 alteração em aberto", que é a pista). Melhorar
  `motivoDesabilitado` para toque é mudança do componente `Button` em todo o app — fica para uma rodada
  própria.
- Pendente (P3): histórico do evento repete "Conferida na reunião (em lote)" uma vez por linha; agrupar
  registros iguais em sequência deixaria a leitura mais curta.

Arquivos: `src/components/ui/layout.tsx` (Aviso), `src/components/eventos/mudancas-pos-ata.tsx`,
`src/app/(app)/eventos/[id]/page.tsx`, `src/app/(app)/eventos/[id]/solicitacoes/page.tsx`.
Validação: tsc, eslint; screenshots `antes-logistica-*-eventos_evento*.png`,
`antes-logistica-*-eventos_EVT_0002_itens_*.png`, `depois-logistica-*-eventos_evento{,_ata,_solicitacoes}.png`,
`depois-logistica-celular-eventos_evento-recorte.png`, `depois-producao-*-eventos_EVT_0002.png`.

### 6. Solicitações — `/solicitacoes` e `/solicitacoes/[id]`

Vista: requisitante Produção e logística; lista (abas, filtros, celular em cartões) e detalhe com resposta
pendente (SOL-0005: fora da janela, item fora do catálogo; painéis "Parcial" e "Não atender") e na ata;
requisitante abrindo solicitação de outra área (vai para "sem permissão", como esperado); desktop e celular.

- P1 (bug) — O filtro **Área** da logística não filtrava nada: o valor da URL era validado com `/^[w-]{1,64}$/`
  (só aceita "w" e "-"), então o id da área (UUID) era descartado e a lista seguia com todas as áreas.
  **Resolvido:** `/^[\w-]{1,64}$/`, como o filtro de evento logo acima. Conferido no navegador: 18 → 6
  linhas, todas da Ativação. É correção de validação de parâmetro na página (não muda regra, permissão nem
  serviço) — registrado também nos riscos.
- P2 — No celular, busca + evento + área + tipo + reunião eram cinco campos empilhados. **Resolvido:** busca,
  evento e área na linha toda; tipo e reunião lado a lado (mesmo padrão da lista de eventos; `FiltroEvento`
  ganhou `className`). Padrão registrado em `docs/design-system.md` § 5.1.
- P3 — Requisitante só vê a própria área, mas a tabela tinha a coluna "Área" repetindo o mesmo nome em todas
  as linhas. **Resolvido:** a coluna (e o nome da área na linha, em telas médias) só aparece para quem vê
  todas as áreas.
- P3 — "em reunião" / "reunião hoje" em vinho na coluna Prazo (e "reunião hoje/amanhã/em reunião agora" na
  lista de eventos): é estado, não ação. **Resolvido:** azul de informação (`text-info`), nas duas listas.
- Sem mudança: detalhe da solicitação (cabeçalho com prazo, aviso de fora da janela, item fora do catálogo
  com "Vincular", resposta Atender/Parcial/Não atender com atalhos A/P/N, painel de motivo, histórico,
  dados e evento) — claro e consistente; no celular os painéis de resposta cabem sem rolagem lateral.

Arquivos: `src/app/(app)/solicitacoes/page.tsx`, `src/app/(app)/eventos/page.tsx`,
`src/components/ui/filtro-evento.tsx`, `docs/design-system.md`.
Validação: tsc, eslint; filtro de área conferido com script no navegador; screenshots
`antes-*-solicitacoes*.png`, `depois-{producao,logistica}-*-solicitacoes.png`,
`depois-logistica-desktop-solicitacoes-filtro-area.png`, `depois-logistica-*-solicitacoes_62ab3eaa*` (com
os painéis Parcial e Não atender).

### Checagem E2E depois dos itens 1–6

`npx next build` + `E2E_SEM_BUILD=1 npx playwright test e2e/acessibilidade.spec.ts e2e/varredura.spec.ts`:
27 de 28 passaram; 1 falhou por tempo (varredura · ativação, desktop: `page.evaluate` ficou parado 15 min
em `/perfil`, tela que não foi alterada; no celular o mesmo perfil passou). Rodado de novo sozinho, passou
em 31 s — tratado como instabilidade do ambiente, não do app.

### 7. Biblioteca — `/biblioteca` (projetos, catálogo de peças, fora do catálogo)

Vista: logística (projetos, peças, "Fora do catálogo") e cenografia (com seleção em lote, filtro de situação e
"Grupos"); diálogo "Grupos de prova"; um item marcado; desktop e celular. `/catalogo` e `/projetos` só
redirecionam para cá.

- P2 — Para a cenografia, a barra de seleção em lote ("Selecione itens ativos nesta página · Limpar seleção ·
  Organizar selecionados · Desabilitar selecionados", tudo desabilitado sem seleção) ficava sempre acima da
  lista: duas linhas no desktop e ~150 px no celular, antes do primeiro projeto. **Resolvido:** sem nada
  marcado, só uma dica de uma linha; ao marcar, aparece a barra com a contagem, "Limpar seleção" e as ações
  (fundo de seleção).
- P3 — "Fora do catálogo": a situação "já na OS" usava o selo vinho (`accent`), que é cor de ação. **Resolvido:**
  `warning` — o item está na OS sem somar peças (separação manual), é um ponto de atenção.
- Sem mudança: tabela de projetos com prévia ao lado (no celular a prévia vem depois da lista e o toque na
  linha rola até ela), catálogo de peças com setores em pílulas, diálogo de grupos.
- Pendente (P3): no celular os filtros da aba Projetos continuam empilhados (até 6 controles). Os seletores
  de grupo, alteração e situação têm largura mínima de 170–190 px, que não cabe em meia linha de 375 px;
  pareá-los exige mexer nesses componentes — fica para a próxima rodada.

Arquivos: `src/components/biblioteca/selecao-em-lote.tsx`, `src/components/eventos/fila-fora-catalogo.tsx`.
Validação: tsc, eslint; screenshots `antes-logistica-*-biblioteca*.png`, `antes-cenografia-*-biblioteca*.png`,
`depois-cenografia-*-biblioteca{,-selecionado}.png`.

### 8. Painel — `/` (por perfil)

Vista: requisitante Produção, logística, gestão, cenografia e admin; desktop e celular.

- P3 — Logística/admin, "Fila de resposta" no celular: os botões "Atender" e "Parcial / não atender" da faixa
  de resposta rápida ficavam lado a lado e passavam da borda da faixa. **Resolvido:** no celular os botões
  quebram linha dentro da faixa; no desktop continuam na mesma linha.
- Sem mudança: "Precisa de você agora" por perfil (cartões com contagem e ação), fila com prazo, métricas,
  agenda de 14 dias, "O que mudou" e "Como funciona" do requisitante, saúde do sistema e atalhos do admin.
- Pendente (P3): requisitante no celular — "Seus eventos" lista todos os eventos da área em cartões (6 no
  demo, ~1.700 px) antes das solicitações e respostas; limitar a 3–4 com "Todos os eventos" encurtaria a
  página, mas muda o que aparece: fica para decisão da equipe.
- Pendente (P3): em "Suas solicitações em andamento" a situação sai como texto ("rascunho") e em "Respostas
  recebidas" como selo; uniformizar com `SolicitacaoStatusBadge`.

Arquivo: `src/components/painel/atender-rapido.tsx`.
Validação: eslint; screenshots `antes-{producao,logistica,gestao,cenografia,admin}-*-raiz.png`,
`depois-logistica-celular-raiz{,-recorte}.png`.

### 9. Novo evento — `/eventos/novo`

Vista: logística; desktop e celular. **Revisada, sem mudanças:** formulário curto em dois cartões (Evento,
Datas), rótulos e dicas claros, "(opcional)" marcado, foco no nome, barra de salvar fixa no celular. Serve de
referência para os outros formulários (itens 11 e 12).

### 10. Impressão da ata — `/impressao/ata/[id]`

Vista: logística, EVT-0001 (ata fechada); desktop e celular. **Revisada, sem mudanças:** é um documento para
papel/PDF (cabeçalho da reunião, linhas conferidas, observações, pedidos por área, assinaturas) e lê bem em A4.
- Pendente (P3): na tela do celular a tabela "O que vai para o evento" rola de lado e a coluna Código (com
  códigos longos como `MRC-TESTEIRADEMADEIRADE3M`) toma metade da largura; como o uso real é imprimir, ficou
  como está.

### 11. Projeto padrão — `/projetos/[id]`, `/projetos/[id]/editar`, `/projetos/novo` (e duplicar `?de=`)

Vista: cenografia; projeto PRJ-0042 (sem anexos), edição (8 peças), novo; desktop e celular.

- P2 — Editar projeto no celular tem ~2.400 px (identificação + lista de peças) e "Salvar"/"Cancelar" só
  apareciam no fim; o formulário do evento já tinha a barra fixa. **Resolvido:** na página (não no modal de
  edição rápida, que tem o próprio rodapé) a barra de salvar fica fixa no rodapé do celular, com "Salvar" largo
  e "Cancelar" discreto — o mesmo desenho do formulário do evento. Desktop igual.
- Sem mudança: página do projeto (lista de peças agrupada por setor, versões, dados, histórico, anexos),
  ações do cabeçalho.

### 12. Peça do catálogo — `/catalogo/nova`, `/catalogo/[id]/editar`

Vista: cenografia; nova peça e edição de uma peça usada em 22 projetos; desktop e celular.

- P2 — Mesmo caso do item 11 (~1.800–2.300 px no celular, salvar só no fim). **Resolvido:** barra de salvar fixa
  no rodapé do celular; "Cancelar" passa a `ghost`, como no evento.
- Sem mudança: origem em cartões de escolha, classificação, "Usada em N projetos" com a lista.
- Observação: no `next dev`, abrir a edição da peça registra no console um aviso do React sobre
  `performance.measure` com tempo negativo — é do modo de desenvolvimento (não aparece no build).

Arquivos (11 e 12): `src/components/projetos/projeto-form.tsx`, `src/components/catalogo/peca-form.tsx`.
Validação: tsc, eslint; screenshots `antes-logistica-*-eventos_novo.png`, `antes-logistica-*-impressao_ata_*`,
`antes-cenografia-*-projetos_a9639484*`, `antes-cenografia-*-catalogo_*`,
`depois-cenografia-celular-{projetos_a9639484…_editar,catalogo_nova}-viewport.png` (barra fixa à vista no meio
da rolagem).

### 13. Calendário — `/calendario`

Vista: logística; desktop (grade do mês + próximos 21 dias) e celular (lista por dia, dias passados recolhidos).
**Revisada, sem mudanças:** legenda, filtros por tipo com contagem, "Hoje", lista do celular começando em hoje.
- Pendente (P3): o rótulo "hoje"/mês na linha do tempo semanal de `carga-descarga` usa `text-[9px]` (abaixo do
  mínimo de 11,5 px do design system); é um rótulo de gráfico minúsculo — trocar exige refazer a escala do gráfico.

### 14. Carga e descarga — `/carga-descarga`, `/carga-descarga/cadastro` (e a aba Carga do evento)

Vista: logística; calendário da semana, volume por semana, cadastro com lista de eventos e vazio "Escolha um
evento"; desktop e celular. **Revisada, sem mudanças:** densa mas organizada (filtros, semana com cargas e
descargas por dia, alerta de eventos sem veículo).

### 15. Arena 3D — `/arena`, `/arena/nova`, `/arena/[slug]`, `/impressao/arena/[slug]`

Vista: logística (lista, mapa da Eco Run em planta, impressão); `/arena/nova` para logística leva a "sem
permissão" (esperado: só quem edita a arena); desktop e celular.

- P2 — Mapa no celular: a fileira "Perspectiva · De cima · Planta" + Camadas + Tela cheia não cabia em 375 px e o
  botão de tela cheia ficava cortado na borda do mapa. **Resolvido:** no celular as três vistas dividem a
  largura que sobra (encolhem o recuo, sem cortar o texto) e os dois botões cabem inteiros.
- P2 — Impressão da arena aberta no celular: a lista "Pontos do mapa" alargava a página (564 px numa tela de 375,
  a página inteira rolava de lado). **Resolvido:** a lista rola de lado dentro do próprio bloco na tela; no
  papel nada muda.
- P3 — Cabeçalho da arena: data, largadas e público em Roboto Mono (o design system reserva mono para códigos).
  **Resolvido:** números tabulares na fonte normal; o SKU continua em mono.
- Pendente (P3): a impressão da arena usa tamanhos próprios de papel (`text-[10px]`, `text-[11px]`) fora dos
  tokens; é uma folha A4 densa e foi mantida.

Arquivos: `src/components/arena/arena-barra-ferramentas.tsx`, `src/components/arena/impressao-arena.tsx`,
`src/components/arena/arena-cabecalho.tsx`.

### 16. Consolidação — `/consolidacao` (e `/consolidacao/pendencias`)
### 17. Pendências — `/pendencias`

Vista: logística, desktop e celular. **Revisadas, sem mudanças:** as duas telas estão desligadas a pedido da
operação (`src/domain/telas.ts`): saem do menu e respondem "Não encontrado" dentro do shell. Nada a revisar
enquanto estiverem inativas.

### 18. Estoque — `/estoque`

Vista: requisitante Ativação (244 itens); desktop e celular; diálogo "Novo item".

- P1 — No celular a página inteira ficava mais larga que a tela (559 px em 375): o rótulo oculto "Editar" do
  cabeçalho (absoluto, sem célula `relative`) escapava da rolagem da tabela. Além disso a tabela tinha 640 px
  mínimos e o stepper de quantidade — a ação desta tela — só aparecia rolando a tabela de lado. **Resolvido:**
  cabeçalho com `relative`; tabela `data-responsiva` com item, quantidade (stepper) e editar (só o lápis no
  celular, nome mantido para leitor de tela) cabendo em 341 px. Medido no navegador: tabela 341 px, página 375 px.
- Observação: a varredura E2E usa emulação de celular com página "ampliável", que esconde esse transbordo
  (o layout cresce para 559 px e a checagem compara com ele); vale endurecer a varredura (pendente abaixo).

Arquivo: `src/components/estoque/estoque-tela.tsx`.

### 19. Histórico geral — `/historico`

Vista: logística (642 registros, filtros por período, evento e pessoa); desktop e celular.

- P2 — Na largura de desktop a coluna "Evento" usava `truncate` (sem quebra) e crescia até caber o nome inteiro
  do evento ("EVT-0016 DESAFIO ENERGIA PETROBRÁS - TRAVESSIA - RIO DE JANEIRO"), espremendo "O que aconteceu" numa
  coluna de ~160 px (descrições em 4–5 linhas). **Resolvido:** o evento quebra em até 2 linhas (nome inteiro no
  `title`); a coluna fica com a largura prevista e a descrição volta a 1–2 linhas. Mesma correção na linha de
  sequências agrupadas.

Arquivo: `src/app/(app)/historico/page.tsx`.

### 20. Notificações — `/notificacoes`
### 21. Perfil — `/perfil`

Vista: logística; desktop e celular. **Revisadas, sem mudanças:** notificações com não lidas marcadas (fundo e
filete), grupos por período, "Marcar todas como lidas"; perfil com dados, sessões e senha do app recolhida.

### 22. Admin — `/admin` (usuários, áreas, configurações)

Vista: admin; abas Usuários (tabela/celular em cartões, diálogo "Novo usuário"), Áreas (diálogo "Nova área"),
Configurações; desktop e celular. `/admin/usuarios|areas|configuracoes` só redirecionam.

- P3 — "Salvar configurações" desabilitado sem dizer por quê. **Resolvido:** `motivoDesabilitado` ("Nada mudou:
  altere um valor para salvar") — o motivo aparece no `title` e é lido pelo leitor de tela.

Arquivo: `src/components/admin/config-painel.tsx`.

### 23. Sem permissão, 404 e erro

Vista: `/sem-permissao` e uma rota inexistente (logística), desktop e celular. **Revisadas, sem mudanças:**
ícone, uma frase, "Ir para o painel" e "Voltar". A tela de erro (`error.tsx`) foi revisada só pelo código
(não há como provocar um erro de servidor sem mexer no app): mensagem, "Tentar de novo" e código do erro.

### 24. Autenticação — `/login`, `/recuperar-senha`, `/redefinir-senha/[token]`

Fora do escopo por regra (a tela de login não é alterada). A tela de login foi usada pelos scripts para entrar,
mas não foi revisada.

### Varredura E2E mais rigorosa no celular

A checagem "página mais larga que a tela" comparava `scrollWidth` com `window.innerWidth`; com a emulação de
celular do Playwright (`isMobile`), uma página que transborda amplia o layout e `innerWidth` cresce junto, então
o estoque (559 px numa tela de 375) passava. A varredura agora compara com a largura do aparelho do projeto
(375). Conferido à parte com um script sem emulação, em 375 e 768 px, perfis admin, Ativação, cenografia e
Produção, em 33 telas: nenhuma página mais larga que a tela depois das correções.

Arquivo: `e2e/varredura.spec.ts`.

### Validação final (26/10/2026)

| Suíte | Resultado |
| --- | --- |
| `npx tsc --noEmit -p .` | ok |
| `npx eslint .` | ok (0 problemas) |
| `npx vitest run` | 709 passaram, 3 pulados (concorrência sem Postgres), 0 falhas |
| `npx next build` + `E2E_SEM_BUILD=1 npx playwright test` (suíte inteira, banco novo) | 38 de 38 passaram (8,3 min), já com a varredura mais rigorosa no celular |

### Pendências desta rodada (resumo)

- P3 — `Button` com `motivoDesabilitado`: no celular o motivo só existe no `title`/leitor de tela; quem toca não
  vê por que "Encerrar evento" está desabilitado. Mudança do componente em todo o app.
- P3 — Biblioteca no celular: filtros da aba Projetos ainda empilhados (seletores com largura mínima).
- P3 — Painel do requisitante no celular: "Seus eventos" mostra todos os eventos da área antes das
  solicitações (decisão de produto: limitar a 3–4?).
- P3 — Painel: situação como texto em "Suas solicitações em andamento" e como selo em "Respostas recebidas".
- P3 — Conferência: seletor de tipo do modal "Incluir linha" quebra em duas linhas no celular.
- P3 — Histórico do evento: registros iguais seguidos ("Conferida na reunião (em lote)") não são agrupados como
  no histórico geral.
- P3 — Impressões (ata, arena) e o gráfico semanal de carga usam tamanhos próprios (`text-[9px]`…`text-[11px]`).
- Decisão — Folha de separação sem o código da peça (decisão anterior registrada no código); incluir se a
  separação no galpão procura pelo código.
- Decisão — Coluna "Pendências" da lista de eventos mostra "em dia" na maioria das linhas.

## 27/10/2026 — Conferência da ata, revisão para o desktop

Escopo pedido: só desktop (1280 e acima; 768 só para não quebrar). Celular não foi revisado nesta rodada.
Vista: logística (Marina) e admin, servidor de dev local (dados de demonstração); EVT-0002 (preparação, com
tenda 3×3, testeira a definir, avulso) e EVT-0009 (montado para o teste pelo "Incluir linha": cocho + cavalete
de ferro, prisma + grades 2×1, mesa de medalha + cavalete reto, tenda 5×5 em dois locais, testeira a definir),
em preparação, em reunião, tudo conferido e sem presentes; EVT-0202 (ata vazia). 1280, 1680 e 768 px.
Modais abertos de verdade: Ajustar, Grades do prisma, Conferir as restantes, Incluir linha, Vincular; teclado
(↑/↓ entre os checks, Esc) e axe em cada um.

- P1 — Foco: ao fechar qualquer modal aberto por estado (Ajustar, Grades do prisma, Conferir as restantes,
  Incluir linha) o foco ia para o `<body>`; quem confere pelo teclado voltava ao topo da página a cada ajuste.
  **Resolvido no `DialogContent`** (vale para o app todo): guarda quem abriu e devolve o foco a ele (também quando
  o modal põe o foco num campo com `autoFocus`). Conferido: o foco volta para "Ajustar a quantidade de …",
  "Conferir as 9 restantes", "Incluir linha", "Vincular".
- P2 — Em 1280 px (lista com ~630 px ao lado do painel), cada linha tinha uma faixa só para "Ajustar/Peças"
  abaixo do item. **Resolvido:** com a lista entre 576 e 768 px (`@xl`), as ações ficam logo abaixo da
  quantidade, à direita, na altura do próprio item — "Ajustar" colado ao número que ele muda. ~25 px a menos por
  linha (a ata do EVT-0002 caiu de ~1.800 para ~1.600 px).
- P2 — "Ajustar" mudava de lugar entre linhas (com e sem "Peças"). **Resolvido:** "Ajustar" vem por último e as
  ações alinham à direita: fica sempre na mesma coluna (1280 e 1680). No celular a ordem passa a ser
  Peças · Ajustar (consequência; o leiaute do celular não mudou).
- P2 — Quadro da tenda a 1280: a coluna do local tinha ~110 px e "Incluída pela logísti…" era cortado sem dica.
  **Resolvido:** colunas dos números na largura do stepper (110 px) e espaço menor; origem e nome do local quebram
  em vez de cortar. Check do local com 40 px como os das outras linhas.
- P2 — Quadro da tenda: a linha do local era recriada a cada gravação automática — o foco de quem usava − e +
  pelo teclado se perdia e o "Salvo" sumia na hora. **Resolvido:** os números do servidor entram sem remontar a
  linha (enquanto a pessoa mexe, vale o que ela está mudando).
- P2 — Ata vazia mostrava "0 de 0 conferidas · faltam 0", filtros com 0/0/0 e rodapé "0 linhas"; o banner dizia
  "As necessidades das áreas já estão na ata". **Resolvido:** só o estado vazio (com "Incluir linha"); banner
  "A ata ainda está vazia: os pedidos das áreas entram aqui sozinhos…".
- P3 — "a definir · opcional" ao lado do nome repetia o "a definir" da coluna da quantidade e jogava o nome para
  duas linhas. Agora só "opcional" (a dica explica).
- P3 — Tenda com um local só mostrava "Conferir todos" além do check (mesma ação duas vezes). Some com um local;
  com vários, "Conferir os 2 locais" / "Conferir o local restante". Bloco por item: "Conferir as 3" /
  "Conferir a restante" (antes "Conferir as 1"), com nome acessível que diz de qual item.
- P3 — "Vem junto de …" usava borda e seta vinho (estado não usa a marca). Agora neutro; a conta continua
  amarela quando a ata não bate com a regra. O texto quebra no meio da frase, não numa linha começando por "·".
- P3 — Modal das grades do prisma: total em vinho → tinta normal; botão "Salvar" → "Salvar ajuste".
- P3 — Nomes acessíveis repetidos ("Peças", "Editar descrição", "Incluir 12") passam a dizer de qual linha/peça.
- P3 — Busca: placeholder cortado a 1680 ("Buscar item, local, pesso"); agora "Item, local, pessoa ou SOL-…"
  (o campo continua "Buscar na ata").
- Sem mudança: barra fixa de progresso, "Próxima a conferir", ↑/↓, confirmação de "Conferir as restantes",
  fluxo "Falta registrar os presentes →" (leva ao campo e foca), banner com o motivo do bloqueio, toasts.

Arquivos: `src/components/eventos/conferencia-ata.tsx`, `src/components/eventos/tenda-conferencia.tsx`,
`src/components/eventos/banner-reuniao.tsx`, `src/app/(app)/conferencia/[id]/page.tsx`, `src/components/ui/dialog.tsx`.

Validação: `npx tsc --noEmit -p .` ok; eslint dos 5 arquivos ok; `npx vitest run` 716 passaram, 3 pulados (numa
primeira rodada, 1 falha no teste de carga, que passou ao repetir — fora desta tela); `npx playwright test
e2e/conferencia.spec.ts e2e/acessibilidade.spec.ts` (desktop e celular, banco novo, num worktree só com estas
mudanças) 18 de 18 passaram, sem nenhuma violação do axe. axe também rodado à mão na página e em cada modal
(Ajustar, Grades do prisma, Conferir as restantes, Incluir linha, Vincular), estado conferido e "tudo conferido".
Screenshots antes/depois em 1280, 1680 e 768 (logística e admin).

Pendente / para decidir:
- Comportamento (repassado ao agente da parte funcional): o aviso "nenhum na ata" do pé de grade mostra o
  código (PE-GRADE-2X1) quando a peça não existe no catálogo, e o "Incluir 12" então falha; "Em reunião" usa o
  selo amarelo (o design system pede `info` para "em andamento" — selo compartilhado).
- Não visto no navegador: "linha junta" (várias linhas do mesmo pedido e local), modal de descrição do admin
  (só o botão), erro de gravação (sem rede).
