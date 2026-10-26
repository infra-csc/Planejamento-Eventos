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
- [ ] 8. Painel — `/` (por perfil)

**Demais**

- [ ] 9. Novo evento — `/eventos/novo`
- [ ] 10. Impressão da ata — `/impressao/ata/[id]`
- [ ] 11. Projeto padrão — `/projetos/[id]`, `/projetos/[id]/editar`, `/projetos/novo` (e duplicar `?de=`)
- [ ] 12. Peça do catálogo — `/catalogo/nova`, `/catalogo/[id]/editar`
- [ ] 13. Calendário — `/calendario`
- [ ] 14. Carga e descarga — `/carga-descarga`, `/carga-descarga/cadastro`
- [ ] 15. Arena 3D — `/arena`, `/arena/nova`, `/arena/[slug]`, impressão `/impressao/arena/[slug]`
- [ ] 16. Consolidação — `/consolidacao` (`/consolidacao/pendencias` só redireciona)
- [ ] 17. Pendências — `/pendencias`
- [ ] 18. Estoque — `/estoque`
- [ ] 19. Histórico geral — `/historico`
- [ ] 20. Notificações — `/notificacoes`
- [ ] 21. Perfil — `/perfil`
- [ ] 22. Admin — `/admin` (abas usuários, áreas, configurações; `/admin/usuarios|areas|configuracoes` só redirecionam)
- [ ] 23. Sem permissão — `/sem-permissao`; 404 (`not-found.tsx`); erro (`error.tsx`)
- [ ] 24. Autenticação — `/login`, `/recuperar-senha`, `/redefinir-senha/[token]` (fora do escopo: a tela de login não é alterada)

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
