# Auditoria de usabilidade (ux-intuitive) — 28/10/2026

Varredura do app inteiro, por perfil, do ponto de vista de quem usa pela primeira vez ou com pressa.
Só relato: nenhum arquivo do app foi alterado.

## Como foi feito

- Servidor de demonstração compartilhado `http://localhost:3100` (build de produção, PGlite `.data/e2e`,
  `EXIBIR_DEMO=true`). Usuários do seed com a senha de demonstração. Não rodei build, `next dev`/`start` nem a
  suíte E2E. Não rodei `git pull`: outros agentes estavam trabalhando no mesmo diretório.
- Playwright próprio (Chromium headless). Scripts, logs e prints em
  `C:\Users\yan.araujo\AppData\Local\Temp\evtshots\auditoria\ux\`:
  - `scripts/varrer.mjs`: abre as 63 rotas (fixas e uma de cada tipo com id) por perfil e grava, por tela, o
    destino final, o status, o `h1`, os botões, links, abas e campos visíveis, a largura da página
    (`scrollWidth`) e os erros de JS em `varredura/varredura.jsonl`, com print da página inteira
    (`varredura/<perfil>-<largura>/`, 749 prints);
  - `scripts/t*.mjs`: tarefas de ponta a ponta com contagem de cliques (`fluxos/<tarefa>/log.txt` e prints, 90
    no total);
  - `evidencias/`: os prints citados abaixo, com o achado no nome do arquivo.
- **Desvio da regra "um Chromium por vez"**: interrompi a varredura em segundo plano para fazer as tarefas, mas
  o laço do shell continuou rodando. Por cerca de 20 minutos a varredura e os scripts de tarefa usaram um
  Chromium cada um, ao mesmo tempo. Isso provavelmente causou os dois "Target crashed" que vi no
  "Responder em sequência"; pela URL direta, a tela abriu normalmente. Os dados não foram afetados.
- Registros que criei no banco de demonstração (todos meus): evento **EVT-0045 "UX Auditoria 28-10"** (reunião
  iniciada, ata fechada, OS v1); solicitações **SOL-0028** (pré-reunião, Paulo, 375 px), **SOL-0030, 0031 e
  0032** (alteração pós-ata no EVT-0001, atendidas pela Marina), SOL-0027 (rascunho que sobrou do 1º ensaio,
  já excluído); projeto **"Pórtico boca de 4 m com orelha UX teste"** (duplicado do projeto errado, veja o P2-6),
  peça **UX-TESTE-01**; usuário **ux.auditoria.teste2@nortemkt.com.br** (Requisitante · Produção). Não alterei
  registros de outros agentes: a SOL-0005 só foi aberta. A reabertura do EVT-0004 foi cancelada no diálogo.

## Resumo

| Prior. | Achados |
|---|---|
| **P1** | 2 — atender rápido do painel (some o item, navega sem querer, o "Desfazer" se perde no celular); quadro de tendas que já abre com 5 tendas em 5 locais |
| **P2** | 14 |
| **P3** | 12 |

O que está bom e não deve voltar atrás: o painel de cada perfil diz em uma linha o que precisa de ação. A nova
solicitação foca o campo que falta quando se tenta enviar. A alteração pós-ata sai em 7 cliques pelo desktop.
Rascunho abandonado vira "alteração pós-ata" quando a ata fecha, e a área é avisada. O fechamento da ata leva
direto à OS v1. Reabrir pede justificativa e explica o efeito. As telas sem acesso ("Seu perfil não acessa esta
página") têm saída. Nenhuma das 63 rotas teve rolagem lateral a 375 px nem erro de JS.

---

## 1. Inventário

### 1.1 Páginas (52 `page.tsx`)

| Área | Rotas (as `[id]` foram abertas com um registro real) |
|---|---|
| Entrada | `/login`, `/recuperar-senha`, `/redefinir-senha/[token]` (aberto com token inválido) |
| Painel | `/` (uma versão por perfil) |
| Eventos | `/eventos`, `/eventos/novo`, `/eventos/[id]` (EVT-0001 aberto a alterações, EVT-0002 preparação, EVT-0003 em reunião, EVT-0005 reaberto, EVT-0004 encerrado, EVT-0045 criado aqui), abas `ata`, `os`, `solicitacoes`, `historico`, `editar`, `carga`, `reuniao` (redireciona para `os` depois da ata), `/eventos/[id]/itens/[linhaId]` (**não aberto** — veja §6) |
| Conferência | `/conferencia/[id]` (EVT-0002, EVT-0003, EVT-0045; EVT-0001 redireciona para a OS) |
| Solicitações | `/solicitacoes`, `/solicitacoes/nova` (sem evento, com evento, `?rascunho=`, `?evento=` pós-ata), `/solicitacoes/[id]` em rascunho, enviada, na ata, respondida e devolvida, e `?fila=1` |
| Biblioteca | `/biblioteca` (Projetos, Catálogo de peças), `/projetos` → `/biblioteca`, `/projetos/novo`, `/projetos/novo?de=`, `/projetos/[id]`, `/projetos/[id]/editar`, `/catalogo` → `/biblioteca?aba=pecas`, `/catalogo/nova`, `/catalogo/[id]/editar` |
| Ativação | `/ativacao` (Estoque), `/ativacao/retornos`, `/ativacao/reformas`, `/ativacao/itens/[id]`, `/estoque` → `/ativacao` |
| Arena | `/arena`, `/arena/nova`, `/arena/[slug]` |
| Carga e descarga | `/carga-descarga` (Calendário), `/carga-descarga/cadastro` |
| Inativas (`TELAS_INATIVAS`) | `/consolidacao`, `/consolidacao/pendencias`, `/pendencias` respondem 200 com "Não encontrado" |
| Outras | `/calendario`, `/historico`, `/notificacoes`, `/perfil`, `/admin` (Usuários, Áreas, Configurações; `/admin/usuarios`, `/admin/areas` e `/admin/configuracoes` redirecionam para as abas), `/sem-permissao`, 404 (`/rota-que-nao-existe`) |
| Impressão | `/impressao/os/[id]`, `/impressao/ata/[id]`, `/impressao/arena/[slug]` |

### 1.2 Rotas de API (16)

`anexos/[id]`, `arenas/[slug]/planta`, `ativacao/anexos/[id]`, `auth/portal`, `busca`, `carga-descarga/modelo`,
`cron/verificacoes`, `eventos/[id]/ata/excel`, `eventos/[id]/ata/lista`, `historico/csv`, `os/[id]/[setor]`,
`os/[id]/complemento`, `os/[id]/estrutura`, `os/[id]/excel`, `os/[id]/marcenaria`, `pecas/anexos/[id]`.
Abri pela tela as exportações da OS do EVT-0045 (`excel`, `estrutura`, `marcenaria` e os dois links "CSV"); veja
o P2-5. A busca (`api/busca`) foi testada pelo Ctrl K. Não chamei `auth/portal` nem `cron`.

### 1.3 Server actions (15 arquivos, 85 ações)

admin (5), arena (4) + arenas (6), ativacao (9), biblioteca (5), carga-descarga (5), catalogo (5), **eventos (20)**,
notificacoes (3), pendencias (1), perfil (2), projetos (5), **solicitacoes (9)**, ver-como (2), auth (4).
Percorri pela interface: `salvarEventoAction`, `transicionarEventoAction` (iniciar reunião, fechar ata;
reabrir até o diálogo), `conferirTodasAction`, `salvarDadosReuniaoAutoAction`, `salvarSolicitacaoCompletaAction`,
`enviarRascunhoAction`, `responderItemAction` (pelo painel), `excluirRascunhoAction`, `salvarProjetoAction`
(duplicar), `salvarPecaAction`, `salvarUsuarioAction`, `verComoAction`/`sairVerComoAction`, `loginAction`,
`marcarNotificacaoLidaAction` (abrindo o sino). As outras não foram executadas (veja §6).

### 1.4 Permissões (`src/domain/permissions.ts`, 28 ações)

Conferi o efeito de todas na matriz da §3 (o perfil vê a tela, cai em "sem permissão" ou tem o botão), exceto
`conferencia.editar_descricao` (só admin; vi o link "Editar descrição" só como admin) e `pendencias.*`
(telas inativas).

---

## 2. Tarefas por perfil (cliques hoje → proposta)

Cliques contados pelo script a partir do painel, depois do login. Campos digitados contam à parte.

| # | Perfil · aparelho | Tarefa | Hoje | Proposta | Atritos |
|---|---|---|---|---|---|
| T0 | Logística (Marina) · 1440 | Criar evento | 3 cliques + 3 campos (a reunião vem sugerida: bom) | igual | P2-2 (a ação principal do evento novo é "Iniciar reunião") |
| T1 | Produção (Paulo) · **375** | Pedido pré-reunião com 1 projeto + tendas 3×3 em 2 locais | **16 cliques** + 6 campos; um "Enviar" falhou por descrição pendente | ~10 (quadro de tendas zerado, sem os 3 "Tirar"; descrição pedida ao adicionar) | **P1-2**, P2-3, P3-10 |
| T2 | Produção (Paulo) · 1440 | Alteração pós-ata no EVT-0001 | 7 cliques + 2 campos | 6 (a aba "Projeto padrão" já vem aberta) | P2-8, P2-9 |
| T3 | Logística · 375 e 1440 | Atender a alteração pelo ✓ da fila do painel | 1 clique, sem ver o item; a tela navega para a solicitação | 1 clique, vendo o item, ficando no painel | **P1-1** |
| T3b | Logística · 1440 | Responder em sequência | Painel → 1 clique → modo fila | igual | P2-7, P3-1, P3-2 |
| T4 | Logística · 1440 | Iniciar reunião → conferir → presentes → fechar ata → OS | 11 cliques + 1 campo (a partir de Eventos) | 10 (ir direto para a conferência ao iniciar) | P2-1, P2-2, P2-4, P2-5, P3-3 |
| T5 | Cenografia (Bruno) · 1440 | Buscar projeto e duplicar | 5 cliques + 2 campos — **duplicou o projeto errado** | 5, com o painel lateral mostrando o resultado exato | P2-6 |
| T5b | Cenografia · 1440 | Nova peça | 3 cliques + 2 campos; cai em Fotos da peça nova (bom) | igual | P3-8 |
| T6 | Gestão (Helena) · 1440 | Reabrir evento encerrado | 2 cliques + justificativa (cancelado no diálogo) | igual | P2-12 |
| T7 | Admin · 1440 | Novo usuário (Requisitante · Produção) | 5 cliques + 2 campos; erro "Escolha a área." claro | igual | — |
| T7b | Admin · 1440 | Ver como Solicitante · Gráfica e voltar | 3 cliques (menu da conta) | igual | P3-11 |
| T8 | Ativação (Júlia) · 375 | Abrir um item do estoque | 4 cliques + busca | igual | P2-10, P2-11, P3-9 |
| T9 | Inativo (Tiago) · 375 | Entrar | Mensagem "E-mail ou senha inválidos." | dizer que o acesso foi desativado | P2-13 |
| T10 | Produção · 1440 | Ctrl K "tenda", sino, excluir rascunho | 0 + 1 + 2 cliques | igual | — (busca acha solicitações e projetos; sino agrupa e marca lidas) |

---

## 3. Matriz tela × perfil

Desktop 1440. **✓ nb** = abriu, com n botões visíveis no conteúdo; **⛔** = "Seu perfil não acessa esta página";
**→** = redireciona; **inativa** = 200 com "Não encontrado". Cada célula veio da varredura
(`varredura.jsonl`); os achados de cada tela estão na §4. Nenhuma célula ficou em branco.

| Tela | admin | logística | gestão | cenografia | produção | ativação | gráfica | atendimento |
|---|---|---|---|---|---|---|---|---|
| `/` | ✓ 1b | ✓ 1b | ✓ 0b | ✓ 0b | ✓ 0b | ✓ 0b | ✓ 0b | ✓ 0b |
| `/eventos` | ✓ 3b | ✓ 3b | ✓ 3b | ✓ 3b | ✓ 3b | ✓ 3b | ✓ 3b | ✓ 3b |
| `/eventos/novo` | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/calendario` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes` | ✓ 3b | ✓ 3b | ✓ 3b | ✓ 3b | ✓ 2b | ✓ 2b | ✓ 2b | ✓ 2b |
| `/solicitacoes/nova` | ✓ | ⛔ | ⛔ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/biblioteca` (projetos) | ✓ 5b | ✓ 5b | ✓ 2b | ✓ 5b | ✓ 2b | ✓ 2b | ✓ 2b | ✓ 2b |
| `/biblioteca?aba=pecas` | ✓ 14b | ✓ 14b | ✓ 1b | ✓ 14b | ✓ 1b | ✓ 1b | ✓ 1b | ✓ 1b |
| `/catalogo/nova`, `/projetos/novo` | ✓ | ✓ | ⛔ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/projetos/[id]` | ✓ 3b | ✓ 3b | ✓ 0b | ✓ 3b | ✓ 0b | ✓ 0b | ✓ 0b | ✓ 0b |
| `/projetos/[id]/editar`, `/projetos/novo?de=`, `/catalogo/[id]/editar` | ✓ | ✓ | ⛔ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/arena`, `/arena/[slug]` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/arena/nova` | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/carga-descarga` (+ cadastro) | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/consolidacao`, `/pendencias` | inativa | inativa | inativa | inativa | inativa | inativa | inativa | inativa |
| `/ativacao` (+ retornos, reformas, item) | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ |
| `/historico` | ✓ | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/notificacoes`, `/perfil` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/admin` (3 abas) | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/eventos/[id]` visão geral | ✓ 31b | ✓ 31b | ✓ 2b | ✓ 2b | ✓ 2b | ✓ 2b | ✓ 2b | ✓ 2b |
| abas Ata, OS, Solicitações, Histórico | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| abas Editar, Carga, Reunião | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `/conferencia/[id]` | ✓ 32b | ✓ 28b | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| SOL-0017 respondida (Ativação) | ✓ | ✓ | ✓ | ✓ | ⛔ | ✓ | ⛔ | ⛔ |
| SOL-0010 rascunho (Ativação) | ✓ | ⛔ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ |
| SOL-0007 rascunho (Produção) | ✓ | ⛔ | ⛔ | ⛔ | ✓ | ⛔ | ⛔ | ⛔ |
| SOL-0006 devolvida (Atendimento) | ✓ 2b | ✓ 0b | ✓ | ✓ | ⛔ | ⛔ | ⛔ | ✓ 2b |
| SOL-0012 / SOL-0009 na ata | ✓ | ✓ | ✓ | ✓ | ⛔ | só a da Ativação | ⛔ | só a do Atendimento |
| `/impressao/os`, `/impressao/ata`, `/impressao/arena` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/sem-permissao`, 404 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

O que cada perfil **deveria** ver bate com `permissions.ts` em todas as células, com duas observações de
usabilidade (P3-6 e P3-7): o rascunho de outra área cai em "Seu perfil não acessa esta página", e o menu
"Arena 3D" aparece para todos os requisitantes.

**Celular 375**: produção, logística e ativação passaram pelas 63 rotas. Admin, cenografia, gráfica e atendimento
passaram pelas 11 rotas principais (painel, eventos, calendário, solicitações, nova, biblioteca, notificações,
EVT-0001, SOL-0017, admin/usuários). Gestão a 375 ficou **não verificada**. Nenhuma página passou da largura de
375; os cortes que encontrei ficam dentro de tabelas (P3-10). A matriz completa a 375, rota por rota, está em
`...\auditoria\ux\matriz-375.md` (as células "não verificado" são as rotas fora do subconjunto); a de 1440, rota
por rota, em `matriz-1440.md`.

"Ver como" do admin: troquei para Solicitante · Gráfica e voltei. O cookie e a faixa "Você está vendo o app
como…" funcionaram. Não repeti a varredura de rotas com "ver como", porque ela usa as mesmas permissões do
perfil, já varrido com login próprio.

---

## 4. Atritos

### P1 — impede ou induz ao erro

**P1-1 · Painel › Fila de resposta › ✓ "atender rápido" (logística, admin)** — *o ponto em aberto confirmado,
e pior do que parecia*
- **O que se vê.** A 375 px a linha mostra só `SOL-0030 · fora da janela · Produção · Festival Prai…`. Não
  aparecem o título, o item nem a quantidade, e o ✓ fica ao lado (`evidencias/P1-01a-fila-375-sem-item.png`).
  A 1440 o título vira "Ba…" porque o selo "fora da janela" ocupa o espaço (`P1-01d-fila-1440-titulo-Ba.jpg`).
  O que será atendido ("Quadro de fotos 4×3 m × 1") só existe no `title` e no `aria-label`, e no toque não há
  hover.
- **O que acontece ao tocar.** Atende **e navega** para a solicitação. Reproduzi três vezes:
  - SOL-0030 a 375;
  - SOL-0031 a 1440, clique no centro do botão: atendeu e abriu `/solicitacoes/…`
    (`P1-01b-toque-check-abriu-solicitacao.png`, `P1-01c-1440-check-navegou.png`);
  - SOL-0032 a 1440, clique na borda do botão: atendeu e **ficou** no painel.
- **Efeito.** No celular o toast com "Desfazer" não aparece depois da navegação. A pessoa atende sem ver o quê,
  sai da fila e perde o desfazer.
- **Causa provável.** `src/components/ui/linha-link.tsx:9-11`: `deveIgnorar` testa
  `alvo instanceof HTMLElement`. O clique no ícone tem como alvo o `<svg>`, que é `SVGElement` e não
  `HTMLElement`, então a linha trata o clique como dela. Vale para todo botão de ícone dentro de `LinhaLink` que
  não pare a propagação. Na lista de itens do evento o lápis não navegou: aquele botão para a propagação.
- **Mudança sugerida.** Em `linha-link.tsx:10`, testar `alvo instanceof Element`. No painel
  (`src/app/(app)/page.tsx:101-136`), mostrar o item e a quantidade embaixo do título ("Quadro de fotos 4×3 m ×
  1"), também a 375, em vez de deixá-los só no `title`.

**P1-2 · Nova solicitação › quadro "Tenda 3×3 m por local" já vem com 5 tendas** (`src/components/solicitacoes/quadro-tendas.tsx:46`,
`nova/dialogo-tendas.tsx:83`)
- **O que se vê.** Ao tocar em "Pedir" na Tenda 3×3 da lista da área, o quadro abre com Buffet 1, Som 2, Crono 1,
  Limpeza 0 e Extra 1 (5 tendas), e o botão diz "Adicionar 5 tendas". O aviso é "Zere o que não vai"
  (`P1-02a-tendas-pre-preenchidas.png`).
- **Contraste.** Na mesma tela a lista da área diz o contrário: "A lista da ata vem zerada. Ponha só a
  quantidade do que vai".
- **O que aconteceu na tarefa.** Para pedir tendas em 2 locais renomeei os 2 primeiros e toquei 3 vezes em
  "Tirar". Saí com **3 tendas** (1 + 2 herdadas de Buffet e Som), não 2 (`P1-02b-tendas-apos-tirar.png`).
  No celular o quadro é um sheet longo: as quantidades pré-preenchidas ficam fora da vista.
- **Mudança sugerida.** Manter os locais comuns como sugestão (nome preenchido ou atalho), com **0 tendas**, para
  "Adicionar N tendas" contar só o que a pessoa pôs. A regra de "locais padrão" (`LOCAIS_PADRAO_TENDA`) continua;
  muda só o valor inicial.

### P2 — atrasa ou confunde

| # | Tela (arquivo:linha) | Problema observado | Mudança sugerida (uma frase) | Print |
|---|---|---|---|---|
| P2-1 | Evento › "Iniciar reunião" (`components/eventos/acoes-evento.tsx:51,151`; `banner-reuniao.tsx:98-103`) | A confirmação diz "Os envios… ficam bloqueados", mas não diz que a reunião está marcada para 10/11, daqui a 13 dias: o número está no cartão atrás do diálogo | Pôr a data marcada e "faltam N dias" no texto do diálogo quando a reunião é iniciada antes do dia | `P2-confirm-iniciar-sem-data.png` |
| P2-2 | Cabeçalho do evento: ação principal da fase (`acoes-evento.tsx:46-77,104-121`) | Evento recém-criado: o primário é "Iniciar reunião" (13 dias antes). Logo depois da ata, com o evento em 48 dias: o primário é "Encerrar evento", competindo com "Marcar v1 como enviada", que é o próximo passo real na aba OS | Antes do dia da reunião, "Iniciar reunião" como secundário; depois da ata, "Encerrar evento" como secundário até a data do evento | `P2-os-csv-e-encerrar.png` |
| P2-3 | Nova solicitação › rodapé fixo no celular (`nova/resumo-envio.tsx:261`) | Descrição obrigatória (com "Descrever cada unidade" já marcado) só se revela ao enviar. O rodapé corta o motivo: "Falta: descrever as unidades d…" | No celular, quebrar o motivo em 2 linhas ou mostrar "1 pendência" e levar a ela; ao adicionar, o item já aparece como "falta descrever" | `P2-rodape-falta-descrever.png` |
| P2-4 | Iniciar reunião pela página do evento (`banner-reuniao.tsx`, `acoes-evento.tsx`) | Depois de confirmar, a tela continua na Visão geral; a conferência é a próxima tarefa e precisa da aba "Conferência". Fechar a ata, ao contrário, já leva à OS | Depois de "Iniciar reunião", ir para `/conferencia/[id]`, como já acontece no "Fechar ata" → OS | `P2-apos-iniciar-fica-na-visao-geral.png` |
| P2-5 | OS › Totais por peça › botão "CSV" da seção Estrutura (`components/eventos/os-visoes.tsx:265-269`) | O botão diz "CSV" e `title` "Baixar Estrutura em CSV", mas `/api/os/[id]/estrutura` é a rota fixa do Excel "OS de estrutura" (content-type `.xlsx`): a rota estática ganha da `[setor]`. A seção Tendas baixa CSV mesmo | Dar à exportação por seção um caminho que não colida (ex.: `/api/os/[id]/secao/[setor]`) ou renomear a chave da seção | `P2-os-csv-e-encerrar.png` |
| P2-6 | Biblioteca › painel lateral (`app/(app)/biblioteca/page.tsx:166`) | Busquei o nome exato "Pórtico boca de 4 m com orelha". O painel abriu com o **1º resultado** em ordem alfabética ("…de 10 m — com aplique"); o exato era o 8º. Cliquei na linha (que navega e demora no servidor lento) e depois em "Duplicar" no painel: **duplicou o de 10 m** | Com busca, selecionar o resultado exato quando existir (ou nenhum) e pôr os exatos primeiro; o clique na linha também atualiza o painel | `P2-biblioteca-painel-1o-resultado.png` |
| P2-7 | Solicitações (logística) (`app/(app)/solicitacoes/page.tsx:51`) | Abre em "Todas", por código decrescente; a única que precisa de ação (SOL-0005, atrasada) é a **última** de 24 linhas. O mesmo estado tem quatro nomes: "Enviada" (status), "Aguardando resposta" (aba), "Fila de resposta" (painel) e "Respondendo em sequência" (banner) | Para Logística/Admin, abrir em "Aguardando resposta" (ou ordenar por prazo) e usar um nome só: "Aguardando resposta" | `P2-solicitacoes-logistica-atrasada-no-fim.jpg` |
| P2-8 | Painel do solicitante › "Respostas recebidas" (`app/(app)/page.tsx:364`) | A SOL-0028, que acabei de enviar, aparece em "Respostas recebidas" como "Na ata", sem resposta nenhuma; "Suas solicitações em andamento" lista só rascunhos | Reforça a proposta do 28/10: uma lista "Suas solicitações" com o estado; enquanto isso, só mover para "Respostas" o que a logística respondeu | `P2-painel-paulo-respostas.png` |
| P2-9 | Evento › cartão "Alterações até 27/10" (visão geral) | Com o evento "Aberto a alterações", o maior número da tela é uma data já passada, sem dizer o que isso muda (só a nova solicitação explica: resposta em até 48h) | Data vencida: "janela encerrada em 27/10 · pedidos ainda entram, com resposta em até 48h" | `P2-evento-visao-paulo.png` |
| P2-10 | Ativação › Estoque › quantidade "Em posse" (`components/estoque/estoque-tela.tsx:239`) | O stepper de cada linha (244 linhas) grava na hora ("salvando… salvo"), sem desfazer; no celular, um toque perdido na rolagem muda o estoque | Toast com "Desfazer" depois de gravar (como o atender rápido) ou edição pelo lápis no celular | `P2-ativacao-375-abas.png` |
| P2-11 | Ativação › abas do estoque a 375 | 7 sub-abas em 4 linhas, 4 delas com 0 (A comprar, Em eventos, Em reforma, Inativos), empurrando a lista para baixo da dobra | Esconder as abas com 0 no celular ou trocar por um seletor "Mostrar: Todos (244)" | `P2-ativacao-375-abas.png` |
| P2-12 | Painel da Gestão › "Precisa de você agora" (`components/painel/agora.tsx:38`) | A Gestão vê "Reunião de OS às 09:00" e "1 solicitação atrasada" sob "Precisa de você agora", mas não age em nenhum dos dois | Para quem só acompanha: "Atenção agora" (ou "Para acompanhar") | `P3-painel-gestao.png` |
| P2-13 | Login com conta desativada (`app/(auth)/actions.ts`) | Tiago (inativo), com a senha certa, vê "E-mail ou senha inválidos.", igual à senha errada; o caminho natural é "Esqueci minha senha", que vai ao admin sem dizer o motivo | Decisão de segurança. Recomendo, **só com a senha correta**, "Seu acesso foi desativado. Fale com o administrador." | `P2-login-inativo.png` |
| P2-14 | Eventos › lista (`app/(app)/eventos/page.tsx`) — não foi redesenhada hoje | Selo de fase **e** barra de progresso por linha; até 5 selos verdes de área (EVT-0001); "não iniciada · 20/10 14:00" em amarelo em 17 linhas; abas "Encerrado" e "Realizados" sem diferença clara (`:27-35`; "Realizados" = encerrado com data passada) | Aplicar a "Densidade das listas" (§4 do design system): fase em ponto + texto, áreas em número ("3 de 5") com nomes no title; juntar Encerrado e Realizados ou explicar na aba | `P2-lista-eventos.jpg` |

### P3 — acabamento

| # | Tela (arquivo:linha) | Problema | Sugestão | Print |
|---|---|---|---|---|
| P3-1 | Modo fila (`app/(app)/solicitacoes/[id]/page.tsx:178`) | Na última da fila o botão "Próxima" vira "Fila zerada" (desabilitado) enquanto ainda se responde a solicitação aberta | "Última da fila" | `P3-modo-fila.png` |
| P3-2 | Modo fila / detalhe | Com 1 item, "Atender tudo" (cabeçalho) e "Atender 2" (item) fazem o mesmo; "Atender tudo" não oferece "Desfazer", o ✓ do painel oferece | Com 1 item pendente, só o botão do item; "Desfazer" também no "Atender tudo" | `P3-modo-fila.png` |
| P3-3 | Aba OS, 1ª versão | Cartão inteiro para "É a primeira versão: ainda não há outra para comparar" | Uma linha, ou nada na v1 | `P2-os-csv-e-encerrar.png` |
| P3-4 | Conferência (todas as larguras) | "0 de 5 conferidas", aba "A conferir 6", "Conferir as 5 restantes": a linha opcional entra numa conta e não na outra | Mesma base nas três (ex.: "A conferir 5 · +1 opcional") | `P3-conferencia-375-contagens.png` |
| P3-5 | Solicitação na ata (SOL-0012) | No mesmo pedido um item tem "Ajustar" e o outro "Corrigir resposta" (`item-resposta.tsx:719`); o histórico diz "Entrou na ata (sem avaliação)", e a Atividade do evento diz "atendido (2 de 2)" com o nome do **solicitante** (EVT-0045) | Um verbo para "mexer no que já está na ata"; na Atividade, "entrou na ata", não "atendido" | `P3-sol0012-ajustar-corrigir.jpg`, `P2-apos-iniciar-fica-na-visao-geral.png` |
| P3-6 | Rascunho de outra área / pedido de outra área | Cai em "Seu perfil não acessa esta página": o problema não é o perfil, é o pedido ser de outra área ou ainda não enviado | Texto específico: "Esta solicitação é da área X" / "ainda é rascunho da área" | varredura `logistica-1440/49__…` |
| P3-7 | Menu "Arena 3D" para requisitantes (`app/(app)/layout.tsx:45`) | Item fixo no menu de todos; para o requisitante a página só lista as arenas (0 botões), sem ligação com a tarefa dele | Mostrar no menu só para quem edita, ou só se o evento do usuário tem arena; o link "Criar mapa da arena" do evento continua | varredura `producao-1440/13__arena.jpg` |
| P3-8 | Nova peça › "Estoque próprio" (`components/catalogo/peca-form.tsx:69`) | A dica fala em "consolidação por período (integração futura…)", tela que está inativa | Tirar a referência ou dizer que hoje não é usado | `fluxos/t4b-ceno-1440-peca/02-form.png` |
| P3-9 | Ativação › item › Fotos vazio (`app/(app)/ativacao/itens/[id]/page.tsx:90`) | "ela aparece na lista do estoque", mas a miniatura saiu da lista hoje (aba1843) | "aparece aqui e nos detalhes da solicitação" | `fluxos/t7-ativacao-375/04-item.png` |
| P3-10 | Detalhe da solicitação a 375 (tenda) | "1 tenda · sem fechamento · sem…" corta na borda; na nova solicitação a tabela Local/Tendas/Descrição corta "DES…" (rolagem só dentro da tabela) | Quebrar a linha do local em 2 no celular | `P3-sol-375-tenda-cortada.png`, `P2-rodape-falta-descrever.png` |
| P3-11 | "Ver o app como…" | Só existe dentro do menu da conta (avatar); o admin que não conhece não acha | Atalho também em Administração › Usuários ("Ver como este perfil") | `fluxos/t6-admin-1440/04-menu-conta.png` |
| P3-12 | Carga e descarga | "15 cargas · 2 descargas · **0 veículos**" na mesma faixa: lê-se como erro (as cargas vêm da planilha, sem veículo cadastrado) | "0 veículos cadastrados" ou esconder o 0 | varredura `logistica-1440/15__carga_descarga.jpg` |

Visto e sem achado: 404 e "sem permissão" (com saída), recuperar senha, link de redefinição inválido (diz o que
fazer), Ctrl K (acha solicitações e projetos por palavra), sino (agrupa, marca lidas, avisa o rascunho que virou
alteração pós-ata), novo usuário (validação da área), reabrir em exceção (justificativa obrigatória, efeito
explicado), criação de peça (vai para Fotos), impressões da OS, da ata e da arena (abrem para todos os perfis).

---

## 5. Sobre o ponto em aberto (fila do painel)

Hoje o item e a quantidade estão só no `title` e no toast. **Fica escondido algo essencial:** no celular a linha
não mostra nem o título, e o toque no ✓ (no ícone) leva para outra tela, onde o toast com "Desfazer" não
aparece. Recomendo, nesta ordem:

1. Corrigir `linha-link.tsx:10` (`Element` em vez de `HTMLElement`). É o que causa a navegação e vale para
   outros botões de ícone em linhas clicáveis.
2. Uma segunda linha só com o item: "Quadro de fotos 4×3 m × 1". O design-log de hoje tirou "área · evento ·
   1 item" da linha; o item é a informação de que a decisão depende, não um repetido.
3. Manter o toast com "Desfazer" (já existe).

---

## 6. O que não foi percorrido

- **Gestão a 375 px**: nenhuma rota. Admin, cenografia, gráfica e atendimento a 375: só as 11 rotas principais.
  Nenhum perfil a 768 px.
- **Item do evento** (`/eventos/[id]/itens/[linhaId]`): ficou fora da lista de rotas do meu script de varredura
  e não foi aberto por nenhum perfil. Só vi o lápis da lista abrir o diálogo "Editar Palco 8×4 m…".
- **Ações não executadas**: devolver, cancelar, atender parcial ou não atender com motivo, vincular ao catálogo,
  incluir linha, ajustar peça ou tendas do local; editar e salvar evento; observações; marcar OS como enviada;
  encerrar evento; reabrir (só até o diálogo); Arena 3D (criar, planta, pontos); carga e descarga (novo
  veículo, importar planilha); Ativação (novo item, retorno, reforma, anexos); Biblioteca (lote, grupos,
  anexos, inativar); áreas e configurações do admin; alterar senha e encerrar sessões; troca de senha
  obrigatória no 1º acesso (não troquei senhas compartilhadas).
- **Downloads**: só conferi tipo e status das exportações da OS. Não abri o conteúdo dos .xlsx, o CSV do
  histórico nem a planilha de modelo de carga.
- **Estados**: sem rede ou erro do servidor, carregando prolongado (só vi os esqueletos), lista vazia de verdade
  (o banco está cheio), texto longo extremo.
- **Teclado** (A/P/N na fila, setas e espaço na conferência, Esc nos diálogos): não testado nesta rodada.
- **Leitor de tela/axe**: fora do foco; só usei os nomes acessíveis para achar os elementos.
