# Design system — Planejamento de Eventos

Base visual e de interação do app. Os tokens vivem em `src/app/globals.css` (bloco `@theme`); os
componentes, em `src/components/ui/*` e `src/components/shell/*`. Este documento diz **o que usar e
quando**. Regra geral: se um valor não tem token, ou ele não deveria existir, ou o token está faltando —
proponha o token aqui antes de escrever `text-[13px]` ou `#abc123` numa página.

Referência de maturidade: produtos SaaS sóbrios (densidade de informação alta, pouca cor, estado
sempre visível). Não copiamos nenhum.

---

## 1. Tokens

### 1.1 Cor

| Papel | Token (classe) | Valor | Uso |
|---|---|---|---|
| Fundo da página | `page` | `#f1efee` | fundo atrás dos cartões |
| Superfície | `surface` | `#ffffff` | cartões, modais, campos |
| Superfície sutil | `subtle` | `#faf8f8` | cabeçalho de tabela, rodapé de cartão/modal, hover de linha |
| Selecionado | `selected` | `#faf6f6` | linha escolhida, notificação não lida |
| Trilho de controle | `control` | `#e9e4e3` | trilho das pílulas, chip de contador neutro |
| Tinta 1 | `ink` | `#2a1418` | texto principal, títulos |
| Tinta 2 | `ink-2` | `#4f4849` | texto de corpo secundário, rótulos de campo |
| Tinta 3 | `ink-3` | `#6d6566` | ícones, abas inativas, texto de apoio |
| Apoio | `muted` / `meta` | `#6b6263` / `#6f6366` | descrição, metadado, placeholder |
| Linhas | `line`, `line-strong`, `line-soft`, `line-row`, `line-faint` | | divisórias (da mais forte à mais fraca) |
| Borda de campo | `line-control` | `#958b8d` | borda de input/select (3:1, WCAG 1.4.11) |
| **Marca** | `accent` / `accent-hover` | `#8e2740` / `#6d1d31` | **só** ação principal, seleção (aba/página atual, item escolhido) e anel de foco |
| Marca suave | `accent-bg`, `accent-border`, `accent-light` | | fundo de seleção; `accent-light` é a marca sobre fundo escuro |
| Sucesso | `success`, `success-bg`, `success-border` | `#136c41` | concluído, atendido, conferido |
| Atenção | `warning`, `warning-bg`, `warning-border` | `#7a5f00` | aguardando, em análise, parcial, ajustado |
| Erro | `danger`, `danger-bg`, `danger-border`, `danger-input` | `#a8400f` | erro, atraso, recusa, ação destrutiva (laranja-queimado: o vinho da marca é vizinho do vermelho) |
| Informação | `info`, `info-bg`, `info-border` | `#2f6680` | em andamento, enviado, informativo |
| Neutro | `neutral-bg` | `#f0eceb` | selo neutro, rascunho, cancelado |
| Escuro | `dark`, `dark-2..4`, `on-dark-2..4` | | banner escuro, toast, cartão "como funciona" |
| Véu | `scrim`, `scrim-forte` | | atrás de modal/gaveta/busca; lightbox |

**Regra da marca:** o vinho não indica estado. "Enviada", "Aberto", "Na ata" usam `info`; o vinho fica
para "é aqui que você age" e "é isto que está escolhido".

### 1.2 Tipografia — 6 papéis (+ métrica)

Fonte: Geist (sans) para tudo; Roboto Mono **só para códigos** (SOL-0001, EVT-0002, código de peça,
versão v3) e teclas (`Kbd`). Nada abaixo de 11.5 px. Sem degraus de meio pixel.

| Papel | Classe | Tamanho / altura de linha | Uso |
|---|---|---|---|
| Legenda | `text-rotulo` | 12 / 16 | selo, chip, hora, legenda de gráfico, rodapé do menu |
| — variante caixa-alta | `text-micro` | 11.5 / 16 | **só** em CAIXA-ALTA espaçada: cabeçalho de tabela, sobretítulo de grupo |
| Pequeno | `text-pequeno` | 13 / 18 | rótulo de campo, dica, descrição, metadado, pílula |
| Corpo | `text-corpo` | 14 / 20 | texto padrão, células, controles, abas, itens de menu |
| Destaque | `text-secao` / `text-destaque` | 15 / 22 | título de cartão (`Section`), ênfase pontual |
| Título | `text-titulo` | 18 / 24 | título de diálogo e de **toda** tela de detalhe de um registro — evento, solicitação, projeto, peça, item da Ativação, arena (`PageHeader tamanho="sm"`; decisão de 30/10, § 9) |
| Página | `text-pagina` | 24 / 30 | h1 (`PageHeader`) das telas de módulo/lista (Painel, Eventos, Solicitações, Biblioteca…) — um por tela |
| Métrica | `text-metrica` | 28 / 32 | número grande de painel (`Metric`) |

Antes → depois (nomes mantidos): micro 10.5→11.5 · rotulo 11.5→12 · pequeno 12.5→13 · corpo 13.5→14 ·
secao 14→15 · destaque 14.5→15 · titulo 18 · pagina 24 · metrica 26→28 · corpo do `<body>` 14.5→14.
Cada `text-*` já traz a altura de linha; `leading-*` só quando houver motivo (ex.: bloco de texto longo `leading-relaxed`).

Pesos: 400 texto, 500 (`font-medium`) rótulos ativos e valores, 600 (`font-semibold`) títulos. Títulos
grandes com `tracking-[-0.02em]`.

### 1.3 Números e datas

- Utilitário **`numero`** = algarismos tabulares na fonte normal. Use em toda coluna/valor numérico,
  data, hora, contador e total: `<td className="numero text-right">`.
- Componentes em `ui/numero.tsx`: `<Numero valor={1234} unidade="un." />` (formata pt-BR),
  `<Data valor="2026-09-20" />` / `<Data valor={date} hora />` (em `<time>`), `<Codigo>SOL-0001</Codigo>` (mono).
- `ChipMono` escolhe sozinho: número (`12`, `× 4`, `+3`) sai em fonte normal tabular; código/versão (`v3`) em mono.
- **Não** use `font-mono` para quantidades, datas ou dinheiro.

### 1.4 Espaço, raio, sombra, camadas, movimento

- Espaço: escala do Tailwind (4 px). Recorrentes: `px-cartao` (18 px, recuo lateral de cartão/tabela),
  `top-topo-fixo` (76 px, painel fixo sob o cabeçalho). Entre blocos de página: `mb-4`/`mb-5`.
- Raio: `rounded-chip` 5 (selo, chip) · `rounded-controle` 8 (botão, campo, pílula, item de menu) ·
  `rounded-cartao` 10 (cartão, popover, toast) · `rounded-modal` 12 (modal, busca).
- Sombra: `shadow-pill` (pílula ativa) · `shadow-popover` (menu, lista, painel do sino) · `shadow-modal` · `shadow-toast`.
  Cartões não têm sombra — têm borda `line`.
- Camadas (utilitário z-index com as variáveis --z-header, --z-tela-cheia, --z-popover, --z-busca, --z-dialogo, --z-toast, --z-progresso): header 20 · tela-cheia 50 · popover 55 · busca 60 · diálogo 65 · toast 70 · progresso 75.
- Movimento: **120–180 ms**. Cor/hover 150 ms (padrão de `transition-*`, curva `cubic-bezier(.2,0,0,1)`);
  entrada de painel `animate-fade-up-rapido` (140 ms) e de página `animate-fade-up` (180 ms); clique em botão
  `scale(.98)`. Com "reduzir movimento" (`prefers-reduced-motion`), animações e transições são zeradas
  globalmente; spinner e barra de progresso ficam estáticos.

---

## 2. Ícones

`<Icone nome="…" tamanho={16 | 20} title?>` em `ui/icons.tsx`. Grade 24, traço único 1.75, pontas
redondas, cor = `currentColor`. **16** em botões, campos, linhas, menus; **20** no menu lateral e no
cabeçalho. Decorativo por padrão (`aria-hidden`); passe `title` só quando o ícone for a única
informação (e não estiver num botão — botão só com ícone usa `IconButton label`).

Nomes: `busca, seta, seta-esquerda, seta-cima, seta-baixo, chevron-direita|esquerda|baixo|cima, fechar,
mais, menos, lapis, lixeira, sino, calendario, casa, eventos, solicitacoes, arena, grafico, livro,
usuario, escudo, sair, imprimir, download, check, check-circulo, alerta, erro, info, relogio,
local, caixa, camadas, link-externo, menu, recolher, expandir, reticencias`; do mapa da arena:
`enquadrar, norte, tela-cheia, sair-tela-cheia, perspectiva, lista, teclado, vista-superior, regua`
(`components/arena/icones.tsx` só repassa estes nomes: 20 px nos controles flutuantes do mapa, 16 nos demais).
`<Spinner tamanho={12|14|16|20} />` para carregamento. Os componentes antigos ainda em uso
(`IconeLapis`, `IconeFechar`, `IconeMais`, `IconeMenos`) continuam funcionando e desenham do mesmo
conjunto; prefira `<Icone>` em código novo. Não desenhe `<svg>` à mão em página: acrescente o desenho aqui.

---

## 3. Botões

| Variante | Quando | Aparência |
|---|---|---|
| `primary` | **a** ação da tela/diálogo (Salvar, Enviar, Nova solicitação). No máximo **uma** por área visível. | vinho, texto branco; hover vinho escuro |
| `secondary` | ações de apoio (Cancelar, Exportar, Responder em sequência) | branco com contorno |
| `ghost` | ações terciárias, barras de ferramentas, "mais opções" | sem fundo; hover cinza |
| `link` | ação dentro de uma frase ou rodapé ("Limpar", "Ver todas") | texto vinho, sublinha no hover (o `.link` de texto fica sempre sublinhado, § 7) |
| `dark` | neutro de peso, para usos específicos (o antigo primary escuro) — ex.: ação forte ao lado de um primary | escuro, texto branco |
| `danger` | confirmar ação destrutiva (dentro do diálogo) | laranja-queimado cheio |
| `dangerOutline` | gatilho de ação destrutiva (abre a confirmação) | contorno laranja |
| `atender` / `parcial` / `recusar` | resposta de item (semânticas) | fundo suave da cor |
| `onDark` / `pink` / `bloqueado` | sobre superfície escura (banner, cartão escuro) | foco em rosa |

Tamanhos: `xs` 27 · `sm` 30 · `md` 34 · `lg` 36 · `xl` 38 · `full` 42 (px, desktop). **Abaixo de `md`
todo botão tem no mínimo 40 px** (`max-md:min-h-10`), exceto `link`.

Estados (já embutidos em `buttonClasses`): hover, active (`scale(.98)` e tom mais escuro), foco
visível (anel 2 px da marca com 2 px de folga; rosa nas variantes escuras), `disabled` (opacidade 50 %,
cursor proibido), `loading` (spinner centralizado, **largura não muda**, `aria-busy`).
Com `disabled` + `motivoDesabilitado="…"`, o botão fica `aria-disabled` (continua focável), mostra o
motivo no `title` e o leitor de tela anuncia o motivo; um clique (ou toque, no celular, onde não há `title`)
mostra o motivo num toast. Prefira isso a um botão desabilitado mudo.

`IconButton`/`IconLink` (redondo, só ícone, `label` obrigatório): 24/28 px no desktop, 40 px no celular.
O `label` começa pelo texto que a pessoa vê (comando de voz, WCAG 2.5.3): botão com texto visível **não** leva
`aria-label` diferente dele ("Editar todos os locais" não vira "Editar todas as tendas de…"); para dar contexto,
acrescente depois do texto, em `sr-only`.

- **Abre diálogo:** `<Button abreDialogo>` / `<IconButton abreDialogo>` põe `aria-haspopup="dialog"` — o leitor de tela
  avisa antes do clique. Use em todo botão que abre um diálogo por estado (`DialogTrigger` já faz isso sozinho).
- **Criar:** o botão de criação ("Novo evento", "Nova solicitação", "Novo item"…) é `primary`, `size="lg"` no
  cabeçalho e leva `<Icone nome="mais" />` antes do texto — em todas as telas (decisão de 30/10, § 9).
- **`link` no celular:** ganha área de toque de 40 px por um pseudo-elemento, sem mudar o desenho. O mesmo vale para
  o `.link` solto (fora de frase, lista ou célula).

---

## 4. Selos

| Componente | Significa | Regra |
|---|---|---|
| `Badge` | **estado** da coisa (Enviada, Em análise, Atendido) | **um por linha**; fundo suave + borda sutil; cor semântica |
| `Tag` | **tipo/categoria/observação** (pré-reunião, fora do catálogo, depois da ata) | texto discreto com contorno `line`, **sem fundo colorido**; o tom só tinge a letra |
| `ChipMono` | **contador** (12, × 4) ou **código/versão** (v3) | contador em fonte normal tabular; código em mono |
| `SolicitacaoStatusTexto` | **estado** numa lista longa em que a coluna inteira é o estado (`/solicitacoes`) | ponto colorido + texto `ink-2`, sem fundo: 25 selos cheios em coluna viram uma faixa de cor |

**Densidade das listas (referência: lista de itens do evento, `/solicitacoes`, fila do painel):** uma linha = uma
leitura; uma informação por coluna (nada de "Item · local" ou "por fulano" embaixo do nome); ações em ícone
(`IconButton`/`IconLink` com `label` = verbo + objeto) sempre na mesma coluna, com lugar reservado quando a linha
não tem a ação; avisos em texto discreto, não em selo; origem, tipo e autor no `title` e na página do registro.
Coluna que some na lista estreita desce para a 2ª linha do nome (`@container` + `@lg:`/`@2xl:`). Seção vazia: uma
frase só (sem subtítulo repetindo o vazio); quadro lateral não repete o cabeçalho.

Tamanho mínimo 12 px (`text-rotulo`). Tons: `success` concluído · `warning` atenção/aguardando ·
`danger` erro/atraso/recusa · `info` andamento/informativo · `neutral`/`muted`/`rascunho` neutros ·
`accent` só para seleção ou contagem do que pede ação do usuário (ex.: contador do menu) · `dark` raro.
Mapeamentos atuais: evento Aberto → info; solicitação Enviada → info; "Na ata" → info; perfil Logística → info.

---

## 5. Padrões de tela

### 5.1 Lista (referência: `/solicitacoes`, `/eventos`)
1. `PageHeader title divisor actions` — ação principal (`primary`, `size="lg"`, com "+" se cria) à direita; secundárias
   antes dela. **Nunca** na barra de filtros. Tela com abas em que só uma aba tem a ação (Ativação › Estoque,
   Carga › Calendário): a aba a manda para o cabeçalho com `<AcaoNoCabecalho>` (`ui/acao-cabecalho.tsx`). No celular
   as ações ficam à esquerda, embaixo do título.
2. Barra de filtros numa linha: `BuscaUrl` (com ícone e spinner), `FiltroEvento`/`Pills`; alertas curtos à direita (`sm:ml-auto`).
   No celular, `grid grid-cols-2 sm:flex …`: busca, evento e avisos com `col-span-2`; listas curtas (`FiltroSelectUrl`)
   aos pares, em vez de um campo de 40 px por linha antes da lista.
3. Cartão (`rounded-cartao border border-line bg-surface overflow-hidden`) com `TabsNav` no topo (`className="mb-0 px-2 pt-1"`), contagem em cada aba.
4. Tabela: `CaptionOculta`, `ThOrdenavel`/`Th`, linhas `LinhaLink` (linha inteira clicável), números com `numero` e alinhados à direita, código com `Codigo`.
   Tabela larga que rola de lado fica num `TabelaRolavel rotulo="…"` (região com nome, entra no Tab).
5. `Paginacao` no rodapé. Vazio: `EmptyState` dentro do cartão (título + 1 frase + ação) — nunca solto no fundo da página.

**Navegação de seção × filtro.** Trocar de **seção** da página (Usuários/Áreas/Configurações; Estoque/Retornos/Reformas;
abas do evento) é `TabsNav` logo abaixo do cabeçalho. `Pills` é só **filtro** ou modo de ver (período, leitura, tipo).
Recorte da lista (Ativos/Inativos, situação) fica nas abas do topo do cartão.

**Busca ou filtro sem resultado (uma regra para todas as listas).** As abas mostram a contagem **com** a busca e os
filtros aplicados (ou nenhuma contagem) — nunca o total sem filtro ao lado de "Nada encontrado". Barra de filtros e
abas continuam na tela. O vazio é `EmptyState icone="busca"` dentro do cartão: título `Nada encontrado para “termo”`
(ou "Nada com estes filtros"), uma frase com a saída e a ação "Limpar busca"/"Limpar filtros". Painel lateral que
depende de um item escolhido some, e a lista ocupa a largura.

### 5.2 Formulário
- `Field label htmlFor hint error obrigatorio` + `Input`/`Textarea`/`Select`/`ComboBox`. Campos 34 px (40 no celular).
- Rótulo acima (13 px), dica abaixo (13 px `muted`), erro abaixo com ícone (liga `aria-describedby`/`aria-invalid`).
  Com erro, a dica continua (erro primeiro); `Stepper`, `ComboBox` e `Select` recebem o mesmo `aria-*` do `Field`.
- Foco de campo: borda + anel de 1 px da marca (`FOCO_CAMPO` em `ui/field.tsx`); nunca só a troca de cor da borda.
- Erro geral: `FormError` no fim, antes das ações. Ações no fim: `SubmitButton` (primary) e depois o secundário.
- Uma coluna no celular; duas no máximo no desktop para campos curtos.

### 5.3 Diálogo
- `DialogContent title description` (460 px padrão; `size` sm/md/lg). Botão fechar (X) no canto, último no Tab.
- `DialogFooter`: escreva a **ação principal primeiro** no código — ela aparece **à direita**; secundárias à esquerda dela. No celular empilham (principal em cima).
- Botões do rodapé: **36 px** em todos os diálogos (o `DialogFooter` fixa a altura; no celular continuam com 40).
- Destrutivo: `ConfirmDialog danger` (botão `danger`) com justificativa quando fica registrado. Abre com o foco em
  "Cancelar". Motivo não obrigatório (`reasonRequired={false}`) aparece como "(opcional)". O toast de sucesso sai
  quando a action responde, mesmo que a linha que abriu o diálogo suma da lista.
- Campo de escolha (`ComboBox`) dentro do diálogo: Esc fecha só a lista; o segundo Esc fecha o diálogo.

### 5.4 Estados
- **Vazio:** `EmptyState` — título diz o que não há; uma frase diz por quê/o que fazer; ação se houver.
  `compact` em cartões pequenos/painéis; `icone` opcional no tamanho normal (`busca` para busca sem resultado).
- **Carregando (página):** `loading.tsx` com `Skeleton` dentro de `<Carregando texto="Carregando …">` (avisa o leitor
  de tela por `role="status"`; **não** use `aria-label` num `div` sem papel); dentro de cartão, `SkeletonLista linhas={n}`
  (já anuncia, e fica calado dentro de outro `Carregando`). O esqueleto tem a forma da tela que chega (mesmas colunas).
  Skeleton com a altura do texto que substitui (h-3.5 corpo, h-3 pequeno, h-6 título).
- **Carregando (navegação):** automático — ver § 6.
- **Aviso:** `Aviso tom="info|warning|danger|success|neutro" titulo acoes` — ícone por tom; `Notice` é o apelido antigo.
- **Toast:** `toastSucesso(msg)` (check), `toast(msg)` (info), `toastErro(msg)` (erro, região `role=alert` própria);
  opções `desfazer` (com Ctrl+Z, 8 s) ou `acao: { rotulo, onClick }` (15 s). Pausa no hover/foco; até 3 empilhados.
  Texto curto, sem ponto final (§ 10).

---

## 6. Carregamento na navegação

- Barra fina (2 px, vinho) no topo do shell sempre que uma navegação passa de 120 ms: clique em link interno,
  aba, pílula, página, ordenação, linha clicável, busca e filtro na URL (`shell/barra-navegacao.tsx`).
- Indicador local no item clicado (via `useLinkStatus` do `next/link`): aba pulsa o sublinhado; pílula,
  página e ordenação mostram spinner por cima; item do menu troca o ícone por spinner; linha esmaece.
- Leitor de tela ouve "Carregando…" (região `aria-live` dos toasts) se passar de 600 ms.
- Para um link novo numa página: ponha `<IndicadorLink />` (ou `lugar="sobre"`/`"sublinhado"`) dentro do `<Link>`;
  para uma navegação por `router.push` numa transição, chame `useSinalizarNavegacao(pendente)`.

---

## 7. Acessibilidade

- **Contraste AA** (tabela abaixo). Texto ≥ 4.5:1; componentes e anel de foco ≥ 3:1.
- **Alvo de toque 40 px** abaixo de `md` (WCAG 2.5.8 pede 24; adotamos 40): botões, `IconButton`,
  pílulas, abas, paginação, stepper, itens de menu/select/combobox, campos. Desktop mantém a densidade.
- **Foco visível** em todo interativo: anel 2 px `accent` com folga 2 px (global, camada base); anel
  **interno** onde o contêiner rola ou recorta (abas, pílulas, paginação, itens de lista). Nunca `outline-none` sem substituto.
- Abas com rolagem horizontal esmaecem a borda do lado com mais abas, mostram uma seta nessa borda e centralizam a aba
  ativa. `TabsControladas` (role=tab) é uma parada de Tab só; setas, Home e End trocam de aba.
- **Links de texto** (`.link`) ficam sempre sublinhados (traço da marca a 40 %, cheio no hover): só a cor não separa o link
  do texto em volta (WCAG 1.4.1).
- **Tabela que rola de lado:** `TabelaRolavel rotulo="…"` — região com nome que entra no Tab, para rolar pelo teclado.
- **Superfície escura** (`BannerEscuro`, `Section tom="dark"`): todo foco dentro dela usa o anel rosa (`accent-light`);
  o vinho sobre o escuro dá 1,87:1.
- **Texto e sinais em cinza claro:** `line-*` é só para linhas e bordas. "—" de valor vazio e texto esmaecido usam
  `text-meta` (5,75:1), nunca `text-line-strong` (1,5:1) nem `opacity-60` sobre texto. Estado (inativo, escolhido, prazo)
  nunca só pela cor: junte texto, ícone ou forma.
- **Regiões vivas:** os toasts têm duas regiões fixas (`status` e `alert`); contagens que mudam no cliente (lista filtrada,
  opções do `ComboBox`) são anunciadas por uma região `aria-live` que já existia antes do texto.
- **Gatilho de diálogo:** `abreDialogo` (§ 3).
- Tabela com versão de celular própria (colunas que somem ou descem para a célula do nome) marca `data-responsiva`;
  sem isso, abaixo de 1024 px toda tabela ganha `min-width: 640px` e rola de lado (`globals.css`).
- Lista ao lado de um painel (conferência com os dados da reunião) escolhe as colunas pela **largura da lista**
  (`@container` + `@3xl:`), não da tela: a 1280 px o painel deixa a lista com ~600 px.
- `Aviso` com `acoes`: no celular as ações descem para baixo do texto (o componente já faz).
- Ícones decorativos `aria-hidden`; botão só com ícone sempre com `label`.
- Movimento reduzido respeitado globalmente.

### 7.1 Contraste das combinações (WCAG 2.x)

| Texto / elemento | Fundo | Razão |
|---|---|---|
| branco (botão primary) | `accent` #8e2740 | 8.35 |
| branco (primary hover/active) | `accent-hover` #6d1d31 | 11.23 |
| `accent` (link, aba, Tag) | branco / `page` / `selected` | 8.35 / 7.29 / 7.79 |
| `accent` (contador ativo, página atual) | `accent-bg` | 6.93 |
| anel de foco `accent` | branco / `page` | 8.35 / 7.29 (≥ 3) |
| anel de foco `accent-light` | `dark` | 6.03 (≥ 3) |
| `ink` (botão pink) | `accent-light` | 6.03 |
| `info` (Badge/Aviso info) | `info-bg` / branco | 5.36 / 6.30 |
| `success` | `success-bg` / branco / `subtle` | 5.75 / 6.46 / 6.11 |
| `warning` | `warning-bg` / branco / `subtle` | 5.33 / 6.06 / 5.73 |
| `danger` | `danger-bg` / branco / `subtle` | 5.42 / 6.17 / 5.83 |
| branco (botão danger, toast de erro) | `danger` | 6.17 |
| `ink-2` (Badge neutro) | `neutral-bg` / branco | 7.60 / 8.91 |
| `ink-3` (Tag, ícones) | branco / `subtle` / `neutral-bg` | 5.67 / 5.36 / 4.83 |
| `ink-3` (ChipMono `control`) | `control` | 4.50 (no limite; não escureça o trilho) |
| `muted` (Badge muted, descrições) | `neutral-bg` / `subtle` / `page` | 5.04 / 5.59 / 5.16 |
| `meta` (contador de pílula, placeholder) | `control` / branco / `page` | 4.56 / 5.75 / 5.02 |
| `success-light` (ícone do toast de sucesso) | `dark` | 9.48 |
| `on-dark-2` / `on-dark-3` | `dark` | 8.67 / 7.19 |
| branco (toast) | `dark` | 17.33 |
| borda de campo `line-control` | branco | 3.30 (≥ 3) |
| anel de foco de campo (`accent`, 2 px com a borda) | branco | 8.35 (≥ 3) |
| `meta` ("—" de valor vazio) | branco / `subtle` | 5.75 / 5.43 |
| ✗ `line-strong` como texto ou borda de caixa de seleção | branco | 1.50 — **não use** para texto nem controle |

---

## 8. O que as páginas adotam na próxima onda

1. Trocar `<svg>` desenhados à mão por `<Icone>` (e os ícones locais da arena, quando fizer sentido).
2. Trocar `font-mono` de quantidades/datas/totais por `numero` (ou `<Numero>`/`<Data>`); códigos com `<Codigo>`.
3. Remover tamanhos arbitrários (`text-[..px]`) e `leading-[..]` redundantes — os papéis já trazem a altura de linha.
4. Revisar `variant="primary"` — um por área; o que era "escuro de peso" e não é a ação principal vira `secondary` ou `dark`.
5. `Tag` para tipo/categoria (sem fundo), `Badge` só para o estado (um por linha).
6. `DialogFooter` com a ação principal primeiro no código; `toastSucesso` para confirmações.
7. `EmptyState` com título + uma frase + ação; `SkeletonLista` nos carregamentos de cartão.
8. `motivoDesabilitado` nos botões desabilitados que hoje não dizem por quê.
9. `abreDialogo` nos gatilhos de diálogo que ainda ficam em outro componente (o diálogo mora num filho e o botão
   chama `onEditar`/`onAbrir`); os do mesmo componente já foram marcados em 30/10.
10. Telas com busca: a regra única do vazio (§ 5.1) — Biblioteca (contagem sem filtro nas abas), Eventos (abas sem
    contagem) e Histórico (abas e filtros que somem).

---

## 9. Decisões registradas

| Data | Tema | Decisão | Por quê |
|---|---|---|---|
| 30/10 | Título de tela de detalhe (auditoria 28/10 nº 51: 24 × 18 px) | **18 px** (`PageHeader tamanho="sm"`) em toda tela de detalhe de registro, inclusive evento, projeto e item da Ativação. 24 px só em telas de módulo/lista. | O design system já dizia 18; o mesmo nível tinha dois tamanhos. O handoff pedia 25 só para o evento — vale a regra única. |
| 30/10 | Navegação de seção (nº 53) | Seção da página = `TabsNav`; pílula só para filtro. Admin passou de pílulas para abas. | Mesma função com dois componentes, e o Admin empilhava pílulas e abas. |
| 30/10 | Lugar da ação principal (nº 54) | Sempre no `PageHeader`; ação de uma aba vai por `AcaoNoCabecalho`. | Ativação e Carga punham "Novo…" na barra de filtros. |
| 30/10 | "+" nos botões de criar (nº 115) | Todo botão de criação leva o "+". | 4 telas com e 4 sem. |
| 30/10 | Rodapé de diálogo (nº 132) | Um tamanho: 36 px (`lg`). | Formulários em 34 e confirmações em 36. |
| 30/10 | Link de texto (nº 62) | Sempre sublinhado, discreto. | Contraste 1,06:1 entre link e texto (WCAG 1.4.1). |
| **pendente** | Menu lateral claro × escuro do handoff (nº 56) | **Não decidido — não trocar o tema.** Hoje o menu é claro; o handoff e `docs/02-entregaveis.md` falam em "barra lateral escura". A equipe decide; depois registrar aqui, no design-log, e atualizar o entregável. | O relatório pede decidir antes de mexer, sem recomendar um lado. |
| **pendente** | Acentos nas planilhas Excel no modelo da cenografia (nº 84) | **Não mudar** até a cenografia confirmar ("ATA DE REUNIAO", "RESPONSAVEL PELA O.S", "SOMATORIA" copiam a planilha deles). As outras exportações seguem o glossário (§ 10). | Recomendado acentuar, só depois de confirmar com a equipe. |

---

## 10. Textos

### 10.1 Glossário — um termo para cada coisa

Fonte: auditoria de textos de 28/10 (§ 5). Ao escrever um texto novo, use a coluna "Usar".

| Conceito | Usar | Evitar |
|---|---|---|
| Item que a área descreveu à mão, sem peça/projeto | **fora do catálogo** ("item fora do catálogo") | item avulso, avulsos, outro item (só como atalho da busca), materiais fora **de** catálogo |
| Peça do catálogo pedida sem projeto | **peça solta** / "soltas" | — |
| Lista de peças de um projeto padrão | **lista de peças** | BOM, lista de materiais |
| Tirar do uso sem apagar | **inativar / inativo / reativar** | desabilitar, desativar (para usuário e área: **desativar acesso** / inativa) |
| Ligar item fora do catálogo ou do estoque a uma peça | **vincular / vinculado** | ligar, ligado, ligue |
| Perfil de quem pede | **Solicitante** | Requisitante (nome interno do perfil, não aparece na tela) |
| Pedido de uma área | **solicitação** (listas, filtros, títulos); "pedido" só em frase corrida ("quem pediu", "pedido da área") | "Nenhum pedido na ata" numa aba de solicitações |
| Pedido antes da reunião | **necessidade pré-reunião** | — |
| Pedido depois da ata | **alteração pós-ata** | — |
| O que a logística faz na reunião | **conferir / conferência** | consolidar, consolidação (só na tela desligada "Demanda de peças") |
| Agrupar projetos na Biblioteca | **grupo da biblioteca** (o nome costuma ser a prova) | grupo de prova, "nome do evento" |
| Evento de corrida (marca) | **prova** | — |
| Fases do evento | **Em preparação · Em reunião · Aberto a alterações · Encerrado · Realizado · Cancelado** (abas e selos com os mesmos nomes) | "Preparação", "Aberto", "Realizados" só nas abas |
| Linha da ata vinda de solicitação | **Pedido da área** / **Pedido de outra área** | Pedido de área, Solicitação da área |
| Linha incluída sem solicitação | **Incluída pela logística** | — |
| Ordem de serviço | **OS** na tela; **Ordem de serviço** por extenso; "O.S." só no modelo da cenografia | Ordem de Serviço, O.S, O.S. |
| Remover algo | **Remover** (botão); "tirar" em frase corrida | "Tirar" sozinho em botão |
| Tentar outra vez | **tente de novo** | tente novamente |
| Encaminhar ao admin | **fale com o administrador** | peça ao administrador ("peça" é objeto neste app) |
| Portal de entrada | **Portal NORTE** | portal Norte, Norte Mkt |
| Voltar ao início | **Ir para o painel** | Ir para o Painel, Voltar para o painel |
| Imprimir | **Imprimir ou salvar em PDF** | Imprimir / salvar PDF |

### 10.2 Estilo

- **Toast:** frase curta, **sem ponto final** ("Área atualizada", "Peça reativada"); o nome do objeto depois de dois-pontos
  quando a concordância complica ("Atendido: Tenda 3×3 m", não "Tenda 3×3 m atendido").
- **Mensagem de erro:** diz o que aconteceu e o que fazer, impessoal ("Não foi possível ler a imagem. Envie outra foto.",
  nunca "Não consegui…" nem "Tentaremos…"). Sem nome de variável, código cru ou JSON na tela. Sem "Dados inválidos." solto:
  "Não foi possível salvar. Atualize a página e tente de novo."
- **Aspas curvas** “ ” em texto de tela, toast, histórico e aviso; nunca aspas retas.
- **Plural pelo número:** "1 evento", "2 eventos"; nunca "item(ns)", "projeto(s)" nem "1 eventos". Concordância: "Falta
  conferir 3 linhas" (o verbo concorda com "conferir").
- **Botão = verbo + objeto** quando o verbo sozinho não diz o resultado ("Remover peça", "Liberar para solicitações",
  "Enviar para reforma"); o `aria-label` começa pelo mesmo texto.
- **Caixa:** frase normal, só a inicial em maiúscula ("Ordem de serviço", "Fora da janela"); CAIXA-ALTA só em
  sobretítulo e cabeçalho de tabela (`text-micro`), nunca em texto de aviso ou histórico.
- **Demonstrativo:** "estes filtros" (o que está na tela).
- **Hora:** "às 14h" em frase; "14:00" em campo, tabela e selo.
- **"e/ou":** não use; "o grupo, a categoria ou os dois".
- **Nome de arquivo exportado:** "TIPO CÓDIGO NOME vN.xlsx" (ex.: `OS EVT-0001 Night Run v3.xlsx`, `Histórico 28-10-2026.csv`);
  as duas planilhas no modelo da cenografia mantêm o nome que a equipe espera (pendente, § 9).
