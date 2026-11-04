# Componentes e áreas sensíveis do NorteLog (auditoria do redesign, etapa 2)

Inventário para o redesign só de UX/UI. Feito por leitura do código e varreduras com script (grep sobre os arquivos), sem servidor, sem navegador e sem rodar teste. Não propõe redesign.

**Estado inventariado:** working tree da branch `redesign/nortelog` em 04/11/2026, sobre o commit `1ee5c6f`, **com o tema novo sem commit** (31 arquivos modificados; novos: `public/nortelog-simbolo-branco.svg`, `src/app/fonts/`). Tokens `marca`/`on-marca`, `primary` com `bg-marca`, `danger` vermelho e menu escuro já valem aqui. Só `globals.css`, `app/layout.tsx` e `shell/app-shell.tsx` mudaram de numeração em relação ao commit; se o tema for alterado de novo, as linhas desses três precisam ser conferidas.

**Convenções:** caminhos a partir de `src/` (`e2e/`, `public/` e `docs/` são da raiz). "Usos" = ocorrências em JSX fora do arquivo que define o componente, sem contar comentários; "n/m" = n usos em m arquivos. "Foco global" = só a regra de `app/globals.css:277` (anel de 2 px em `a, button, input, select, textarea, summary, [tabindex]`, abas, opções e itens de menu), sem classe própria.

## Totais

| Item | Total |
|---|---|
| `components/ui` | 32 arquivos (28 `.tsx` + 4 `.ts`; o pedido cita os 28 `.tsx`) |
| `components/shell` | 6 arquivos |
| Exports de `ui/` sem nenhum uso | 5: `AcaoNoCabecalho`, `Panel`, `Notice`, `TipoSolicitacaoTag`, `COR_ITEM` |
| Janelas com Radix Dialog | 60: 37 `DialogContent` + 21 `ConfirmDialog` + busca global + lightbox |
| Larguras distintas de modal | 12 (460, 480, 500, 520, 540, 560, 640, 720, 760, 880, 980, 1120) |
| Elementos à mão fora de `ui/` e `shell/` | 48 `<button>` (27 arquivos), 13 `<input>` visíveis (+27 `hidden` no projeto todo), 18 `<label>`, 46 `<table>` (33 arquivos), 120 `<th>` |
| `loading.tsx` / `error.tsx` + `global-error` / `not-found` | 11 / 3 / 2 |
| Rotas `page.tsx` | 53, sendo 8 só de redirecionamento |
| Hex em `.ts`/`.tsx` (sem comentário) | 104 linhas: 99 da Arena, 4 de app, 1 de teste |
| `marca` / `accent` | 36 linhas em 24 arquivos / 137 em 69 |
| `danger` / `warning` | 127 linhas em 68 arquivos / 151 em 65 |
| Lógica intocável | `domain` 56 arq.; `server` 127 arq.; 15 arquivos de actions; 18 `route.ts`; `proxy.ts` |
| Testes que renderizam componente | 0 (Vitest só cobre `src/**/*.test.ts` de lógica; a interface só tem E2E) |

---

# Parte 1. Componentes

## 1.1 `components/ui`

| Arquivo | Export: usos | Variantes e estados que tem | O que falta |
|---|---|---|---|
| `button-classes.ts` | `buttonClasses`: 4 arq. fora de `ui` (5 linhas) | 13 variantes (uso abaixo), 6 tamanhos; hover, active, `focus-visible`, `disabled`, `aria-disabled` | `atender`, `parcial`, `recusar`, `link` sem `active`; `bloqueado` sem hover (de propósito). Nome `pink` não corresponde mais à cor |
| `button.tsx` | `Button` 214/66; `ButtonLink` 42/26; `SubmitButton` 11/11 | `loading` (spinner sem mudar largura), `motivoDesabilitado` (segue focável, toast no clique), `abreDialogo` | `ButtonLink` sem `disabled` e sem `loading` (usa-se `<span>` falso em `app/(app)/solicitacoes/[id]/page.tsx:179,188`) |
| `icon-button.tsx` | `IconButton` 25/17; `IconLink` 3/2 | `sm`/`md`; hover, active, foco, `disabled` | `loading`; `IconLink` sem `disabled` |
| `badge.tsx` | `Badge` 19/12; `Tag` 51/26; `ChipMono` 11/10; `EventoStatusBadge` 4/3; `SolicitacaoStatusBadge` 1/1; `SolicitacaoStatusTexto` 4/2; `ItemStatusBadge` 4/2; `PerfilBadge` 1/1; `ForaJanelaTag` 5/4; `TipoSolicitacaoTag` 0 | 9 tons | Estáticos: não se aplica. `TipoSolicitacaoTag` e `COR_ITEM` (`:118`) sem uso |
| `dialog.tsx` | `Dialog` 36/27; `DialogContent` 38/27; `DialogFooter` 29/22; `DialogClose` 11/8 | `width` (padrão 460) ou `size` (420/520/720); folha de baixo no celular; rodapé fixo; devolve o foco | Sem estado "ocupado" (dois consumidores fazem à mão: `biblioteca/organizar-projetos-dialog.tsx:113`, `biblioteca/selecao-em-lote.tsx:210`); fechar com hover e foco global, sem `active` |
| `confirm-dialog.tsx` | `ConfirmDialog` 21/13 | `danger`, justificativa obrigatória ou opcional, `children`; pendente no botão de envio; foco em Cancelar quando destrutiva | Cancelar e Esc seguem ativos durante o envio; largura fixa em 460 |
| `field.tsx` | `Input` 74/34; `Textarea` 17/13; `Label` 9/5; `Field` 114/29; `Checkbox` 10/8; `FormError` 26/22 | Campo: hover, foco, `disabled`, `read-only`, `aria-invalid`; `Field`: dica, erro, obrigatório, opcional | `Checkbox` sem `disabled`, sem hover, sem erro; `Field` só liga ARIA com filho único; `Label` sem estado desabilitado |
| `select.tsx` | `Select` 21/15 | `sm`/`md`; hover, foco, aberto, `disabled`, inválido, placeholder; item destacado e desabilitado; grupos | Sem `loading` |
| `combobox.tsx` | `ComboBox` 14/11 | Hover, foco, `disabled`, inválido; opção ativa e desabilitada; selo com 3 tons; lista em portal | Sem `loading`; sem limpar |
| `dropdown.tsx` | `Dropdown` 4/4; `DropdownContent` 4/4; `DropdownItem` 18/4; `DropdownSeparator` 7/4; `DropdownLabel` 2/1; `DropdownTrigger` 4/4 | Item destacado, `danger`, `disabled` | Gatilho sem classe própria (cada uso desenha); item sem `loading` |
| `stepper.tsx` | `Stepper` 35/15 | `sm`/`md`; hover, active, foco, `disabled`, inválido, limites | Sem `loading` |
| `tabela.tsx` | `TabelaRolavel` 5/4; `CaptionOculta` 33/25; `ThOrdenavel` 4/4; `Th` 137/21; `Paginacao` 13/8 | Ordenação (ativo, direção, hover, foco, carregando); paginação (atual, desabilitada, hover, foco, carregando) | **Não há componente de tabela**: só peças soltas. `Th` estático |
| `linha-link.tsx` | `LinhaLink` 13/9 | Hover, abrindo, foco na linha; Ctrl/clique do meio; prefetch | Sem `disabled`; depende de `td`/`th` diretos (Parte 4) |
| `tabs-nav.tsx` | `TabsNav` 13/11; `TabsControladas` 4/4 | Ativo, hover, foco, contador, setas de rolagem; `TabsNav` com carregando; `tom="warning"`; `compacta` | `TabsControladas` sem `disabled` e sem `loading`; setas fora do teclado (de propósito) |
| `pills.tsx` | `Pills` 14/12 | Ativo, hover, foco; carregando só no modo link | Sem `disabled`; modo botão sem `loading` |
| `layout.tsx` | `PageHeader` 28/28; `Meta` 16/3; `Section` 73/25; `Panel` 0; `RotuloGrupo` 5/3; `EmptyState` 50/35; `RodapeTabela` 8/7; `BannerEscuro` 2/2; `MetricStrip` 4/4; `Metric` 16/4; `ListaDados` 5/4; `Aviso` 48/23; `Notice` 0; `Skeleton` 122/13; `Carregando` 13/12; `SkeletonLista` 5/4; `Marcador` 1/1 (mais um homônimo local em `arena/impressao-arena.tsx:39`); `BarraProgresso` 3/3; `Kbd` 12/6 | `PageHeader` `md`/`sm`, `divisor`; `Section` claro/escuro; `Metric` tom e link; `Aviso` 5 tons; `Kbd` claro/escuro | `Section` sem variante interativa nem hover; `Metric` com link sem `active`; `Panel` e `Notice` sem uso |
| `toast.tsx` | `Toaster` 1/1; `toast` 29 ocorr.; `toastErro` 46; `toastSucesso` 48 | 3 tipos, Desfazer (Ctrl+Z), ação, pausa em hover/foco, até 3 empilhados | Sem animação de saída; sem estado na ação assíncrona |
| `busca-url.tsx` | `BuscaUrl` 10/7 | Hover, foco, pendente | Sem `disabled` |
| `filtro-evento.tsx` | `FiltroEvento` 5/5 | Herda de `ComboBox`; `fluido`; Limpar | Só `aria-busy`; sem indicação visual além da barra do topo |
| `filtro-select-url.tsx` | `FiltroSelectUrl` 6/2 | Filtro ativo (`border-marca text-accent`) | Idem |
| `imagem-zoom.tsx` | `ImagemZoom` 8/8 | Lightbox; Fechar com hover e foco | Miniatura com foco global, sem hover; sem carregando nem erro de imagem |
| `indicador-link.tsx` | `IndicadorLink` 9/6; `SinalLink` 1/1 | `ao-lado`, `sobre`, `sublinhado` | É ele mesmo o estado |
| `linha-do-tempo.tsx` | `LinhaDoTempo` 1/1 | 5 tons; bloco recolhível | Vazio à mão (`:47`); resumo com foco global, sem hover |
| `numero.tsx` | `Numero` 110/29; `Data` 6/2; `Codigo` 104/46 | Formatação | Não se aplica |
| `icons.tsx` | `Icone` 247/87; `Spinner` 7/6; `IconeLapis` 2/2; `IconeFechar` 3/3; `IconeMais` 1/1; `IconeMenos` 1/1 | Cerca de 52 nomes | Quatro exports antigos paralelos a `Icone` |
| `botao-voltar.tsx` | `BotaoVoltar` 3/3 | Herda de `Button` | Sem `loading` na volta |
| `contagem-ao-vivo.tsx` | `ContagemAoVivo` 11/8 | Visível ou oculta | Não se aplica |
| `action-form.tsx` | `ActionForm` 10/10 | Pendente em contexto; foca o primeiro inválido | Não se aplica (lógica de formulário) |
| `acao-cabecalho.tsx` | `AcaoNoCabecalho` **0** | Portal para `[data-acoes-pagina]` | **Sem uso**; o comentário de `ui/layout.tsx:25` ainda o cita. A Ativação usa evento próprio (`estoque/novo-item-estoque.tsx:12`) |
| `aviso-corte.ts` | `avisarTextoCortado` em 5 arq. | Toast ao colar além do limite | Não se aplica |
| `navegacao.ts` | `useSinalizarNavegacao` em 10 arq. | Sinal da barra do topo | Não se aplica |
| `use-action-feedback.ts` | `useActionFeedback` em 3 arq. | Toast de resultado | Não se aplica |

**Uso de variantes de botão** (estático; 13 usos têm variante dinâmica): `secondary` 95, `primary` 53, `ghost` 39, padrão 27 (`secondary`, ou `primary` no `SubmitButton`), `link` 25, `dangerOutline` 5, `parcial` 4, `danger` 4, `pink` 2 + 1 dinâmico, `atender` 2, `onDark` 1, `recusar` 1. `dark` sem uso estático. `bloqueado` só em `eventos/banner-reuniao.tsx:71` e `app/(app)/solicitacoes/[id]/page.tsx:179,188`. Tamanhos: `lg` 75, `sm` 73, `md` 38 + 38 padrão, `xs` 34, `full` 3, `xl` 2.

## 1.2 `components/shell`

| Arquivo | Export e uso | Estados | O que falta |
|---|---|---|---|
| `app-shell.tsx` | `AppShell` 1 (`app/(app)/layout.tsx`) | Menu escuro; item (`:74-100`): ativo com `canto-marca`, hover, foco, carregando, contagem, recolhido; gaveta abaixo de 1024 px; faixa "ver como" (`:373`) | Recolher, Buscar, Sair e abrir menu sem `focus-visible` próprio (o claro vem de `[&_:focus-visible]` no `aside`, `:228`); Sair sem pendente; contagem é selo à mão (`:91`) |
| `barra-navegacao.tsx` | `BarraNavegacao` 1 | Oculta/visível; movimento reduzido | Não se aplica |
| `busca-global.tsx` | `BuscaGlobal` 1; `abrirBuscaGlobal` em 2 arq. | Buscando, opção ativa, vazio com `EmptyState` | **Sem estado de erro**: falha de rede é engolida (`:87`), resposta não ok vira lista vazia (`:81`) e aparece como "Nada encontrado" |
| `sino-notificacoes.tsx` | `SinoNotificacoes` 1 | Aberto, carregando, vazio, não lida, prazo | Sem estado de erro ao carregar; gatilho com foco global; vazio à mão (`:141`) |
| `trilha.tsx` | `Trilha` 1; `DefinirTrilha` 3/3 | Hover, página atual, reticências | Links com foco global. `NOMES` (`:36`) é mapa de rotas |
| `foco.ts` | `focarConteudoSePerdido` em 4 arq. | Não se aplica | Não se aplica |

## 1.3 Duplicações fora de `ui/`

### Botões

| Padrão repetido | Onde | Componente que já cobre |
|---|---|---|
| Botão com cara de link | `arena/arena-barra-edicao.tsx:227`; `biblioteca/selecao-em-lote.tsx:292`; `eventos/banner-reuniao.tsx:78`; `eventos/conferencia-ata.tsx:563,1120`; `eventos/mesmo-item-no-evento.tsx:67,78,213`; `eventos/tendas-do-evento.tsx:147`; `solicitacoes/nova/aviso-ja-pedido.tsx:42`; `solicitacoes/nova/busca-catalogo.tsx:324`; `solicitacoes/nova/lista-itens.tsx:306` | `Button variant="link"` |
| Círculo de conferir (`role="checkbox"`), sem componente: 6 cópias | `eventos/ata-lista.tsx:65`; `eventos/conferencia-ata.tsx:144,655`; `eventos/mesmo-item-no-evento.tsx:98`; `eventos/tenda-conferencia.tsx:247`; `eventos/tendas-do-evento.tsx:235` | Nenhum |
| Cartão de rádio à mão | `carga/form-veiculo.tsx:206`; `catalogo/origem-peca-field.tsx:24`; `app/(app)/arena/nova/form.tsx:93-101` | Nenhum |
| Aba à mão | `estoque/estoque-tela.tsx:126` | `TabsControladas` |
| Chip liga/desliga | `carga/calendario-carga.tsx:393`; `carga/form-veiculo.tsx:51` | `Pills` (parcial) |
| Linha ou cartão clicável | `carga/calendario-carga.tsx:236,267,284,299,495,591`; `carga/cadastro-carga.tsx:105`; `solicitacoes/nova/resumo-envio.tsx:120,175`; `app/(auth)/login/login-form.tsx:104`; `arena/indice-pontos.tsx:51`; `arena/painel-conferencia.tsx:60` | Nenhum |
| Selo clicável | `eventos/ata-lista.tsx:122`; `solicitacoes/nova/aviso-ja-pedido.tsx:48` | Nenhum |
| Abrir/fechar | `eventos/item-com-locais.tsx:56`; `arena/arena-controles-mapa.tsx:199` | Nenhum |
| Dia do calendário e barra de semana | `calendario/dia-modal.tsx:24,55`; `carga/calendario-carga.tsx:456` | Específicos |
| Controles do mapa | `arena/arena-botao-mapa.tsx:26`; `arena/plano-2d.tsx:371,374,377`; `arena/arena-marcadores-3d.tsx:77` | Arena |
| Submit que recebe classe de fora | `app/(app)/notificacoes/botao-notificacao.tsx:12` | `SubmitButton` |
| `<a>` ou `<span>` com `buttonClasses` | `app/global-error.tsx:35` (de propósito); `eventos/envio-os.tsx:100`; `eventos/os-visoes.tsx:266`; `app/(app)/solicitacoes/[id]/page.tsx:179,188` | `ButtonLink` não baixa arquivo nem desabilita |

### Tabelas

| Padrão | Onde |
|---|---|
| `<table>` à mão (todas: não há componente) | 46 em 33 arquivos, principalmente `eventos/os-visoes.tsx` (5), `app/(app)/page.tsx`, `app/(app)/biblioteca/page.tsx`, `app/(app)/consolidacao/page.tsx`, `app/(app)/pendencias/page.tsx`, `arena/painel-ponto.tsx` (3) |
| `<th>` de coluna à mão, duplicando `Th` | `estoque/estoque-tela.tsx:151-160`; `estoque/reformas-tela.tsx:61-66`; `estoque/retornos-tela.tsx:112-116`; `carga/importar-carga.tsx:167-171`; `eventos/acoes-linha-evento.tsx:295-298`; `solicitacoes/nova/aviso-ja-pedido.tsx:89-99`; `solicitacoes/nova/lista-itens.tsx:105-109`; `solicitacoes/quadro-tendas.tsx:107-110`; `arena/painel-ponto.tsx:135,138`; `arena/impressao-arena.tsx:245-251,293-296`; `app/impressao/ata/[id]/page.tsx:106-112,188-195`; `app/impressao/os/[id]/page.tsx:131-134,182-185` |
| Cabeçalho ordenável à mão, duplicando `ThOrdenavel` | `app/(app)/eventos/(lista)/page.tsx:262` (sem `IndicadorLink`) |
| Tabela sem `caption` | `arena/impressao-arena.tsx` (2); `eventos/acoes-linha-evento.tsx:292` |
| `data-responsiva` em parte das tabelas | 29 ocorrências; sem ele vale o `min-width: 640px` de `globals.css:349` |

### Selos

| Onde | Observação |
|---|---|
| `shell/app-shell.tsx:91` | Contagem do menu, à mão desde o tema novo (antes `ChipMono`) |
| `ui/linha-do-tempo.tsx:64`; `ui/combobox.tsx:242`; `ui/tabs-nav.tsx:25`; `shell/busca-global.tsx:208` | Dentro do próprio sistema |
| `app/(app)/historico/page.tsx:302`; `estoque/estoque-tela.tsx:136`; `eventos/conferencia-ata.tsx:282,681`; `eventos/linha-tempo-agrupada.tsx:127,180`; `eventos/mudancas-pos-ata.tsx:178`; `solicitacoes/item-resposta.tsx:418`; `catalogo/anexos-peca.tsx:159` | Duplicam `ChipMono` ou `Tag` |
| `carga/base.tsx:45`; `carga/calendario-carga.tsx:303,305,400,549,550`; `carga/importar-carga.tsx:277` | Família própria de Carga |
| `eventos/ata-lista.tsx:111`; `solicitacoes/nova/aviso-ja-pedido.tsx:52` | Selo de aviso à mão |
| `eventos/conferencia-ata.tsx:1303` | `<kbd>` à mão, duplica `Kbd` |
| Ponto pulsante (10): `app/(app)/biblioteca/page.tsx:116`; `app/(app)/consolidacao/page.tsx:166`; `app/(app)/eventos/(lista)/page.tsx:216`; `app/(app)/eventos/[id]/solicitacoes/page.tsx:126`; `app/(app)/solicitacoes/page.tsx:99,190`; `app/(app)/solicitacoes/[id]/page.tsx:235`; `arena/arena-cabecalho.tsx:43`; `eventos/dados-reuniao-form.tsx:103`; `solicitacoes/nova/resumo-envio.tsx:224` | Duplica `Marcador pulsar` |

### Cartões

`rounded-cartao border border-line bg-surface` à mão, em vez de `Section`:

| Tipo | Onde |
|---|---|
| Constante local | `app/(app)/admin/page.tsx:47`; `app/(app)/biblioteca/page.tsx:73`; `arena/arena-botao-mapa.tsx:5` |
| Páginas | `app/(app)/calendario/page.tsx:278,327,388`; `app/(app)/consolidacao/page.tsx:172`; `app/(app)/eventos/(lista)/page.tsx:223`; `app/(app)/eventos/[id]/page.tsx:250`; `app/(app)/historico/page.tsx:83`; `app/(app)/notificacoes/page.tsx:97`; `app/(app)/page.tsx:435`; `app/(app)/pendencias/page.tsx:88`; `app/(app)/perfil/page.tsx:38,74`; `app/(app)/projetos/[id]/page.tsx:110`; `app/(app)/solicitacoes/page.tsx:196`; `app/impressao/ata/[id]/page.tsx:55`; `app/impressao/os/[id]/page.tsx:78` |
| Componentes | `admin/config-painel.tsx:43`; `carga/cadastro-carga.tsx:63,160`; `carga/calendario-carga.tsx:354,433,485,539`; `carga/carga-evento.tsx:52`; `carga/form-veiculo.tsx:83`; `carga/importar-carga.tsx:28`; `estoque/estoque-tela.tsx:123`; `estoque/reformas-tela.tsx:52,124`; `estoque/retornos-tela.tsx:43,54,84`; `eventos/conferencia-ata.tsx:1091`; `eventos/mudancas-pos-ata.tsx:159,171`; `eventos/painel-reuniao.tsx:33`; `painel/agora.tsx:41,47`; `projetos/editar-projeto-modal.tsx:67`; `projetos/gerenciar-grupos.tsx:50`; `solicitacoes/nova/busca-catalogo.tsx:332,423,448`; `solicitacoes/nova/lista-itens.tsx:270`; `solicitacoes/nova/passo.tsx:8` |
| Esqueletos | Todos os `loading.tsx` repetem a mesma classe |

### Campos e avisos

| Padrão | Onde | Componente que já cobre |
|---|---|---|
| Checkbox nativo | `arena/arena-barra-ferramentas.tsx:248,267`; `biblioteca/selecao-em-lote.tsx:340,368`; `carga/cadastro-carga.tsx:80,84`; `carga/calendario-carga.tsx:419`; `carga/form-veiculo.tsx:90` | `Checkbox`, que não aceita `disabled` |
| Arquivo nativo | `app/(app)/arena/arena-acoes.tsx:77`; `app/(app)/arena/nova/form.tsx:142`; `carga/importar-carga.tsx:134`; `catalogo/anexos-peca.tsx:192` | Nenhum |
| Rótulo nativo visível | `admin/config-painel.tsx:46`; `biblioteca/filtros-biblioteca.tsx:66,68` | `Label`/`Field` |
| Campo de busca solto (`Input type="search"` ou nativo) | `arena/arena-barra-ferramentas.tsx:96`; `carga/cadastro-carga.tsx:76`; `carga/calendario-carga.tsx:378`; `estoque/estoque-tela.tsx:116`; `eventos/conferencia-ata.tsx:1179`; `solicitacoes/nova/busca-catalogo.tsx:270` | `BuscaUrl` só serve para URL |
| Lista de busca paralela a `ComboBox` | `arena/arena-barra-ferramentas.tsx:133`; `shell/busca-global.tsx:186` | Específicas |
| Aviso à mão (`bg-*-bg` + borda) | `app/impressao/error.tsx:15`; `carga/importar-carga.tsx:151,153`; `eventos/conferencia-ata.tsx:692,1277`; `eventos/tenda-conferencia.tsx:308`; `eventos/vincular-catalogo.tsx:72`; `eventos/linha-tempo-agrupada.tsx:23-26`; `eventos/mudancas-pos-ata.tsx:60-62` | `Aviso` |
| Spinner e esqueleto à mão | `eventos/tenda-conferencia.tsx:299`; `arena/arena-controles-mapa.tsx:91` | `Spinner`, `Skeleton` |

---

# Parte 2. Elementos fora da visão inicial

Tipo: **C** confirmação curta, **F** formulário, **D** trabalho denso, **T** detalhe. O tipo é uma leitura do código (campos e tabelas no corpo), não da tela.

## 2.1 `DialogContent` (37 janelas; a 38ª ocorrência é a base do `ConfirmDialog`)

| Arquivo:linha | Finalidade | Largura | Tipo |
|---|---|---|---|
| `admin/areas-painel.tsx:42` | Nova área ou editar área | 460 | F |
| `admin/usuarios-painel.tsx:57` | Link de acesso para copiar | 460 | T |
| `admin/usuarios-painel.tsx:164` | Novo usuário ou editar | 460 | F |
| `biblioteca/organizar-projetos-dialog.tsx:113` | Grupo e categoria em lote | 560 | F |
| `biblioteca/selecao-em-lote.tsx:210` | Inativar ou reativar selecionados | 540 | C |
| `calendario/dia-modal.tsx:70` | Compromissos do dia | 520 | T |
| `carga/calendario-carga.tsx:584` | Veículos de uma operação | 760 | T |
| `carga/calendario-carga.tsx:615` | Evento e seus veículos | 760 | T |
| `carga/calendario-carga.tsx:651` | Operação vinda da planilha 2026 | 520 | T |
| `carga/detalhe-veiculo.tsx:197` | Veículo: trechos e ações | 760 | T |
| `carga/form-veiculo.tsx:179` | Novo veículo ou editar (ida e volta) | 880 | D |
| `carga/importar-carga.tsx:88` | Importar planilha, com prévia em tabela | 560 → 980 | D |
| `catalogo/peca-ativo-botao.tsx:76` | Bloqueio: não dá para inativar a peça | 480 | T |
| `estoque/estoque-tela.tsx:380` | Novo item ou editar | 520 | F |
| `estoque/pedidos-item.tsx:66` | Pedidos do item | 760 | T |
| `estoque/reformas-tela.tsx:181` | Enviar para reforma | 520 | F |
| `estoque/reformas-tela.tsx:237` | Editar reforma | 520 | F |
| `estoque/reformas-tela.tsx:280` | Concluir reforma | 480 | F |
| `estoque/retornos-tela.tsx:195` | Registrar retorno por item | 720 | D |
| `eventos/acoes-linha-evento.tsx:165` | Tenda de um local | 520 | F |
| `eventos/acoes-linha-evento.tsx:262` | Tenda em todos os locais (tabela) | 640 ou 760 | D |
| `eventos/acoes-linha-evento.tsx:368` | Incluir item na ata ou OS | 520 | F |
| `eventos/ata-lista.tsx:338` | Incluir linha na ata ou OS | 520 | F |
| `eventos/conferencia-ata.tsx:190` | Ajustar linha com regra (extra) | 480 | F |
| `eventos/conferencia-ata.tsx:263` | Ajustar quantidade da linha | 480 | F |
| `eventos/conferencia-ata.tsx:333` | Descrições da linha | 560 | F |
| `eventos/conferencia-ata.tsx:1326` | Conferir as restantes | 460 | C |
| `eventos/conferencia-ata.tsx:1370` | Incluir linha na ata | 520 | F |
| `eventos/edicao-leituras.tsx:39` | De onde vem um total | 560 | T |
| `eventos/envio-os.tsx:117` | Marcar OS enviada ou incorporar complemento | 480 | C |
| `eventos/pecas-projeto.tsx:168` | Ajustar ou incluir peça do projeto | 460 | F |
| `eventos/vincular-catalogo.tsx:70` | Vincular item ao catálogo (com abas) | 520 | F |
| `projetos/editar-projeto-modal.tsx:65` | Editar projeto com anexos e lista de peças | 1120 | D |
| `projetos/gerenciar-grupos.tsx:46` | Grupos da biblioteca | 520 | D |
| `projetos/projeto-form.tsx:302` | Salvar nova versão e gerar OS | 500 | C |
| `solicitacoes/nova/aviso-ja-pedido.tsx:75` | Projeto: peças e o que já foi pedido | 720 | T |
| `solicitacoes/nova/dialogo-tendas.tsx:78` | Quadro de tendas por local | 760 | D |

`carga/carga-evento.tsx:153` e `estoque/botao-reforma-item.tsx:17` só abrem `Dialog` em volta de janelas acima. `eventos/linha-ata-form.tsx` e `solicitacoes/quadro-tendas.tsx` usam só `DialogFooter`, dentro de outras janelas.

## 2.2 `ConfirmDialog` (21 instâncias, todas com 460 px; base em `ui/confirm-dialog.tsx:68`)

| Arquivo:linha | Finalidade | Destrutiva | Tipo |
|---|---|---|---|
| `app/(app)/arena/arena-acoes.tsx:66` | Enviar ou trocar planta (arquivo) | Não | F |
| `app/(app)/arena/arena-acoes.tsx:95` | Remover planta | Sim | C |
| `app/(app)/arena/arena-acoes.tsx:98` | Importar prédios do entorno | Não | C |
| `app/(app)/arena/arena-acoes.tsx:118` | Remover prédios do entorno | Sim | C |
| `app/(app)/arena/arena-acoes.tsx:121` | Excluir arena | Sim | C |
| `app/(app)/pendencias/resolver-pendencia.tsx:19` | Resolver pendência (com texto) | Não | F |
| `arena/arena-experiencia.tsx:664` | Restaurar planta original | Sim | C |
| `catalogo/peca-ativo-botao.tsx:92` | Inativar ou reativar peça | Ao inativar | C |
| `eventos/acoes-evento.tsx:138` | Transições do evento; às vezes com justificativa | Ao cancelar | C/F |
| `eventos/acoes-linha-evento.tsx:88` | Editar quantidade da linha | Não | F |
| `eventos/acoes-linha-evento.tsx:106` | Remover linha do evento | Sim | C/F |
| `eventos/ata-lista.tsx:350` | Ajustar linha da ata | Não | F |
| `eventos/banner-reuniao.tsx:102` | Iniciar reunião ou fechar ata | Não | C |
| `eventos/situacao-evento.tsx:39` | Cancelar evento ou adiar reunião | Ao cancelar | C/F |
| `projetos/ativo-toggle.tsx:16` | Inativar ou reativar projeto | Ao inativar | C |
| `projetos/disponivel-toggle.tsx:17` | Tirar ou liberar nas solicitações | Não | C |
| `solicitacoes/acoes-solicitacao.tsx:123` | Devolver para ajuste (motivo) | Não | F |
| `solicitacoes/acoes-solicitacao.tsx:137` | Cancelar solicitação (motivo opcional) | Sim | C/F |
| `solicitacoes/acoes-solicitacao.tsx:154` | Excluir rascunho | Sim | C |
| `solicitacoes/nova-solicitacao-form.tsx:418` | Descartar alterações | Sim | C |
| `solicitacoes/nova-solicitacao-form.tsx:435` | Trocar de evento | Sim | C |

## 2.3 Demais janelas, menus e camadas

| Arquivo:linha | O que é | Largura | Base |
|---|---|---|---|
| `shell/busca-global.tsx:130` | Busca global (Ctrl K) | até 620 | Radix Dialog direto |
| `ui/imagem-zoom.tsx:31` | Lightbox | tela cheia; figura até 1200 | Radix Dialog direto |
| `shell/app-shell.tsx:216-233` | Gaveta do menu abaixo de 1024 px; `role="dialog"` quando aberta | 236 | À mão, com `inert` no conteúdo |
| `shell/sino-notificacoes.tsx:121` | Painel de notificações | até 420 | À mão, `role="dialog"` |
| `shell/app-shell.tsx:328` | Menu da conta e "ver como" | mín. 192 | `Dropdown` |
| `admin/usuarios-painel.tsx:216` | Mais ações do usuário | mín. 192 | `Dropdown` |
| `app/(app)/arena/arena-acoes.tsx:46` | Ações da arena | mín. 192 | `Dropdown` |
| `arena/arena-barra-edicao.tsx:166` | Menu de edição do mapa | mín. 192 | `Dropdown` |
| `arena/arena-barra-edicao.tsx:191` | Adicionar ao mapa | até 560 | À mão, `role="dialog"` |
| `arena/arena-barra-edicao.tsx:243` | Renomear ou item novo | até 640 | `<form>` flutuante |
| `arena/arena-barra-ferramentas.tsx:133` | Resultados da busca no mapa | largura do campo | À mão, `listbox` |
| `arena/arena-barra-ferramentas.tsx:224` | Camadas | 292 | À mão |
| `arena/arena-controles-mapa.tsx:48` / `:67` | Fontes / atalhos | até 360 / 290 | À mão, `role="dialog"` |
| `arena/indice-pontos.tsx:28`; `arena/painel-conferencia.tsx:35`; `arena/painel-ponto.tsx:38` | Painéis laterais | 300; 352; variável | À mão |
| `arena/arena-experiencia.tsx:496` | Tela cheia do mapa | tela inteira | À mão |
| `solicitacoes/nova/resumo-envio.tsx:266` | Barra fixa de envio abaixo de `lg` | largura toda | À mão |
| `ui/select.tsx:114` | Lista do `Select` (21 usos) | do gatilho, mín. 220 | Radix Select |
| `ui/toast.tsx:163-188` | Avisos; até 3; no celular, no topo | até 520 | À mão |

**`ComboBox` (14 instâncias, listas em portal):** `app/(app)/arena/nova/form.tsx:54,122`; `carga/form-veiculo.tsx:188`; `estoque/estoque-tela.tsx:401`; `estoque/reformas-tela.tsx:185`; `eventos/linha-ata-form.tsx:71,77`; `eventos/pecas-projeto.tsx:178`; `eventos/vincular-catalogo.tsx:93,100`; `historico/filtro-pessoa.tsx:32`; `projetos/projeto-form.tsx:174`; `solicitacoes/nova/escolha-evento.tsx:87`; `ui/filtro-evento.tsx:36`.

**Conteúdo recolhido (`<details>`):** `app/(app)/calendario/page.tsx:311`; `app/(app)/historico/page.tsx:179,306`; `app/(app)/page.tsx:435`; `app/(app)/perfil/page.tsx:74`; `eventos/linha-tempo-agrupada.tsx:176`; `eventos/mudancas-pos-ata.tsx:209`; `solicitacoes/nova/aviso-estoque.tsx:49`; `ui/linha-do-tempo.tsx:61`.

## 2.4 `loading.tsx`, `error.tsx` e `not-found`

| Arquivo | Cobre |
|---|---|
| `app/(app)/loading.tsx` | Painel em `/`; esqueleto genérico (título + lista) nas demais telas sem arquivo próprio |
| `app/(app)/calendario/loading.tsx`; `carga-descarga/loading.tsx`; `carga-descarga/cadastro/loading.tsx`; `conferencia/[id]/loading.tsx`; `eventos/(lista)/loading.tsx`; `eventos/[id]/loading.tsx`; `historico/loading.tsx`; `solicitacoes/loading.tsx`; `solicitacoes/nova/loading.tsx`; `solicitacoes/[id]/loading.tsx` | Esqueleto próprio. O de `eventos/[id]` atende também ata, OS, carga, histórico, itens, solicitações e editar |
| `app/(app)/error.tsx` | Todo o app; tem título "Sem conexão" |
| `app/impressao/error.tsx` | Impressões |
| `app/global-error.tsx` | Layout raiz e, por falta de outro, as telas de `(auth)` |
| `app/(app)/not-found.tsx` / `app/not-found.tsx` | `notFound()` no shell / endereço inexistente e impressões |
| `app/(app)/sem-permissao/page.tsx` | Recusa de acesso |

**Sem `loading` próprio ou herdado:** `(auth)/login`, `(auth)/recuperar-senha`, `(auth)/redefinir-senha/[token]`, `impressao/os/[id]`, `impressao/ata/[id]`, `impressao/arena/[slug]`.

**Só com o esqueleto genérico (forma diferente da tela):** `admin`, `arena`, `arena/[slug]`, `arena/nova`, `ativacao` e abas, `ativacao/itens/[id]`, `biblioteca`, `catalogo/[id]`, `catalogo/[id]/editar`, `catalogo/nova`, `consolidacao`, `eventos/novo`, `notificacoes`, `pendencias`, `perfil`, `projetos/[id]`, `projetos/[id]/editar`, `projetos/novo`, `sem-permissao`.

**Sem `error.tsx` no próprio trecho:** `(auth)` e cada módulo do app, que caem no erro geral. Dentro de janela, o erro aparece por `FormError` ou toast.

**Só redirecionam (sem estado próprio):** `admin/areas`, `admin/configuracoes`, `admin/usuarios`, `catalogo`, `consolidacao/pendencias`, `estoque`, `eventos/[id]/reuniao`, `projetos`.

## 2.5 Estados vazios

**`EmptyState`: 50 usos em 35 arquivos.**

| Módulo | Arquivo:linha |
|---|---|
| Painel | `app/(app)/page.tsx:193,530,570`; `painel/eventos-solicitante.tsx:45` |
| Eventos | `app/(app)/eventos/(lista)/page.tsx:231`; `app/(app)/eventos/[id]/page.tsx:163,234`; `[id]/ata/page.tsx:127`; `[id]/os/page.tsx:80`; `[id]/historico/page.tsx:56,58`; `[id]/solicitacoes/page.tsx:51`; `eventos/ata-lista.tsx:194`; `eventos/conferencia-ata.tsx:1218,1233,1235`; `eventos/fila-fora-catalogo.tsx:17`; `eventos/os-visoes.tsx:112,195,334` |
| Solicitações | `app/(app)/solicitacoes/page.tsx:205`; `solicitacoes/[id]/page.tsx:352`; `solicitacoes/nova/busca-catalogo.tsx:449`; `solicitacoes/nova/escolha-evento.tsx:82`; `solicitacoes/nova/lista-itens.tsx:271` |
| Biblioteca | `app/(app)/biblioteca/page.tsx:141,212,235,424,587`; `app/(app)/projetos/[id]/page.tsx:135,251`; `projetos/projeto-form.tsx:214` |
| Operação | `app/(app)/calendario/page.tsx:285,396`; `app/(app)/consolidacao/page.tsx:186`; `app/(app)/pendencias/page.tsx:102`; `app/(app)/historico/page.tsx:94`; `app/(app)/notificacoes/page.tsx:109,122`; `carga/cadastro-carga.tsx:161`; `carga/carga-evento.tsx:95`; `estoque/estoque-tela.tsx:141`; `estoque/reformas-tela.tsx:54`; `estoque/retornos-tela.tsx:44` |
| Arena, admin, shell | `app/(app)/arena/page.tsx:40`; `app/(app)/arena/nova/form.tsx:36`; `admin/areas-painel.tsx:82`; `admin/usuarios-painel.tsx:284`; `shell/busca-global.tsx:221` |

**Vazio com texto à mão, em vez de `EmptyState`:** `ui/linha-do-tempo.tsx:47`; `shell/sino-notificacoes.tsx:141`; `estoque/retornos-tela.tsx:54`; `estoque/pedidos-item.tsx:75`; `carga/calendario-carga.tsx:555`; `carga/cadastro-carga.tsx:96`; `catalogo/anexos-peca.tsx:150`; `projetos/gerenciar-grupos.tsx:48`; `calendario/dia-modal.tsx:72`; `eventos/linha-tempo-agrupada.tsx:230`; `eventos/detalhes-unidades-tenda.tsx:75`; `app/(app)/eventos/[id]/itens/[linhaId]/page.tsx:218`; `app/(app)/ativacao/itens/[id]/page.tsx:100,181`; `painel/agora.tsx:41-44`; `arena/painel-ponto.tsx:129,234`; `arena/arena-barra-ferramentas.tsx:135`.

**Telas com dados e sem `EmptyState` na própria tela:**

| Tela | O que há hoje |
|---|---|
| `carga-descarga` | Texto por dia em `carga/calendario-carga.tsx:555` e contagem em `:488` |
| `arena/[slug]` | Só textos em painéis (Arena) |
| `eventos/[id]/itens/[linhaId]` | Só textos à mão |
| `catalogo/[id]` | Só o texto de `catalogo/anexos-peca.tsx:150` |
| `ativacao/itens/[id]` | Textos à mão; os `EmptyState` importados são de outras telas |
| `impressao/os/[id]`, `impressao/arena/[slug]` | Nenhum; seções vazias somem. `impressao/ata/[id]` só trata observações (`:177`) |

Telas de formulário (`eventos/novo`, `eventos/[id]/editar`, `catalogo/nova`, `perfil`, `(auth)/*`) não têm lista para esvaziar.

---

# Parte 3. Cor e marca

## 3.1 Tokens atuais (`app/globals.css`)

| Papel | Token | Valor | Linha | Contraste |
|---|---|---|---|---|
| Marca (fundo) | `marca` / `marca-hover` / `on-marca` | `#f06a2a` / `#f4804b` / `#242424` | 42-44 | Grafite sobre marca 5,03; **marca sobre branco 3,09, sobre `page` 2,73, sobre `subtle` 2,88** |
| Laranja legível (texto, link, foco) | `accent` / `accent-hover` | `#b8460f` / `#963809` | 47-48 | Sobre branco 5,36; `page` 4,74; `accent-bg` 4,73; `selected` 4,91; **`control` 4,28; `dark` 2,90** |
| Laranja sobre escuro | `accent-light` | `#f06a2a` (mesmo valor de `marca`) | 50 | Sobre `dark` 5,03; `dark-2` 3,99 |
| Fundos claros | `accent-bg` / `selected` / `accent-border` / `accent-muted` | `#fdeee6` / `#fef3ec` / `#f4cbb4` / `#e8a988` | 49, 22, 51, 78 | |
| Erro | `danger` / `-bg` / `-border` / `-input` | `#b3261e` / `#fbeae8` / `#f0cdc9` / `#c4443b` | 63-66 | Sobre branco 6,54; `-bg` 5,61; `-input` 4,96 |
| Atenção | `warning` / `-bg` / `-border` | `#7a5f00` / `#f7f0dd` / `#e6dcc2` | 67-69 | Sobre branco 6,06; `-bg` 5,33 |
| Texto de apoio | `ink-3`, `muted`, `meta` (mesmo valor) | `#63676a` | 28-30 | `control` 4,56; `neutral-bg` 4,90 |

## 3.2 Conflitos com a marca laranja que ainda existem

Matiz, saturação e luz da marca: 19°/87/55. ΔE é a distância de cor CIE76: abaixo de cerca de 5, quase não se distingue lado a lado.

**O que ficou resolvido:** `danger` tem matiz 3°, a 28,2 de ΔE da marca, e `warning` tem matiz 47°, a 50,2. As 127 linhas de `danger` (Tabela 3.3) herdam o vermelho pelo token, sem hex; `FormError`, `Aviso`, toast de erro, `Button danger` e `dangerOutline` não conflitam com o botão principal laranja.

| # | Conflito | Evidência | Onde |
|---|---|---|---|
| 1 | **Fundos claros de erro, marca e seleção quase iguais** | ΔE `danger-bg`×`accent-bg` 3,3; `danger-bg`×`selected` 4,2; `accent-bg`×`selected` 2,1; `warning-bg`×`selected` 6,5 | Lado a lado em `ui/dropdown.tsx:26` (item destrutivo) e `globals.css:226` (`opcao-ativa`); `ui/badge.tsx:36,40` e `ui/combobox.tsx:11`; linhas: `carga/importar-carga.tsx:201` (`bg-danger-bg/40`), `eventos/ata-lista.tsx:239` (`bg-warning-bg/40`) contra linhas `bg-selected` (`solicitacoes/item-resposta.tsx:628`, `eventos/tendas-do-evento.tsx:133,172`, `eventos/acoes-linha-evento.tsx:267,303`) |
| 2 | **Texto `accent` e texto `danger` com a mesma força** | Luz 39 e 41; contraste entre eles 1,22; ΔE 16,6. Distinguem-se só pelo matiz | Link (`ui/button-classes.ts:37`, `.link` em `globals.css:297`) junto de erro (`ui/field.tsx:85`, `eventos/observacoes-autosave.tsx:73`, `solicitacoes/nova/resumo-envio.tsx:180,220,272`) |
| 3 | **Campo com erro recebe foco laranja** | `ui/action-form.tsx:40-41` foca o primeiro campo inválido ao voltar do servidor: o estado de erro quase sempre aparece focado. Borda de foco `accent` e borda de erro `danger-input` disputam a mesma propriedade (ΔE 19,6). Qual vence é "ver na tela" | `ui/field.tsx:9-10`; `ui/select.tsx:98-99`; `ui/combobox.tsx:201-202`; `ui/stepper.tsx:58` |
| 4 | **Laranja usado como estado**, contra a regra escrita em `globals.css:10` ("nunca estado") | As barras de fase são opostas entre si: em `eventos/fases.tsx:16` a fase concluída é marca e a atual é escura; em `:65` a concluída é cinza e a atual é marca | `eventos/fases.tsx:16,65`; hoje: `calendario/dia-modal.tsx:35`, `carga/calendario-carga.tsx:539,542`, `app/(app)/calendario/page.tsx:136`; não lida: `app/(app)/notificacoes/page.tsx:147,167`, `shell/sino-notificacoes.tsx:151,156`; contagens: `shell/app-shell.tsx:91,95`, `ui/tabs-nav.tsx:25`, `shell/sino-notificacoes.tsx:117`; alterado: `solicitacoes/nova/lista-itens.tsx:243`, `solicitacoes/quadro-tendas.tsx:182`, `eventos/acoes-linha-evento.tsx:267,303` |
| 5 | **Dois laranjas no mesmo papel** | Barra de seleção com `bg-marca` (`app/(app)/biblioteca/page.tsx:268`, `solicitacoes/item-resposta.tsx:628`) ou `accent` (`globals.css:228`, `app/(app)/notificacoes/page.tsx:167`, `arena/painel-conferencia.tsx:59`, `arena/painel-ponto.tsx:246`, `eventos/conferencia-ata.tsx:135`). Contagem: `bg-marca` no menu; `accent-bg` + `accent` nas abas e no sino. Controle marcado: rádio `bg-marca` (`catalogo/origem-peca-field.tsx:36`); checkbox `accent` (`ui/field.tsx:125`, `biblioteca/selecao-em-lote.tsx:350,382`, `carga/*`). Mesmo tom: `ui/layout.tsx:187` usa `text-accent`, `:188` usa `bg-marca` | |
| 6 | **Arena: laranja-queimado antigo fixo** (`#a8400f`, matiz 19°, igual à marca; ΔE 23,4) marca divergência, médico e área restrita, enquanto o ponto selecionado já é `bg-marca` | No mesmo marcador, o selo é vermelho (`arena-marcadores-3d.tsx:138`, token) e o ponto, laranja antigo (`:152`). **Fora do escopo por regra; registrado porque é o único uso em que erro ainda é laranja** | `arena/arena-marcadores-3d.tsx:152`; `arena/plano-2d.tsx:262,316`; `domain/arena/categorias.ts:38,50`; `domain/arena/conferencia.ts:5` (com fundo `#fbeee5`); `arena/cena/ambiente.ts:405` (`#c8997f`, hachura da área restrita) |
| 7 | **Excel: coluna "Volta" em laranja-marrom** | `FF9A5B12`, matiz 32°, ΔE 33,4, com aba `COR.marca` no mesmo arquivo | `server/export/carga-modelo.ts:7,32` |
| 8 | **Marca em contraste abaixo de 3:1 como único sinal** | Sublinhado da aba e barras finas sobre `page` (2,73) ou `subtle` (2,88). Regra 1.4.11; "ver na tela" | `ui/tabs-nav.tsx:20`; `ui/indicador-link.tsx:21`; `eventos/fases.tsx:16,65`; `shell/barra-navegacao.tsx:52`; `eventos/versoes-os.tsx:35` |
| 9 | **`accent` sobre `control` abaixo de AA** | 4,28. Só afeta o que usa `text-accent` sobre o trilho; a pílula ativa é branca, então hoje não foi achado uso direto | `ui/pills.tsx:30` (vizinho) |

**Resíduos de nome e valor:** `accent-light` duplica `marca`; a variante `pink` (`ui/button-classes.ts:45`, usada em `eventos/banner-reuniao.tsx:71,88` e `app/(app)/solicitacoes/[id]/page.tsx:184`) é laranja. O `accent` atual está a ΔE 6,4 do antigo `danger` (`#a8400f`): quem conhecia o app verá o antigo tom de erro em todo link.

## 3.3 Onde `danger` e `warning` são usados

### `danger` (127 linhas: 23 em `ui/`, 8 na Arena, 96 em telas)

| Papel | Arquivo:linha |
|---|---|
| Definição em `ui/` | `ui/badge.tsx:28,40,57,95,122,177`; `ui/button-classes.ts:41-43`; `ui/field.tsx:10,28,85,138`; `ui/layout.tsx:187,188,226,238`; `ui/select.tsx:99`; `ui/combobox.tsx:202`; `ui/stepper.tsx:58`; `ui/dropdown.tsx:26`; `ui/linha-do-tempo.tsx:12`; `ui/toast.tsx:188` |
| Ação destrutiva | `admin/usuarios-painel.tsx:202,233`; `carga/detalhe-veiculo.tsx:142,186`; `catalogo/anexos-peca.tsx:126,127,135`; `catalogo/peca-ativo-botao.tsx:71,98`; `eventos/acoes-evento.tsx:144`; `eventos/acoes-linha-evento.tsx:65,80,108`; `eventos/situacao-evento.tsx:33,51`; `eventos/tenda-conferencia.tsx:308,313`; `projetos/ativo-toggle.tsx:22`; `projetos/gerenciar-grupos.tsx:68`; `projetos/projeto-form.tsx:242`; `solicitacoes/acoes-solicitacao.tsx:144,160`; `solicitacoes/nova/busca-catalogo.tsx:439`; `solicitacoes/nova-solicitacao-form.tsx:425,445` |
| Erro e validação | `app/(app)/error.tsx:18`; `app/impressao/error.tsx:15,16`; `app/(auth)/redefinir-senha/[token]/page.tsx:15`; `admin/config-painel.tsx:50`; `biblioteca/organizar-projetos-dialog.tsx:190`; `biblioteca/selecao-em-lote.tsx:237`; `carga/form-veiculo.tsx:201`; `carga/importar-carga.tsx:153,177,201`; `eventos/dados-reuniao-form.tsx:101`; `eventos/observacoes-autosave.tsx:73`; `projetos/projeto-form.tsx:252`; `solicitacoes/item-resposta.tsx:223`; `solicitacoes/nova/descricoes-item.tsx:83,87`; `solicitacoes/nova/lista-itens.tsx:194,270`; `solicitacoes/nova/passo.tsx:33`; `solicitacoes/nova/resumo-envio.tsx:180,183,199,220,272`; `solicitacoes/quadro-tendas.tsx:236` |
| Atraso e prazo | `lib/prazo.ts:8,32`; `app/(app)/notificacoes/page.tsx:37`; `app/(app)/page.tsx:321`; `app/(app)/solicitacoes/page.tsx:189,190`; `app/(app)/consolidacao/page.tsx:165,166,361,420`; `calendario/tipos.ts:11`; `estoque/reformas-tela.tsx:95`; `painel/agora.tsx:23`; `shell/sino-notificacoes.tsx:156` |
| Cancelado, recusado, fora da janela | `app/(app)/eventos/[id]/layout.tsx:164`; `app/(app)/solicitacoes/[id]/page.tsx:269,290`; `carga/cadastro-carga.tsx:120`; `carga/calendario-carga.tsx:227`; `carga/carga-evento.tsx:88`; `carga/detalhe-veiculo.tsx:137,207`; `catalogo/peca-ativo-botao.tsx:77`; `eventos/fases.tsx:30`; `solicitacoes/item-resposta.tsx:312,671` |
| Saiu, perdido, redução | `app/(app)/ativacao/itens/[id]/page.tsx:192`; `estoque/pedidos-item.tsx:129`; `estoque/reformas-tela.tsx:286`; `estoque/retornos-tela.tsx:133`; `eventos/acoes-linha-evento.tsx:270,306`; `eventos/diff-os.tsx:21,97`; `eventos/envio-os.tsx:83`; `eventos/linha-tempo-agrupada.tsx:26,43,69`; `eventos/mudancas-pos-ata.tsx:62,139,186`; `eventos/tenda-conferencia.tsx:309`; `painel/eventos-solicitante.tsx:17` |
| Destaque de dado | `carga/calendario-carga.tsx:305` (texto "quente"), `:549` (feriado) |
| Arena | `app/(app)/arena/arena-acoes.tsx:127`; `arena/arena-cabecalho.tsx:43`; `arena/arena-controles-mapa.tsx:221,248,250`; `arena/arena-experiencia.tsx:670`; `arena/arena-marcadores-3d.tsx:138,149` |

### `warning` (151 linhas: 12 em `ui/`, 9 na Arena, 130 em telas)

| Papel | Arquivo:linha |
|---|---|
| Definição em `ui/` | `ui/badge.tsx:26,38,55,95,121`; `ui/button-classes.ts:40`; `ui/combobox.tsx:11`; `ui/layout.tsx:187,188,239`; `ui/linha-do-tempo.tsx:11`; `ui/tabs-nav.tsx:143` |
| Aviso em bloco | `app/(app)/eventos/[id]/os/page.tsx:66`; `app/(app)/perfil/page.tsx:26`; `app/(app)/projetos/[id]/page.tsx:93`; `app/(app)/solicitacoes/nova/page.tsx:130`; `app/(app)/solicitacoes/[id]/page.tsx:285,304`; `app/(auth)/login/login-form.tsx:58,63`; `biblioteca/selecao-em-lote.tsx:231`; `catalogo/peca-ativo-botao.tsx:103`; `eventos/acoes-evento.tsx:165,171,173`; `eventos/banner-reuniao.tsx:116`; `eventos/conferencia-ata.tsx:692,1277`; `eventos/vincular-catalogo.tsx:72`; `solicitacoes/nova-solicitacao-form.tsx:349` |
| Texto de atenção | `carga/cadastro-carga.tsx:89,125`; `estoque/reformas-tela.tsx:193`; `estoque/retornos-tela.tsx:223`; `eventos/acoes-linha-evento.tsx:185,334`; `eventos/conferencia-ata.tsx:94,355,367,557,716,1120`; `eventos/tenda-conferencia.tsx:278`; `projetos/projeto-form.tsx:238`; `solicitacoes/item-resposta.tsx:366`; `solicitacoes/nova/aviso-estoque.tsx:29`; `solicitacoes/nova/escolha-evento.tsx:140`; `solicitacoes/nova/resumo-envio.tsx:107,125` |
| Prazo e próximo passo | `lib/prazo.ts:9,35`; `app/(app)/page.tsx:287,298,335,346,375`; `app/(app)/eventos/(lista)/page.tsx:59,62,69,210,215,216,314,315,333,334`; `app/(app)/eventos/[id]/page.tsx:132`; `app/(app)/notificacoes/page.tsx:38`; `app/(app)/solicitacoes/page.tsx:87`; `app/(app)/calendario/page.tsx:60,160`; `calendario/tipos.ts:12`; `painel/agora.tsx:24`; `painel/eventos-solicitante.tsx:85,92` |
| Selo de condição | `app/(app)/biblioteca/page.tsx:115,116,299,431,502`; `app/(app)/consolidacao/page.tsx:251,276,335,372,404`; `app/(app)/eventos/(lista)/page.tsx:298`; `app/(app)/eventos/[id]/layout.tsx:126`; `app/(app)/eventos/[id]/ata/page.tsx:176`; `app/(app)/projetos/[id]/page.tsx:165,191`; `app/(app)/solicitacoes/[id]/page.tsx:144`; `admin/areas-painel.tsx:114`; `admin/usuarios-painel.tsx:314`; `eventos/conferencia-ata.tsx:538,1017`; `eventos/fila-fora-catalogo.tsx:64,77`; `eventos/quantidade-ata.tsx:9`; `solicitacoes/item-resposta.tsx:784` |
| Ajuste, mudança | `domain/historico.ts:11`; `eventos/conferencia-ata.tsx:282`; `eventos/ata-lista.tsx:111,125,239,326`; `eventos/diff-os.tsx:21`; `eventos/envio-os.tsx:67`; `eventos/linha-tempo-agrupada.tsx:25,46,50,66,82,86`; `eventos/mudancas-pos-ata.tsx:61,186`; `painel/eventos-solicitante.tsx:17` |
| **Categoria, sem ser atenção**: descarga | `carga/calendario-carga.tsx:62,346,438,473,507` |
| Fase em reunião | `eventos/fases.tsx:26` |
| Estoque | `app/(app)/ativacao/itens/[id]/page.tsx:191`; `app/(app)/pendencias/page.tsx:180`; `estoque/estoque-tela.tsx:318-320`; `estoque/pedidos-item.tsx:18,114,115,128`; `estoque/reformas-tela.tsx:92`; `estoque/retornos-tela.tsx:23,24,132`; `solicitacoes/item-resposta.tsx:312,671`; `solicitacoes/nova/aviso-ja-pedido.tsx:52,72` |
| Ação: variante `parcial` | `shell/app-shell.tsx:373,377` (faixa "ver como"); `eventos/vincular-catalogo.tsx:33` |
| Arena | `arena/arena-cabecalho.tsx:42,43`; `arena/arena-controles-mapa.tsx:262`; `arena/painel-conferencia.tsx:35,36,42,46,76`; `arena/painel-ponto.tsx:193` |

Cor como texto em JS, sem erro de compilação se o token mudar de nome: `lib/prazo.ts:8-11`; `app/(app)/page.tsx:176-178`; `app/(app)/solicitacoes/page.tsx:86-91`; `ui/badge.tsx:119-122` e `domain/historico.ts:8-11` (ambos sem consumidor); `ui/dropdown.tsx:26`.

## 3.4 Hex em `.ts`/`.tsx`

### Fora da Arena

| Arquivo:linha | Valor | O que é |
|---|---|---|
| `app/layout.tsx:34` | `#242424` | `themeColor` da aba no celular |
| `components/carga/base.tsx:41` | `#9b2c4f`, `#6b4fa3`, `#4f5b6b`, `#1f7a6e` | `COR_TAG`: ponto das etiquetas de carga, usado em `carga/base.tsx:46`, `carga/calendario-carga.tsx:404`, `carga/form-veiculo.tsx:62`. "kit" ainda é vinho |
| `components/ui/tabs-nav.tsx:62` | `#000` | Máscara de esmaecer, não é cor visível |
| `server/export/resposta-erro.ts:12` | `#f0f1f2`, `#242424`, `#fff`, `#dcdfe0`, `#45484a`, `#b8460f` | Página de erro de download; já acompanha o tema, mas é cópia manual |
| `server/services/catalogo-anexos.test.ts:26` | `#8e2740` | Imagem de teste; irrelevante |

Em comentário, desatualizados: `ui/dialog.tsx:88` (`#faf8f8`), `ui/pills.tsx:18` (`#e9e4e3`).

### Arena 3D (de fora do redesign): 99 linhas

| Arquivo | Linhas | O que é |
|---|---|---|
| `components/arena/plano-2d.tsx` | 28 | Formas do mapa 2D, seleção, medida |
| `components/arena/impressao-arena.tsx` | 24 | Mapa impresso |
| `domain/arena/categorias.ts` | 16 | Cor por categoria e zona; `COR_PERCURSO` |
| `components/arena/cena/materiais.ts` | 10 | Materiais e céu do Three.js |
| `components/arena/minimapa.tsx` | 7 | Minimapa |
| `domain/arena/conferencia.ts` | 5 | Selos de divergência |
| `components/arena/cena/estruturas.ts` | 3 | Testeiras e placas |
| `components/arena/cena/ambiente.ts` | 2 | Placas e área restrita |
| `components/arena/arena-controles-mapa.tsx` | 2 | Fundo de carregamento; legenda |
| `components/arena/arena-experiencia.tsx` | 1 | Fundo do mapa |
| `components/arena/arena-marcadores-3d.tsx` | 1 | Cor do ponto |

Mais 5 linhas com `rgba()`: `arena/cena/materiais.ts:160-162`, `arena/minimapa.tsx:75`, `arena/plano-2d.tsx:317`.

**A Arena ainda carrega a marca antiga em 32 linhas** (`#8e2740`, `#2a1418`, `#a8400f`, `#7a5f00`): vinho no percurso (`domain/arena/categorias.ts:55`), na seleção e na medida (`arena/plano-2d.tsx:317,319,341,349,364`) e na pegada do minimapa (`arena/minimapa.tsx:75`); `#2a1418` na tinta do mapa impresso (`arena/impressao-arena.tsx:104-145,190`) e nas testeiras (`arena/cena/estruturas.ts:92,146,159`). As partes da Arena em token (cerca de 40 linhas de `marca`/`accent`/`danger`/`warning`, inclusive `bg-marca` em `arena-marcadores-3d.tsx:138,165,171`) já mudaram, então a Arena está com as duas paletas ao mesmo tempo.

### Tailwind padrão, fora dos tokens

`text-white` 30 linhas, `bg-white` 8 (fundo de miniatura), `bg-black/[0.04-0.07]` 8 (hover), `border-white/30`, `bg-white/10`, `bg-white/50`, `bg-white/75`, `text-white/70-80`, `outline-white` 3. Na Arena: `text-neutral-500/600` 12, `border-black` 5, `border-white` 5, `border-neutral-300/400` 3.

## 3.5 Marca fixa fora da tela

| Lugar | Arquivo:linha | Estado atual |
|---|---|---|
| Excel, paleta | `server/export/excel.ts:6` | `COR` já com grafite e `marca: FFB8460F`. **`claro: FFFAF8F8` é o `subtle` antigo** (hoje `#f6f7f7`) |
| Excel, faixa de título | `server/export/excel.ts:20,25,28,32` | Grafite, `FFF06A2A`, branco, `FFC9CBCC` |
| Excel, título de seção | `server/export/excel.ts:63` | `COR.marca`; o comentário `:59` ainda diz "vinho" |
| Excel, nome na faixa | `app/api/eventos/[id]/ata/excel/route.ts:65`; `app/api/os/[id]/excel/route.ts:44`; `server/export/os-kit-xlsx.ts:50` | `NORTELOG` |
| Excel, nome na faixa | `app/api/eventos/[id]/ata/excel/route.ts:149`; `app/api/os/[id]/complemento/route.ts:37`; `app/api/os/[id]/excel/route.ts:114,136,167,205` | **`NORTE MKT`**: duas marcas no mesmo arquivo |
| Excel, tabela | `server/export/excel.ts:92` | Tema `TableStyleMedium2` do Excel, azul por padrão |
| Modelo de carga | `server/export/carga-modelo.ts:7,32,43,52,112,113,150` | Grafite e marca; Ida azul, Volta laranja-marrom |
| OS da cenografia e marcenaria | `server/export/cenografia-xlsx.ts:11-15`, usados por `os-estrutura-xlsx.ts`, `os-marcenaria-xlsx.ts` | Azul e amarelo que **imitam a planilha da cenografia**: é formato de trabalho, não marca |
| Autor do arquivo | `wb.creator = "NorteLog"` em 6 rotas e 2 de `server/export` | Já novo |
| Erro de download | `server/export/resposta-erro.ts:12` | Já novo; hex próprios (3.4) |
| E-mails | Não há. `server/services/recuperacao.ts:32` (sem SMTP), `admin/usuarios-painel.tsx:57,164` | Sem o que mudar |
| Impressão OS e ata | `app/impressao/os/[id]/page.tsx:87`; `app/impressao/ata/[id]/page.tsx:64` | Cor por token; **texto "Norte Mkt" e sem logo** |
| Impressão Arena | `arena/impressao-arena.tsx:220` | **"Norte Mkt"**; hex próprios |
| Manifest | Não existe | Só `robots` e `applicationName` em `app/layout.tsx:30-31` |
| `themeColor` | `app/layout.tsx:34` | `#242424` |
| Favicon | `app/icon.svg` | Branco, `#242424`, `#F06A2A` |
| Ícone da Apple | `app/apple-icon.png` | Símbolo novo (conferido na imagem) |
| Logo | `public/logo-nortelog.svg` (`app/global-error.tsx:24`, `app/not-found.tsx:20`); `public/logo-nortelog-branco.svg` (`app/(auth)/layout.tsx:33`, `shell/app-shell.tsx:239`); `public/nortelog-simbolo-branco.svg` (`shell/app-shell.tsx:241`) | Novos |
| Logo sem uso | `public/selo-app.svg` | **Nenhuma referência no código** desde o menu escuro |
| Fontes | `app/layout.tsx:6-25`; `app/fonts/` | Locais (Geist, Roboto Mono, Barlow Condensed) |

Comentários que ainda falam de vinho ou rosa (11): `app/(app)/eventos/(lista)/page.tsx:68`; `calendario/tipos.ts:4`; `eventos/banner-reuniao.tsx:77`; `eventos/conferencia-ata.tsx:203,1266`; `shell/busca-global.tsx:148`; `ui/button-classes.ts:62`; `ui/layout.tsx:166`; `server/export/excel.ts:59`; `arena/cena/materiais.ts:5`; `domain/arena/categorias.ts:47`. `docs/design-system.md` ainda descreve a paleta antiga (6 linhas com "vinho", tabela de tokens, título).

## 3.6 Nome antigo

| Texto | Arquivo:linha | Natureza |
|---|---|---|
| "Planejamento de Eventos" | **Nenhum em `src/`, `e2e/`, `scripts/`** (o commit `12c55a4` trocou) | |
| "Planejamento de Eventos" | `README.md:1`; `docs/design-system.md:1`; `docs/01-analise-e-especificacao.md`; `docs/02-entregaveis.md`; `docs/design-handoff/README.md`; `docs/auditoria/2026-10-28-copy-review.md`; `docs/auditoria/2026-10-28-visual-qa.md`; 7 arquivos em `.claude/agents/` | Documentação |
| "Norte Mkt" visível | `app/impressao/os/[id]/page.tsx:87`; `app/impressao/ata/[id]/page.tsx:64`; `arena/impressao-arena.tsx:220` | Impressão |
| "NORTE MKT" visível | 6 linhas de Excel (3.5) | Excel |
| `nortemkt.com.br` | `app/(auth)/login/login-form.tsx:13-17,75` | Usuários de demonstração e placeholder |
| `norte-planejamento-eventos` | `package.json:2` | Pacote |
| `NorteMkt-PlanejamentoEventos`, `planejamento-eventos.replit.app` | `server/services/arena-entorno.ts:37` | User-Agent para o OpenStreetMap |
| `planejamento-eventos.replit.app` | `app/api/auth/portal/route.test.ts:92,93` | Teste |

**Parecem nome antigo, mas são contrato; trocar quebra sessão ou dados:**

| Identificador | Arquivo:linha | Efeito de mudar |
|---|---|---|
| `npe_sessao`, `npe_ver_como`, `x-npe-caminho` | `server/auth/cookies.ts:3,5,7` | Derruba sessões; o header é lido pelo servidor |
| `npe-ref:` | `server/armazenamento.ts:31` | Referências gravadas de arquivos deixam de ser reconhecidas |
| `PORTAL_APP = "planejamento"` | `server/auth/portal.ts:19` | Quebra a entrada pelo Portal NORTE (token externo) |
| `npe-backup-` | `scripts/backup.ts:31`; `scripts/restaurar.ts:132` | Quebra a restauração |
| `npe-dados` | `server/cache-dados.ts:49` | Invalida cache |
| `npe_menu_recolhido`, `norte:carga:filtros:`, `norte:edicao-solicitacao:` | `shell/app-shell.tsx:169,175`; `carga/calendario-carga.tsx:86`; `solicitacoes/nova-solicitacao-form.tsx:76` | Perde preferência e **cópia local de edição não salva** |

---

# Parte 4. O que o redesign não pode alterar

## 4.1 Mapa de áreas intocáveis

| Área | Tamanho | O que contém |
|---|---|---|
| `domain/` | 56 arq. (22 testes), 6.516 linhas | Regras, transições, permissões, tendas, kits, OS, **e os rótulos de status que a tela mostra** |
| `domain/arena/` | 8 arq. (2 testes), 1.265 linhas | Categorias, conferência, geometria |
| `server/services/` | 84 arq. (36 testes), 14.452 linhas | Casos de uso |
| `server/auth/` | 18 arq. (7 testes), 1.272 linhas | Sessão, cookies, CSP, portal, limite, senha |
| `server/db/` | 2 arq., 1.038 linhas | Schema |
| `server/export/` | 16 arq. (2 testes), 1.906 linhas | Excel e ata. **O tema já alterou cor em 3 arquivos**: `excel.ts`, `carga-modelo.ts`, `resposta-erro.ts` (só cor, pelo diff) |
| `server/jobs`, `armazenamento.ts`, `cache*.ts`, `resposta-arquivo.ts` | 5 arq. | Verificações, arquivos, cache |
| Actions | 15 arq., cerca de 1.600 linhas | `app/(app)/{admin,arena,arena/arenas-actions,ativacao,biblioteca,carga-descarga,catalogo,eventos,notificacoes,pendencias,perfil,projetos,solicitacoes,ver-como}` e `app/(auth)/actions.ts` |
| Action dentro de página | `app/(app)/notificacoes/page.tsx:50,57` | `"use server"` inline: mexer na página exige cuidado |
| `route.ts` | 18 arq. | Anexos, planta, portal, busca, modelo, cron, ata (Excel, lista), histórico CSV, OS (excel, estrutura, kit, marcenaria, complemento, seção, setor) |
| `proxy.ts` | 1 + teste | Sessão otimista, CSP com nonce, caminho no header |
| Fora do pedido, mesma natureza | `lib/{action,schemas,prazo,format,destino,url,busca,filtro-alteracao}.ts`; `instrumentation.ts`; `next.config.ts`; `drizzle/`; `scripts/`; `data/*.json` | |

**Restrições que afetam o visual:**

| Restrição | Onde | Consequência |
|---|---|---|
| CSP sem origem externa: `font-src 'self' data:`, `img-src 'self' data: blob:`, `connect-src 'self'`, `style-src 'self' 'unsafe-inline'` | `server/auth/csp.ts:33-44` | Fonte, imagem ou script de CDN é bloqueado e gera erro de console, **que reprova a varredura E2E** |
| `await connection()` | `app/(auth)/layout.tsx:25`; `app/not-found.tsx:14` | Sem ele a página sai sem nonce e os scripts são bloqueados |
| Consulta ao banco em layout | `app/(auth)/layout.tsx:7-20` | Os números da tela de login vêm daqui |
| Permissão dentro de layout e páginas | `app/(app)/layout.tsx:16-54` (menu por perfil); 91 chamadas de `pode()` em 22 arquivos de UI (`app/(app)/biblioteca/page.tsx` 19, `eventos/[id]/page.tsx` 9, `eventos/[id]/itens/[linhaId]/page.tsx` 8, `eventos/[id]/layout.tsx` 7); 46 páginas e layouts com verificação de sessão | Reorganizar JSX pode perder a condição |
| Nome de área como regra | `app/(app)/layout.tsx:58` (`"Logística"`, `"Cenografia"`) | Dado, não rótulo |

## 4.2 Lógica no cliente, dentro de componentes

**Nenhum destes tem teste unitário.**

| Arquivo:linha | O que faz | Risco se reescrito |
|---|---|---|
| `solicitacoes/nova/utilidades.ts:48` `sincronizarAcompanhantes`, aplicado em `nova-solicitacao-form.tsx:74` | Deriva linhas automáticas (cavaletes, pés) | Duplica ou perde peça no pedido |
| `solicitacoes/nova/utilidades.ts:46-47` | "Vem junto" na observação marca a linha automática | É gravado e relido |
| `solicitacoes/nova/utilidades.ts:31,89` | Agrupa itens; sugere título | Título enviado muda |
| `solicitacoes/nova-solicitacao-form.tsx:76,118-155,159,273,323` | Cópia local da edição; aviso ao sair | Perda de edição |
| `solicitacoes/nova-solicitacao-form.tsx:168,181,214,216,224,331,334,335` | Troca de evento, pendências, envio, passos | Envio bloqueado ou liberado errado |
| `solicitacoes/nova/use-autosave-solicitacao.ts:43,48,57,80,110,134` | Fila única, payload, assinatura, 1.500 ms | Rascunho sobrescrito; contrato com a action |
| `solicitacoes/nova/itens-da-area.tsx:24,29,62-68,95,134`; `lista-itens.tsx:85,96,127,283`; `descricoes-item.tsx:47,70,71`; `busca-catalogo.tsx:77,111,124,166,185` | Listas por área, tendas, descrições, adicionar | Quantidade errada |
| `eventos/conferencia-ata.tsx:794,803-846` | Marcação otimista e fila de gravação; último clique vale; desfaz o que o servidor recusar; aviso ao sair | **Marcação perdida** se a linha remontar |
| `eventos/conferencia-ata.tsx:40,881-890,900,915,928,945,967` | Dependentes, obrigatórias, filtros, seções, contagens de tenda | Progresso e fechamento da ata |
| `eventos/conferencia-ata.tsx:849-873` | Filtros na URL por `replaceState` | Filtro perdido ao voltar |
| `eventos/conferencia-ata.tsx:1062-1082` | Próxima pendente e setas entre `[data-check]` | Teclado para de funcionar |
| `eventos/conferencia-ata.tsx:102-103` + `eventos/painel-reuniao.tsx:20-22` | Evento de página leva ao campo de presentes | Atalho morto |
| `eventos/edicao-os-evento.tsx:20`, chamado em `app/(app)/eventos/[id]/page.tsx:86` | `montarEdicaoOs` liga a linha calculada à da ata pela **mesma ordem e filtro de `calcularOS`**; `confere` protege | Ação na linha errada |
| `eventos/banner-reuniao.tsx:45-46,56-61,71` | Quando a ata pode fechar | Fechamento liberado ou travado |
| `eventos/acoes-evento.tsx:52,57,61,73,82,87,98,109,119,120` | Ações por `acoesDisponiveis`; escolhe a principal | Hierarquia de botões **é regra** |
| `eventos/acoes-linha-evento.tsx:160,258`; `eventos/evento-form.tsx:36,67`; `eventos/dados-reuniao-form.tsx:42-73`; `eventos/observacoes-autosave.tsx:16-44` | Avisos de tenda; reunião derivada da data; autosave (900 ms) | Regressão silenciosa |
| `solicitacoes/item-resposta.tsx:94,169,178-182,218,284,407,440,597-622,725-792` | Foco do item, atalhos, agrupamento, resposta | Resposta no item errado |
| `carga/calendario-carga.tsx:47,86,111,122,152-155,168-193` | Operações, filtros, semana; `QUENTE` por texto | Calendário diverge |
| `carga/form-veiculo.tsx:120,153-167,140` | Normaliza, valida, foca `vc-*` | Erro sem foco |
| `solicitacoes/quadro-tendas.tsx:47,64-80,129` | Locais e itens do quadro; erro por prefixo "Diga" | Destaque errado |
| `estoque/retornos-tela.tsx:173,222`; `estoque/reformas-tela.tsx:269` | Validação por domínio | Botão liberado errado |
| `biblioteca/selecao-em-lote.tsx:31,53,54,83,114,148`; `biblioteca/organizar-projetos-dialog.tsx:73-92` | Seleção; monta `FormData`; devolve foco | Ação em itens errados |
| `projetos/projeto-form.tsx:117,129,241,260,302`; `eventos/linha-ata-form.tsx:55,107` | JSON oculto de itens; campos `tenda_*` | Quebra o contrato com a action |
| `app/(app)/eventos/(lista)/page.tsx:59-69`; `app/(app)/solicitacoes/page.tsx:86-93` | Texto e tom calculados na página | Mudança de sentido |

## 4.3 Estado de formulário e contrato com o servidor

| Contrato | Onde | Regra |
|---|---|---|
| `name=` de campo | 70 linhas em 19 arquivos: `catalogo/peca-form.tsx` 11, `eventos/linha-ata-form.tsx` 10, `projetos/projeto-form.tsx` 8, `app/(app)/arena/nova/form.tsx` 7, `eventos/evento-form.tsx` 7 | É a chave lida pela action |
| Campos ocultos | 27, entre eles `$volta` (`catalogo/peca-form.tsx:49`), `temDisponivel` (`:91`), `grupoEvento`/`grupoNovo` (`projetos/grupo-projeto-field.tsx:51,52`), `deProva` (`catalogo/origem-peca-field.tsx:86`), `justificativa` e `hidden` do `ConfirmDialog` (`ui/confirm-dialog.tsx:70,75`) | Não podem sumir ao reorganizar |
| `Select` com `name` | `ui/select.tsx:79` | Grava em input oculto; o valor vazio usa sentinela (`:12`) |
| `campos.x` | Erro do servidor por nome de campo (`ui/use-action-feedback.ts:18`, formulários) | Precisa continuar exibido |
| `ActionForm` | `ui/action-form.tsx:53-64` | Submete por transição para **não limpar campos no erro**; trocar por `<form action>` quebra |
| Filtros e paginação na URL | `?q`, `?evento`, `?pagina`, `?ordem`, `?dir`, `?aba`, `?fila=1`, `?situacao`, `?area`, `?pessoa`, `?material` | Link compartilhável; testes navegam com `?aba=pecas` |
| Atraso de envio | `ui/busca-url.tsx:51` (280 ms); `shell/busca-global.tsx:88` (120 ms) | Comportamento, não estilo |

## 4.4 Marcadores, seletores e texto como lógica

### `data-*` e classes que o código ou o teste lê

| Marcador | Definido em | Lido em | Sem ele |
|---|---|---|---|
| `data-responsiva` (29) | Tabelas | `globals.css:349` | Tabela ganha `min-width` de 640 px: a varredura acusa estouro no celular |
| `data-linha-link` | `ui/linha-link.tsx:83` | `globals.css:375`; `e2e/varredura.spec.ts:135` | Sem contorno; teste reprova |
| `data-check`, `data-obrigatoria` | `eventos/conferencia-ata.tsx:147,148,658,659`; `eventos/tenda-conferencia.tsx:250,251` | `eventos/conferencia-ata.tsx:1062,1079,1082` | Teclado e "próxima pendente" param |
| `data-linha` | `eventos/conferencia-ata.tsx:512,653`; `eventos/tenda-conferencia.tsx:243` | Nenhuma leitura achada | Conferir antes de remover |
| `data-item-resposta` | `solicitacoes/item-resposta.tsx:615` | `:113,178` | Atalhos e foco |
| `data-notificacao` | `shell/sino-notificacoes.tsx:146` | `:65` | Foco ao abrir |
| `data-selecao-item`, `data-selecao-pagina` | `biblioteca/selecao-em-lote.tsx:342,370` | `:53,54` | Foco após lote |
| `data-retorno-evento` | `estoque/retornos-tela.tsx:84` | `:74`, via `estoque/foco-apos-atualizar.ts:20` | Foco após registrar |
| `data-indice` | `ui/combobox.tsx:225` | `:130` | Rolagem da lista |
| `data-toast` | `ui/toast.tsx:188` | `:164` | Clique no aviso |
| `data-carregando` | `ui/layout.tsx:281` | `:283` | Anúncio duplicado |
| `data-acoes-pagina` | `ui/layout.tsx:65` | `ui/acao-cabecalho.tsx:7` (sem uso) | Hoje sem efeito |
| `data-ponto-id`, `data-chao`, `data-rotulo`, `data-prioridade`, `data-zoom`, `data-oculto` | Arena | `arena/cena/motor.ts:477-536` | Rótulos do mapa |
| `.rodape-dialogo` | `ui/dialog.tsx:94` | `ui/dialog.tsx:73`; `globals.css:342` | Altura e margem do rodapé |
| `.no-print` | Shell, toast, barra | `globals.css` (`@media print`, a partir de `:380`) | Shell na impressão |
| `hidden`, `max-*:hidden` em `td`/`th` | Tabelas | `ui/linha-link.tsx:18`, **lê o nome da classe** | Link da linha cai em célula oculta; `e2e/varredura.spec.ts:143` reprova |
| Margem por regex em `className` | `ui/tabs-nav.tsx:92`; `ui/layout.tsx:125` | Lê `mb-` | Margem dobrada |

### Dependência de estrutura

| Código | Depende de |
|---|---|
| `ui/linha-link.tsx:27-59` | `<td>`/`<th>` **filhos diretos** da linha. Trocar tabela por cartão ou embrulhar célula em componente muda o caminho do link |
| `ui/linha-link.tsx:11-13` | Clique em `a,button,input,select,textarea,label,[role=dialog]` não abre a linha |
| `ui/combobox.tsx:105-117` | `[role=dialog]` com `transform`: a lista é posicionada relativa à janela e mede animação. Trocar a forma de centrar a janela desloca a lista |
| `ui/combobox.tsx:87-97` | Esc capturado na janela antes do Radix; sem isso o diálogo fecha e perde o preenchido |
| `biblioteca/organizar-projetos-dialog.tsx:113`; `biblioteca/selecao-em-lote.tsx:210` | `[&>button[aria-label='Fechar']]`: botão Fechar filho direto do conteúdo |
| `ui/dialog.tsx:43-57` | Devolução do foco a quem abriu |
| `solicitacoes/item-resposta.tsx:179`; `eventos/item-com-locais.tsx:50`; `carga/use-foco-de-volta.ts:16` | `[role=dialog]` existente no DOM |
| `painel/atender-rapido.tsx:28,36`; `biblioteca/selecao-em-lote.tsx:53`; `eventos/conferencia-ata.tsx:1073` | `closest("tr")`, `closest("li")` |
| `estoque/estoque-tela.tsx:99`; `ui/tabs-nav.tsx:40,134`; `catalogo/origem-peca-field.tsx:56`; `carga/calendario-carga.tsx:146,191` | `[role=tab]`, `[role=radio]`, `aria-current`, `button` |
| `shell/app-shell.tsx:184,225,311,383`; `shell/foco.ts:12`; `shell/busca-global.tsx:42` | `a[href]` na gaveta; `inert`; `#conteudo` |
| IDs focados por script | `reuniaoPresentes`, `erro-geral`, `vc-*`, `tenda-local-*`, `descricoes-tenda-*`, `novaPeca`, `lote-grupo-nome`, `lote-categoria`, `evento`, `area-solicitante`, `busca-itens`, `titulo`, `descricoes-*`, `item-*` |
| `globals.css:205-211,217`; `shell/app-shell.tsx` (`h-14`) | Escala de camadas; `--altura-cabecalho` precisa acompanhar a altura real do cabeçalho; `carga/cadastro-carga.tsx:63` usa `top-[72px]` fixo |
| `globals.css:349-353` | `main :has(> table)` faz rolar qualquer pai direto de tabela |

**Atalhos de teclado:** Ctrl+K `shell/busca-global.tsx:66`; Ctrl+Z `ui/toast.tsx:142`; atender/parcial/não atender `solicitacoes/item-resposta.tsx:182`; setas na conferência `eventos/conferencia-ata.tsx:1080`; setas e Home/End em abas `ui/tabs-nav.tsx:130`, `estoque/estoque-tela.tsx:102`.

### Texto usado como lógica

| Arquivo:linha | Texto | O que decide |
|---|---|---|
| `solicitacoes/nova/utilidades.ts:46`; `eventos/conferencia-ata.tsx:601` | `Vem junto` | Identifica linha automática; é gravado |
| `solicitacoes/nova/lista-itens.tsx:289` | `vem junto · ` | Monta a legenda |
| `eventos/conferencia-ata.tsx:613` | Separador ` · ` | Divide ajustes vindos do servidor |
| `solicitacoes/quadro-tendas.tsx:129` | Erro começa com `Diga` | Qual campo destacar |
| `eventos/linha-tempo-agrupada.tsx:147` | Título com `:` | Tipo do registro |
| `eventos/tendas-do-evento.tsx:128` | `incluída por ` | Limpa o nome |
| `calendario/tipos.ts:24` | Prefixos de título | Tira o tipo do título |
| `solicitacoes/item-resposta.tsx:218` | `OBS_ENTROU_NA_OS`, `OBS_REGISTRADO_NA_ATA` | Esconde observação automática |
| `carga/calendario-carga.tsx:47,305` | `ULTIMO`, `COMECA`, `SALDO`… | Destaque de dado |
| `app/(app)/notificacoes/page.tsx:37,38` | Regex no tipo (`VENCID`, `PRAZO`) | Ícone e cor |

Rótulos em `domain/`, exibidos nas telas e usados por testes: `domain/evento.ts:34-74,129`; `domain/solicitacao.ts:8,17,27`; `domain/permissions.ts:128`; `domain/os.ts:103`; `domain/grupos-material.ts:9`; `domain/carga-descarga.ts:16,20`.

## 4.5 Rótulos e seletores dos testes E2E

Projetos `desktop` (1280×800) e `celular` (375×812), com job próprio em `.github/workflows/ci.yml:75`. Mudar qualquer linha desta tabela exige ajustar o teste.

**`getByLabel` sem `exact` casa por trecho:** um rótulo novo que contenha "Nome", "Cliente" ou "E-mail" na mesma tela gera ambiguidade e reprova, mesmo sem mudar o rótulo testado.

| Seletor | Teste | Origem |
|---|---|---|
| Rótulo `E-mail`; `Senha` (exato); botão `Entrar` (exato) | `e2e/apoio.ts:37-39` | `app/(auth)/login/login-form.tsx:74,77,82` |
| Rótulos `Nome`, `Cliente`, `Data do evento`, `Reunião de OS`, `Alterações até`; botão `Criar evento` | `e2e/apoio.ts:78-83` | `eventos/evento-form.tsx:42,46,57,72,91,100` |
| Título nível 1 = nome do evento ou da solicitação | `e2e/apoio.ts:85,138`; `e2e/logistica.spec.ts:37`; `e2e/solicitante.spec.ts:43` | `ui/layout.tsx:56` (único `h1`) |
| Link da linha `Abrir EVT-… — nome` etc., com **Enter** | `e2e/apoio.ts:53-55` | `app/(app)/eventos/(lista)/page.tsx:290`; `app/(app)/solicitacoes/page.tsx:266`; `ui/linha-link.tsx:79-93` |
| Botão `Fechar aviso` | `e2e/apoio.ts:94` | `ui/toast.tsx:204` |
| Botão `/^Enviar( solicitação)?$/`, visível | `e2e/apoio.ts:103` | `solicitacoes/nova/resumo-envio.tsx:205,287` |
| Título `/^(Adicione o que precisa\|Outros itens)$/` | `e2e/apoio.ts:115`; `e2e/acessibilidade.spec.ts:83` | `solicitacoes/nova/busca-catalogo.tsx:211` |
| `searchbox` `Buscar projeto padrão` | `e2e/apoio.ts:118`; `e2e/solicitante.spec.ts:24` | `solicitacoes/nova/busca-catalogo.tsx:270-271` |
| `spinbutton` `Quantidade de {projeto}` (exato) | `e2e/apoio.ts:120`; `e2e/solicitante.spec.ts:25` | `solicitacoes/nova/busca-catalogo.tsx:397`; `ui/stepper.tsx:73` |
| `listitem` contendo o campo + botão `Aumentar` | `e2e/solicitante.spec.ts:26` | `busca-catalogo.tsx:332` (precisa seguir `<li>`); `ui/stepper.tsx:88` |
| Botão `Adicionar {projeto}` (exato) | `e2e/apoio.ts:123`; `e2e/solicitante.spec.ts:28` | `solicitacoes/nova/busca-catalogo.tsx:403` |
| `textbox` `Descrição de {x}`, `Descrição da unidade {n} de {x}` | `e2e/apoio.ts:126,129`; `e2e/solicitante.spec.ts:33` | `solicitacoes/nova/descricoes-item.tsx:122` |
| `0 de 2 descritas`, `2 de 2 descritas` | `e2e/solicitante.spec.ts:31,35` | `solicitacoes/nova/descricoes-item.tsx:95` |
| `textbox` `/^Título/` | `e2e/apoio.ts:134`; `e2e/solicitante.spec.ts:38` | `solicitacoes/nova/resumo-envio.tsx:141` |
| `Pronto para enviar`, visível | `e2e/apoio.ts:135`; `e2e/solicitante.spec.ts:39` | `solicitacoes/nova/resumo-envio.tsx:193,273` |
| `combobox` `/Evento/` + `option` | `e2e/solicitante.spec.ts:17-20` | `solicitacoes/nova/escolha-evento.tsx:86-88`; `ui/combobox.tsx:154,222`. **Gatilho de `Select` também é `combobox`** |
| `pré-reunião` (exato) | `e2e/solicitante.spec.ts:21` | `solicitacoes/nova/escolha-evento.tsx:114` |
| `Na ata` (exato), `group` `/^{projeto}/` | `e2e/solicitante.spec.ts:45-48` | `ui/badge.tsx:90,152`; `solicitacoes/item-resposta.tsx:451-453,614-619` |
| `/^Alteração pós-ata ·/` | `e2e/logistica.spec.ts:28` | `app/(app)/solicitacoes/[id]/page.tsx:217` |
| Botão `/^Atender 1/` e `/^Atender/`; `Atendido` | `e2e/logistica.spec.ts:41-43` | `solicitacoes/item-resposta.tsx:730`; `domain/solicitacao.ts:27` |
| `/^v\d+$/`, `/^v1$/` | `e2e/logistica.spec.ts:7`; `e2e/conferencia.spec.ts:71` | `app/(app)/eventos/[id]/os/page.tsx:201`; `eventos/versoes-os.tsx:47`. **Texto precisa ser só `v1`** |
| Título `Conferência da ata` nível 1; link com nome do evento | `e2e/conferencia.spec.ts:30,31` | `app/(app)/conferencia/[id]/page.tsx:56-63` |
| Botão `Iniciar reunião`, na página e no diálogo | `e2e/conferencia.spec.ts:34,35` | `eventos/banner-reuniao.tsx:89,107` |
| `Reunião de OS em andamento` | `e2e/conferencia.spec.ts:37` | `eventos/banner-reuniao.tsx:49` |
| `region` `Conferência da ata`; `region` `Andamento da reunião` | `e2e/conferencia.spec.ts:39,67`; `e2e/acessibilidade.spec.ts:58` | `eventos/conferencia-ata.tsx:1091`; `eventos/banner-reuniao.tsx:66` |
| `progressbar` `Linhas conferidas` com `aria-valuemax/now` | `e2e/conferencia.spec.ts:40-42` | `eventos/conferencia-ata.tsx:1153` |
| `checkbox` `{linha}: marcar como conferido` / `: conferido, clique para desfazer` | `e2e/conferencia.spec.ts:46-48` | `eventos/conferencia-ata.tsx:130,146,150` |
| Botão `Conferir as 2 restantes`; diálogo `Marcar 2 como conferidas` | `e2e/conferencia.spec.ts:52,53` | `eventos/conferencia-ata.tsx:1143,1344` |
| `complementary` `Dados da reunião`; `textbox` `/Pessoas presentes/`, `Público esperado`, `Caminhão sai`; `Salvo` | `e2e/conferencia.spec.ts:57-63` | `eventos/painel-reuniao.tsx:33` (precisa seguir `<aside>`); `eventos/dados-reuniao-form.tsx:88,92,95,107` |
| Botão `Fechar ata e gerar OS` | `e2e/conferencia.spec.ts:67,68` | `eventos/banner-reuniao.tsx:72,107` |
| Link `/^Excel completo/`, `/^OS de estrutura/`, `/^Excel da ata/` | `e2e/exportacoes.spec.ts:25-29` | `app/(app)/eventos/[id]/os/page.tsx:42,43`; `app/(app)/eventos/[id]/ata/page.tsx:273`; `eventos/exportacoes.tsx`: **o rótulo precisa ser o começo do nome** |

### Regras gerais dos testes que limitam o redesign

| Teste | Regra | Efeito |
|---|---|---|
| `e2e/acessibilidade.spec.ts:13-14,51` | Axe WCAG 2.x A/AA, inclusive 2.2; reprova em `serious` e `critical` | **Contraste e alvo de toque reprovam**, nas telas Painel, Eventos, Solicitações, Nova solicitação, Evento e Conferência, nas duas larguras |
| `e2e/varredura.spec.ts:127-128` | Primeiro `h1`, sem "Não foi possível carregar esta página" nem "…montar a versão para impressão" | `app/(app)/error.tsx:21`; `app/impressao/error.tsx:16` |
| `e2e/varredura.spec.ts:112,141-142` | Sem erro de JS nem de console | CSP (4.1) e hidratação |
| `e2e/varredura.spec.ts:132-133,144` | No celular, largura do documento não passa de 375 px | Tabela e layout |
| `e2e/varredura.spec.ts:135,143` | Link da linha não pode ficar em célula escondida | `ui/linha-link.tsx` |
| `e2e/varredura.spec.ts:72-85` | Acha rotas pelos `href` da lista: `/eventos/{uuid}`, `/projetos/{uuid}`, `/catalogo/{uuid}/editar`, `/arena/{slug}`, `/eventos/{uuid}/itens/{uuid}` | Trocar link por botão esconde a tela da varredura |
| `e2e/acessibilidade.spec.ts:26` | Existe `main` | `shell/app-shell.tsx:383` |

---

# O que não foi verificado

- **Nada foi renderizado:** hover, foco, contraste real sobre cada fundo, larguras no celular e os itens marcados "ver na tela" vêm só do código. Contraste e ΔE foram calculados pelos hex dos tokens, sem transparência nem `brightness`.
- **Testes não rodaram:** não se sabe se o E2E e o axe passam com o tema atual.
- **Contagens por regex:** não veem classes montadas dinamicamente nem tom ou variante em variável. Os papéis em 3.3 e os tipos de janela em 2.1 e 2.2 são classificação minha pela linha, não conferência de cada tela.
- **Arena:** só cor e janelas; a lógica de `arena/cena/*` não foi lida a fundo.
- **Exportações:** os arquivos Excel não foram abertos; o tema `TableStyleMedium2` é azul pelo padrão do Excel, não conferido na planilha.
- **`docs/design-handoff/` e `attached_assets/`:** não comparados.
