# Norte Mkt · Planejamento de Eventos — Análise e Especificação do Produto

Fonte: `deck.pptx` (13 slides, "Briefing de Sistema — validação de escopo do MVP"). Notas de apresentação vazias; as 26 imagens são ícones sem conteúdo informacional. Todo o conhecimento vem do texto dos slides.

Legenda usada neste documento:

- **RN-xx** — regra de negócio extraída do PPT (ou derivada logicamente dele).
- **RV-xx** — **REGRA A VALIDAR**: decisão que o PPT não fecha. Cada uma traz a alternativa adotada como padrão na implementação.
- **MEL-xx** — melhoria além do PPT (otimização de produto, não requisito explícito).

---

## 1. Visão geral do produto (o que foi entendido)

**Empresa:** Norte Mkt, agência que produz eventos. Para cada evento, várias áreas internas (produção, cenografia, ativação, gráfica, atendimento) precisam de estruturas físicas: pórticos e torres em **box truss**, **tendas** e peças de **marcenaria**. A **logística** consolida esses pedidos, gera as **Ordens de Serviço (OS)** com a lista de peças que precisam ser separadas/montadas e organiza a carga do caminhão.

**Problema atual (slide 3):** pedido verbal → reunião de OS semanal (terça) → ata manual não padronizada → alterações por WhatsApp/e-mail sem rastro → OS montada à mão em Excel com erro de fórmula. Resultado literal do slide: "nenhum evento tem a mesma OS que foi de fato pedida — e ninguém descobre até a montagem".

**Conceito central (slides 2 e 4):** um **Projeto padrão** (ex.: "Pórtico boca 6,60m") tem uma **lista de peças (BOM)** fixa. O evento usa N unidades de cada projeto. A **OS é gerada automaticamente** como Σ (BOM × quantidade), sem fórmula manual. A mesma lógica vale para Estrutura (box truss), Marcenaria e estrutura de Tendas.

**Processo desejado (slides 5, 7, 8, 9):**

1. Peças cadastradas uma vez em um **catálogo mestre**.
2. **Biblioteca de projetos padrão** com BOM, imagens e anexo técnico (PDF), administrada pela Cenografia.
3. Áreas registram necessidades antes da reunião (fase "pré-reunião", com notificação de prazo).
4. Na reunião, a logística consolida e ajusta; sai a **ata digital**.
5. A OS de cada setor é gerada automaticamente da ata.
6. Depois da ata, alterações entram como **solicitações paralelas** (muitas ao mesmo tempo, sem fila): rascunho → enviada → logística responde **item a item** (atendido / parcial / não atendido, com observação obrigatória nos dois últimos) → OS recalculada com a quantidade efetivamente atendida.
7. A logística **encerra o evento para alterações** por comando explícito (não por data). Depois disso nenhuma solicitação nova entra.

**Objetivos do sistema:** eliminar erro manual na OS; dar rastro e padronização a pedidos e alterações; dar visibilidade a todos do que foi pedido × o que foi atendido; criar a base de dados que os módulos futuros (mapa de arena 3D, compras, logística/estoque) consumirão.

**Fora do escopo (slide 6):** mapa de arena 3D; produção e compras (cotação, financeiro); integração com o sistema de Logística (Replit). Consolidação estoque × locação × compra entra apenas como **visão inicial**.

---

## 2. Grau de definição do PPT

| Claramente definido | Parcialmente definido | Implícito | Faltando |
|---|---|---|---|
| Conceito Projeto padrão → BOM → OS automática | Conteúdo da ata (só "gerada a partir do consolidado") | Autenticação, perfis por usuário, cadastro de usuários e áreas | Campos do evento (nome, cliente, datas, local) |
| Resposta por item: atendido / parcial / não atendido, obs. obrigatória | Escopo exato do MVP (conflito slide 5 × slide 11) | Histórico/auditoria ("sem rastro" é a dor) | Quem cria o evento e quando |
| Encerramento manual pela logística; nada entra depois | Consolidação por período (visão inicial, lógica a refinar) | Notificações ("notifica quem precisa saber") | Formato/exportação da OS e da ata |
| Rascunho de solicitação preserva progresso | Papel da Gestão ("aprovação de exceções") | Solicitação pode reduzir/remover, não só adicionar | O que acontece com solicitações pendentes ao encerrar |
| Fechamento de tenda é item avulso (qtd + destino) | Fases pós-MVP | Versionamento do projeto padrão (BOM muda com o tempo) | Prazo de resposta, data de corte, reabertura, pendência de compra, áreas fixas, códigos de peça (slide 12) |
| Peças do BOM do exemplo (Box 400/600/700/3000/3500, Cubo, Grapple, Parafusos) e da tenda (cantoneira, travessa, pé, mastro, cabo, calha) | Quem administra o catálogo de peças | Estoque próprio por peça (necessário para consolidação) | Unidade de medida, categorias de peça |

---

## 3. Conflitos detectados no PPT

**C1 — Escopo do MVP.** Slide 5 ("Escopo do MVP") inclui *solicitação de alteração paralela* e *encerramento manual*. Slide 11 coloca *Solicitações* na Fase 3 e *Pré-reunião* na Fase 2, deixando o MVP (Fase 1) só com catálogo, projetos, ata e OS. Além disso, a ata "gerada a partir do consolidado" pressupõe entradas das áreas (pré-reunião).
**Solução adotada:** construir Fases 1 + 2 + 3 como produto único, porque o fluxo dos slides 7–9 (o coração do briefing) não existe sem a solicitação por item e a ata não existe sem entradas. Marcado como **RV-01**.

**C2 — Consolidação por período.** Slide 6 diz que "entra como visão inicial no MVP"; slide 11 coloca na Fase 4 "a refinar com a Logística".
**Solução adotada:** tela de consolidação **somente leitura** no MVP: demanda de peças por período (pico diário) × estoque próprio cadastrado na peça, apontando déficit (necessidade de locação/compra). Sem integração. **RV-02**.

**C3 — Cenografia é requisitante e administradora.** Slide 10 lista cenografia entre as áreas requisitantes e também como quem administra a biblioteca de projetos.
**Solução adotada:** perfil *Cenografia* = tudo que um requisitante faz + gestão da biblioteca + visualizar/exportar OS.

**C4 — Tenda: OS própria ou parte da estrutura?** Slide 4 fala em "OS de Estrutura", "OS de Marcenaria" e "estrutura das Tendas".
**Solução adotada:** cada peça do catálogo pertence a um **setor de execução** (Estrutura, Tenda, Marcenaria). A OS é gerada por setor. Um projeto padrão pode misturar peças de setores diferentes (ex.: palco com box truss e piso de marcenaria); a OS de cada setor recebe só as suas peças. **RV-03**.

---

## 4. Perfis e permissões

### 4.1 Perfis

| Perfil | Origem | Descrição |
|---|---|---|
| **Requisitante** | Slide 10 | Usuário de uma área (produção, ativação, gráfica, atendimento, cenografia). Registra necessidades e abre solicitações da sua área. |
| **Cenografia** | Slide 10 | Requisitante da área Cenografia + administra biblioteca de projetos padrão + visualiza/exporta OS. |
| **Logística** | Slide 10 | Cria/gerencia eventos, conduz reunião, fecha ata, responde solicitações por item, encerra evento, administra catálogo de peças. |
| **Gestão** | Slide 10 | Visão consolidada entre eventos; aprova exceções (reabrir evento encerrado). Somente leitura no restante. |
| **Administrador** | **MEL-01** (não está no PPT) | Usuários, áreas, configurações do sistema (SLA, lembretes). Necessário para operar o sistema; pode ser acumulado por alguém da Logística/Gestão. |

Todo usuário tem exatamente um perfil e, se Requisitante/Cenografia, uma área. **RV-04:** áreas são cadastro mestre fixo (não variam por evento); todas as áreas ativas podem participar de qualquer evento. Alternativa: escolher áreas participantes ao criar o evento — descartada por ora porque acrescenta um passo sem ganho claro.

### 4.2 Matriz Perfil × Módulo × Ação

| Módulo / Ação | Requisitante | Cenografia | Logística | Gestão | Admin |
|---|---|---|---|---|---|
| Eventos — ver lista e detalhe | ✔ | ✔ | ✔ | ✔ | ✔ |
| Eventos — criar / editar dados | – | – | ✔ | – | – |
| Eventos — iniciar reunião, fechar ata, encerrar, cancelar | – | – | ✔ | – | – |
| Eventos — reabrir em exceção (com justificativa) | – | – | – | ✔ | – |
| Ata — consolidar (responder itens pré-reunião, incluir linhas) | – | – | ✔ | – | – |
| Ata — ajuste direto após fechamento (com justificativa) | – | – | ✔ | – | – |
| Solicitações — criar / editar rascunho / enviar / cancelar (própria área) | ✔ | ✔ | – | – | – |
| Solicitações — ver | própria área | própria área | todas | todas | todas |
| Solicitações — responder por item / devolver / corrigir resposta | – | – | ✔ | – | – |
| OS — visualizar e exportar | – | ✔ | ✔ | ✔ | ✔ |
| Catálogo de peças — ver | ✔ | ✔ | ✔ | ✔ | ✔ |
| Catálogo de peças — criar / editar / inativar / estoque | – | ✔ | ✔ | – | – |
| Projetos padrão — ver | ✔ | ✔ | ✔ | ✔ | ✔ |
| Projetos padrão — criar / editar (nova versão) / inativar / anexos | – | ✔ | – | – | – |
| Consolidação por período | – | – | ✔ | ✔ | – |
| Pendências de compra/locação | – | – | ✔ | ✔ | – |
| Histórico | do que vê | do que vê | tudo | tudo | tudo |
| Notificações | próprias | próprias | próprias | próprias | próprias |
| Usuários, áreas, configurações | – | – | – | – | ✔ |
| Perfil próprio (senha) | ✔ | ✔ | ✔ | ✔ | ✔ |

**RV-05:** quem administra o catálogo de peças? O PPT diz apenas que "iniciar o cadastro do catálogo" é o primeiro passo. Padrão adotado: Logística e Cenografia. **RV-06:** requisitantes veem a OS? Padrão: não; eles veem a ata (o que foi pedido/atendido); a OS é documento operacional do setor. **RV-07:** rascunho é da área ou do autor? Padrão: da área (qualquer usuário da mesma área pode editar e enviar), porque "área digita aos poucos" descreve trabalho de equipe. O autor e o último editor ficam registrados.

As permissões são verificadas **no servidor** em toda mutação e leitura, não apenas escondendo botões.

---

## 5. Modelo de dados

```
Area 1──n Usuario
Peca (catálogo) n──n ProjetoPadrao  (via ProjetoPadraoItem = BOM, versionado)
ProjetoPadrao 1──n Anexo (imagens, PDF)
Evento 1──n Solicitacao 1──n SolicitacaoItem
Evento 1──n EventoItem (linhas da ata / base da OS)  ← origem: SolicitacaoItem ou inclusão direta
Evento 1──n AtaVersao / OsVersao (snapshots)
Evento 1──n Historico ; Usuario 1──n Notificacao
Configuracao (chave/valor) ; SessaoUsuario ; TokenRecuperacaoSenha
```

### 5.1 Entidades e campos

Convenções: todas as entidades têm `id` (cuid), `criadoEm`, `atualizadoEm`; entidades de negócio têm `criadoPorId`; exclusão é lógica (`ativo`/status) onde há histórico.

**Area** — `nome` (único, obrig.), `ativo`. Seed: Produção, Cenografia, Ativação, Gráfica, Atendimento, Logística.

**Usuario** — `nome`, `email` (único), `senhaHash`, `perfil` (REQUISITANTE | CENOGRAFIA | LOGISTICA | GESTAO | ADMIN), `areaId` (obrig. para Requisitante/Cenografia), `ativo`, `ultimoAcessoEm`.

**Peca** (catálogo mestre) — `codigo` (único, ex.: "BOX-400"), `nome` (ex.: "Box truss 400 mm"), `setor` (ESTRUTURA | TENDA | MARCENARIA), `familia` (texto livre: Box truss, Conexão, Fixação, Tenda, Chapa…), `unidade` (un, m, kg…), `descricao`, `estoqueProprio` (int ≥ 0; **RV-08**: fonte do estoque é o sistema de Logística; no MVP é campo manual), `permiteEmProjeto` (bool; falso para "Fechamento de tenda" — RN-09), `ativo`. **RV-09 (slide 12):** código × nome descritivo — adotado **ambos**: `codigo` curto e `nome` descritivo, exibidos juntos.

**ProjetoPadrao** — `codigo`, `nome` (ex.: "Pórtico boca 6,60m"), `categoria` (Pórtico, Palco, Torre, Tenda, Balcão…), `descricao`, `versaoAtual` (int), `ativo`, `criadoPorId`.
**ProjetoPadraoVersao** — `projetoId`, `numero`, `criadoEm`, `criadoPorId`, `observacao`. **ProjetoPadraoItem** — `versaoId`, `pecaId`, `quantidade` (>0). **Anexo** — `projetoId`, `tipo` (IMAGEM | PDF), `nomeArquivo`, `caminho`, `tamanho`, `mime`, `criadoPorId`.
**MEL-02 (versionamento):** editar o BOM cria nova versão; eventos existentes mantêm snapshot e mostram "versão mais nova disponível" com ação de atualizar (só Logística, só evento não encerrado). Evita que a OS de um evento mude silenciosamente porque a cenografia alterou um projeto.

**Evento** — `codigo` (sequencial EV-0001), `nome`, `cliente`, `local`, `dataMontagem`, `dataInicio`, `dataFim`, `dataDesmontagem`, `dataReuniao` (data/hora da reunião de OS), `dataCarga` (opcional, informativa — **RV-10**), `responsavelLogisticaId`, `status` (PREPARACAO | EM_REUNIAO | ABERTO | ENCERRADO | CANCELADO), `observacoesReuniao` (texto da ata), `ataFechadaEm/PorId`, `encerradoEm/PorId`, `reabertoVezes`, `canceladoEm/PorId/Motivo`.

**Solicitacao** — `codigo` (SOL-0001), `eventoId`, `areaId`, `tipo` (PRE_REUNIAO | ALTERACAO), `status` (RASCUNHO | ENVIADA | EM_ANALISE | RESPONDIDA | DEVOLVIDA | CANCELADA), `titulo` (opcional), `observacao`, `criadoPorId`, `atualizadoPorId`, `enviadaEm`, `prazoRespostaEm` (= enviadaEm + SLA), `respondidaEm`, `devolvidaMotivo`, `canceladaEm/Motivo`.

**SolicitacaoItem** — `solicitacaoId`, `ordem`, `operacao` (ADICIONAR | ALTERAR_QUANTIDADE | REMOVER — **MEL-03**), `eventoItemId` (obrig. para ALTERAR/REMOVER), `projetoId` + `projetoVersaoId` **ou** `pecaId` **ou** `descricaoLivre` (exatamente um), `quantidadeSolicitada` (>0; para ALTERAR = nova quantidade desejada), `destino` (texto, ex.: "GV"), `justificativa`, `status` (EM_ANALISE | ATENDIDO | PARCIAL | NAO_ATENDIDO), `quantidadeAtendida`, `observacaoLogistica` (obrig. se PARCIAL/NAO_ATENDIDO), `pendenciaCompra` (bool — RV-11), `respondidoPorId`, `respondidoEm`, `eventoItemGeradoId`.

**EventoItem** (linha da ata / base da OS) — `eventoId`, `tipo` (PROJETO | PECA | AVULSO), `projetoId` + `projetoVersaoId` + `bomSnapshot` (JSON `[ {pecaId, codigo, nome, setor, quantidade} ]`) | `pecaId` | `descricaoLivre`, `quantidade`, `destino`, `areaId` (área de origem), `origem` (SOLICITACAO | AJUSTE_LOGISTICA), `solicitacaoItemId`, `justificativaAjuste`, `ativo`, `removidoEm/PorId`.

**AtaVersao** — `eventoId`, `numero`, `fechadaEm`, `fechadaPorId`, `conteudo` (JSON com linhas, observações, participantes por área). **OsVersao** — `eventoId`, `numero`, `geradaEm`, `gatilho` (ATA_FECHADA | RESPOSTA_SOLICITACAO | AJUSTE | ATUALIZACAO_PROJETO | REABERTURA | ENCERRAMENTO), `conteudo` (JSON por setor com totais e decomposição por origem).

**Historico** — `eventoId?`, `entidade`, `entidadeId`, `acao`, `usuarioId`, `criadoEm`, `dadosAntes` (JSON), `dadosDepois` (JSON), `descricao`.

**Notificacao** — `usuarioId`, `tipo`, `titulo`, `mensagem`, `link`, `lidaEm`, `criadoEm`, `chaveDedupe` (evita repetir lembretes).

**Configuracao** — `chave` (`sla_resposta_horas`=48, `lembrete_reuniao_dias`=1, `bloquear_encerramento_com_pendentes`=true), `valor`.

### 5.2 Campos com regras especiais

| Campo | Quem edita | Quando aparece | Validação / regra |
|---|---|---|---|
| `SolicitacaoItem.quantidadeAtendida` | Logística | Ao responder | ATENDIDO ⇒ = solicitada; PARCIAL ⇒ 0 < atendida < solicitada; NAO_ATENDIDO ⇒ 0 |
| `SolicitacaoItem.observacaoLogistica` | Logística | Ao responder | Obrigatória se PARCIAL ou NAO_ATENDIDO (RN-07) |
| `SolicitacaoItem.destino` | Requisitante | Sempre; obrigatório para AVULSO de tenda (fechamento) | Texto ≤ 60 |
| `Evento.dataCarga` | Logística | Opcional | Se preenchida, mostra aviso "carga em X dias" mas **não** encerra (RN-10) |
| `EventoItem.justificativaAjuste` | Logística | Ajuste direto após ata fechada | Obrigatória (RV-12) |
| `Evento.status` | Logística / Gestão (reabrir) | — | Só via ações da máquina de estados (§6) |
| `Peca.estoqueProprio` | Logística/Cenografia | Catálogo | Inteiro ≥ 0; usado só na consolidação |
| `ProjetoPadraoItem.quantidade` | Cenografia | Editor de BOM | Inteiro > 0; peça ativa e `permiteEmProjeto` |

---

## 6. Máquinas de estado

### 6.1 Evento

| Estado atual | Ação | Novo estado | Responsável | Consequência |
|---|---|---|---|---|
| — | Criar evento | PREPARACAO | Logística | Notifica áreas: "evento aberto para necessidades até {dataReuniao}" |
| PREPARACAO | Editar dados / data da reunião | PREPARACAO | Logística | Histórico |
| PREPARACAO | Iniciar reunião | EM_REUNIAO | Logística | Rascunhos PRE_REUNIAO não podem mais ser enviados; notifica áreas |
| EM_REUNIAO | Voltar para preparação (reunião adiada) | PREPARACAO | Logística | Justificativa; notifica áreas |
| EM_REUNIAO | Fechar ata | ABERTO | Logística | Pré-condição: todos os itens de solicitações PRE_REUNIAO enviadas respondidos. Gera AtaVersao 1 e OsVersao 1. Notifica áreas |
| ABERTO | Responder solicitação de alteração (por item) | ABERTO | Logística | Aplica no EventoItem; nova OsVersao; notifica solicitante por item |
| ABERTO | Ajuste direto na ata | ABERTO | Logística | Justificativa obrigatória; nova OsVersao; notifica área afetada |
| ABERTO | Encerrar para alterações | ENCERRADO | Logística | Pré-condição RV-13: nenhuma solicitação ENVIADA/EM_ANALISE. Gera OsVersao final. Notifica áreas |
| ENCERRADO | Reabrir em exceção | ABERTO | Gestão | Justificativa obrigatória; `reabertoVezes++`; notifica Logística e áreas (RV-14) |
| PREPARACAO / EM_REUNIAO / ABERTO | Cancelar evento | CANCELADO | Logística | Motivo obrigatório; solicitações abertas → CANCELADA; notifica áreas |
| CANCELADO | — | — | — | Terminal (somente leitura). Reverter exige novo evento (RV-15) |

Estado derivado exibido: evento ENCERRADO com `dataFim` passada aparece como "Realizado" nas listagens (não é estado persistido).

### 6.2 Solicitação (PRE_REUNIAO e ALTERACAO)

| Estado atual | Ação | Novo estado | Responsável | Regra |
|---|---|---|---|---|
| — | Criar rascunho | RASCUNHO | Requisitante | PRE_REUNIAO só se evento PREPARACAO; ALTERACAO só se evento ABERTO |
| RASCUNHO | Editar itens | RASCUNHO | Requisitante (mesma área) | Salvamento automático por item |
| RASCUNHO | Excluir rascunho | (excluída logicamente) | Requisitante | Sem impacto |
| RASCUNHO | Enviar | ENVIADA | Requisitante | ≥ 1 item válido; evento no estado correto; define `prazoRespostaEm`; notifica Logística |
| ENVIADA | Cancelar | CANCELADA | Requisitante | Só enquanto nenhum item respondido |
| ENVIADA | Devolver para ajuste | DEVOLVIDA | Logística | Motivo obrigatório; notifica autor (**MEL-04**) |
| DEVOLVIDA | Editar e reenviar | ENVIADA | Requisitante | Novo prazo |
| ENVIADA | Responder primeiro item | EM_ANALISE | Logística | — |
| EM_ANALISE | Responder último item pendente | RESPONDIDA | Logística | `respondidaEm`; OS recalculada a cada item |
| RESPONDIDA | Corrigir resposta de item | RESPONDIDA | Logística | Justificativa; reaplica no EventoItem; nova OsVersao; notifica (**MEL-05**) |
| qualquer não terminal | Evento cancelado | CANCELADA | Sistema | — |

Indicador derivado: **atrasada** = status ENVIADA/EM_ANALISE e `agora > prazoRespostaEm`.

### 6.3 Item de solicitação

`EM_ANALISE` → `ATENDIDO` | `PARCIAL` | `NAO_ATENDIDO` (Logística). Efeito no evento:

| Operação | ATENDIDO | PARCIAL | NAO_ATENDIDO |
|---|---|---|---|
| ADICIONAR | cria EventoItem com qtd solicitada | cria EventoItem com qtd atendida | nada |
| ALTERAR_QUANTIDADE | EventoItem.quantidade = nova qtd | EventoItem.quantidade = qtd atendida | mantém |
| REMOVER | EventoItem.ativo = false | (não se aplica; tratado como ATENDIDO ou NAO_ATENDIDO) | mantém |

### 6.4 Projeto padrão e Peça

Projeto: ATIVO ⇄ INATIVO (Cenografia). Inativo não pode entrar em novas solicitações; eventos existentes mantêm. Editar BOM ⇒ nova versão. Peça: ATIVA ⇄ INATIVA; não pode ser inativada se estiver no BOM de projeto ativo (mensagem lista os projetos).

---

## 7. Regras de negócio consolidadas

- **RN-01** OS de um setor = Σ (BOM da versão usada × quantidade do projeto no evento) + peças avulsas do setor. Nunca é editada à mão.
- **RN-02** Toda mudança na OS tem origem rastreável: item de solicitação respondido ou ajuste da logística com justificativa.
- **RN-03** Atendimento é por item, nunca em bloco. Uma solicitação pode ter itens em estados diferentes.
- **RN-04** Estados de item: Em análise → Atendido / Atendido parcialmente / Não atendido.
- **RN-05** OS recalculada automaticamente com a quantidade efetivamente atendida.
- **RN-06** Rascunho preserva o progresso (autosave), sem enviar.
- **RN-07** Parcial e Não atendido exigem observação da logística; o solicitante é notificado item a item. "A OS nunca reflete uma quantidade menor em silêncio."
- **RN-08** Muitas solicitações do mesmo evento correm em paralelo; não há fila nem bloqueio entre elas.
- **RN-09** Estrutura da tenda tem BOM automático (cantoneira, travessa, pé, mastro, cabo, calha). **Fechamento de tenda nunca entra em BOM**: é sempre item avulso com quantidade + destino.
- **RN-10** Encerramento para alterações é comando explícito da Logística; não é automático por data de corte. Depois dele nenhuma solicitação nova é aceita (rascunhos existentes ficam bloqueados para envio).
- **RN-11** A ata digital é gerada a partir do que foi consolidado e ajustado na reunião e fica congelada (snapshot) ao ser fechada; alterações posteriores ficam registradas separadamente.
- **RN-12** Catálogo de peças é único e reutilizado por todos os projetos.
- **RN-13** Gestão tem visão consolidada entre eventos e aprova exceções (reabertura).
- **RN-14** Prazo padrão de resposta a solicitação: 48 h (sugestão do slide 12), configurável (RV-16).

---

## 8. Lacunas e pontos REGRA A VALIDAR

| # | Pergunta | Padrão adotado na implementação | Alternativa |
|---|---|---|---|
| RV-01 | MVP inclui pré-reunião e solicitações (slide 5) ou só catálogo/projetos/ata/OS (slide 11)? | Inclui (fases 1–3) | Entregar fase 1 e esconder módulos por feature flag |
| RV-02 | Consolidação por período no MVP? | Sim, somente leitura, com estoque manual na peça | Deixar para integração com Logística |
| RV-03 | Tenda gera OS própria? | Sim: OS por setor (Estrutura, Tenda, Marcenaria) | Tenda dentro da OS de Estrutura |
| RV-04 | Áreas fixas ou por evento? (slide 12) | Fixas, cadastro mestre | Selecionar áreas por evento |
| RV-05 | Quem administra o catálogo? | Logística e Cenografia | Só Logística |
| RV-06 | Requisitante vê OS? | Não (vê a ata) | Somente leitura para todos |
| RV-07 | Rascunho é da área ou do autor? | Da área | Do autor |
| RV-08 | Origem do estoque por peça | Campo manual no catálogo | Integração futura |
| RV-09 | Códigos de peça vs nomes descritivos (slide 12) | Ambos (código + nome) | — |
| RV-10 | Existe data de corte fixa antes da carga? (slide 12) | Não; `dataCarga` opcional só informativa, com aviso visual | Corte automático em `dataCarga` |
| RV-11 | Atendimento parcial vira pendência de compra/locação? (slide 12) | Logística marca "gerar pendência" ao responder; lista de pendências sem integração | Automático em todo parcial/não atendido |
| RV-12 | Logística pode ajustar a ata diretamente depois de fechada? | Sim, com justificativa obrigatória, histórico e notificação à área | Só via solicitação |
| RV-13 | Encerrar com solicitações pendentes? | Bloqueado; tela lista o que falta responder | Marcar pendentes como não atendidas automaticamente |
| RV-14 | Reabrir evento encerrado? (slide 12) | Só Gestão, com justificativa, contado e visível | Logística também |
| RV-15 | Evento cancelado pode ser restaurado? | Não | Gestão restaura |
| RV-16 | Prazo de resposta 48 h corridas ou úteis? | Corridas, configurável | Horas úteis |
| RV-17 | Solicitação de alteração pode reduzir/remover item da ata? | Sim (ALTERAR_QUANTIDADE, REMOVER) | Só adicionar |
| RV-18 | Quem recebe "ata fechada" e "evento encerrado"? | Todos os usuários ativos das áreas requisitantes + cenografia | Só áreas com itens no evento |
| RV-19 | Anexos em solicitações (foto, croqui)? | Não no MVP (só em projetos) | Permitir |
| RV-20 | Recuperação de senha por e-mail | Sem SMTP no MVP: link exibido/registrado em log; trocar por e-mail real na implantação | Configurar SMTP |
| RV-21 | Escalonamento se a área discordar da resposta | Não há fluxo; a área abre nova solicitação; Gestão enxerga tudo | Contestação formal |

---

## 9. Fluxos completos

### 9.1 Happy path

1. Logística cria evento (PREPARACAO) com data da reunião → áreas notificadas.
2. Produção abre solicitação pré-reunião: "Pórtico boca 6,60m × 2", "Tenda 10×10 × 1", item avulso "4 fechamentos — GV". Salva como rascunho, completa depois, envia.
3. Um dia antes da reunião, lembrete automático para áreas sem envio.
4. Logística inicia reunião (EM_REUNIAO). Na tela de consolidação vê todos os itens enviados agrupados por área, responde item a item (atende, ajusta quantidade com observação, recusa com observação) e inclui linhas próprias.
5. Fecha a ata → ABERTO. AtaVersao 1 e OS v1 (por setor) geradas; áreas notificadas.
6. Ativação percebe que precisa de mais uma torre: abre solicitação de alteração, envia. Logística responde em até 48 h; OS v2 gerada; ativação notificada.
7. Logística encerra o evento → ENCERRADO. OS final exportada para Estrutura, Tenda e Marcenaria.

### 9.2 Caminhos alternativos e "buracos" fechados

| Situação | Tratamento |
|---|---|
| Área envia solicitação com informação insuficiente | Logística **devolve** com motivo; área corrige e reenvia (MEL-04) |
| Área quer editar solicitação já enviada | Cancela (se nada respondido) e cria outra, ou aguarda devolução |
| Logística errou a resposta | Corrige item com justificativa; OS recalculada; solicitante notificado (MEL-05) |
| Solicitação enviada quando o evento acabou de ser encerrado | Servidor rejeita: "Evento encerrado para alterações em {data} por {nome}"; rascunho preservado |
| Item duplicado (mesmo projeto já na ata) | Aviso não bloqueante no formulário: "Já existem 2 na ata; deseja adicionar mais ou alterar a quantidade?" (MEL-06) |
| Envio repetido (duplo clique) | Ação idempotente: só RASCUNHO → ENVIADA |
| Logística tenta encerrar com pendências | Bloqueado com lista das solicitações pendentes (RV-13) |
| Evento encerrado precisa de mudança | Gestão reabre com justificativa; a OS final anterior fica no histórico (RV-14) |
| Projeto padrão alterado após uso | Evento mostra "nova versão disponível"; Logística decide atualizar (MEL-02) |
| Reunião adiada | Volta para PREPARACAO; envios reabertos |
| Peça inativada | Bloqueada se em projeto ativo |
| Usuário sem permissão acessa URL direta | Tela "sem permissão" (403) com link para onde ele pode ir |
| Recarregar página no meio do rascunho | Nada se perde (autosave por item) |

---

## 10. Mapa de telas

| Rota | Tela | Função no fluxo | Perfis |
|---|---|---|---|
| `/login` | Login | Entrada | todos |
| `/recuperar-senha`, `/redefinir-senha/[token]` | Recuperação de acesso | RV-20 | todos |
| `/` | Painel | Próxima ação por perfil: Logística → solicitações a responder (com prazo), eventos por estado; Requisitante → eventos aceitando necessidades/alterações, meus rascunhos, minhas respostas recentes; Cenografia → projetos, OS recentes; Gestão → eventos por estado, atrasos, exceções | todos |
| `/eventos` | Lista de eventos | Filtro por status, período, busca | todos |
| `/eventos/novo`, `/eventos/[id]/editar` | Formulário de evento | Criar/editar | Logística |
| `/eventos/[id]` | Detalhe do evento — abas **Visão geral · Ata · Solicitações · OS · Histórico** | Centro do processo; ações do estado atual no cabeçalho | todos (OS: conforme matriz) |
| `/eventos/[id]/reuniao` | Consolidação da reunião | Responder itens pré-reunião por área, incluir linhas, observações, fechar ata | Logística |
| `/eventos/[id]/os/[setor]` | OS do setor (impressão/PDF) e exportação CSV | Saída operacional | Logística, Cenografia, Gestão |
| `/solicitacoes` | Minhas solicitações / Todas | Lista com status, prazo, evento | conforme matriz |
| `/solicitacoes/nova?evento=` | Nova solicitação (rascunho) | Itens: projeto, peça ou avulso; operação; qtd; destino; justificativa | Requisitante, Cenografia |
| `/solicitacoes/[id]` | Detalhe | Requisitante: acompanha por item. Logística: responde por item (inline), devolve | conforme matriz |
| `/projetos`, `/projetos/[id]`, `/projetos/novo`, `/projetos/[id]/editar` | Biblioteca de projetos padrão | BOM, imagens, PDF, versões | ver: todos; editar: Cenografia |
| `/catalogo`, `/catalogo/nova`, `/catalogo/[id]/editar` | Catálogo de peças | Cadastro mestre, estoque | ver: todos; editar: Logística, Cenografia |
| `/consolidacao` | Consolidação por período | Demanda × estoque por peça, pico diário, déficit; aba Pendências de compra/locação | Logística, Gestão |
| `/notificacoes` | Central de notificações | Lista, marcar lida | todos |
| `/admin/usuarios`, `/admin/areas`, `/admin/configuracoes` | Administração | Usuários/perfis, áreas, SLA e lembretes | Admin |
| `/perfil` | Meu perfil | Trocar senha | todos |
| `/403`, `/404`, erro | Estados globais | — | — |

Modais/drawers com função definida: confirmar envio de solicitação; encerrar evento (com verificação de pendências); reabrir (justificativa); cancelar evento/solicitação (motivo); devolver solicitação (motivo); responder item (drawer com qtd + observação + pendência); ajuste direto na ata (justificativa); atualizar versão de projeto no evento; inativar peça/projeto.

Estados de interface cobertos em todas as telas: carregando (skeleton), vazio com próxima ação, erro com tentar novamente, sem permissão, salvando/salvo (autosave), confirmação de destrutivas, alteração pendente ao sair do formulário, offline (toast).

---

## 11. Notificações (cada uma com propósito)

| Gatilho | Destinatário | Por quê |
|---|---|---|
| Evento criado / reunião marcada | usuários das áreas requisitantes | saber que podem registrar necessidades |
| Lembrete: reunião em N dias e a área ainda não enviou | usuários da área | "notificação de prazo" (slide 11) |
| Solicitação enviada | usuários Logística | precisa responder |
| Item respondido (cada item) | autor + área da solicitação | RN-07 |
| Solicitação devolvida | autor | precisa corrigir |
| Ata fechada | áreas | podem abrir alterações |
| Prazo de resposta vencido | usuários Logística | SLA |
| Evento encerrado | áreas | nada mais entra |
| Evento reaberto em exceção | Logística + áreas | janela excepcional |
| Ajuste direto na ata | área afetada | rastro |
| Nova versão de projeto em uso em evento aberto | Logística | decidir atualização |

Sem e-mail no MVP (RV-20); central interna + contador no topo.

---

## 12. Auditoria e histórico

Registrado em `Historico`: criação/edição de evento; cada transição de estado (quem, quando, justificativa); envio, devolução, cancelamento de solicitação; cada resposta de item (antes/depois); ajustes diretos na ata; atualização de versão de projeto no evento; criação de versões de projeto; alterações de catálogo (incl. estoque); alterações de usuário/perfil. Snapshots: `AtaVersao` e `OsVersao` (comparáveis entre si na aba OS: "o que mudou entre v3 e v4").

---

## 13. Arquitetura proposta

Proporcional ao produto: aplicação web única, monolito modular, sem microsserviços.

- **Next.js 15 (App Router) + TypeScript** — front e back no mesmo deploy; Server Components para listas, Server Actions para mutações, Route Handlers para exportações (CSV) e impressão.
- **Prisma + SQLite** para desenvolvimento/demonstração, esquema portável para PostgreSQL em produção (só troca o provider).
- **Autenticação própria**: e-mail + senha (bcrypt), sessão em cookie HttpOnly assinado, tabela de sessões (revogável), tokens de recuperação com expiração.
- **Camada de domínio pura** (`src/domain`): máquinas de estado, cálculo de OS, consolidação, matriz de permissões — funções sem I/O, testadas com **Vitest**.
- **Camada de serviços** (`src/server/services`): casos de uso transacionais (autorização → regra de domínio → persistência → histórico → notificações).
- **Validação**: Zod, com o mesmo schema no formulário e no servidor.
- **UI**: Tailwind CSS + primitivas Radix (diálogo, menu, abas, toast) + biblioteca interna pequena de componentes (Button, Input, Select, DataTable com fallback em cartões no mobile, StatusBadge, PageHeader, EmptyState, Drawer). Sem template genérico; tipografia Inter, paleta neutra com um acento, densidade de sistema operacional.
- **Segurança**: autorização no servidor em toda ação e leitura; IDs opacos; soft delete; uploads validados por tipo/tamanho e servidos por rota autenticada; proteção CSRF nativa das Server Actions; limite de tentativas no login.
- **Tarefas de tempo** (lembretes, SLA vencido): verificação leve executada no servidor no máximo a cada 5 min, disparada por requisições (sem cron externo no MVP).

Estrutura de pastas:

```
src/
  app/            rotas (App Router), layouts, páginas, actions
  components/     ui/ (primitivas) e feature/ (eventos, solicitacoes, os, ...)
  domain/         regras puras + testes
  server/         auth, db (prisma), services, notifications, audit
  lib/            utils, formatação, zod schemas
prisma/           schema.prisma, seed.ts
docs/             este documento e os entregáveis finais
```

---

## 14. Dados de teste planejados (fictícios)

- 6 áreas; 12 usuários (2 Logística, 1 Gestão, 1 Admin, 2 Cenografia, 6 requisitantes distribuídos). Senha padrão de demonstração única.
- Catálogo: ~28 peças — box truss (400, 600, 700, 3000, 3500, cubo, grapple, parafuso, base, sapata), tenda (cantoneira, travessa, pé, mastro, cabo, calha, fechamento — `permiteEmProjeto=false`), marcenaria (chapa MDF, sarrafo, piso, tampo, rodapé, tinta).
- Projetos: Pórtico boca 6,60m (BOM exato do slide 4), Pórtico boca 4m, Torre de som 4m, Palco 8×6 (estrutura + marcenaria), Tenda 10×10, Tenda 5×5, Balcão de credenciamento (marcenaria), Camarim 3×3 — com imagens e PDF placeholder.
- Eventos: 9 cobrindo todos os estados — Preparação (com rascunhos e envios), Em reunião, Aberto (com solicitações respondidas, parciais, não atendidas, devolvida, atrasada), Encerrado, Reaberto em exceção, Cancelado, e 2 realizados no passado para a consolidação.
- Histórico e notificações coerentes com os cenários.

---

## 15. Melhorias além do PPT (todas marcadas como otimização)

| # | Melhoria | Por quê |
|---|---|---|
| MEL-01 | Perfil Administrador | operar usuários/áreas/config sem misturar com Gestão |
| MEL-02 | Versionamento de projeto padrão com snapshot no evento | evita OS mudar silenciosamente |
| MEL-03 | Solicitação pode alterar quantidade ou remover item da ata | processo real inclui reduções |
| MEL-04 | Devolução de solicitação para ajuste | caminho de correção sem cancelar |
| MEL-05 | Correção de resposta com justificativa | erro humano da logística com rastro |
| MEL-06 | Aviso de duplicidade ao adicionar item já presente | evita OS inflada por engano |
| MEL-07 | Versões de OS comparáveis | responde "o que mudou desde ontem?" |
| MEL-08 | Consolidação por pico diário (não soma bruta) | eventos que não se sobrepõem não competem por peça |
| MEL-09 | Indicador de prazo/atraso nas solicitações e no painel | SLA de 48 h visível sem relatório |
| MEL-10 | Painel orientado à "próxima ação" por perfil | reduz navegação |

---

## 16. Ordem de implementação

1. Base: projeto Next + Prisma + auth + layout + componentes.
2. Domínio testado: permissões, máquinas de estado, cálculo de OS, consolidação.
3. Cadastros: áreas, usuários, catálogo, projetos (com versões e anexos).
4. Eventos + solicitações pré-reunião + consolidação da reunião + ata.
5. OS por setor, versões, exportação.
6. Solicitações de alteração, respostas por item, encerramento, reabertura, ajustes.
7. Notificações, histórico, painel, consolidação por período, pendências.
8. Seed completo; testes de fluxo no navegador (desktop, notebook, tablet, celular); revisão de produto; auditoria técnica; entregáveis finais.
