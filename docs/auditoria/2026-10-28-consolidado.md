# Auditoria de 28/10/2026 — lista consolidada

Junta os seis relatórios desta pasta: `security-review` (SEG), `logic-auditor` (LOG), `ux-intuitive` (UX),
`visual-qa` (VIS), `copy-review` (TXT) e `a11y-perf` (A11Y, com os achados de desempenho `D-…`). Situação conferida
no código em 29/10, sobre `d3de62d` (`git log`: d3de62d, 07ad7fa, 2bb3745…), e na cópia de trabalho.

## Resumo

- **188 achados** depois de juntar o que se repetia (os relatórios somam cerca de 205): **18 P1 · 73 P2 · 97 P3**.
- **Corrigidos: 9** (commit local `07ad7fa`, conferido no código): LOG P1-1, P1-2, P1-3, P2-4, P2-5, P2-6, P3-8, P3-9 e
  P3-10. Mais **2 corrigidos só na cópia de trabalho, ainda sem commit** (nº 90 e 91: textos do histórico de tendas e da
  estrutura locada). Alguém está mexendo nesses arquivos agora (`conferencia.ts`, `separacao.ts`, `separacao-locada.tsx`,
  `impressao/os/[id]/page.tsx`).
- **Dependem de decisão do time: 7** (estoque sem paginação, mensagem para conta desativada, tamanho do título das telas de
  detalhe, menu lateral escuro, acentos nas planilhas no modelo da cenografia, fechamentos na tela da solicitação, nome do
  item em "O que mudou").
- **A corrigir: 170.** Dos 15 P1 em aberto, 3 são de segurança (dependências com falha pública, acesso que fica depois da
  troca de área e aba OS mostrando dados de outra área). Os outros 12 estão no painel da logística, na nova solicitação, na lista
  de itens do evento, nos componentes de lista, na Arena e em textos.
- `main` está 2 commits à frente e 1 atrás de `origin/main`: o `07ad7fa` ainda não foi publicado.

**Como a prioridade foi unificada.** P1 = dado errado, acesso indevido, perda de dado ou impede a tarefa; P2 = atrapalha,
confunde ou risco provável; P3 = acabamento. Os relatórios de LOG, UX, VIS, TXT e A11Y já usam P1/P2/P3 e foram mantidos.
SEG usa Alto/Médio/Baixo. A conversão foi: Alto → P1; Médio com acesso indevido comprovado (SEC-02, SEC-04) → P1; os
outros Médios → P2; Baixo → P3. Quando dois relatórios deram prioridades diferentes ao mesmo problema, vale a maior, e a
linha diz isso. Tamanho (P/M/G) é estimativa a partir da correção sugerida no relatório. As linhas de código são as dos
relatórios. As dos P1 e as de `conferencia.ts` (que mudou no `07ad7fa`) foram conferidas no código atual.

## 1. Achados

| nº | Prior. | Área | Problema (e origem) | Onde | Tam. | Situação |
|---|---|---|---|---|---|---|
| 1 | P1 | Segurança | A produção instala versões do Next, zod e sharp com falhas públicas graves (2 críticas no Next), diferentes das que rodam nos testes. *SEG SEC-05 (Alto)* | `package-lock.json`; `.replit` (`npm ci`) | P | a corrigir |
| 2 | P1 | Segurança / permissões | Quem muda de área continua vendo, editando, enviando e excluindo os pedidos da área antiga. *SEG SEC-02 (Médio, acesso indevido comprovado)* | `src/server/auth/session.ts:23`, `:195`, `:213`; `src/domain/permissions.ts:97-122` | M | a corrigir |
| 3 | P1 | Evento › aba OS | Qualquer perfil lê na aba OS o motivo que a logística escreveu sobre o pedido de outra área, além do código, do item e da situação dos pedidos de outras áreas. *SEG SEC-04 (Médio, acesso indevido comprovado)* | `src/app/(app)/eventos/[id]/os/page.tsx:53`; `src/server/services/os.ts:110`; textos gravados em `conferencia.ts:323`, `:760`, `eventos/ata.ts:247`, `solicitacoes/resposta.ts:162`, `solicitacoes/envio.ts:65` | M | a corrigir |
| 4 | P1 | Conferência › tendas | Duas áreas com tenda no mesmo local: mexer só nos fechamentos tirava a tenda de uma área e a passava para a outra. *LOG P1-1* | `src/domain/tendas.ts:271` (`distribuirTendasDoLocal`); `src/server/services/conferencia.ts:600-746` | — | corrigido (07ad7fa: o quadro é aplicado às linhas existentes, sem trocar o dono) |
| 5 | P1 | Conferência › tendas | Fechamentos que não dividem igual entre as tendas marcavam o pedido como "parcial" e avisavam a área. *LOG P1-2* | `conferencia.ts:670-680` | — | corrigido (07ad7fa: a linha se divide em partes da mesma área e a resposta olha a soma) |
| 6 | P1 | Conferência › tendas | Um erro no meio do salvamento do quadro deixava o local pela metade (2 tendas viravam 1). *LOG P1-3* | `conferencia.ts:548-570` (`ajustarTendasDosLocais`) | — | corrigido (07ad7fa: uma transação com o evento travado) |
| 7 | P1 | Painel › fila de resposta | Tocar no ✓ de "atender" atende e abre a solicitação. No celular, o "Desfazer" se perde e a pessoa sai da fila. *UX P1-1* | `src/components/ui/linha-link.tsx:9-10` (`instanceof HTMLElement` não pega o clique no ícone) | P | a corrigir |
| 8 | P1 | Painel › fila de resposta | O selo "fora da janela" espreme o título da solicitação ("Ba…", ou some no celular), e o item com a quantidade só aparece passando o mouse. *VIS #1 · UX P1-1* | `src/app/(app)/page.tsx:101-107` (larguras em `:82-90`) | P | a corrigir |
| 9 | P1 | Painel › fila de resposta | No celular, o prazo ("até 30/10 13:30") é cortado na borda do cartão. *VIS #2* | `src/app/(app)/page.tsx:85`, `:57-61` | P | a corrigir |
| 10 | P1 | Nova solicitação › tendas | O quadro de tendas já abre com tendas em vários locais ("Adicionar 5 tendas"), e quem só ajusta acaba pedindo tenda a mais. O código atual faz o mesmo na 5×5 (8 tendas). *UX P1-2* | `src/domain/tendas.ts:115-129` (`LOCAIS_PADRAO_TENDA`); `src/components/solicitacoes/quadro-tendas.tsx:46`; `nova/dialogo-tendas.tsx:83` | P | a corrigir |
| 11 | P1 | Evento › itens (celular) | Na lista de itens do evento, o nome do item fica com cerca de 12 letras para quem pode editar. *VIS #3* | `src/components/eventos/lista-itens-evento.tsx:140`, `:152` | M | a corrigir |
| 12 | P1 | Diálogos no celular | Em "Novo veículo" e "Enviar para reforma", a lista de opções abre sozinha para cima e esconde as primeiras opções e o título. *VIS #42* | `src/components/ui/combobox.tsx:83-90`, `:125-129` | M | a corrigir |
| 13 | P1 | Listas suspensas e menus | Quem usa o teclado não vê qual opção está destacada em filtros, menus, buscas e campos de escolha. *A11Y A-P1-1* | `src/components/ui/select.tsx:125-126`; `ui/dropdown.tsx:25-26`; `ui/combobox.tsx:190`; `shell/busca-global.tsx:184`; `arena/arena-barra-ferramentas.tsx:145` | P | a corrigir |
| 14 | P1 | Solicitação › resposta | Apertar "A" em qualquer lugar da página responde "Atendido" no item que estava em foco. *A11Y A-P1-2* | `src/components/solicitacoes/item-resposta.tsx:142-167` | P | a corrigir |
| 15 | P1 | Arena › editar mapa | Não dá para pôr ou mover pontos no mapa sem mouse ou toque. *A11Y A-P1-3* | `arena/arena-experiencia.tsx:440-450`; `arena/plano-2d.tsx:203-206`, `:275-283`; `arena/arena-marcadores-3d.tsx:96-121`; `arena/arena-barra-edicao.tsx:278-294` | G | a corrigir |
| 16 | P1 | Textos › erros | As mensagens de "não encontrado" erram o gênero ("Solicitação não encontrado.", "Peça … não encontrado.") e não dizem o que fazer. *TXT #1* | `src/domain/errors.ts:19` (+ ~40 chamadas; ex.: `conferencia.ts:657`) | M | a corrigir |
| 17 | P1 | Carga › importar planilha | A mensagem de tipo inválido sai colada: "(usekit, ceno, estrutura, ativação)". *TXT #2* | `src/domain/carga-importacao.ts:158` | P | a corrigir |
| 18 | P1 | Biblioteca › nova peça | A dica de "Estoque próprio" promete uma consolidação por período, mas essa tela está desligada. *TXT #4 (P1) · UX P3-8 (P3): vale a maior* | `src/components/catalogo/peca-form.tsx:69` | P | a corrigir |
| 19 | P2 | Segurança › histórico | Texto digitado por uma área vira fórmula quando a logística ou a gestão abre o CSV do histórico no Excel. *SEG SEC-01 (Médio)* | `src/app/api/historico/csv/route.ts:12` | P | a corrigir |
| 20 | P2 | Conferência › tendas | Um salvamento do quadro com a ata fechada gerava até 7 versões da OS e 7 avisos. *LOG P2-4* | `conferencia.ts:759-768` (`fecharAjustePosAta`) | — | corrigido (07ad7fa: uma versão e um aviso por salvamento) |
| 21 | P2 | Evento › incluir item | Incluir tenda com fechamentos depois da ata gerava 2 versões, e um erro no meio deixava a tenda sem fechamentos. *LOG P2-5* | `conferencia.ts:577-595` (`incluirTendaNaAta`); `app/(app)/eventos/actions.ts:127` | — | corrigido (07ad7fa) |
| 22 | P2 | Biblioteca › projeto | Um projeto editado na Biblioteca mudava a OS de evento com ata fechada sem avisar a área que pediu. *LOG P2-6* | `src/server/services/eventos/versoes.ts:71-85` | — | corrigido (07ad7fa: avisa quem tem pedido no evento, a opção recomendada) |
| 23 | P2 | Solicitações › lista | O selo "fora da janela" corta o título e deixa linhas diferentes iguais ("Quadro de fotos 4×…"). *VIS #4* | `src/app/(app)/solicitacoes/page.tsx:259-263` | P | a corrigir |
| 24 | P2 | Solicitações › lista (celular) | O título da solicitação fica com 10 a 15 letras, sem texto completo ao tocar. *VIS #5* | `src/app/(app)/solicitacoes/page.tsx:219` | P | a corrigir |
| 25 | P2 | Solicitações (logística) | A lista abre em "Todas" e a única atrasada fica no fim. O mesmo estado tem 4 nomes ("Enviada", "Aguardando resposta", "Fila de resposta", "Respondendo em sequência"). *UX P2-7* | `src/app/(app)/solicitacoes/page.tsx:51` | P | a corrigir |
| 26 | P2 | Painel do solicitante | Um pedido recém-enviado aparece em "Respostas recebidas" sem resposta nenhuma. *UX P2-8* | `src/app/(app)/page.tsx:364` | M | a corrigir |
| 27 | P2 | Painel da Gestão | "Precisa de você agora" lista coisas que a Gestão não pode fazer (iniciar reunião, responder). *UX P2-12 · VIS (observação da matriz)* | `src/components/painel/agora.tsx:38` | P | a corrigir |
| 28 | P2 | Painel do solicitante | Em "Seus eventos", o nome do evento é cortado, enquanto as colunas ao lado sobram. *VIS #14* | `src/components/painel/eventos-solicitante.tsx:63-67` | P | a corrigir |
| 29 | P2 | Nova solicitação (celular) | A descrição obrigatória só aparece ao enviar, e o rodapé corta o motivo ("Falta: descrever as unidades d…"). *UX P2-3* | `src/components/solicitacoes/nova/resumo-envio.tsx:261` | M | a corrigir |
| 30 | P2 | Formulários (celular) | O campo em que se está digitando fica escondido atrás da barra fixa do rodapé. *A11Y A-P2-8* | `projetos/projeto-form.tsx:234`; `catalogo/peca-form.tsx:103`; `solicitacoes/nova/resumo-envio.tsx:254` | P | a corrigir |
| 31 | P2 | Evento › iniciar reunião | A confirmação não diz que a reunião está marcada para daqui a vários dias. *UX P2-1* | `src/components/eventos/acoes-evento.tsx:51`, `:151`; `banner-reuniao.tsx:98-103` | P | a corrigir |
| 32 | P2 | Evento › cabeçalho | O botão principal sugere o passo errado: "Iniciar reunião" 13 dias antes, e "Encerrar evento" logo depois da ata, competindo com "Marcar v1 como enviada". *UX P2-2* | `src/components/eventos/acoes-evento.tsx:46-77`, `:104-121` | M | a corrigir |
| 33 | P2 | Evento › iniciar reunião | Depois de iniciar a reunião, a tela fica na visão geral em vez de ir para a conferência. *UX P2-4* | `banner-reuniao.tsx`; `acoes-evento.tsx` | P | a corrigir |
| 34 | P2 | Evento › OS | O botão "CSV" da seção Estrutura baixa um Excel (o endereço colide com o da OS de estrutura). *UX P2-5* | `src/components/eventos/os-visoes.tsx:265-269`; `app/api/os/[id]/estrutura` × `[setor]` | M | a corrigir |
| 35 | P2 | Evento › visão geral | O cartão "Alterações até 27/10" mostra uma data vencida sem dizer o que isso muda. *UX P2-9* | visão geral do evento (o relatório não cita o arquivo) | P | a corrigir |
| 36 | P2 | Evento › aba Solicitações | A aba do evento usa outro desenho de linha (selos cheios, "por fulano") em vez do da lista geral de solicitações. *VIS #7* | `src/app/(app)/eventos/[id]/solicitacoes/page.tsx:88-118` | M | a corrigir |
| 37 | P2 | Evento › OS (celular) | A origem de cada peça na "Composição" é cortada sem texto completo. *VIS #13* | `src/components/eventos/os-visoes.tsx:305` | P | a corrigir |
| 38 | P2 | Eventos › lista | Cada linha tem selo de fase, barra de progresso, até 5 selos de área e "não iniciada" em amarelo: a lista fica carregada. *UX P2-14* | `src/app/(app)/eventos/page.tsx` | M | a corrigir |
| 39 | P2 | Eventos › abas | As abas de fase têm nomes diferentes dos selos ("Aberto" × "Aberto a alterações"), e "Encerrado" e "Realizados" não se distinguem. *TXT #10 · UX P2-14* | `src/app/(app)/eventos/page.tsx:27-35` × `src/domain/evento.ts:115-119` | P | a corrigir |
| 40 | P2 | Biblioteca › painel lateral | Com busca, o painel mostra o 1º resultado da lista, e não o nome exato: a pessoa duplicou o projeto errado. *UX P2-6* | `src/app/(app)/biblioteca/page.tsx:166` | M | a corrigir |
| 41 | P2 | Biblioteca › filtros | No celular são 6 linhas de filtro antes da lista. No desktop, "Todos os eventos" ocupa uma linha inteira. *VIS #11* | `src/app/(app)/biblioteca/page.tsx:70`, `:192` | P | a corrigir |
| 42 | P2 | Ativação › estoque | O "+/−" de cada linha grava na hora, sem desfazer: um toque perdido ao rolar no celular muda o estoque. *UX P2-10* | `src/components/estoque/estoque-tela.tsx:239` | M | a corrigir |
| 43 | P2 | Ativação › estoque (celular) | São 7 abas em 4 linhas, 4 delas vazias, e elas empurram a lista para baixo. *UX P2-11* | `src/components/estoque/estoque-tela.tsx` (abas) | P | a corrigir |
| 44 | P2 | Ativação › estoque | O estoque mostra 244 linhas editáveis de uma vez (página pesada, 7,6 mil elementos). *A11Y D-P2-1* | `src/components/estoque/estoque-tela.tsx:147`; `app/(app)/ativacao/(abas)/page.tsx:22`, `:25` | G | decisão do time: paginar ou virtualizar o estoque, ou manter a lista inteira na tela. Recomendado: paginar (50 por página) com busca e filtro no servidor e carregar o catálogo só ao abrir "Novo item" |
| 45 | P2 | Ativação › item | Abrir um item do estoque calcula o estoque inteiro, duas vezes (29–30 consultas). *A11Y D-P2-3* | `app/(app)/ativacao/itens/[id]/page.tsx:24`, `:35`; `services/ativacao.ts:255` | P | a corrigir |
| 46 | P2 | Login | Quem teve o acesso desativado vê "E-mail ou senha inválidos." e tenta de novo até ser bloqueado. *UX P2-13 (P2) · TXT #74 (P3): vale a maior* | `src/server/auth/session.ts:68`; `app/(auth)/actions.ts` | P | decisão do time (segurança): dizer ou não que a conta foi desativada. UX recomenda dizer só com a senha correta ("Seu acesso foi desativado. Fale com o administrador."); TXT recomenda a mesma frase genérica com "Se a sua conta foi desativada, fale com o administrador." |
| 47 | P2 | Login e senhas | Depois de um erro, o foco se perde e nenhum campo fica marcado como errado para o leitor de tela. *A11Y A-P2-11* | `(auth)/login/login-form.tsx:81`; `recuperar-form.tsx:28`; `redefinir-senha/[token]/form.tsx:26`; `admin/senha-form.tsx:27` | P | a corrigir |
| 48 | P2 | Busca global (celular) | Abrir a busca pelo menu deixa a gaveta aberta atrás, com dois campos de busca sobrepostos. *VIS #37* | `src/components/shell/app-shell.tsx:215-217` | P | a corrigir |
| 49 | P2 | Menu (celular) | Com a gaveta do menu aberta, o foco não entra nela e o Tab passa para o conteúdo de trás. *A11Y A-P2-1* | `src/components/shell/app-shell.tsx:147-150`, `:174-190`, `:268` | M | a corrigir |
| 50 | P2 | Notificações (sino) | O painel do sino continua aberto, cobrindo a página, quando o foco sai dele. *A11Y A-P2-5* | `src/components/shell/sino-notificacoes.tsx:112-113` | P | a corrigir |
| 51 | P2 | Telas de detalhe | O título de evento, projeto e item da Ativação é maior (24 px) que o das outras telas de detalhe (18 px). *VIS #6* | `app/(app)/eventos/[id]/layout.tsx:109`; `projetos/[id]/page.tsx:54`; `ativacao/itens/[id]/page.tsx:48` | P | decisão do time: todos os detalhes no tamanho pequeno, ou a regra passa a dizer "registro principal = 24". O relatório não escolhe: pede decidir e registrar |
| 52 | P2 | Carga › gráfico | Os rótulos do gráfico "Volume por semana" têm 9 px, e no celular "hoje" e "nov" se sobrepõem. *VIS #8* | `src/components/carga/calendario-carga.tsx:437` | P | a corrigir |
| 53 | P2 | Admin › navegação | O Admin troca de seção por pílulas com abas dentro, e as outras telas usam abas sublinhadas. *VIS #9* | `src/app/(app)/admin/page.tsx:149` | P | a corrigir |
| 54 | P2 | Ativação e Carga | "Novo item" e "Novo veículo" ficam na barra de filtros, não no topo como nas outras listas. *VIS #10* | `src/components/estoque/estoque-tela.tsx:103`; `carga/calendario-carga.tsx:318` | P | a corrigir |
| 55 | P2 | Impressão | Imprimir um evento que não existe mostra "erro registrado" com código, em vez de "Não encontrado", e o cartão fica torto. *VIS #15* | `src/app/impressao/error.tsx`; `src/app/impressao/*/[id]/page.tsx` | P | a corrigir |
| 56 | P2 | Menu lateral | O menu lateral é claro, e o design de referência pede menu escuro. Não há registro dessa decisão. *VIS #16* | `src/components/shell/app-shell.tsx:185` | P | decisão do time: manter o menu claro (registrar no design-log e atualizar `docs/02-entregaveis.md`) ou voltar ao escuro do handoff. O relatório não recomenda um lado: pede decidir antes de mexer |
| 57 | P2 | Listas › busca sem resultado | Cada lista reage de um jeito a uma busca vazia. Na Biblioteca, a aba diz "435" e a lista diz "Nada encontrado". *VIS #17* | `src/app/(app)/biblioteca/page.tsx:54-62`; `eventos/page.tsx`; `historico/page.tsx` | M | a corrigir |
| 58 | P2 | Página não encontrada | Há duas páginas de 404 diferentes (uma tira o menu). Tela desligada mostra título "Demanda de peças" e fala de "registro" quando é uma página. *VIS #25 (P3) · TXT #3 (P2): vale a maior* | `src/app/not-found.tsx:28` × `src/app/(app)/not-found.tsx:21-22`; `app/(app)/consolidacao/page.tsx:26` | P | a corrigir |
| 59 | P2 | Celular › alvos de toque | Vários botões e links ficam menores que o mínimo de toque (40 px): "Ver peças", Editar/Duplicar da Biblioteca, filtros e cartões da Carga, "comparar" da OS, "Sair" do modo fila, 178 links do estoque, caixas de seleção. *VIS #12 (P2) · A11Y A-P3-11 (P3): vale a maior* | `solicitacoes/nova/aviso-ja-pedido.tsx:41`; `biblioteca/page.tsx:331-346`; `carga/calendario-carga.tsx:251`; `eventos/versoes-os.tsx:65`; `solicitacoes/[id]/page.tsx:181`; `estoque/estoque-tela.tsx`; `biblioteca/selecao-em-lote.tsx:258-297` | M | a corrigir |
| 60 | P2 | Alvos muito pequenos (todas as larguras) | Alguns alvos ficam abaixo do mínimo absoluto de 24 px: barras de semana da Carga (14 px), links "usado em" da peça, links do histórico e "Comparar com a vN" (18 px). *A11Y A-P2-3* | `carga/calendario-carga.tsx:430`; `catalogo/peca-form.tsx:89`; `app/(app)/historico/page.tsx:177`, `:269`; `eventos/versoes-os.tsx:65` | P | a corrigir |
| 61 | P2 | Leitor de tela / voz | O nome lido em voz alta não começa pelo texto visível. Nas notificações, o leitor perde "Não lida", a mensagem e a hora. Também nos dias do calendário, na Carga e na Arena. *A11Y A-P2-2* | `app/(app)/notificacoes/page.tsx:176`; `calendario/dia-modal.tsx:27`, `:57-60`; `carga/calendario-carga.tsx:428`; `arena/plano-2d.tsx:288`, `:375`; `eventos/acoes-linha-evento.tsx:205-207`; `nova/busca-catalogo.tsx:379-380` | P | a corrigir |
| 62 | P2 | Links em texto | Links no meio de frases só se distinguem pela cor. *A11Y A-P2-4* | `src/app/globals.css:260-264` | P | a corrigir |
| 63 | P2 | Campos de formulário | O erro e a dica de "+/−", campos de escolha e listas suspensas não chegam ao leitor de tela. *A11Y A-P2-6* | `ui/field.tsx:60-69`; `ui/stepper.tsx:10-33`; `ui/combobox.tsx:19-39`; `ui/select.tsx:22-55` | M | a corrigir |
| 64 | P2 | Vincular ao catálogo / peças do projeto | Alguns campos só têm nome pelo texto de exemplo ("Selecione"), e o erro "Escolha o setor." não fica ligado ao campo. *A11Y A-P2-7* | `eventos/vincular-catalogo.tsx:91-108`; `eventos/pecas-projeto.tsx:175-176` | P | a corrigir |
| 65 | P2 | Arena | Em tela cheia no iPhone, o fundo continua focável. Painéis de ajuda não recebem o foco, a legenda some abaixo de 1100 px e há atalhos de uma letra na janela inteira. *A11Y A-P2-9* | `arena/arena-experiencia.tsx:319-333`, `:383-435`, `:482`; `arena/arena-controles-mapa.tsx:77`, `:92`, `:173-179`; `arena/arena-barra-edicao.tsx:185`, `:235-258` | M | a corrigir |
| 66 | P2 | Abas e opções | Abas e grupos de opção não respondem às setas do teclado. *A11Y A-P2-10* | `ui/tabs-nav.tsx:95-108`; `estoque/estoque-tela.tsx:108-121`; `carga/form-veiculo.tsx:197-213`; `catalogo/origem-peca-field.tsx:25-48` | M | a corrigir |
| 67 | P2 | Tabelas largas (celular) | Quem não usa toque não consegue rolar para os lados as tabelas da comparação da OS e das impressões. *A11Y A-P2-12* | `eventos/diff-os.tsx:50`; `impressao/os/[id]/page.tsx:42`; `impressao/ata/[id]/page.tsx:92`, `:173`; `arena/impressao-arena.tsx:240` | P | a corrigir |
| 68 | P2 | Desempenho › evento | O item da ata, a OS e a impressão montam a ata até 3 vezes por abertura (até 39 consultas). *A11Y D-P2-2* | `services/eventos/ata.ts:36`; `eventos/[id]/itens/[linhaId]/page.tsx:33`, `:58`, `:86`; `eventos/[id]/os/page.tsx:59`, `:98`, `:124`; `impressao/ata/[id]/page.tsx:23`, `:41`; `grupos-material.ts:8` | M | a corrigir |
| 69 | P2 | Desempenho › eventos | A lista de eventos lê todos os eventos e só depois separa a página (a tela mais lenta hoje). *A11Y D-P2-4* | `src/server/services/eventos/consultas.ts:39-60` | M | a corrigir |
| 70 | P2 | Desempenho › sessão | Toda página, ação e imagem faz uma consulta sem índice nas solicitações da pessoa. *A11Y D-P2-5* (é a mesma consulta do nº 2: some se a correção do nº 2 tirar essa consulta) | `src/server/auth/session.ts:23-24`; `src/server/db/schema.ts:357-364` | P | a corrigir |
| 71 | P2 | Desempenho › histórico | O histórico lê a tabela inteira 6–7 vezes por visita, e o CSV faz até 151 consultas. *A11Y D-P2-6* | `src/server/services/historico-geral.ts:40`, `:163-170`, `:178` | M | a corrigir |
| 72 | P2 | Textos › plurais | Aparecem "3 item(ns)…" ao fechar a ata e "2 projeto(s) e 1 peça(s)" no histórico. *TXT #5 · #8* | `services/eventos/transicoes.ts:128`; `services/projetos.ts:61` | P | a corrigir |
| 73 | P2 | Textos › "BOM" | Mensagens e histórico usam "BOM" e "lista de materiais" para a lista de peças do projeto. *TXT #6 · #7 · #9 (P2) · #55 (P3)* | `services/catalogo.ts:145`; `services/projetos.ts:156`, `:164`, `:225`; `services/biblioteca-lote.ts:107`; `lib/schemas.ts:149` | P | a corrigir |
| 74 | P2 | Textos › perfis | O mesmo perfil se chama "Requisitante" num lugar e "Solicitante" em outro. *TXT #11* | `src/domain/permissions.ts:129`; `shell/app-shell.tsx:314`; `eventos/[id]/itens/[linhaId]/page.tsx:239` | P | a corrigir (sugestão: "Solicitante"; ajustar `ver-como.test.ts:122`) |
| 75 | P2 | Textos › item fora do catálogo | O mesmo tipo de item se chama "item avulso", "outro item", "descrito à mão" e "fora do catálogo". *TXT #12* | `eventos/linha-ata-form.tsx:27`; `domain/os.ts:107`, `:160`; `api/os/[id]/excel/route.ts:93`, `:201-216`; `impressao/os/[id]/page.tsx:108` e outros | M | a corrigir |
| 76 | P2 | Textos › Biblioteca em lote | A ação em lote diz "Desabilitar", e o resto do app diz "Inativar". *TXT #13* | `biblioteca/selecao-em-lote.tsx:97-248`; `biblioteca/actions.ts:37`; `services/biblioteca-lote.ts:54` | P | a corrigir |
| 77 | P2 | Textos › Ativação | A Ativação diz "ligar ao catálogo", e o resto do app diz "vincular". *TXT #14* | `estoque/estoque-tela.tsx:85`, `:311`; `ativacao/itens/[id]/page.tsx:98`; `retornos/page.tsx:18`; `services/estoque.ts:64` | P | a corrigir |
| 78 | P2 | Textos › reunião | O diálogo de iniciar reunião e um aviso falam em "consolidação" da ata, que no resto do app é "conferência". *TXT #15* | `src/domain/evento.ts:35`; `services/eventos/transicoes.ts:217` | P | a corrigir |
| 79 | P2 | Textos › grupos da Biblioteca | O mesmo agrupamento tem 4 nomes, e "Criar grupo" pede "o nome do evento" quando o grupo não é um evento. *TXT #16 · #17* | `biblioteca/organizar-projetos-dialog.tsx:139`; `projetos/gerenciar-grupos.tsx:46`; `catalogo/origem-peca-field.tsx:48-65` | P | a corrigir |
| 80 | P2 | Textos › erros | Mensagens mandam usar um botão com outro nome ("Use “Corrigir”.", "Use cancelar.") ou a aba errada ("na aba Ata"). *TXT #18 · #19 · #20* | `solicitacoes/resposta.ts:379`, `:389`; `solicitacoes/rascunho.ts:155`; `conferencia.ts:258` | P | a corrigir |
| 81 | P2 | Textos › fechar ata | "Ação “Fechar ata” não é possível no estado atual do evento." não diz o que fazer. *TXT #21* | `services/eventos/transicoes.ts:241` | P | a corrigir |
| 82 | P2 | Downloads e anexos | Com a sessão vencida ou sem permissão, baixar um Excel ou anexo abre uma aba com código cru (`{"erro":"Não autenticado"}`). *TXT #22* | `api/os/[id]/excel/route.ts:223-231` e as outras 11 rotas de arquivo | M | a corrigir |
| 83 | P2 | Carga › calendário | O resumo da semana diz "1 eventos". *TXT #23* | `carga/calendario-carga.tsx:427-428` | P | a corrigir |
| 84 | P2 | Exportações em Excel | Planilhas saem sem acento e com "O.S", "O.S." e "OS" misturados ("ATA DE REUNIAO", "RESPONSAVEL", "Agua", "Telescopica"). *TXT #24 · #25 · #26* | `export/ata-lista-xlsx.ts:38`, `:78`; `export/ata-lista.ts:26-65`; `export/os-estrutura-xlsx.ts:18`, `:24`, `:76`; `export/os-estrutura.ts:31-37`, `:95`; `export/os-marcenaria-xlsx.ts:37`, `:54` | P | decisão do time: acentuar as planilhas ou manter a grafia da planilha da cenografia, que elas copiam de propósito. O relatório recomenda acentuar, mas só depois de confirmar com a cenografia (ajustar `estrutura/route.test.ts:85` se a aba "SOMATORIA" mudar) |
| 85 | P2 | Excel da OS | O Excel diz "Ordem de Serviço", e a tela diz "Ordem de serviço". *TXT #27* | `api/os/[id]/excel/route.ts:42` | P | a corrigir |
| 86 | P2 | Ata › origem da linha | A origem da linha aparece como "Pedido da área", "Pedido de área" e "Solicitação da área". *TXT #28* | `eventos/[id]/ata/page.tsx:22`, `:51`; `eventos/[id]/page.tsx:94`; `export/ata.ts:44` | P | a corrigir |
| 87 | P2 | Solicitações › aba Na ata | A aba vazia diz "Nenhum pedido na ata" numa lista de solicitações. *TXT #29* | `app/(app)/solicitacoes/page.tsx:116` | P | a corrigir |
| 88 | P2 | Avisos e histórico | Aparece "FORA DA JANELA: SOL-…" em caixa-alta. *TXT #30* | `services/solicitacoes/envio.ts:147`, `:193` | P | a corrigir |
| 89 | P2 | Textos › portal | O portal aparece como "portal Norte", "Portal NORTE" e "Norte Mkt". *TXT #31* | `perfil/page.tsx:75`; `(auth)/login/login-form.tsx:92-96`; `(auth)/login/page.tsx:11-14`; `auth/portal-entrada.ts:54` | P | a corrigir |
| 90 | P2 | Histórico › tendas | O histórico do quadro de tendas escreve "1 fechamentos e 1 calhas por tenda". *TXT #76* | `conferencia.ts:749-756` | P | corrigido na cópia de trabalho, **sem commit** (`qtdPapel`/`qtdTendas`; "0 calhas" ainda não vira "sem calha") |
| 91 | P2 | Folha de separação | Com a estrutura locada, a folha também tira tina, pallet de ferro e cinta, mas os textos falavam só de "estaiamento". *TXT #80* | `eventos/separacao-locada.tsx:25`, `:34`; `impressao/os/[id]/page.tsx:100`; `services/separacao.ts:45` | P | corrigido na cópia de trabalho, **sem commit** |
| 92 | P3 | Segurança › senha provisória | Quem entra com senha provisória consegue baixar arquivos e usar ações sem trocar a senha. *SEG SEC-03 (Baixo)* | `src/server/auth/session.ts:248-256` | M | a corrigir |
| 93 | P3 | Segurança › Arena | Um solicitante consegue criar ponto com nome inventado no mapa de qualquer arena. *SEG SEC-06 (Baixo)* | `services/arena.ts:64-76`; `domain/arena/posicoes.ts:28` | P | a corrigir |
| 94 | P3 | Solicitação › tendas | A área vê "sem fechamento" no pedido enquanto a OS tem 4 fechamentos decididos na reunião. *LOG P3-7* | `app/(app)/solicitacoes/[id]/page.tsx:62-87` | M | decisão do time: mostrar ao lado do pedido o que entrou na OS, ou transformar a mudança de peças numa correção visível do item. Recomendado: mostrar "na OS: 4 fechamentos" ao lado do pedido |
| 95 | P3 | Conferência › acompanhantes | "Completar" cavalete ou pé clicado duas vezes duplicava a linha. *LOG P3-8* | `conferencia.ts:196-215` | — | corrigido (07ad7fa: falta contada dentro da transação) |
| 96 | P3 | Conferência › prisma | As grades "a mais" do prisma aceitavam ajuste depois da ata, com uma justificativa que ninguém escreveu. *LOG P3-9* | `conferencia.ts:379-386` | — | corrigido (07ad7fa: recusa fora da conferência) |
| 97 | P3 | Conferência › tendas | Mandar só os fechamentos zerava as calhas. *LOG P3-10* | `conferencia.ts:637-638` | — | corrigido (07ad7fa: ausente = padrão × tendas) |
| 98 | P3 | Ativação › estoque | Duas pessoas mexendo no mesmo item ao mesmo tempo: a última grava por cima (hipótese, não reproduzida). *LOG P3-11* | `services/ativacao.ts:102`, `:181`, `:217`; `services/estoque.ts:108` | P | a corrigir |
| 99 | P3 | Evento › atualizar versão | "Atualizar para vN" depois da ata não pede justificativa, não avisa a área e atualiza até linha removida. *LOG P3-12* | `services/eventos/ata.ts:287-312` | P | a corrigir |
| 100 | P3 | Solicitação › tendas | A tela da solicitação reconhece tenda pelo nome, e o resto do app pelas peças: "Kit tenda 5×5" aparece como projeto comum. *LOG P3-13* | `app/(app)/solicitacoes/[id]/page.tsx:65`; `services/solicitacoes/consultas.ts:448` | P | a corrigir |
| 101 | P3 | Modo fila | Na última da fila, "Próxima" vira "Fila zerada" enquanto ainda se responde a aberta. *UX P3-1* | `app/(app)/solicitacoes/[id]/page.tsx:178` | P | a corrigir |
| 102 | P3 | Modo fila | Com 1 item, "Atender tudo" e "Atender 2" fazem o mesmo, e "Atender tudo" não oferece "Desfazer". *UX P3-2* | tela da solicitação (modo fila) | P | a corrigir |
| 103 | P3 | Evento › OS | Na 1ª versão, um cartão inteiro diz que ainda não há o que comparar. *UX P3-3* | aba OS | P | a corrigir |
| 104 | P3 | Conferência | "0 de 5 conferidas", "A conferir 6" e "Conferir as 5 restantes": a linha opcional entra numa conta e não na outra. *UX P3-4* | conferência | P | a corrigir |
| 105 | P3 | Solicitação na ata | Um item tem "Ajustar" e o outro "Corrigir resposta". A Atividade diz "atendido" e põe o nome do solicitante. *UX P3-5* | `components/solicitacoes/item-resposta.tsx:719` | M | a corrigir |
| 106 | P3 | Sem permissão | O pedido de outra área (ou ainda em rascunho) cai em "Seu perfil não acessa esta página", mas o motivo não é o perfil. *UX P3-6* | tela da solicitação / `/sem-permissao` | P | a corrigir |
| 107 | P3 | Menu | "Arena 3D" aparece no menu de todos os solicitantes, sem ligação com a tarefa deles. *UX P3-7* | `src/app/(app)/layout.tsx:45` | P | a corrigir |
| 108 | P3 | Ativação › item | O vazio de Fotos diz que a foto aparece na lista do estoque, mas a miniatura saiu da lista. *UX P3-9* | `app/(app)/ativacao/itens/[id]/page.tsx:90` | P | a corrigir |
| 109 | P3 | Solicitação (celular) | A linha da tenda ("1 tenda · sem fechamento · sem…") e a tabela de locais ("DES…") são cortadas. *UX P3-10* | detalhe da solicitação; nova solicitação | P | a corrigir |
| 110 | P3 | Admin | "Ver o app como…" só existe no menu da conta, e quem não conhece não acha. *UX P3-11* | menu da conta | P | a corrigir |
| 111 | P3 | Carga | "15 cargas · 2 descargas · 0 veículos" parece erro. *UX P3-12* | `/carga-descarga` | P | a corrigir |
| 112 | P3 | Menu lateral | "Buscar ou executar" e o rodapé "Atualizado há 1 min · v0.2" quebram em 2 linhas. *VIS #18* | `shell/app-shell.tsx:226`, `:253` | P | a corrigir |
| 113 | P3 | Painel › próximos 14 dias | Linhas com e sem hora têm alturas diferentes, e o local aparece cortado numa letra. *VIS #19* | `src/app/(app)/page.tsx:185-195` | P | a corrigir |
| 114 | P3 | Eventos › lista | "não iniciada · 20/10 14:00" quebra em 3 linhas, com "14:00" sozinho. *VIS #20* | `src/app/(app)/eventos/page.tsx:57` | P | a corrigir |
| 115 | P3 | Botões "Novo…" | Alguns "Novo…" têm "+" e outros não ("Nova solicitação" tem no painel e não tem na lista). *VIS #21* | `app/(app)/page.tsx:450-453`; `arena/page.tsx:33`; `calendario-carga.tsx:318`; `estoque-tela.tsx:103` × `eventos/page.tsx:197`; `solicitacoes/page.tsx:138`; `biblioteca/page.tsx:93`; `admin/page.tsx:84` | P | a corrigir |
| 116 | P3 | Cabeçalho de lista (celular) | Com um botão, a ação fica à esquerda; com dois, à direita. *VIS #22* | `src/components/ui/layout.tsx:50`, `:57` | P | a corrigir |
| 117 | P3 | Arena › mapa | Rótulos dos pontos com 10–11 px, a contagem em fonte de código, e a legenda com "▲" em vez do ícone. *VIS #23* | `arena/plano-2d.tsx:328`; `arena/arena-controles-mapa.tsx:176` | P | a corrigir |
| 118 | P3 | Linha do tempo | O nome do projeto aparece num chip com fundo, fora do padrão. *VIS #24* | `ui/linha-do-tempo.tsx:74`, `:90` | P | a corrigir |
| 119 | P3 | Ativação › Retornos | O aviso de lista vazia fica solto, fora do cartão. *VIS #26* | `estoque/retornos-tela.tsx:38-44` | P | a corrigir |
| 120 | P3 | Nova solicitação › projetos | Caixa cinza com ícone em quase toda linha sem foto (a Biblioteca já tirou). *VIS #27* | `solicitacoes/nova/busca-catalogo.tsx:348` | P | a corrigir |
| 121 | P3 | Impressão da OS | As colunas de "Materiais fora de catálogo" não se alinham com as das tabelas acima. *VIS #28* | `src/app/impressao/os/[id]/page.tsx` | P | a corrigir |
| 122 | P3 | Impressões | O mesmo botão tem dois textos ("Imprimir ou salvar em PDF" × "Imprimir / salvar PDF") e o título tem dois tamanhos. *VIS #29 · TXT #62* | `arena/impressao-arena.tsx:220`; `impressao/arena/[slug]/imprimir-botao.tsx:8` | P | a corrigir |
| 123 | P3 | Ata | O espaço em volta do "·" muda de uma linha para outra. *VIS #30* | `eventos/ata-lista.tsx:249-252` | P | a corrigir |
| 124 | P3 | Evento › editar | Na página de edição, nenhuma aba fica marcada como atual. *VIS #31* | `app/(app)/eventos/[id]/layout.tsx` | P | a corrigir |
| 125 | P3 | Biblioteca › busca vazia | Sobra um espaço vazio à direita, onde ficava o painel. *VIS #32* | `app/(app)/biblioteca/page.tsx:203` | P | a corrigir |
| 126 | P3 | Carga › cores | "eventos" em verde (verde quer dizer concluído) e etiquetas em cores fora da paleta. *VIS #33* | `carga/calendario-carga.tsx:59`, `:313`, `:408`, `:435`; `carga/base.tsx:41` | P | a corrigir |
| 127 | P3 | Conferência (celular) | O motivo do ajuste ("Ajustado por …: 2 → 1 · Só um…") é cortado e só existe completo passando o mouse. *VIS #34* | `eventos/conferencia-ata.tsx:543` | P | a corrigir |
| 128 | P3 | Painel › O que mudou | A linha de contexto é cortada sem texto completo. *VIS #35* | `painel/eventos-solicitante.tsx:114` | P | a corrigir |
| 129 | P3 | Eventos › carregando | O esqueleto de carregamento não tem filtros nem abas, e a página "pula" quando chega. *VIS #36* | falta `src/app/(app)/eventos/loading.tsx` | P | a corrigir |
| 130 | P3 | Menu (celular) | O atalho "Ctrl K" aparece no celular, que não tem teclado. *VIS #38* | `shell/app-shell.tsx:227-231` | P | a corrigir |
| 131 | P3 | Busca global | O tipo do resultado ("EVENTO") aparece em fonte de código. *VIS #39* | `shell/busca-global.tsx:193` | P | a corrigir |
| 132 | P3 | Diálogos | Os botões do rodapé mudam de altura de um diálogo para outro. *VIS #40* | `ui/confirm-dialog.tsx:74`, `:78` × `admin/usuarios-painel.tsx:165` | P | a corrigir |
| 133 | P3 | Incluir item (celular) | O seletor Projeto padrão / Peça do catálogo / Item avulso quebra em 2 linhas. *VIS #41* | `eventos/acoes-linha-evento.tsx:325`; `eventos/conferencia-ata.tsx:1328` | P | a corrigir |
| 134 | P3 | Biblioteca › peças | Para quem não edita, a linha da peça muda de cor ao passar o mouse, como se desse para clicar. *VIS (observação da matriz)* | `app/(app)/biblioteca/page.tsx:622` | P | a corrigir |
| 135 | P3 | Campos | Ao receber o foco, o campo só muda a cor da borda (fraco), e a busca global não mostra foco nenhum. *A11Y A-P3-1* | `ui/field.tsx:7`; `ui/select.tsx:90-91`; `ui/combobox.tsx:160`; `ui/stepper.tsx:60`; `ui/busca-url.tsx:53`; `shell/busca-global.tsx:147` | P | a corrigir |
| 136 | P3 | Busca global | Fechada com Esc, a busca perde o foco, e "Nada encontrado" não é anunciado. *A11Y A-P3-2* | `shell/busca-global.tsx` | P | a corrigir |
| 137 | P3 | Avisos na tela | O leitor de tela não anuncia direito avisos, contagens e o toast com ação, que some em 8 s. *A11Y A-P3-3* | `ui/toast.tsx:153`, `:173`; `estoque/estoque-tela.tsx:154`; `ui/combobox.tsx:176`; `arena/arena-barra-edicao.tsx:104`, `:117`; `nova/busca-catalogo.tsx:107`, `:120` | M | a corrigir |
| 138 | P3 | Estado só por cor | Prazo no sino, contador do menu recolhido, item inativo e opção escolhida no formulário de veículo só se distinguem pela cor. *A11Y A-P3-4* | `shell/sino-notificacoes.tsx:146`; `shell/app-shell.tsx:91`; `estoque-tela.tsx:204`; `carga/form-veiculo.tsx:206-207` | P | a corrigir |
| 139 | P3 | Contraste | Caixa desmarcada, textos esmaecidos, "—" e anel de foco sobre fundo escuro com pouco contraste. *A11Y A-P3-5* | `eventos/ata-lista.tsx:85`; `carga/calendario-carga.tsx:463`; `estoque-tela.tsx:246-251`; `eventos/banner-reuniao.tsx:74` e outros | P | a corrigir |
| 140 | P3 | Tabelas | O estoque e as impressões têm tabelas sem legenda para o leitor de tela. *A11Y A-P3-6* | `estoque/estoque-tela.tsx:129-145`; impressões; `solicitacoes/quadro-tendas.tsx:100`, `:138` | P | a corrigir |
| 141 | P3 | Formulários de página | O foco pula direto para o 1º campo e passa por cima do cabeçalho e da trilha. *A11Y A-P3-7* | `eventos/evento-form.tsx:40`; `projetos/projeto-form.tsx:107`; `catalogo/peca-form.tsx:41` | P | a corrigir |
| 142 | P3 | Campo de escolha em diálogo | Esc no campo de escolha fecha o diálogo inteiro. Também o minimapa clicável sem papel de botão e pontos pulsando. *A11Y A-P3-8* | `ui/combobox.tsx:154-157`; `arena/minimapa.tsx:36-51` | P | a corrigir |
| 143 | P3 | Reunião (redireciona) | A página intermediária de `/eventos/[id]/reuniao` fica sem título. *A11Y A-P3-9* | `app/(app)/eventos/[id]/reuniao` | P | a corrigir |
| 144 | P3 | Carregando | O esqueleto de carregamento tem um rótulo proibido e não avisa que está carregando. *A11Y A-P3-10* | `app/(app)/loading.tsx:68`; `eventos/[id]/loading.tsx:6`; `ui/layout.tsx:271` | P | a corrigir |
| 145 | P3 | Desempenho › listas | Painel, carga, reformas, fora do catálogo e usuários leem tudo sem limite. *A11Y D-P3-1* | `services/dashboard.ts:77-80`; `services/carga-descarga.ts:29`; `services/fora-catalogo.ts:20` | M | a corrigir |
| 146 | P3 | Desempenho › dados não usados | Telas leem dados que não mostram (ata inteira para contar, todas as versões, 572 KB na nova solicitação). *A11Y D-P3-2* | `eventos/[id]/editar/page.tsx:22`; `eventos/[id]/ata/page.tsx:38`; `services/eventos/ata.ts:100`; `services/projetos.ts:139` | M | a corrigir |
| 147 | P3 | Desempenho › espera em série | Consultas que podiam correr juntas esperam uma pela outra. *A11Y D-P3-3* | `arena/[slug]/page.tsx:19-33`; `services/catalogo.ts:70-74`; rotas `api/os/[id]/*` | P | a corrigir |
| 148 | P3 | Desempenho › repetições | Contagens repetidas (não lidas 2×, 3 consultas iguais no layout do evento, notificações uma a uma no cron). *A11Y D-P3-4* | `app/(app)/layout.tsx:34`; `services/eventos/consultas.ts:142`, `:183`, `:199`; `jobs/verificacoes.ts:45-135` | P | a corrigir |
| 149 | P3 | Sem permissão / telas desligadas | Sem permissão, a tela carrega e só depois pula para "sem permissão", o que pode atropelar o próximo clique. As telas desligadas respondem 200 em vez de 404. *A11Y D-P3-5 · TXT (nota §8) · UX (inventário)* | `src/proxy.ts` ou topo dos layouts dos segmentos | M | a corrigir |
| 150 | P3 | Textos › toasts | Alguns toasts terminam com ponto final, e a maioria não. *TXT #32* | `arena/arenas-actions.ts:83-146`; `catalogo/actions.ts:37`, `:71`; `projetos/actions.ts:52-88` e outros | P | a corrigir |
| 151 | P3 | Textos | "Tente novamente" (6×) × "Tente de novo" (18×). *TXT #33* | `lib/action.ts:70`; `auth/session.ts:58`; `services/projetos.ts:78` e outros | P | a corrigir |
| 152 | P3 | Textos › erros | Algumas mensagens falam em primeira pessoa ("Não consegui…", "Tentaremos…"). *TXT #34* | `services/ativacao.ts:308`; `services/catalogo.ts:246`; `carga-importacao.ts:47`, `:70`; `nova/use-autosave-solicitacao.ts:98` | P | a corrigir |
| 153 | P3 | Textos | Cerca de 10 mensagens usam aspas retas. *TXT #35* | `arena/use-edicao-arena.ts:227`; `eventos/conferencia-ata.tsx:243`; `services/admin.ts:45`, `:49` e outros | P | a corrigir |
| 154 | P3 | Textos › administrador | "Peça ao administrador…" é ambíguo num app em que "peça" é objeto, e "Sua área está desativada" não diz o que fazer. *TXT #36 · #37* | `solicitacoes/nova/page.tsx:131`; `solicitacoes/rascunho.ts:20`, `:34`; `services/recuperacao.ts:76`; `redefinir-senha/[token]/page.tsx:16` | P | a corrigir |
| 155 | P3 | Textos | "Faltam conferir 3 linhas", "Faltam descrever 2 unidades". *TXT #38* | `eventos/banner-reuniao.tsx:54`; `nova/descricoes-item.tsx:136` | P | a corrigir |
| 156 | P3 | Textos | "Marque cada uma no check…" *TXT #39* | `eventos/banner-reuniao.tsx:54` | P | a corrigir |
| 157 | P3 | Textos | "Você tem 2 rascunhos ou devolvidas esperando você". *TXT #40* | `app/(app)/solicitacoes/page.tsx:204` | P | a corrigir |
| 158 | P3 | Textos | "esses filtros" × "estes filtros". *TXT #41* | `solicitacoes/page.tsx:194`; `eventos/conferencia-ata.tsx:1193` | P | a corrigir |
| 159 | P3 | Pendências (tela desligada) | O vazio diz "Nenhuma neste evento". *TXT #42* | `app/(app)/pendencias/page.tsx:103` | P | a corrigir |
| 160 | P3 | Ativação › item | "+3 reservado" e "1 voltaram". *TXT #43* | `app/(app)/ativacao/itens/[id]/page.tsx:76`, `:135` | P | a corrigir |
| 161 | P3 | Botões | Botões de uma palavra não dizem o que fazem ("Tirar", "Liberar", "Enviar"). *TXT #44 · #45 · #46* | `projetos/disponivel-toggle.tsx:26`; `arena/arena-acoes.tsx:56`; `estoque/estoque-tela.tsx:335` | P | a corrigir |
| 162 | P3 | Biblioteca em lote | O toast diz só "Pronto." *TXT #47* | `biblioteca/selecao-em-lote.tsx:123` | P | a corrigir |
| 163 | P3 | Carga | "Incluir veículo" × "Novo veículo". *TXT #48* | `carga/carga-evento.tsx:74`, `:85` | P | a corrigir |
| 164 | P3 | Carga › importar | "…e suba todos de uma vez". *TXT #49* | `carga/importar-carga.tsx:29` | P | a corrigir |
| 165 | P3 | Carga › importar | Dois caminhos diferentes para baixar a planilha no Google Planilhas. *TXT #50* | `carga-descarga/actions.ts:90`; `services/carga-importacao.ts:47` | P | a corrigir |
| 166 | P3 | Textos › horário | "às 14:00" × "às 14h". *TXT #51* | `eventos/evento-form.tsx:71`; `eventos/dados-reuniao-form.tsx:94-97` | P | a corrigir |
| 167 | P3 | Textos › solicitação | "referenciam" e "referenciada" em mensagens, sem dizer o que fazer. *TXT #52 · #53* | `solicitacoes/nova-solicitacao-form.tsx:439`; `domain/solicitacao.ts:237` | P | a corrigir |
| 168 | P3 | Textos › solicitação | "…e você será avisado." *TXT #54* | `app/(app)/solicitacoes/[id]/page.tsx:305` | P | a corrigir |
| 169 | P3 | Evento › iniciar reunião | A descrição e o aviso do diálogo dizem a mesma coisa. *TXT #56* | `eventos/acoes-evento.tsx:127`, `:151`; `domain/evento.ts:35` | P | a corrigir |
| 170 | P3 | Evento › OS | A aba se chama "Itens · ajustar". *TXT #57* | `eventos/os-visoes.tsx:100` | P | a corrigir |
| 171 | P3 | Arena | "Itens da ata de reunião de OS" × "Ata da reunião de OS". *TXT #58* | `arena/painel-ponto.tsx:132` | P | a corrigir |
| 172 | P3 | Arena | "Confirme antes de fechar a carga" usa um termo que não aparece em outra tela. *TXT #59* | `arena/painel-conferencia.tsx:43` | P | a corrigir |
| 173 | P3 | Sem permissão | A trilha diz "Sem acesso" e o título diz "Sem permissão". *TXT #60* | `shell/trilha.tsx:54` | P | a corrigir |
| 174 | P3 | Páginas de erro | "Ir para o Painel" × "Ir para o painel" × "Voltar para o painel". *TXT #61* | `app/global-error.tsx:37`; `app/impressao/error.tsx:26` | P | a corrigir |
| 175 | P3 | Biblioteca | "e/ou" numa instrução. *TXT #63* | `biblioteca/organizar-projetos-dialog.tsx:113` | P | a corrigir |
| 176 | P3 | Textos › permissão | "Você não tem permissão para executar esta ação." e "O módulo é da Ativação…" não dizem a quem recorrer. *TXT #64 · #65* | `domain/errors.ts:24`; `services/ativacao.ts:25`; `services/estoque.ts:12` | P | a corrigir |
| 177 | P3 | Textos › erros | "Dados inválidos." (32×) e "Ação inválida." *TXT #66* | `app/(app)/*/actions.ts`; `eventos/actions.ts:82` | P | a corrigir |
| 178 | P3 | Login | Com o portal desligado, a tela mostra o nome de uma variável do servidor (`PORTAL_SSO_SECRET`). *TXT #67* | `app/(auth)/login/page.tsx:13` | P | a corrigir |
| 179 | P3 | CSV do histórico | Colunas "Entidade" e "Id" não dizem nada a quem abre. *TXT #68* | `api/historico/csv/route.ts:32` | P | a corrigir |
| 180 | P3 | Exportações | Os arquivos baixados têm nomes sem padrão (`ATA-EVT-0001-v3.xlsx`, `OS ESTRUTURA_NOME_v3.xlsx`, `historico-….csv`). *TXT #69* | `src/app/api/**/route.ts` (`Content-Disposition`) | M | a corrigir (muda testes de rota e `e2e/exportacoes.spec.ts`) |
| 181 | P3 | Excel da ata | "Cliente/gestão" × "Cliente / gestão". *TXT #70* | `api/eventos/[id]/ata/excel/route.ts:54` | P | a corrigir |
| 182 | P3 | Ata | A mesma coluna se chama "Na ata" no Excel e "Atendido" na impressão. *TXT #71* | `impressao/ata/[id]/page.tsx:181` × `ata/excel/route.ts:156` | P | a corrigir |
| 183 | P3 | Admin › Áreas | A mesma frase aparece na nota, no vazio e no diálogo. *TXT #72* | `app/(app)/admin/page.tsx:118`, `:129`; `admin/areas-painel.tsx:41` | P | a corrigir |
| 184 | P3 | Impressão da OS | O título da aba do navegador não tem o código do evento. *TXT #73* | `impressao/os/[id]/page.tsx:21`; `consolidacao/pendencias/page.tsx` | P | a corrigir |
| 185 | P3 | Painel › O que mudou | Quatro linhas seguidas dizem "Item de Produção foi ajustado", sem dizer qual item. *TXT #75* | `services/dashboard.ts:414` | P | decisão do time (privacidade): mostrar o nome do item de outra área ou não. Recomendado: mostrar o nome se puder ser visto por outras áreas (a ata já é); senão, agrupar ("3 itens de Produção foram ajustados") |
| 186 | P3 | Histórico › tendas | "Tendas de local não informado: …" e "2 → 3 tendas" repetindo "tendas". *TXT #77* | `conferencia.ts:690`, `:708`, `:732` | P | a corrigir |
| 187 | P3 | Aviso › tendas | "A logística ajustou as tendas: GV: …", com dois-pontos em sequência. *TXT #78* | `conferencia.ts:566`, `:743` | P | a corrigir |
| 188 | P3 | Notificações | O título "Ajuste na OS:" traz o código do evento num aviso e o nome do evento nos outros. *TXT #79* | `services/eventos/versoes.ts:80` × `conferencia.ts:327`, `:566` | P | a corrigir |

### Fora da tabela (os relatórios não dão prioridade)

- **Endurecimento de segurança** (SEG E1–E7, "não são riscos confirmados"):
  - E1: IP do limite de tentativas lido do último `X-Forwarded-For` (`auth/limite.ts:15-17`).
  - E2: módulo Ativação liberado pelo nome da área, fora da matriz (`domain/estoque.ts:17`).
  - E3: anexos em cache por 1 dia (`resposta-arquivo.ts:16`).
  - E4: planilha de 5 MB compactada no ExcelJS (`carga-descarga/actions.ts:82`).
  - E5: entrada pelo Portal por GET.
  - E6: `/api/cron` responde por GET.
  - E7: `detalheLinha` devolve o id da solicitação de outra área (`linha-do-tempo.ts:212`).
- **LOG**: a regra RN-09 em `docs/01-analise-e-especificacao.md:233` ainda diz que fechamento de tenda nunca entra em BOM.
  Além disso, `resolverPendenciaAction` aceita chamadas com a tela de pendências desligada.
- **TXT (nota §8)**: a resposta do item ainda mostra a tag "pendência de compra/locação" com a tela desligada
  (`item-resposta.tsx:707`).
- **VIS**: a maioria dos botões que abrem diálogo não anuncia isso (`aria-haspopup`).

## 2. Ordem sugerida de correção

Do mais importante ao menos. O tamanho total soma os tamanhos das linhas em aberto do lote. As decisões do time podem
andar em paralelo com os lotes 1 a 5.

| Lote | Nºs | Tamanho total |
|---|---|---|
| **1. Segurança no servidor**: dependências, área antiga, aba OS, CSV, senha provisória, ponto na arena e o índice da sessão, que sai junto com o nº 2 | 1, 2, 3, 19, 70, 92, 93 | 4 P + 3 M |
| **2. Painel e solicitação: fila de resposta**: o ✓ que navega, o título espremido pelo selo, o prazo cortado, a tecla "A", a lista da logística e o modo fila | 7, 8, 9, 14, 23, 24, 25, 101, 102, 105 | 9 P + 1 M |
| **3. Componentes de lista, menu e campo: foco visível e teclado**: Select, Dropdown, ComboBox (inclui a lista que abre fora da tela), Stepper, abas e campos sem nome | 12, 13, 63, 64, 66, 135, 136, 142 | 5 P + 3 M |
| **4. Textos: concordância, plurais e frases quebradas** | 16, 17, 18, 72, 83, 155, 160, 186, 187 (e commitar o 90) | 8 P + 1 M |
| **5. Nova solicitação: tendas e rodapé**: quadro zerado, rodapé que corta e esconde o campo, regra única de "é tenda" | 10, 29, 30, 100, 109, 120 | 5 P + 1 M |
| **6. Evento: reunião, ata e OS**: lista de itens no celular, botão da fase, ir para a conferência, CSV que baixa Excel, atualizar versão, contagens da conferência | 11, 31, 32, 33, 34, 35, 36, 37, 99, 103, 104, 121, 123, 124, 127, 133, 169 | 13 P + 4 M |
| **7. Arena: teclado e painéis** | 15, 65, 117 | 1 P + 1 M + 1 G |
| **8. Desempenho: consultas repetidas e paginação no banco** | 45, 68, 69, 71, 145, 146, 147, 148, 149 | 3 P + 6 M |
| **9. Menu, gaveta, busca e sino** | 48, 49, 50, 107, 110, 112, 130, 131 | 7 P + 1 M |
| **10. Leitor de tela e semântica**: nomes lidos, links, erros de login, tabelas roláveis, avisos, contraste | 47, 61, 62, 67, 137, 138, 139, 140, 141, 143, 144 | 10 P + 1 M |
| **11. Celular: alvos de toque e textos cortados** | 28, 59, 60, 113, 114, 116, 128 | 6 P + 1 M |
| **12. Painéis por perfil, Biblioteca e listas** | 26, 27, 38, 40, 41, 106, 111 | 4 P + 3 M |
| **13. Ativação** | 42, 43, 98, 108 | 3 P + 1 M |
| **14. Textos: um termo para cada coisa** (glossário do TXT §5) | 39, 73, 74, 75, 76, 77, 78, 79, 85, 86, 87, 89, 163, 170, 172, 173, 174, 182, 188 (e commitar o 91) | 18 P + 1 M |
| **15. Textos: mensagens de erro e botões que dizem o que fazer** | 80, 81, 82, 152, 154, 161, 162, 167, 168, 176, 177, 178 | 11 P + 1 M |
| **16. Consistência visual entre telas** | 52, 53, 54, 55, 57, 58, 115, 118, 119, 122, 125, 126, 129, 132, 134 | 14 P + 1 M |
| **17. Textos: estilo** (pontuação, aspas, "tente de novo", nomes de arquivo) | 88, 150, 151, 153, 156, 157, 158, 159, 164, 165, 166, 171, 175, 179, 180, 181, 183, 184 | 17 P + 1 M |
| **Em paralelo: decisões do time** (decidir, depois corrigir) | 44, 46, 51, 56, 84, 94, 185 | 5 P + 1 M + 1 G |
| Já corrigidos (só publicar o `07ad7fa`) | 4, 5, 6, 20, 21, 22, 95, 96, 97 | — |

## 3. O que nenhum agente verificou

União das seções "não verificado" dos seis relatórios. Saiu da lista o que outro agente cobriu, como o item do
evento (aberto por A11Y e TXT) e o quadro de tendas da nova solicitação (aberto por UX).

- **Leitor de tela de verdade** (NVDA, JAWS, VoiceOver, TalkBack), zoom de 200 % e espaçamento de texto ampliado (1.4.12).
  Só houve axe, a árvore de acessibilidade e o reflow a 320 px.
- **Ações que gravam, na tela**: devolver, cancelar, atender parcial ou não atender, fechar ata, marcar OS como enviada,
  encerrar, uploads, importar planilha, editar o mapa, ajustes da Ativação, lote da Biblioteca e áreas e configurações do
  admin. Por isso também não foram vistos os toasts, o foco depois de salvar, os erros do servidor nesses formulários e o
  atalho "A" no navegador.
- **Arquivos exportados abertos** (Excel da OS e da ata, CSV do histórico, modelo da carga, PDF), o conteúdo comparado
  com a OS e a impressão em papel (`@media print`).
- **Concorrência em Postgres de verdade** (LOG P3-11 e corridas entre salvamentos): o PGlite faz uma coisa de cada vez.
- **Desempenho real**: consultas contadas só pelo código (sem `DB_LOG`), sem Postgres pela rede, sem o volume de produção
  (191 eventos), sem tempo de interação (digitar, marcar, arrastar) e sem o modo 3D da Arena.
- **Segurança fora do demo**:
  - Portal NORTE ligado, cron com segredo e redefinição de senha de ponta a ponta;
  - troca obrigatória de senha na tela;
  - força bruta, carga e DoS, e se as falhas do `next 16.3.6` são exploráveis;
  - configuração real de produção;
  - varredura completa do histórico do git.
- **Contas e filtros** do calendário, contadores do painel, importação da carga, histórico geral e notificações: só a
  permissão foi checada. Prazos no fuso de São Paulo (48 h, janela, reunião) tiveram só uma leitura superficial.
- **Estados**:
  - erro do servidor nas telas internas;
  - texto muito longo;
  - "muitos registros" além do banco de demonstração;
  - os cerca de 40 botões desabilitados sem motivo, um a um.
- **Diálogos não abertos**: Editar tendas, Editar descrição, cancelar ou devolver solicitação, diálogos da Arena 3D,
  Organizar projetos em lote, Pedidos do item, Retorno e Concluir reforma, Link de acesso do usuário. Também a interação
  3D da Arena e o arrastar.
- **Cobertura parcial de perfil e largura**:
  - 768 px só para o admin;
  - Gestão no celular só aberta, sem percorrer;
  - Gráfica e Atendimento em parte das telas;
  - "Ver como" percorrido rapidamente.
- **Teclado além das 70 primeiras paradas** em listas longas (conferência, ata, estoque), e o `e2e/acessibilidade.spec.ts`
  não rodado.
