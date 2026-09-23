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
| Título | `text-titulo` | 18 / 24 | título de diálogo e de tela de detalhe (`PageHeader tamanho="sm"`) |
| Página | `text-pagina` | 24 / 30 | h1 (`PageHeader`) — um por tela |
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
| `link` | ação dentro de uma frase ou rodapé ("Limpar", "Ver todas") | texto vinho, sublinha no hover |
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
motivo no `title` e o leitor de tela anuncia o motivo. Prefira isso a um botão desabilitado mudo.

`IconButton`/`IconLink` (redondo, só ícone, `label` obrigatório): 24/28 px no desktop, 40 px no celular.

---

## 4. Selos

| Componente | Significa | Regra |
|---|---|---|
| `Badge` | **estado** da coisa (Enviada, Em análise, Atendido) | **um por linha**; fundo suave + borda sutil; cor semântica |
| `Tag` | **tipo/categoria/observação** (pré-reunião, fora do catálogo, depois da ata) | texto discreto com contorno `line`, **sem fundo colorido**; o tom só tinge a letra |
| `ChipMono` | **contador** (12, × 4) ou **código/versão** (v3) | contador em fonte normal tabular; código em mono |

Tamanho mínimo 12 px (`text-rotulo`). Tons: `success` concluído · `warning` atenção/aguardando ·
`danger` erro/atraso/recusa · `info` andamento/informativo · `neutral`/`muted`/`rascunho` neutros ·
`accent` só para seleção ou contagem do que pede ação do usuário (ex.: contador do menu) · `dark` raro.
Mapeamentos atuais: evento Aberto → info; solicitação Enviada → info; "Na ata" → info; perfil Logística → info.

---

## 5. Padrões de tela

### 5.1 Lista (referência: `/solicitacoes`, `/eventos`)
1. `PageHeader title divisor actions` — ação principal (`primary`, `size="lg"`) à direita; secundárias antes dela.
2. Barra de filtros numa linha: `BuscaUrl` (com ícone e spinner), `FiltroEvento`/`Pills`; alertas curtos à direita (`sm:ml-auto`).
3. Cartão (`rounded-cartao border border-line bg-surface overflow-hidden`) com `TabsNav` no topo (`className="mb-0 px-2 pt-1"`), contagem em cada aba.
4. Tabela: `CaptionOculta`, `ThOrdenavel`/`Th`, linhas `LinhaLink` (linha inteira clicável), números com `numero` e alinhados à direita, código com `Codigo`.
5. `Paginacao` no rodapé. Vazio: `EmptyState` dentro do cartão (título + 1 frase + ação).

### 5.2 Formulário
- `Field label htmlFor hint error obrigatorio` + `Input`/`Textarea`/`Select`/`ComboBox`. Campos 34 px (40 no celular).
- Rótulo acima (13 px), dica abaixo (13 px `muted`), erro abaixo com ícone (liga `aria-describedby`/`aria-invalid`).
- Erro geral: `FormError` no fim, antes das ações. Ações no fim: `SubmitButton` (primary) e depois o secundário.
- Uma coluna no celular; duas no máximo no desktop para campos curtos.

### 5.3 Diálogo
- `DialogContent title description` (460 px padrão; `size` sm/md/lg). Botão fechar (X) no canto, último no Tab.
- `DialogFooter`: escreva a **ação principal primeiro** no código — ela aparece **à direita**; secundárias à esquerda dela. No celular empilham (principal em cima).
- Destrutivo: `ConfirmDialog danger` (botão `danger`) com justificativa quando fica registrado.

### 5.4 Estados
- **Vazio:** `EmptyState` — título diz o que não há; uma frase diz por quê/o que fazer; ação se houver.
  `compact` em cartões pequenos/painéis; `icone` opcional no tamanho normal (`busca` para busca sem resultado).
- **Carregando (página):** `loading.tsx` com `Skeleton`; dentro de cartão, `SkeletonLista linhas={n}`.
  Skeleton com a altura do texto que substitui (h-3.5 corpo, h-3 pequeno, h-6 título).
- **Carregando (navegação):** automático — ver § 6.
- **Aviso:** `Aviso tom="info|warning|danger|success|neutro" titulo acoes` — ícone por tom; `Notice` é o apelido antigo.
- **Toast:** `toastSucesso(msg)` (check), `toast(msg)` (info), `toastErro(msg)` (erro, `role=alert`);
  opções `desfazer` (com Ctrl+Z) ou `acao: { rotulo, onClick }`. Pausa no hover/foco; até 3 empilhados.

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
- Abas com rolagem horizontal esmaecem a borda do lado com mais abas e centralizam a aba ativa.
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
