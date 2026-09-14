# Handoff — Planejamento de Eventos (Norte Mkt)

Redesenho completo de UX e UI do app `infra-csc/Planejamento-Eventos` (Next.js + TypeScript).
Documento escrito para ser implementado por um desenvolvedor usando Claude Code, sem depender da conversa que o originou.

---

## 1. Sobre os arquivos deste pacote

Os arquivos HTML/JS aqui são **referências de design**, não código de produção.

| Arquivo | O que é |
|---|---|
| `Planejamento de Eventos.dc.html` | Protótipo navegável de todas as telas. Estilos inline, lógica em uma classe JS. |
| `dados.js` | Dados de demonstração derivados de `scripts/seed.ts` do repositório, mais as listas de peças (BOM) por projeto. |
| `support.js` | Runtime do ambiente de prototipagem. **Não portar.** |

A tarefa é **recriar estas telas no codebase existente** (Next.js App Router, React Server/Client Components, Tailwind ou o que o projeto já usa), seguindo os padrões do repositório. Não copie o HTML.

**Fidelidade: alta.** Cores, tipografia, espaçamentos, estados e microinterações estão definidos e devem ser reproduzidos com precisão. Onde o texto aparece entre aspas neste documento, é a cópia final.

---

## 2. Contexto de produto (regras que o design assume)

O sistema organiza o material de estruturas para eventos. O fluxo é:

1. **Preparação** — cada área (Produção, Cenografia, Ativação, Gráfica, Atendimento) envia suas necessidades como *solicitação pré-reunião*.
2. **Reunião de OS** — a logística consolida tudo em uma **ata**, respondendo **item a item**.
3. **Ata fechada** — a ata é congelada e a **OS** (ordem de serviço, lista de peças por setor) é gerada automaticamente.
4. **Aberto a alterações** — mudanças entram como *solicitação de alteração*, com prazo de 48 h. Cada resposta regera a OS em uma nova versão.
5. **Encerrado** — nada mais entra. Só o perfil Gestão reabre, em exceção.

Regras preservadas do código original (não alterar):
- Resposta é **por item**, nunca por solicitação inteira. Estados: `EM_ANALISE`, `ATENDIDO`, `PARCIAL`, `NAO_ATENDIDO`.
- `PARCIAL` e `NAO_ATENDIDO` **exigem motivo** e podem gerar pendência de compra/locação.
- A OS **nunca é editada à mão**. Toda mudança vem de uma resposta a item ou de um ajuste registrado com justificativa.
- Um **projeto padrão** é uma lista de peças (BOM). A OS é a soma dos BOMs × quantidade de cada linha da ata.
- **Itens avulsos** não têm peça de catálogo: aparecem em lista separada, fora da soma por peça.
- Perfis: `REQUISITANTE`, `CENOGRAFIA`, `LOGISTICA`, `GESTAO`, `ADMIN`.

### Mudanças de UX propostas (sinalizadas, não são regra nova)

| Problema atual | Proposta | Benefício |
|---|---|---|
| Responder solicitações exige abrir uma por uma | **Fila de resposta** no painel + **modo fila** com atalhos `A`/`P`/`N` | Reduz de ~4 cliques por item para 1 tecla no caso comum (atendido integral) |
| Reunião de OS acontece fora do sistema e a ata é digitada depois | **Aba "Consolidar ata"**: itens enviados à esquerda, ata se montando à direita, em tempo real | A ata sai pronta ao fim da reunião |
| Versões da OS são só uma lista | **Diff visual** por versão e **comparação entre duas versões quaisquer** | Dá para explicar ao cliente exatamente o que mudou e quando |
| Fases do evento ficam implícitas no status | **Linha do tempo** de 4 fases no topo do evento | Novo usuário entende o processo sem explicação |
| Consolidação usava números fixos | **Cálculo real**: demanda por dia no intervalo montagem→desmontagem de todos os eventos que se sobrepõem | O pico mostra o pior dia de verdade |

---

## 3. Design tokens

### Cores

```
/* Superfícies */
--bg-page:        #f1efee   /* fundo da aplicação */
--bg-surface:     #ffffff   /* cards, tabelas */
--bg-subtle:      #faf8f8   /* cabeçalho de tabela, rodapés, blocos secundários */
--bg-selected:    #faf6f6   /* linha selecionada */
--bg-control:     #e9e4e3   /* trilho dos grupos de pills */

/* Tinta (fundo claro) */
--ink:            #2a1418   /* texto principal e superfície escura */
--ink-2:          #4f4849   /* texto de apoio */
--ink-3:          #6d6566   /* rótulos */
--ink-muted:      #6b6263   /* texto secundário — AA em #fff e #f1efee */
--ink-meta:       #6f6366   /* metadados, timestamps, 11–12px */

/* Bordas */
--border:         #e4dedd   /* borda de card */
--border-strong:  #d7d2d2   /* borda de input e botão secundário */
--border-soft:    #ece7e6   /* divisor de cabeçalho */
--border-row:     #f0eceb   /* divisor de linha */
--border-faint:   #f3efee   /* divisor interno de lista */

/* Marca */
--accent:         #8e2740   /* links, marcador de fase concluída, seleção */
--accent-bg:      #f6e6ea   /* fundo de badge e item selecionado na busca */
--accent-light:   #e0798f   /* destaque sobre superfície escura */

/* Superfície escura (sidebar, banners, toast) */
--dark:           #2a1418
--dark-2:         #3d2026   /* item ativo da nav, chips sobre escuro */
--dark-3:         #4a2a30   /* borda sobre escuro */
--dark-4:         #351b21   /* campo de busca na sidebar */
--on-dark:        #ffffff
--on-dark-2:      #c2b4b7   /* item inativo da nav — AA sobre #2a1418 */
--on-dark-3:      #b3a3a6   /* texto de apoio sobre escuro */
--on-dark-4:      #a49497   /* rodapé e rótulos de seção */

/* Semânticas */
--danger:         #a8400f   /* atraso, recusa, ação destrutiva */
--danger-bg:      #fbeee5
--danger-border:  #efd9c9
--warning:        #7a5f00   /* parcial, ressalva */
--warning-bg:     #f7f0dd
--warning-border: #e6dcc2
--success:        #136c41   /* atendido */
--success-bg:     #eaf4ee
--success-border: #cfe3d6
--neutral-bg:     #f0eceb   /* badge neutro */
```

**Nota importante sobre o vermelho.** Como o vinho da marca (`#8e2740`) é vizinho do vermelho, o estado de erro/atraso usa **laranja-queimado `#a8400f`**, não vermelho puro. Isso é deliberado — não "corrija" para `#d32f2f`.

**Contraste.** Toda a paleta foi auditada: nenhum texto abaixo de 4.5:1 (3:1 para títulos ≥24px). Ao introduzir cores novas, mantenha o critério.

### Tipografia

```
Família principal: Geist (Google Fonts), pesos 400, 500, 600, 700
Fallback: "Helvetica Neue", Arial, sans-serif
Família mono: "Roboto Mono", pesos 400, 500
```

Mono é usada **apenas** para: códigos (`EVT-0001`, `BOX-3000`, `SOL-0011`), quantidades, datas curtas, atalhos de teclado e contadores. Nunca para texto corrido.

| Uso | Tamanho | Peso | Letter-spacing |
|---|---|---|---|
| Título de página (h1) | 24px | 600 | -0.025em |
| Título de evento (detalhe) | 25px | 600 | -0.025em |
| Título do login | 40px | 600 | -0.03em |
| Título de card / seção (h2) | 14px | 600 | -0.01em |
| Rótulo de grupo (uppercase) | 12px | 600 | 0.1em |
| Rótulo de seção na sidebar | 10.5px | 600 | 0.14em |
| Corpo base | 14.5px | 400 | — |
| Corpo em card | 13.5px | 400 | — |
| Tabela | 13px | 400 | — |
| Texto secundário | 12.5px | 400 | — |
| Metadados | 11.5px | 400 | — |
| Badge | 11px | 500 | — |
| Cabeçalho de tabela | 11.5px | 500 | — |
| Número em destaque (métrica) | 26px mono | 500 | -0.02em |
| Número médio | 20–21px mono | 500 | -0.02em |

`line-height` do corpo: 1.5. Textos longos em card: 1.55. Títulos: 1.12–1.2.

### Espaçamento

Escala de 4: `3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28`px.

- Padding de card: `14px 18px` no cabeçalho, `14px 18px` no corpo.
- Padding de linha de tabela: `9–14px` vertical, `12–18px` horizontal (18px nas bordas).
- Gap entre cards: `20px`. Entre seções: `18–22px`.
- Padding do `main`: `28px 28px 64px`.

### Raio e sombra

```
Card, seção:        10px
Modal:              12px
Botão, input:       8px
Botão pequeno:      7px
Badge, chip:        5px
Pill de filtro:     7px (trilho 9px)
Barra de progresso: 3px
```

Sombras — usar apenas três:
```
Pill ativa:  0 1px 2px rgba(42,20,24,.08)
Modal:       0 24px 60px rgba(42,20,24,.22)
Toast:       0 12px 32px rgba(42,20,24,.28)
```
Cards **não têm sombra** — a hierarquia vem da borda `#e4dedd`.

### Ícones

O app é **quase sem ícones**, de propósito. Onde existem marcadores, são formas geométricas simples:
- Círculo de 7px para item pendente/estado.
- Quadrado de 7px com raio 2px para marco da linha do tempo.
- Barra de 4px para fase do evento.
- Retângulo 3px à esquerda para item ativo da navegação.

Não introduza uma biblioteca de ícones sem necessidade. A única "seta" é `↑ ↓ ↵` em mono na busca.

---

## 4. Estrutura da aplicação

```
Sidebar fixa (236px, #2a1418)          Header (56px, sticky, blur)
├─ Logo + "Planejamento"               ├─ Breadcrumb
├─ Busca global (⌘K)                   ├─ Notificações (rótulo em texto + ponto)
├─ Painel                              └─ Usuário (iniciais + nome + perfil)
├─ Eventos
├─ Solicitações  [n]                   Main (max-width 1240px, min-width 1000px)
├─ CADASTROS
│  └─ Biblioteca
├─ Consolidação
├─ SISTEMA
│  └─ Administração
└─ Atualizado há 2 min · v0.2 · Sair
```

**Desktop-only** por decisão do cliente. `main` tem `min-width: 1000px` e `overflow-x: auto`.

### Visibilidade por perfil

| Item | REQUISITANTE / CENOGRAFIA | LOGISTICA | GESTAO | ADMIN |
|---|---|---|---|---|
| Painel | ✓ (versão da área) | ✓ | ✓ | ✓ |
| Eventos | ✓ | ✓ | ✓ | ✓ |
| Solicitações | ✓ (só da área) | ✓ + contador | ✓ + contador | ✓ |
| Biblioteca | ✓ | ✓ | ✓ | ✓ |
| Consolidação | — | ✓ | ✓ | — |
| Administração | — | — | — | ✓ |
| Aba OS do evento | só CENOGRAFIA | ✓ | ✓ | ✓ |
| Aba "Consolidar ata" | — | ✓ (em PREPARACAO ou EM_REUNIAO) | — | — |
| Responder item | — | ✓ | — | — |
| Reabrir evento encerrado | — | — | ✓ | — |

---

## 5. Telas

### 5.1 Login

Grid `1.1fr 1fr`, altura total.

**Painel esquerdo** (`#2a1418`, padding `56px 64px`, flex column, `justify-content: space-between`):
- Topo: quadrado 22px raio 5px `#e0798f` + "NORTE MKT" (13px/600, `letter-spacing: .18em`, uppercase, branco).
- Meio (`max-width: 440px`): h1 40px/600 branco — "Da reunião de OS ao caminhão carregado, em um só lugar." + parágrafo 15.5px `#b3a3a6` — "Catálogo de peças, projetos padrão, ata da reunião, OS gerada automaticamente e solicitações respondidas item a item."
- Base: três números mono 22px (o primeiro em `#e0798f`) com rótulo 13px `#b3a3a6`: "9 eventos ativos", "28 peças no catálogo", "8 projetos padrão".

**Painel direito** (centralizado, `max-width: 352px`):
- h2 24px/600 "Entrar" + "Use o e-mail e a senha cadastrados pelo administrador."
- Campos e-mail e senha: altura 42px, borda `#d7d2d2`, raio 8px.
- Botão primário largura total, 42px, `#2a1418`.
- Link "Esqueci minha senha" centralizado.
- Bloco de demonstração separado por `border-top`: rótulo uppercase 12px + um botão por perfil (nome à esquerda, perfil à direita), 9px/12px de padding, borda `#e4dedd`.

### 5.2 Painel

Muda por perfil. Cabeçalho comum: data por extenso em mono 12.5px `#6b6263`, h1 "Olá, {primeiro nome}", subtítulo, e um botão primário de ação.

| Perfil | Subtítulo | Ação primária |
|---|---|---|
| LOGISTICA | "Sua fila de hoje: uma reunião de OS às 09:00, {n} solicitações aguardando resposta e {n} prazos vencidos." | "Consolidar ata de hoje" |
| REQUISITANTE | "Área {área}: o que você enviou, o que voltou para ajuste e onde ainda dá para pedir alteração." | "Nova solicitação" |
| GESTAO | "Visão entre eventos: prazos, exceções e o que está travando a operação." | "Ver atrasos" |
| ADMIN | "Usuários, áreas e configurações do sistema." | "Novo usuário" |

**Faixa de 4 métricas** — grid de 4 colunas com `gap: 1px` sobre fundo `#e4dedd` e borda, criando divisores de 1px. Cada célula: rótulo 12.5px, número mono 26px, hint 12px. Cada uma é clicável e leva à tela filtrada.

Logística/Gestão: "Aguardando sua resposta" · "Prazo vencido" (número em `#a8400f`) · "Reuniões esta semana" · "Peças em déficit" (`#7a5f00`).
Requisitante: "Aguardando resposta" · "Rascunhos e devolvidas" · "Respondidas em 7 dias" · "Eventos aceitando envio".

**Corpo** — grid `1.85fr 1fr`.

Coluna esquerda — **Fila de resposta** (o principal ganho de produtividade):
- Cabeçalho: "Fila de resposta" + "Ordenada por prazo. O que tem um item só pode ser resolvido aqui." + botão "Modo fila".
- Cada linha: ponto colorido de prazo (7px; pulsa com `animation: pulseDot 1.8s ease-in-out infinite` quando vencido), código em mono, título, badge de tipo, contexto ("{área} · {evento} · {n} itens · {n} já respondido"), e à direita prazo em mono + detalhe.
- Se a solicitação tem **um único item pendente**, aparece uma faixa de ação rápida (`#faf8f8`, borda `#ece7e6`): descrição do item + botão "Atender" (verde) + "Parcial / recusar".
- Estado vazio: "Fila zerada" / "Nenhuma solicitação aguardando resposta."

Para requisitante, a mesma seção vira "Precisa de você" (rascunhos e devolvidas) e ganha abaixo **"Respostas recebidas"**, com badge "tudo atendido" (verde) ou "{n} com ressalva" (âmbar).

Coluna direita:
- **Próximos 14 dias** — lista de reuniões, cargas e montagens de todos os eventos, ordenada por data. Marcador quadrado para reunião, círculo âmbar para carga, círculo cinza para montagem.
- **Estoque em risco** (logística/gestão) — peça, faltante em `#a8400f`, barra de cobertura e legenda `pico/estoque`.
- **Como o processo funciona** (requisitante) — card escuro `#2a1418` com os 4 passos numerados.

### 5.3 Eventos

Busca (280px) + pills de fase com contagem: Todos, Preparação, Em reunião, Aberto, Encerrado, Realizados, Cancelado.

Agrupados em três seções, cada uma com rótulo uppercase 12px e contagem:
1. **Exige ação agora** — em reunião ou com solicitação aberta.
2. **Em andamento** — preparação ou aberto.
3. **Encerrados e cancelados**.

Cada grupo é uma `<table>` sem `thead` (`caption` invisível com o nome do grupo). A linha (`<tr role="link" tabIndex="0">`, `Enter`/`Espaço` abrem):
- `<th scope="row">`: nome 14.5px/500 + badge de status + badge "reaberto {n}×" se houver; abaixo, código mono + cliente + local.
- Coluna de fase (148px): 4 barras de 4px — concluída `#8e2740`, atual `#2a1418`, futura `#e4dedd`. Envolvidas em `role="img"` com `aria-label="Fase: {status}"`.
- Coluna de datas (150px): período em mono + próximo marco ("reunião 16/09 14:00", "carga 22/09", "OS final v4").
- Coluna de pendência (130px): "{n} aguardando" em `#7a5f00` ou "—"; abaixo, responsável.

Cores de badge por status: Preparação `#f0eceb/#4f4849` · Em reunião `#f7f0dd/#7a5f00` · Aberto `#f6e6ea/#8e2740` · Encerrado `#eaf4ee/#136c41` · Realizado `#f0eceb/#6f6366` · Cancelado `#fbeee5/#a8400f`.

### 5.4 Evento — cabeçalho e linha do tempo

Cabeçalho: código mono + badge + "reaberto {n}× pela gestão"; h1 25px; linha de metadados com rótulo em `#6b6263` e valor em `#4f4849` (Cliente, Local, Evento, Logística). À direita, botões conforme perfil e fase:

| Fase | LOGISTICA | GESTAO | REQUISITANTE |
|---|---|---|---|
| PREPARACAO | "Iniciar reunião" (primário), "Editar" | — | "Enviar necessidades" |
| EM_REUNIAO | "Consolidar ata" (primário), "Fechar ata", "Editar" | — | — |
| ABERTO | "Encerrar para alterações" (primário), "Editar" | — | "Solicitar alteração" |
| ENCERRADO | — | "Reabrir em exceção" | — |

**Linha do tempo** — card com 4 colunas iguais. Cada uma: ponto (9px; 11px com halo `0 0 0 4px #f6e6ea` quando é a fase atual) + trilho de 2px, título, quando (mono 12px), detalhe. Concluída `#8e2740`, atual `#2a1418`, futura `#d7d2d2`.

**Abas**: Visão geral · Ata [n] · Consolidar ata (só logística, antes do fechamento) · Solicitações [n] · OS [v{n}] · Histórico. Aba ativa tem `border-bottom: 2px solid #8e2740`.

### 5.5 Evento — Visão geral

Grid `1.7fr 1fr`.

- **Onde está cada área** — por área: nome, barra de progresso de itens respondidos (verde quando 100%, senão `#8e2740`) e resumo "{n}/{n} itens respondidos · {n} solicitações" ou "não enviou nada".
- **Atividade** — 6 eventos mais recentes do histórico, com marcador colorido por tipo (marco `#2a1418` quadrado, resposta `#136c41`, solicitação `#8e2740`, ajuste `#7a5f00`) e link "Ver histórico completo".
- **Datas** — lista rótulo/valor: Montagem, Evento (destacado), Desmontagem, Reunião de OS, Carga do caminhão, Ata fechada.
- **OS** — número total de peças em mono 26px + botão "Abrir OS".

### 5.6 Evento — Ata

Grid `1fr 300px`.

Tabela da ata: Item (com tag "projeto"/"peça"/"avulso" e, se a linha usa versão antiga do projeto, um botão-badge âmbar "v1 · atualizar para v2") · Qtd. (mono, à direita) · Destino · Área · Origem ("SOL-0001", "SOL-0001 (parcial)", "Incluída na reunião", "Ajuste da logística"). Rodapé com "{n} linhas na ata" e soma.

Estado vazio: "Ata ainda não montada" + "A ata é montada na reunião de OS, marcada para {data}." — o cabeçalho e o rodapé da tabela ficam ocultos nesse caso.

Lateral: "Observações da reunião" (texto preservando quebras) e "Ata congelada" (**oculta inteira** se a ata ainda não foi fechada).

### 5.7 Evento — Consolidar ata *(momento-chave)*

Só para logística, antes do fechamento. É a tela usada **durante** a reunião.

**Banner escuro** (`#2a1418`, raio 10px): título "Reunião de OS em andamento · {evento}", subtítulo que muda quando tudo está respondido ("Todos os itens foram respondidos. Revise a ata à direita e feche para gerar a OS."), barra de progresso `{respondidos}/{total}` (`#e0798f`, vira `#7fd0a8` ao completar) e botão "Fechar ata e gerar OS" — **desabilitado visualmente** (`#3d2026` com texto `#6f6366`, `cursor: not-allowed`) até 100%.

**Coluna esquerda** — um card por solicitação, agrupando seus itens. Acima, a dica: "selecione um item e use `A` `P` `N`".

Cada item:
- Marcador colorido por estado, descrição + quantidade (`× 2`, `de 2 para 3`, `(remover da ata)`), contexto ("Destino: … · {justificativa}") e badge de estado.
- Clicar seleciona o item (fundo `#faf6f6` + faixa `inset 3px 0 0 #8e2740`).
- Pendente: botões "Atender {n}" (verde), "Parcial" (âmbar), "Não atender" (laranja).
- Em edição: painel com quantidade atendida (number, 76px), campo de motivo, checkbox "Gerar pendência de compra ou locação", "Confirmar resposta" e "Cancelar".
- Respondido: resultado em mono ("3 de 4"), observação e link "Corrigir".

Abaixo, se houver áreas sem envio: caixa tracejada — "Sem envio até agora: {áreas}. Você ainda pode incluir linhas direto na ata."

**Coluna direita** (`position: sticky; top: 76px`) — a ata se montando em tempo real, com "+ Incluir linha decidida na reunião" e o campo de observações com "salvo automaticamente".

**Atalhos** (quando há item selecionado e o foco não está em input): `A` atende integralmente, `P` abre parcial, `N` abre não atendido, `Esc` cancela a edição.

### 5.8 Evento — OS

Grid `1fr 320px`.

**Card de diff** (escuro) no topo:
- Modo normal: "O que mudou na v{n}" + descrição da versão.
- Modo comparação: "Diferença entre v{a} e v{b}" + "Soma de {n} alterações no intervalo" + botão "Sair da comparação".
- Cada peça alterada é um chip `#3d2026`: código, valor antes (`#b3a3a6`), `→`, valor depois (branco/600) e delta (`+8` em `#e0798f`).

**Setores** — um card por setor (Estrutura, Tendas, Marcenaria), com resumo "{n} tipos de peça · {n} unidades" e botão "CSV". Colunas: código (mono, 108px) · nome · origens (11.5px `#6f6366`, 260px, ex.: "Pórtico boca 6,60m × 2 → 20 · Torre de som 4m × 3 → 6") · total (mono 600, à direita, com unidade em 11px).

**Itens avulsos** — card separado: "Sem peça de catálogo. Separação manual; não entram na soma por peça."

**Estado sem OS**: "OS ainda não gerada" + "A OS é gerada automaticamente quando a ata for fechada. Nenhuma peça é somada antes disso." (o grid principal fica `display: none`).

Lateral:
- **Exportar** — botão "Imprimir / PDF" e a nota "A OS nunca é editada à mão. Toda mudança vem de uma resposta a item ou de um ajuste registrado com justificativa."
- **Versões** — cada versão é um bloco clicável (`role="button" tabIndex="0"`, Enter/Espaço) com número em mono, badge do gatilho, data/autor, descrição, resumo do diff, rótulo "atual"/"base da comparação" e botão "comparar"/"limpar". Versão atual: `inset 3px 0 0 #8e2740`; base da comparação: `inset 3px 0 0 #c9a3ad`.

**Cálculo do diff acumulado**: ao comparar v{a} e v{b}, some os diffs de todas as versões `> min(a,b)` e `<= max(a,b)`, mantendo o `antes` do primeiro registro e o `depois` do último por peça, e descarte as que voltaram ao valor original.

### 5.9 Solicitações

Pills: Aguardando resposta · Atrasadas · Rascunhos e devolvidas · Respondidas · Todas — com contagem. Logística vê o botão "Responder em fila"; requisitante vê "Nova solicitação".

`<table>` com `<caption>` invisível e cabeçalho **ordenável**: Código · Solicitação · Itens · Status · Prazo. Cada `<th>` tem `aria-sort` (`none`/`ascending`/`descending`) e contém um `<button>` com o rótulo e a seta `↑`/`↓`. Ciclo: asc → desc → sem ordenação.

Paginação de 8 por página no rodapé `#faf8f8`: "1–8 de 10" + "Anterior" / "Próxima" (desabilitados em `#6f6366`, `cursor: not-allowed`). Trocar de filtro ou de ordenação volta para a primeira página.

Cores de badge: Rascunho `#f0eceb/#6d6566` · Enviada `#f6e6ea/#8e2740` · Em análise `#f7f0dd/#7a5f00` · Respondida `#eaf4ee/#136c41` · Devolvida `#fbeee5/#a8400f` · Cancelada `#f0eceb/#6f6366`.

**Importante:** "atrasada" = **ainda aberta** e com prazo vencido. Uma respondida nunca é atrasada.

### 5.10 Solicitação — detalhe

`max-width: 1080px`.

**Barra do modo fila** (escura, quando ativo): "Modo fila", posição "2 de 5" em mono, "ordenada por prazo · atalhos A, P e N no item selecionado", botões "Anterior", "Próxima" (`#e0798f`) e "Sair".

Cabeçalho: código mono 15px + badge + "atrasada há 2 dias"; h1 22px; linha com tipo, link para o evento, área e autor. Botões à direita: "Devolver para ajuste" (só se nenhum item foi respondido), "Atender tudo"; para requisitante em rascunho/devolvida: "Editar itens" e "Enviar".

**Aviso contextual**: se devolvida, caixa laranja com o motivo + "Corrija e reenvie."; se pré-reunião e respondível, caixa neutra — "Você pode responder agora ou durante a reunião, na aba Consolidar ata do evento."

Grid `1fr 280px`: observação do solicitante, lista de itens (mesma mecânica de resposta da 5.7) e card "Dados" (Criada em, Enviada em, Prazo de resposta, Respondida em, Itens respondidos).

### 5.11 Nova solicitação

`max-width: 880px`. O tipo é **derivado da fase do evento** — o usuário não escolhe: "O tipo é definido pela fase do evento. Você não precisa escolher."

1. **Evento** — lista de rádios só com eventos em PREPARACAO ou ABERTO. Cada um mostra cliente, período e reunião/ata, mais a tag "necessidade pré-reunião" ou "alteração pós-ata". Selecionado: fundo `#faf6f6`, borda `#e0c4cc`, rádio com `border: 4px solid #8e2740`.
2. **Itens** — estado vazio explicativo; cada item tem `−` / campo numérico / `+` e "Remover". Abaixo, três abas: Projeto padrão · Peça do catálogo · Item avulso, cada uma com busca e lista de resultados (código, nome, meta, "Adicionar").
3. **Contexto** — Título (obrigatório) e Observação.

**Validação**: no `blur` do título, borda `#c0562c` e mensagem 12px `#a8400f` abaixo. Ao tentar enviar sem item ou sem título, aparece um resumo em caixa laranja: "Falta preencher antes de enviar — ao menos um item e o título." O item avulso valida a descrição ao tentar adicionar.

Rodapé: "Enviar solicitação", "Salvar rascunho" e a nota de prazo ("Prazo de resposta: 48h após o envio." ou "Envios encerram quando a reunião começa.").

### 5.12 Biblioteca

Abas "Projetos padrão [8]" e "Catálogo de peças [28]".

**Projetos** — grid `1fr 330px`. Lista com nome + versão, código + descrição, categoria, tipos, peças e uso. Selecionado com faixa `#8e2740`. Lateral sticky mostra o **BOM** do projeto selecionado, com badge "novo na v2" nas peças acrescentadas, e a nota: "A v2 incluiu 2 sapatas e 4 contrapesos após revisão de segurança. Eventos que ainda usam a v1 aparecem marcados na ata."

**Catálogo** — busca + pills de setor; `<table>` ordenável (Código, Peça, Setor, Família, Estoque, Em BOM) com paginação de 12.

### 5.13 Consolidação

"Demanda de todos os eventos que ocupam o período, de montagem a desmontagem, contra o estoque próprio. Eventos simultâneos disputam a mesma peça: o pico mostra o pior dia."

Pills 15/30/60 dias + intervalo em mono. Quatro métricas: eventos no período (com os códigos no hint), peças demandadas, peças em déficit, unidades a locar.

**Demanda × estoque** — ordenado por risco (menor saldo primeiro). Cada linha: código, nome, barra e legenda. A barra tem fundo `#f0eceb`, preenchimento proporcional à demanda no pico (`#a8400f` se falta, `#136c41` se cabe) e um **traço vertical de 2px `#2a1418`** marcando o estoque. Legenda: "demanda 104 · estoque 90". À direita, "faltam 14" (chip laranja) ou "+36" (chip verde) e o dia do pico.

**Pendências de compra e locação** — derivadas das respostas com `pendencia = true`: código da solicitação, item, motivo, contexto e "faltam {n}". Estado vazio: "Nenhuma pendência aberta. Toda resposta parcial ou recusada aparece aqui até ser resolvida."

**Algoritmo do pico** — para cada dia do intervalo, some a demanda dos eventos cujo `montagem <= dia <= desmontagem`; guarde o maior valor, o dia e quais eventos entraram. Eventos sem ata fechada entram com **demanda projetada** (itens ainda `EM_ANALISE` das solicitações), marcados como "projetado" no detalhamento.

### 5.14 Administração

Abas Usuários · Áreas · Configurações.

**Usuários** — busca, pills Todos/Ativos/Inativos, botão "Novo usuário". `<table>` semântica: Pessoa (nome + e-mail) · Perfil (badge colorido) · Área · Último acesso (mono) · Status + ações "Editar" e "Desativar"/"Reativar". Linha de usuário inativo com fundo `#faf8f8`.

**Modal de usuário** (`role="dialog" aria-modal="true"`, 460px, raio 12px):
- Título "Novo usuário" ou "Editar {primeiro nome}"; subtítulo "A pessoa recebe um e-mail para definir a senha." / "Alterações valem a partir do próximo acesso."
- Nome (obrigatório), E-mail (obrigatório, **somente leitura ao editar**, fundo `#faf8f8`), Perfil (select) e Área (select, **só aparece** para REQUISITANTE, CENOGRAFIA e LOGISTICA).
- Sob o select de perfil, uma linha explicando o que o perfil pode fazer:
  - REQUISITANTE: "Envia necessidades e alterações da própria área. Vê apenas o que a área enviou."
  - CENOGRAFIA: "Além de solicitar, mantém os projetos padrão e o catálogo de peças."
  - LOGISTICA: "Conduz a reunião, responde item a item, fecha a ata e gera a OS."
  - GESTAO: "Acompanha todos os eventos e é o único perfil que reabre um evento encerrado."
  - ADMIN: "Gerencia usuários, áreas e configurações. Não participa do fluxo de solicitações."
- Rodapé `#faf8f8`: "Criar usuário"/"Salvar alterações", "Cancelar" e, à direita, "Desativar acesso" (só ao editar).
- Validação: nome vazio, e-mail vazio, formato inválido e e-mail duplicado.

**Configurações** — Prazo padrão de resposta (48h), Aviso de prazo próximo (12h), Antecedência da reunião de OS (0h), Reabertura de evento (restrita).

### 5.15 Notificações

`max-width: 780px`. Lista com ponto colorido (laranja para prazo, vinho para o resto; invisível se lida), título (500 se não lida), mensagem, quando e botão "Abrir" que navega ao objeto. Não lidas com fundo `#faf6f6`. Botão "Marcar todas como lidas" no cabeçalho.

### 5.16 Busca global (⌘K)

Overlay `rgba(22,23,26,.4)`, caixa de 620px a 14vh do topo.
- Campo com `autofocus`, placeholder "Buscar eventos, solicitações, peças, projetos — ou executar uma ação" e chip "esc".
- Barra de atalhos: `↑ ↓` navegar · `↵` abrir · `esc` fechar.
- Resultados **agrupados** (Ações, Eventos, Solicitações, Biblioteca) com cabeçalho de grupo uppercase 10.5px. Ações têm tag `#e0798f`; o resto, `#e4dedd`.
- Selecionado: fundo `#f6e6ea` e `↵` à direita. Mouse hover move a seleção.
- Sem termo: 8 primeiros. Com termo: até 12. Vazio: "Nada encontrado para "{termo}"."
- Ações disponíveis: "Nova solicitação", "Consolidar ata da reunião de hoje", "Ver solicitações atrasadas".

---

## 6. Estados

| Estado | Tratamento |
|---|---|
| Carregando | Skeleton com a forma real da tela (título, 4 métricas, 5 linhas), animação `pulseDot 1.4s` |
| Erro de dados | Card laranja com a mensagem e botão "Tentar de novo" |
| Lista vazia | Título + frase explicando o que faria aparecer algo ali |
| Busca sem resultado | "Nenhum evento corresponde aos filtros" / "Ajuste a busca ou volte para todas as fases." |
| Sem permissão | O item simplesmente não aparece na navegação nem como aba |
| Salvando / salvo | "salvo automaticamente" abaixo do campo de observações |
| Ação concluída | Toast escuro no canto inferior direito, 5s, com "Desfazer" quando a ação foi uma resposta a item |
| Bloqueado | Botão em `#3d2026`/`#6f6366` com `cursor: not-allowed` e toast explicando o que falta |

**Toast**: `position: fixed; right: 24px; bottom: 24px`, fundo `#2a1418`, raio 10px, ponto `#e0798f`, texto 13.5px e link "Desfazer" em `#e0798f` sublinhado. Some em 5s.

---

## 7. Microinterações

Só existem quatro, todas com função:

```css
@keyframes fadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
```

1. `fadeUp .18s ease` na troca de rota; `.14s` em modais e busca.
2. `pulseDot 1.8s infinite` no ponto de prazo vencido (chama atenção sem piscar a tela inteira).
3. Hover de linha de tabela: `background: #faf8f8`.
4. Foco visível: `outline: 2px solid #8e2740; outline-offset: 2px` (`-2px` em `<tr>`).

Não há transições de página, parallax, nem animação decorativa.

---

## 8. Acessibilidade

- Contraste AA verificado em todas as telas (4.5:1; 3:1 para ≥24px). Ao mudar cor, reaudite.
- Tabelas com `<table>`, `<thead>`, `<th scope="col|row">` e `<caption>` visualmente oculta.
- Cabeçalhos ordenáveis com `aria-sort` e botão real dentro do `<th>`.
- Linhas clicáveis: `role="link"`, `tabIndex={0}`, `aria-label` descritivo e `Enter`/`Espaço`.
- Modais: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apontando para o título. *(Falta implementar o focus trap — ver §11.)*
- Todo campo tem `<label for>`; os que não podem ter rótulo visível usam `aria-label`.
- Estado nunca depende só de cor: badge sempre tem texto, barra de fase tem `aria-label`, prazo vencido tem a palavra "vencido".
- Alvos clicáveis com no mínimo 26–28px de altura; ações principais 34–38px.

---

## 9. Estado da aplicação

Estado que o protótipo mantém e que a implementação precisa cobrir:

```
rota, sub (aba do evento), eventoId, solicitacaoId, usuarioIdx
buscaAberta, termo, buscaIdx
toast, desfazerId
respostas: { [itemId]: { status, atendida, obs, pendencia, respondidoPor, respondidoEm } }
modoFila, filaIdx
versaoOs (versão exibida), versaoBase (versão de comparação)
catalogoAba, projetoSel, buscaPeca, setorPeca
adminAba, buscaUsuario, filtroUsuario, usuariosEdit, usuariosNovos, usuarioForm
filtroSol, faseEventos, buscaEventos
ordem: { [tabela]: { chave, dir } }, pagina: { [tabela]: n }
novaEvento, novaModo, novaBusca, novaItens, novaTitulo, novaObs, tentouEnviar, erroTitulo, erroAvulso
itemFoco, itemEditando, rascunhoStatus, rascunhoQtd, rascunhoObs, rascunhoPendencia
observacoes (ata em construção)
```

**Regra de ouro da implementação:** todo contador, badge e agregado deve ser **derivado** do estado dos itens, nunca de um campo persistido no registro pai. No protótipo, responder um item atualiza na mesma hora: o badge da navegação, as 4 métricas do painel, o subtítulo, a fila, os filtros de solicitação, a coluna "aguardando" da lista de eventos, o agrupamento dos eventos, a linha do tempo, a ata em construção, a OS e as pendências da consolidação. Campos como `evento.solicitacoesAbertas` e `evento.linhasAta` do seed existem, mas **não devem ser lidos na UI** — foram fonte de três rodadas de bug.

---

## 10. Cálculos

**Status derivado da solicitação** — se todos os itens respondidos: `RESPONDIDA`; se nenhum: `ENVIADA`; se alguns: `EM_ANALISE`. `RASCUNHO`, `DEVOLVIDA` e `CANCELADA` vêm do registro.

**OS a partir da ata** — para cada linha de ata do tipo projeto, multiplique o BOM do projeto (na versão da linha) pela quantidade; agrupe por peça, somando, e registre a origem no formato "{projeto} × {qtd} → {total}". Agrupe as peças por setor (ESTRUTURA, TENDA, MARCENARIA) e ordene por código.

**Ata a partir das respostas** — para eventos sem ata congelada, derive das solicitações: itens `ATENDIDO` entram com a quantidade pedida, `PARCIAL` com a atendida, `NAO_ATENDIDO` não entra.

**Prazo** — referência 14/09/2026 12:00 no protótipo (usar `now()` na implementação). Vencido: "vencido / há {n} dias" em `#a8400f`. Até 24h: "em {n}h" em `#7a5f00`. Depois: "em {n}d" em `#4f4849`.

---

## 11. O que ficou fora

Para transparência, o que o protótipo **não** cobre:

- **Focus trap e devolução de foco** nos modais e na busca (`aria` está correto, o comportamento de foco não).
- **Mobile e tablet** — desktop-only por decisão do cliente (`min-width: 1000px`).
- Ordenação e paginação existem em Solicitações e Catálogo; **faltam** em Eventos, Projetos, Usuários e Consolidação.
- Fluxos de criar/editar **evento**, **projeto padrão** e **peça** — os botões existem e disparam toast.
- Recuperação de senha, preferências de notificação, exportação real (CSV/PDF disparam toast).
- Paginação no servidor, busca no servidor, tempo real.

**Sobre os dados:** os estoques de `BOX-3000` (40), `CUBO` (34), `TALHA` (2) e `PARAF` (600) foram ajustados em relação ao seed para que a demanda calculada gerasse déficit real e a tela de Consolidação tivesse o que mostrar. Use os valores reais do estoque da empresa.

---

## 12. Arquivos

```
Planejamento de Eventos.dc.html   protótipo completo (referência visual e de comportamento)
dados.js                          dados de demonstração + BOM_PROJETOS + ATAS + OS_VERSOES
support.js                        runtime do ambiente de protótipo — não portar
```

Para ver o protótipo: abra o `.dc.html` em um navegador servindo a pasta (`npx serve`), porque `dados.js` é carregado como módulo ES.
