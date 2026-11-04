# Mapa de páginas do NorteLog (auditoria do redesign, etapa 1)

Inventário das 53 rotas de `src/app/**/page.tsx`, para o redesign só de UX/UI. Base: branch `redesign/nortelog`, commit
`1ee5c6f` (03/11/2026). Feito só por leitura do código: sem servidor e sem navegador. O que depende de ver renderizado
está marcado "ver na tela".

Reaproveita `docs/design-log.md`, `docs/design-system.md`, `docs/auditoria/2026-10-28-consolidado.md` e
`docs/auditoria/2026-10-30-parte-*.md`. Problema antigo só entra aqui se o código de hoje ainda o mostra. Referências:
"nº 44" é o consolidado de 28/10; "A-N11", "B-02", "C-N2" e "D-N1" são as partes de 30/10.

**Cópia de trabalho em movimento.** Enquanto este mapa era feito, outra tarefa começou a alterar 28 arquivos sem commit (novo kit
de marca: grafite e laranja, menu escuro, títulos em Barlow Condensed). Pelo diff, são tokens e classes: não mudam rota,
permissão nem estrutura de tela, que é o que este mapa descreve. As referências de linha são do commit base.

**Gravidade** (régua do consolidado, aplicada à tela): **P1** pode levar a dado errado ou impede a tarefa principal;
**P2** atrapalha, confunde ou tem risco provável; **P3** acabamento.

## 1. Cobertura

| Composição | Rotas | Quais |
|---|---|---|
| Lista operacional | 9 | `/eventos`, `/eventos/[id]/solicitacoes`, `/conferencia/[id]`, `/solicitacoes`, `/arena`, `/ativacao`, `/ativacao/retornos`, `/ativacao/reformas`, `/biblioteca` |
| Acompanhamento | 7 | `/`, `/eventos/[id]`, `/eventos/[id]/historico`, `/calendario`, `/carga-descarga`, `/historico`, `/notificacoes` |
| Detalhe | 7 | `/eventos/[id]/ata`, `/eventos/[id]/os`, `/eventos/[id]/itens/[linhaId]`, `/solicitacoes/[id]`, `/ativacao/itens/[id]`, `/projetos/[id]`, `/catalogo/[id]` |
| Cadastro | 14 | `/eventos/novo`, `/eventos/[id]/editar`, `/eventos/[id]/carga`, `/carga-descarga/cadastro`, `/arena/nova`, `/projetos/novo`, `/projetos/[id]/editar`, `/catalogo/nova`, `/catalogo/[id]/editar`, `/perfil`, `/admin`, `/login`, `/recuperar-senha`, `/redefinir-senha/[token]` |
| Formulário em passos | 1 | `/solicitacoes/nova` |
| Impressão | 3 | `/impressao/os/[id]`, `/impressao/ata/[id]`, `/impressao/arena/[slug]` |
| Ferramenta 3D | 1 | `/arena/[slug]` |
| Sem composição própria | 11 | `/sem-permissao`; 3 desligadas (seção 12); 7 redirecionamentos (seção 13) |

## 2. O que é comum às telas

**Shell (`components/shell/app-shell.tsx`), em todo `(app)`.** Menu lateral (claro no commit base; ver seção 17), trilha, busca
global (Ctrl K), sino e menu da conta. Abaixo de 1024 px o menu vira gaveta.

| Item do menu | ADMIN | LOGISTICA | GESTAO | CENOGRAFIA | REQUISITANTE |
|---|---|---|---|---|---|
| Painel, Eventos, Calendário, Solicitações, Biblioteca | sim | sim | sim | sim | sim |
| Carga e descarga | sim | sim | | | |
| Arena 3D | sim | sim | sim | só pelo evento | só pelo evento |
| Ativação | sim | só quem é da área Ativação | só quem é da área Ativação | só quem é da área Ativação | só quem é da área Ativação |
| Histórico | sim | sim | sim | | |
| Administração | sim | | | | |

A Ativação é liberada pelo nome da área (`domain/estoque.ts:17`), fora da matriz de `permissions.ts`. O contador do item
Solicitações só aparece para ADMIN, LOGISTICA e GESTAO.

**Layout do evento (`eventos/[id]/layout.tsx`), em 8 páginas.** Cabeçalho (código, fase, nome, 4 metadados, ações), trilho
de 4 fases e até 7 abas (Visão geral, Ata, Conferência, Solicitações, OS, Carga, Histórico). Os blocos abaixo não repetem isso.

## 3. Painel

### `/`
- **Finalidade:** porta de entrada: o que depende da pessoa agora. **Quem:** todos, em duas versões: operação (ADMIN, LOGISTICA, GESTAO) e área (CENOGRAFIA, REQUISITANTE). **Composição:** acompanhamento.
- **Prioritário:** operação: atrasadas, reuniões por fechar, fila por prazo. Área: devolvidas, ressalvas, seus eventos.
- **Ações:** responder em sequência e ✓ atender (LOGISTICA, ADMIN); Novo evento ou Abrir conferência de hoje (LOGISTICA); Nova solicitação (área).
- **Densidade:** média na operação (lista "agora", fila, agenda); alta na área (até 7 blocos).
- **Problemas:** a ação principal do ADMIN é "Administração", igual ao menu (`page.tsx:471`). Atrasadas e aguardando aparecem em "agora" e de novo na fila logo abaixo. "Devolvida ou rascunho" junta urgências diferentes numa linha (`:366`). Agenda de 14 dias aqui e 21 no Calendário. O "onde" da agenda fica só no `title` no celular (`:220`).
- **Oportunidades:** ação do ADMIN orientada a tarefa; juntar "em andamento" e "respostas" numa lista (proposta de 28/10 no design-log, mexe na consulta); separar devolvida de rascunho.

## 4. Eventos

### `/eventos`
- **Finalidade:** achar um evento e ver em que pé está. **Quem:** todos; Novo evento só LOGISTICA e ADMIN. **Composição:** lista operacional.
- **Prioritário:** o que exige ação, a fase e o próximo marco (reunião, janela, OS).
- **Ações:** buscar, filtrar, ver só o que exige ação, abrir, Novo evento.
- **Densidade:** alta: 3 listas de filtro, atalho de urgência e 7 abas antes da tabela; cada linha com até 6 informações, mais cliente, local e responsável.
- **Problemas:** a ordem padrão (ação agora, andamento, resto) não é dita na tela. "Encerrado" e "Realizado" não têm explicação. "Áreas que pediram" abre só no `title`. No celular a linha empilha até 4 faixas: ver na tela.
- **Oportunidades:** fases numa lista e abas só para os recortes de trabalho; dizer a ordem usada; decidir a coluna "Pendências", que mostra "em dia" na maioria das linhas (decisão em aberto no design-log).

### `/eventos/novo`
- **Finalidade:** criar o evento. **Quem:** LOGISTICA, ADMIN. **Composição:** cadastro.
- **Prioritário:** nome, data do evento e reunião de OS (sugerida: terça, 35 dias antes).
- **Ações:** Criar evento; Voltar sem salvar.
- **Densidade:** baixa: 6 campos em 2 seções.
- **Problemas:** "Voltar sem salvar" aqui e "Cancelar" nos formulários de projeto e peça.
- **Oportunidades:** mostrar a linha do tempo resultante (reunião, janela, evento) enquanto se preenche.

### `/eventos/[id]` (Visão geral)
- **Finalidade:** situação do evento e tabela de trabalho dos itens. **Quem:** todos; corrige itens só LOGISTICA e ADMIN. **Composição:** acompanhamento.
- **Prioritário:** próximo passo com prazo, o que mudou depois da ata e os itens.
- **Ações:** incluir e ajustar itens, trocar a leitura (4 pílulas), abrir item, OS, histórico, arena.
- **Densidade:** alta: 4 métricas, "o que mudou", itens, galeria, atividade e atalhos, abaixo do cabeçalho, das fases e das abas.
- **Problemas:** a métrica "Evento" repete a data do cabeçalho. O atalho "Solicitações do evento" repete a aba. A arena, único caminho de CENOGRAFIA e REQUISITANTE (o menu não a mostra), fica nos atalhos do fim da página. As leituras repetem as da aba OS com outros nomes e outro padrão. Leitura "Peças por projeto" pesada (B-38): ver na tela.
- **Oportunidades:** deixar o topo só com o próximo passo; tirar o que a aba já dá; levar galeria e atividade para baixo de uma dobra clara; dar à arena um lugar no cabeçalho.

### `/eventos/[id]/ata`
- **Finalidade:** ata em construção, ou registro congelado da reunião. **Quem:** todos; observações só para quem tem `historico.ver_tudo` ou `ata.consolidar`. **Composição:** detalhe.
- **Prioritário:** linhas por área, quem conferiu, dados da reunião.
- **Ações:** abrir conferência, exportar (2 Excel e impressão), ver o que mudou, corrigir itens (leva à visão geral).
- **Densidade:** média a alta: tabela e até 4 painéis laterais.
- **Problemas:** para quem confere, Ata e Conferência mostram as mesmas linhas em duas abas. "Ata (lista de materiais)" traz as quantidades da OS atual (B-02 atenuado pelo texto e pelo rodapé do arquivo). No celular as exportações vêm depois da lista inteira (a aba OS já inverteu isso). "avulso" fora do glossário (`ata-lista.tsx:105`).
- **Oportunidades:** com a ata aberta, para quem confere, a aba leva à conferência; renomear a lista como documento da OS.

### `/eventos/[id]/solicitacoes`
- **Finalidade:** pedidos deste evento. **Quem:** todos; REQUISITANTE só os da área. **Composição:** lista operacional.
- **Prioritário:** o que aguarda resposta, no topo.
- **Ações:** abrir, responder em sequência.
- **Densidade:** média: uma tabela, 7 colunas no desktop.
- **Problemas:** sem busca, filtro nem paginação, ao contrário de `/solicitacoes` (`page.tsx:21`). Prazo em duas linhas aqui e em uma na lista geral.
- **Oportunidades:** reaproveitar a lista geral com o evento fixo.

### `/eventos/[id]/os`
- **Finalidade:** o que vai para o galpão, por versão. **Quem:** todos veem e exportam; ajusta e marca envio só LOGISTICA e ADMIN. **Composição:** detalhe.
- **Prioritário:** versão atual, se foi enviada, o que mudou, totais por peça.
- **Ações:** marcar como enviada, baixar complemento, exportar, comparar versões, ajustar itens, estrutura locada.
- **Densidade:** alta: OS, comparação, 4 visões e até 4 painéis laterais; a lista passa de 7.000 px no celular (comentário em `os/page.tsx:171`).
- **Problemas:** até 7 tipos de saída com nomes parecidos e nada diz qual vai para quem (Excel completo, estrutura, marcenaria, impressão, KIT, complemento, CSV por seção). "Ajustar itens" é a 4ª pílula. Versões ficam depois da OS inteira no celular. Lista de versões longa (24 no exemplo do design-log). "Totais" é o padrão aqui, "Lista" na visão geral.
- **Oportunidades:** agrupar exportações por destino (galpão, cenografia, arquivo); levar "ajustar" para ação explícita; recolher versões antigas por dia.

### `/eventos/[id]/carga`
- **Finalidade:** veículos deste evento. **Quem:** LOGISTICA, ADMIN. **Composição:** cadastro.
- **Prioritário:** quantos veículos, ida e volta de cada um.
- **Ações:** Novo veículo, ver, editar, duplicar, excluir, ir ao calendário.
- **Densidade:** média: um cartão por veículo com os dois trechos.
- **Problemas:** o mesmo componente tem dois desenhos, aqui e em `/carga-descarga/cadastro` (`compacto`).
- **Oportunidades:** um desenho só de veículo.

### `/eventos/[id]/historico`
- **Finalidade:** tudo que mudou ata e OS. **Quem:** todos; quem não vê tudo recebe só o da própria área. **Composição:** acompanhamento.
- **Prioritário:** quem mudou o quê, quando e por quê.
- **Ações:** filtrar por assunto, abrir item ou solicitação.
- **Densidade:** média: uma linha do tempo em coluna de 840 px.
- **Problemas:** teto de 300 registros sem aviso (`consultas.ts:119`). Sem busca. Desenho diferente do `/historico` geral.
- **Oportunidades:** avisar o teto ou paginar; aproximar do histórico geral.

### `/eventos/[id]/itens/[linhaId]`
- **Finalidade:** um item da ata ou OS, de quem pediu até a resposta. **Quem:** todos; dados da outra área ocultos; edita LOGISTICA e ADMIN. **Composição:** detalhe.
- **Prioritário:** quantidade, local, quem pediu, peças.
- **Ações:** ajustar quantidade, remover, vincular, ajustar peças, quadro de tendas, conferir (antes da ata).
- **Densidade:** alta: até 4 seções e 2 painéis fixos, abaixo do cabeçalho do evento, das fases e das abas.
- **Problemas:** nenhuma aba fica marcada. "Nesta linha" e "Peças do grupo de tendas" são vocabulário interno (design-log 27/10). Painel lateral fixo com conteúdo longo: ver na tela. "Respondido por" pode trazer uma frase longa (`:272`).
- **Oportunidades:** abrir como painel sobre a lista de itens, sem sair do contexto; vocabulário de quem usa.

### `/eventos/[id]/editar`
- **Finalidade:** dados do evento e exceções. **Quem:** LOGISTICA, ADMIN. **Composição:** cadastro.
- **Prioritário:** datas e janela.
- **Ações:** salvar; adiar reunião; cancelar evento.
- **Densidade:** baixa: 6 campos e a zona de exceção.
- **Problemas:** usa `h2` solto em vez do cabeçalho padrão, dentro do layout do evento (`:27`).
- **Oportunidades:** abrir como diálogo a partir de "Editar".

## 5. Conferência

### `/conferencia/[id]`
- **Finalidade:** conduzir a reunião de OS: conferir cada linha e fechar a ata. **Quem:** LOGISTICA, ADMIN. **Composição:** lista operacional.
- **Prioritário:** quantas faltam, a próxima linha, o que impede de fechar.
- **Ações:** iniciar reunião, conferir, ajustar quantidade, incluir linha, registrar presentes, fechar ata e gerar OS.
- **Densidade:** alta: cabeçalho, banner escuro, barra fixa, filtros (pílulas, busca, 3 listas), lista e painel lateral.
- **Problemas:** "Fechar ata" só existe no banner do topo; a barra fixa não o traz e o vazio manda "feche a ata no topo da página" (`conferencia-ata.tsx:1233`). Presentes, obrigatório para fechar, fica abaixo da lista inteira até 1280 px (`page.tsx:93`). Sai das abas do evento, embora a aba "Conferência" leve até aqui. O sobretítulo repete a trilha. Progresso dito em dois lugares. "Incluir linha" aqui e "Incluir item" na visão geral.
- **Oportunidades:** barra fixa com progresso e o fechamento; presentes antes da lista em tela menor; modo reunião sem os blocos de apoio.

## 6. Solicitações

### `/solicitacoes`
- **Finalidade:** fila de resposta (logística) e acompanhamento (área). **Quem:** todos; REQUISITANTE só a própria área; quem vê todas não vê rascunho alheio, exceto ADMIN. **Composição:** lista operacional.
- **Prioritário:** atraso e prazo, status, área.
- **Ações:** responder em sequência, Nova solicitação, buscar, filtrar, abrir.
- **Densidade:** alta: até 5 filtros e 6 abas; 7 colunas no desktop largo.
- **Problemas:** tipo e autor ficam só no `title` no desktop e não aparecem no celular (`:272`). "—" em `--color-line-strong`, cerca de 1,5:1 (`:91`; regra do design system §7). Duas marcações diferentes para a mesma lista (`md:hidden`).
- **Oportunidades:** marcar pré-reunião e alteração de forma visível, sem selo por linha; recolher Área, Tipo e Reunião atrás de um "Filtros" no celular.

### `/solicitacoes/nova`
- **Finalidade:** pedir itens para um evento, ou editar rascunho e pedido enviado. **Quem:** REQUISITANTE, CENOGRAFIA, ADMIN (escolhe a área). **Composição:** formulário em passos.
- **Prioritário:** evento, o que pedir, o que falta para enviar.
- **Ações:** escolher evento, adicionar do catálogo ou da lista da área, detalhar, salvar rascunho, enviar.
- **Densidade:** alta: 4 ou 5 passos na mesma página, resumo fixo de 340 px (barra no rodapé abaixo de `lg`).
- **Problemas:** os passos não guiam: tudo aparece de uma vez e o número muda conforme a área. Trocar de evento pede excluir o rascunho e refazer, sem link para isso (`nova/escolha-evento.tsx:152`; P1 proposto no design-log 27/10). Peso da página (nº 146): ver na tela.
- **Oportunidades:** focar um passo por vez no celular; link direto para descartar; permitir trocar o evento (muda regra: decisão do time).

### `/solicitacoes/[id]`
- **Finalidade:** ler o pedido e, para a logística, responder item a item. **Quem:** a área dona e quem vê todas; responde LOGISTICA e ADMIN; os outros caem em `/sem-permissao?motivo=solicitacao`. **Composição:** detalhe.
- **Prioritário:** prazo, itens, o que falta responder.
- **Ações:** atender, parcial, não atender, atender tudo, devolver, vincular; para a área: editar, enviar, cancelar, excluir; modo fila.
- **Densidade:** alta: 8 avisos condicionais, até 5 metadados e até 4 ações no cabeçalho, mais o banner do modo fila.
- **Problemas:** "Atender tudo" e os atalhos ficam longe do item respondido. No modo fila, "Próxima" (rosa) e "Atender tudo" (primário) competem. O motivo de "fora do catálogo" está só no `title` (`:143`). A área não retira pedido pré-reunião: `podeCancelar` exige nada respondido (A-N11, decisão do time; confirmar na tela).
- **Oportunidades:** resumir avisos numa faixa; barra fixa de resposta no modo fila; deixar claro antes de "Atender" que o item fora do catálogo não soma peças (design-log 27/10).

## 7. Calendário e carga

### `/calendario`
- **Finalidade:** ver compromissos de todos os eventos no mês. **Quem:** todos. **Composição:** acompanhamento.
- **Prioritário:** reuniões, montagens, cargas e fim de janela de hoje em diante.
- **Ações:** trocar mês, filtrar por tipo e evento, abrir o resumo do dia, abrir compromisso.
- **Densidade:** média a alta: grade de até 6 semanas e agenda de 21 dias embaixo; no celular, lista.
- **Problemas:** a agenda fica depois da grade inteira: ver na tela. A célula tem até 3 linhas e o resto vai a "+N". Dois alvos sobrepostos: o dia abre resumo e o compromisso abre o destino (`dia-modal.tsx`).
- **Oportunidades:** alternar Mês e Agenda; levar a agenda para o lado em telas largas (hoje foi retirada de lá para não espremer a grade).

### `/carga-descarga`
- **Finalidade:** o que sai do galpão e o que volta, na semana. **Quem:** LOGISTICA, ADMIN. **Composição:** acompanhamento.
- **Prioritário:** veículos e operações do dia, por dia da semana.
- **Ações:** Novo veículo, trocar semana, filtrar, abrir veículo ou evento.
- **Densidade:** alta: indicadores, cartão de filtros em 2 linhas (2 grupos de pílulas, busca, tipos, 3 caixas), gráfico anual e grade de 7 dias.
- **Problemas:** o gráfico do ano fica antes da semana, que é a tarefa. Itens da "Planilha 2026" se distinguem só pela borda pontilhada (dica no `title`). Cartões de 7 colunas: conferir leitura em 1280 px, ver na tela.
- **Oportunidades:** recolher gráfico e filtros raros; a semana primeiro.

### `/carga-descarga/cadastro`
- **Finalidade:** escolher o evento e cadastrar veículos; importar planilha. **Quem:** LOGISTICA, ADMIN. **Composição:** cadastro.
- **Prioritário:** eventos sem veículo nos próximos 30 dias.
- **Ações:** filtrar, escolher evento, novo veículo, baixar modelo, importar, Novo evento.
- **Densidade:** média: lista e detalhe lado a lado, e a faixa de importação.
- **Problemas:** busca e caixas ficam só em memória: recarregar ou navegar perde o recorte. A faixa de importação ocupa o topo mesmo sendo ocasional.
- **Oportunidades:** importar como ação do cabeçalho; filtros na URL, como nas outras listas.

## 8. Arena

### `/arena`
- **Finalidade:** índice de mapas. **Quem:** todos com `arena.ver`, no menu só ADMIN, LOGISTICA e GESTAO; criar e gerir só ADMIN. **Composição:** lista operacional.
- **Prioritário:** arena, evento, tem planta, pontos.
- **Ações:** abrir, Nova arena; ⋯ trocar planta, entorno 3D, excluir.
- **Densidade:** baixa a média: tabela de 7 colunas, poucas linhas.
- **Problemas:** no celular o menu ⋯ aparece sem conferir `podeEditar` (`arena/page.tsx:151`; no desktop confere, `:109`): quem não é ADMIN vê "Excluir arena" e o servidor recusa. O vazio oferece "Criar a primeira arena" a todos (`:45`). Mostra o caminho técnico `/arena/slug` (`:82`).
- **Oportunidades:** mesma regra nas duas larguras; trocar o caminho pela data ou pelo local do evento.

### `/arena/nova`
- **Finalidade:** criar o mapa de um evento. **Quem:** ADMIN. **Composição:** cadastro.
- **Prioritário:** evento e ponto de partida (em branco ou cópia).
- **Ações:** criar; voltar.
- **Densidade:** baixa: 2 seções curtas.
- **Problemas:** a dica "vira o endereço do mapa" é técnica.
- **Oportunidades:** esconder o nome, sugerido pelo evento, até alguém querer mudar.

### `/arena/[slug]`
- **Finalidade:** ver e editar a planta em 3D e 2D e conferir com a ata. **Quem:** todos veem; edita ADMIN e, em arena de evento, cada área nos itens que pediu. **Composição:** ferramenta 3D.
- **Prioritário:** o mapa; divergências entre planta e ata.
- **Ações:** vistas, camadas, buscar, índice, medir, tela cheia, editar mapa, posicionar, imprimir.
- **Densidade:** alta: barra de edição, barra de ferramentas, controles, legenda, minimapa e painéis laterais sobre o mapa.
- **Problemas:** ações da planta só no índice `/arena`; imprimir e restaurar só no ⋯ do mapa. Cores fixas fora dos tokens (`bg-[#e6e2dc]`, `#ebe7e1`, `#e4e6d9`). Sobreposição de controles e rótulos nas larguras menores: ver na tela. Mover sem mouse (nº 15, corrigido em 30/10): ver na tela.
- **Oportunidades:** juntar as ações da arena num lugar só; tokens próprios do mapa; modo limpo só de leitura.

## 9. Ativação

### `/ativacao`
- **Finalidade:** estoque da área. **Quem:** ADMIN e quem é da área Ativação. **Composição:** lista operacional.
- **Prioritário:** disponível, a comprar, em evento, em reforma.
- **Ações:** mudar quantidade na linha, editar, Novo item, buscar, ver pedidos.
- **Densidade:** alta: cerca de 245 linhas editáveis sem paginação (nº 44, decisão pendente).
- **Problemas:** o +/− grava sozinho em 0,7 s, com Desfazer por 8 s (nº 42 atenuado). Busca, categoria e aba só em memória: voltar de um item perde o recorte. Abas próprias em vez de `TabsNav`, em outro tamanho de texto (`estoque-tela.tsx:124`).
- **Oportunidades:** edição de quantidade como modo explícito; paginar (recomendação do nº 44); filtros na URL.

### `/ativacao/retornos`
- **Finalidade:** registrar o que voltou de cada evento. **Quem:** ADMIN, área Ativação. **Composição:** lista operacional.
- **Prioritário:** eventos com retorno pendente.
- **Ações:** registrar, completar ou corrigir retorno.
- **Densidade:** média: um cartão com tabela por evento.
- **Problemas:** tabelas com `min-w-[560px]` rolam de lado no celular (`retornos-tela.tsx:108`): ver na tela. "Todos os retornos estão registrados" fica fora do `EmptyState`.
- **Oportunidades:** no celular, um bloco por item; pendentes como fila.

### `/ativacao/reformas`
- **Finalidade:** o que está em reforma. **Quem:** ADMIN, área Ativação. **Composição:** lista operacional.
- **Prioritário:** item, quantidade, previsão.
- **Ações:** Enviar para reforma, editar, concluir, ver concluídas.
- **Densidade:** baixa a média.
- **Problemas:** "Enviar para reforma" fica no corpo, não no cabeçalho (regra §5.1 e decisão de 30/10; `reformas-tela.tsx:46`).
- **Oportunidades:** ação pelo `AcaoNoCabecalho`, como pede o design system.

### `/ativacao/itens/[id]`
- **Finalidade:** um item: quanto tem, onde está, o que aconteceu. **Quem:** ADMIN, área Ativação. **Composição:** detalhe.
- **Prioritário:** em posse, em evento, em reforma, disponível.
- **Ações:** enviar para reforma, editar, anexar fotos, registrar retornos.
- **Densidade:** alta: 4 métricas e 5 seções em coluna única.
- **Problemas:** fotos vêm antes de eventos e reformas. "Registrar retornos" leva à lista geral, sem o evento. Vazios em `<p>`, fora do `EmptyState`.
- **Oportunidades:** duas colunas (situação e histórico); seções vazias recolhidas.

## 10. Biblioteca, projetos e peças

### `/biblioteca`
- **Finalidade:** projetos padrão, catálogo de peças e fila do fora do catálogo. **Quem:** todos; gerencia LOGISTICA, CENOGRAFIA, ADMIN; a fila só LOGISTICA e ADMIN. **Composição:** lista operacional.
- **Prioritário:** achar um projeto ou peça, onde é usado.
- **Ações:** buscar, filtrar, abrir, Novo projeto, Nova peça, selecionar em lote, vincular, duplicar.
- **Densidade:** alta: até 6 controles antes da lista, 3 abas, faixa de lote sempre à vista para quem gerencia, painel lateral de 330 px.
- **Problemas:** a linha faz coisas diferentes: em Projetos abre o painel; em Peças abre a edição direta para quem gerencia. Filtros diferentes por aba (listas num lado, pílulas de setor no outro). "Gerenciar grupos" fica na barra de filtros (contra §5.1). O painel abre sozinho no 1º item sem busca. Cabeçalho do painel com 3 ações em texto.
- **Oportunidades:** uma regra só para o clique; faixa de lote só ao selecionar; o painel abre só por escolha.

### `/projetos/novo`
- **Finalidade:** criar projeto do zero ou por duplicação (`?de=`). **Quem:** LOGISTICA, CENOGRAFIA, ADMIN. **Composição:** cadastro.
- **Prioritário:** nome e lista de peças.
- **Ações:** adicionar peças, criar projeto, cancelar.
- **Densidade:** média.
- **Problemas:** fotos só na página do projeto, depois de criar (dito num aviso).
- **Oportunidades:** depois de criar, abrir na seção de anexos, com o aviso que a peça já mostra.

### `/projetos/[id]`
- **Finalidade:** ler o projeto, peças por setor, versões. **Quem:** todos; gerencia LOGISTICA, CENOGRAFIA, ADMIN. **Composição:** detalhe.
- **Prioritário:** lista de peças, versão atual, eventos em versão antiga.
- **Ações:** editar, duplicar, inativar, liberar para solicitações, anexar.
- **Densidade:** média a alta: tabela, anexos e até 4 painéis laterais.
- **Problemas:** tipos e unidades aparecem 3 vezes (cabeçalho, título da lista, rodapé). O aviso diz que "a logística decide na ata" (`:103`), mas a ata fechada é só leitura (`ata/page.tsx:122`) e o ajuste fica nos itens. Histórico cortado em 8, sem "ver tudo" (`:254`).
- **Oportunidades:** apontar o aviso para os itens do evento; juntar Dados e Histórico.

### `/projetos/[id]/editar`
- **Finalidade:** mudar dados e peças; pode gerar nova versão. **Quem:** LOGISTICA, CENOGRAFIA, ADMIN. **Composição:** cadastro.
- **Prioritário:** o que a nova versão faz nos eventos em uso.
- **Ações:** salvar (confirma quando há ata fechada), cancelar.
- **Densidade:** média.
- **Problemas:** dois caminhos para o mesmo formulário: esta página e o diálogo da Biblioteca, e só o diálogo recebe os anexos.
- **Oportunidades:** um caminho só.

### `/catalogo/nova`
- **Finalidade:** cadastrar peça ou duplicar (`?de=`). **Quem:** LOGISTICA, CENOGRAFIA, ADMIN. **Composição:** cadastro.
- **Prioritário:** código, nome, setor.
- **Ações:** cadastrar, cancelar.
- **Densidade:** média: 3 seções.
- **Problemas:** "Estoque próprio" é um campo que não tem efeito: a dica diz que nenhuma tela soma o número (`peca-form.tsx:83`).
- **Oportunidades:** recolher campos sem efeito.

### `/catalogo/[id]`
- **Finalidade:** ler a peça. **Quem:** quem vê e não gerencia (GESTAO, REQUISITANTE); os outros são levados à edição. **Composição:** detalhe.
- **Prioritário:** fotos, PDFs, dados, projetos que usam.
- **Ações:** zoom, abrir PDF, ir ao projeto.
- **Densidade:** baixa.
- **Problemas:** nenhum relevante pelo código.
- **Oportunidades:** reaproveitar como painel lateral da Biblioteca.

### `/catalogo/[id]/editar`
- **Finalidade:** editar peça e anexos. **Quem:** LOGISTICA, CENOGRAFIA, ADMIN. **Composição:** cadastro.
- **Prioritário:** dados e onde a peça é usada.
- **Ações:** salvar, anexar, duplicar, inativar.
- **Densidade:** média: anexos, 3 seções, aviso de uso.
- **Problemas:** quem gerencia não tem visão de leitura: abrir a peça já é editar. "Estoque próprio", como em `/catalogo/nova`.
- **Oportunidades:** "usada em" mais perto do topo, antes de inativar.

## 11. Histórico, conta e administração

### `/historico`
- **Finalidade:** registro geral do app. **Quem:** LOGISTICA, GESTAO, ADMIN. **Composição:** acompanhamento.
- **Prioritário:** quem fez o quê, quando, em que evento.
- **Ações:** filtrar, exportar CSV, abrir registro, ver campos alterados.
- **Densidade:** alta: 4 métricas, pílulas, 3 filtros, abas e tabela.
- **Problemas:** as métricas repetem as pílulas de período e, ao clicar, limpam os outros filtros (`:69`). "Registros" e "pessoas ativas" não levam a uma decisão.
- **Oportunidades:** tirar as métricas; começar pela busca.

### `/notificacoes`
- **Finalidade:** avisos da pessoa. **Quem:** todos. **Composição:** acompanhamento.
- **Prioritário:** não lidas, prazo vencido.
- **Ações:** abrir (marca como lida), marcar todas.
- **Densidade:** baixa a média: lista por período.
- **Problemas:** "não lida" usa a cor da marca, que o design system reserva para ação e seleção (proposta em aberto no design-log 28/10). Não há marcar uma como lida sem abrir o destino.
- **Oportunidades:** tom próprio para "novo"; decidir o que fica só no sino.

### `/perfil`
- **Finalidade:** dados, sessões e senha. **Quem:** todos. **Composição:** cadastro.
- **Prioritário:** senha, se for provisória; quem sou e o que meu perfil pode.
- **Ações:** trocar senha, encerrar outras sessões.
- **Densidade:** baixa.
- **Problemas:** nenhum relevante pelo código.
- **Oportunidades:** manter simples.

### `/admin`
- **Finalidade:** usuários, áreas e configurações (`?aba=`). **Quem:** ADMIN. **Composição:** cadastro.
- **Prioritário:** quem tem acesso; regras de prazo.
- **Ações:** Novo usuário ou Nova área, editar, desativar, gerar link de acesso, ver como, salvar configurações.
- **Densidade:** média: dois níveis de abas (seção e situação, decisão de 30/10), busca e tabela.
- **Problemas:** o cabeçalho não tem o `divisor` das outras listas. Configurações misturam campos com uma linha só informativa ("Reabertura de evento · Restrita", `config-painel.tsx:66`).
- **Oportunidades:** tirar a linha informativa da lista de ajustes.

### `/sem-permissao`
- **Finalidade:** dizer por que não abriu e dar uma saída. **Quem:** todos. **Composição:** estado do sistema.
- **Prioritário:** o motivo.
- **Ações:** ir para o painel, voltar.
- **Densidade:** baixa.
- **Problemas:** nenhum relevante pelo código (nº 106 e 173 corrigidos).
- **Oportunidades:** manter.

## 12. Telas desligadas

`TELAS_INATIVAS` (`domain/telas.ts`) responde "não encontrado" e tira do menu. O código continua lá. Não entram no redesign
enquanto a operação não pedir.

| Rota | Seria | Exigiria | Hoje |
|---|---|---|---|
| `/consolidacao` | Demanda de peças por período (métricas, janela, tabela) | `consolidacao.ver`: ADMIN | 404 |
| `/consolidacao/pendencias` | Redireciona para a aba de pendências | a mesma | 404 |
| `/pendencias` | Pendências de compra (abas, busca, resolver) | `pendencias.ver`: LOGISTICA, GESTAO, ADMIN | 404 |

## 13. Redirecionamentos (sem tela)

| Rota | Vai para | Observação |
|---|---|---|
| `/catalogo` | `/biblioteca?aba=pecas` | |
| `/projetos` | `/biblioteca` | |
| `/estoque` | `/ativacao` | link antigo |
| `/admin/usuarios` | `/admin` | a permissão fica no destino |
| `/admin/areas` | `/admin?aba=areas` | a permissão fica no destino |
| `/admin/configuracoes` | `/admin?aba=config` | a permissão fica no destino |
| `/eventos/[id]/reuniao` | `/conferencia/[id]` | |

## 14. Acesso

### `/login`
**Fora do redesign por regra do dono do produto: rota só registrada, sem proposta.** Finalidade: entrar (Portal NORTE, ou
e-mail e senha). Quem: público. Composição: cadastro, no layout de `(auth)`.

### `/recuperar-senha`
- **Finalidade:** pedir um novo link ao administrador. **Quem:** público. **Composição:** cadastro.
- **Prioritário:** e-mail. **Ações:** pedir novo acesso; voltar ao login.
- **Densidade:** baixa: um campo.
- **Problemas:** nenhum relevante pelo código.
- **Oportunidades:** nenhuma que mexa no layout: ele é o mesmo do login, que está fora do redesign.

### `/redefinir-senha/[token]`
- **Finalidade:** definir a senha por link, ou dizer que o link venceu. **Quem:** quem recebeu o link. **Composição:** cadastro.
- **Prioritário:** nova senha. **Ações:** salvar senha; recuperar acesso.
- **Densidade:** baixa: dois campos.
- **Problemas:** nenhum relevante pelo código.
- **Oportunidades:** a mesma restrição do layout de `/recuperar-senha`.

## 15. Impressão

### `/impressao/os/[id]`
- **Finalidade:** folha de separação para o galpão. **Quem:** todos com `os.exportar`. **Composição:** impressão.
- **Prioritário:** peça e quantidade, coluna para escrever. **Ações:** imprimir, voltar à OS.
- **Densidade:** média: tabelas por seção, sem código nem composição (decisão registrada).
- **Problemas:** a prévia só é dita numa célula do cabeçalho (`:104`), então uma folha de OS ainda não gerada pode passar por definitiva.
- **Oportunidades:** marca de prévia forte, visível no papel.

### `/impressao/ata/[id]`
- **Finalidade:** ata com presentes e assinaturas. **Quem:** todos com `os.exportar`. **Composição:** impressão.
- **Prioritário:** linhas conferidas, presentes, assinaturas. **Ações:** imprimir, voltar à ata.
- **Densidade:** média.
- **Problemas:** a ata ainda não fechada só é dita numa linha pequena do cabeçalho (`:68`).
- **Oportunidades:** a mesma marca forte de prévia da folha da OS.

### `/impressao/arena/[slug]`
- **Finalidade:** mapa de montagem em A4 paisagem. **Quem:** todos com `arena.ver`. **Composição:** impressão.
- **Prioritário:** planta numerada e lista de pontos. **Ações:** imprimir.
- **Densidade:** média: planta e lista.
- **Problemas:** "Imprimir / salvar PDF" fora do glossário (`imprimir-botao.tsx:8`; nº 122 ainda aberto aqui). Sem link de volta. Tamanhos fora dos tokens (16 usos de `text-[..px]`, o único arquivo do app com isso) e cores fixas.
- **Oportunidades:** mesma base tipográfica das outras duas folhas.

## 16. Problemas repetidos entre telas

Em cada faixa, do mais pesado para o mais leve. Depois de duas rodadas de correção sobraram poucos P1, e os que restam são
de estrutura, não de acabamento.

### P1

| # | Problema | Telas | Evidência | Origem |
|---|---|---|---|---|
| R1 | A mesma linha se corrige em vários lugares, sem dizer qual é o certo. Depois da ata, cada ajuste pede justificativa, gera versão da OS e avisa as áreas. | visão geral, aba OS, item, conferência; a aba Ata só aponta para eles | `eventos/[id]/page.tsx:240`; `os/page.tsx:140`; `itens/[linhaId]/page.tsx:141` e `:153` ("terceira forma de editar a mesma coisa", no comentário); `conferencia-ata.tsx:461` | nova; toca o nº 32 |
| R2 | A área fica presa ao que já começou: o rascunho não troca de evento e o pedido pré-reunião não pode ser retirado. **Muda regra: decisão do time, não se resolve só com tela.** | nova solicitação, detalhe da solicitação | `nova/escolha-evento.tsx:152`; `domain/solicitacao.ts:45` | design-log 27/10 (P1 proposto); A-N11 |

### P2

| # | Problema | Telas | Evidência | Origem |
|---|---|---|---|---|
| R3 | Pilha de cabeçalhos: trilha, título, metadados, fases e abas antes do conteúdo em todas as telas do evento; o item soma um cabeçalho próprio. Altura real: ver na tela. | 8 páginas do evento | `eventos/[id]/layout.tsx:117-170` | nova |
| R4 | Ação principal ou dado obrigatório fora de onde se trabalha. | conferência (fechar ata, presentes), solicitação (atender tudo), ata (exportar no celular), OS (versões no celular) | `conferencia-ata.tsx:1233`; `conferencia/[id]/page.tsx:93`; `ata/page.tsx:86` | nova |
| R5 | Filtros em camadas antes da lista: abas, pílulas, listas e métricas sem regra de quando usar cada um. | eventos, solicitações, biblioteca, histórico, carga, conferência | páginas citadas nas seções 4 a 11 | parte do nº 41, resolvido no layout de celular |
| R6 | Mesmo conceito com nomes, ordem ou desenho diferentes: leituras da OS; histórico do evento e geral; solicitações do evento e geral; veículo compacto e completo; agenda de 14 e 21 dias. | visão geral × OS; `/eventos/[id]/historico` × `/historico`; `/eventos/[id]/solicitacoes` × `/solicitacoes`; carga; painel × calendário | `eventos/[id]/page.tsx:36`; `os-visoes.tsx:95-100`; `carga-evento.tsx` | nova |
| R7 | Informação que só existe no `title`, inacessível ao toque. | solicitações, painel, eventos, carga, solicitação | 134 usos de `title={` em `components`; `solicitacoes/page.tsx:272`; `(app)/page.tsx:220`; `(lista)/page.tsx:97`; `solicitacoes/[id]/page.tsx:143` | parte do design system §4 ("no `title`"), que precisa de revisão |
| R8 | Salvamento automático e botão Salvar misturados, com indicação diferente em cada tela. No estoque o risco é maior (nº 44). | estoque, dados da reunião e observações, separação, rascunho × demais formulários | `estoque-tela.tsx` (0,7 s); `dados-reuniao-form.tsx` (0,9 s); `separacao-locada.tsx` (grava ao marcar) | nova |
| R9 | Saídas da OS e da ata sem dizer qual documento vai para quem. | aba OS, aba Ata | `os/page.tsx:40-48`; `ata/page.tsx:272` | parte em B-02 |
| R10 | Recorte de lista que se perde ao recarregar ou voltar. | Ativação › Estoque, Carga › Cadastro | `estoque-tela.tsx:61-63`; `cadastro-carga.tsx` | B-23 corrigiu só a conferência |
| R11 | O clique na linha faz coisas diferentes, e quem gerencia não tem visão de leitura. | biblioteca (projetos × peças), estoque (só o nome é link) | `biblioteca/page.tsx:270` × `:638` | nova |
| R12 | Celular com regra ou conteúdo diferente do desktop (marcação separada). | arena (ações sem `podeEditar`), solicitações (sem tipo) | `arena/page.tsx:109` × `:151`; `solicitacoes/page.tsx:224` × `:248` | nova |
| R13 | Vocabulário interno: "linha" × "item" × "peça". | conferência, visão geral, item, ata | `conferencia-ata.tsx:1148` × `acoes-linha-evento.tsx:364`; `itens/[linhaId]/page.tsx:146` | design-log 27/10 |

### P3

| # | Problema | Telas | Evidência | Origem |
|---|---|---|---|---|
| R14 | Cabeçalho sem regra para formulário e subpágina: tamanho de módulo em criar e em conferência, de detalhe em registro, `h2` solto no editar evento e no item, `divisor` em umas e não em outras. | formulários, editar evento, item, admin, conferência | `eventos/[id]/editar/page.tsx:27`; `itens/[linhaId]/page.tsx:119`; `admin/page.tsx:145` | §1.2 cobre só módulo e detalhe |
| R15 | Subpágina sem aba marcada, ou que sai das abas. | item do evento, conferência, item da Ativação | `eventos/[id]/layout.tsx:102` | nº 124 corrigido só no editar |
| R16 | Busca com dois componentes: `BuscaUrl` e campo próprio em memória. | estoque, carga, cadastro, conferência, nova solicitação, arena | 6 componentes com `type="search"` | nova |
| R17 | Sair sem salvar com nomes diferentes: "Voltar sem salvar" e "Cancelar". | evento × projeto, peça, reforma | `evento-form.tsx:104`; `projeto-form.tsx`; `peca-form.tsx` | B-33 corrigiu só o evento |
| R18 | Vazios em `<p>` fora do `EmptyState`. | item da Ativação, cadastro de carga, retornos, item do evento | `ativacao/itens/[id]/page.tsx:100`, `:130`, `:181`; `cadastro-carga.tsx`; `itens/[linhaId]/page.tsx:218` | §5.4 |
| R19 | Valores fora do design system: cinza de linha usado em texto e ponto; cores fixas no mapa; tamanhos fixos na impressão da arena. | solicitações, conferência, arena, impressão | `solicitacoes/page.tsx:91`; `badge.tsx:119`; `conferencia-ata.tsx:160`; `arena-experiencia.tsx:495`; `impressao-arena.tsx` | nº 139 (parte) |
| R20 | Textos fora do glossário: "avulso", "Imprimir / salvar PDF", "Ata (lista de materiais)", "Tirar a descrição". | ata, OS, impressão da arena, conferência | `ata-lista.tsx:105`; `impressao/arena/[slug]/imprimir-botao.tsx:8`; `ata/page.tsx:272`; `conferencia-ata.tsx:345` | §10.1; nº 75, 122, 161 |
| R21 | Detalhe técnico à vista: caminho da arena, "vira o endereço do mapa", "v0.2" no rodapé do menu. | arena, nova arena, shell | `arena/page.tsx:82`; `arena/nova/form.tsx`; `app-shell.tsx` (rodapé do menu) | nova |

## 17. Decisões em aberto que o redesign precisa respeitar

| Tema | Situação | Referência |
|---|---|---|
| Login | Fora do redesign, por regra do dono do produto | pedido desta etapa |
| Menu lateral claro × escuro | O design system §9 ainda diz "não decidido: não trocar", mas a cópia de trabalho de outra tarefa já o deixa escuro. Confirmar e registrar no design-log | design system §9; nº 56 |
| Acentos nas planilhas no modelo da cenografia | Não mudar até a cenografia confirmar | design system §9; nº 84 |
| Estoque sem paginação | Recomendação: 50 por página, com busca no servidor; muda comportamento | nº 44 |
| Trocar evento do rascunho e retirar pedido pré-reunião | Mudam regra | R2 |
| Tenda fora do catálogo: atender sem vincular | Decidir se o "atender" pede o vínculo antes | design-log 27/10 |
| Coluna "Pendências" da lista de eventos | Decidir se fica | design-log 26/10 |

## 18. Corrigidos: conferido no código, não citados acima

Consolidado: nº 8, 11, 23, 24, 25, 27, 28, 31, 32 (botão principal), 33, 35, 36, 38, 39 (nomes das abas), 40, 41, 43, 48,
52, 53, 54 (parte), 55, 60, 62, 66 (parte), 101, 102, 103, 106, 107, 111, 113, 114, 115, 116, 124 (só editar), 129, 130,
141, 142, 143, 173, 182.

Partes de 30/10: A-N1, N6, N10, N13, N20, N21, N22, N26; B-01, B-03, B-04, B-05, B-06, B-08, B-09, B-10, B-12, B-18, B-20,
B-23, B-33, B-35; C-N1, N2, N3, N4, N5, N9, N23, N24, N25, N26; D-N1, N2, N6, N7, N8, N10, N12, N19, N23, N28.

## 19. O que precisa ser visto na tela (próxima etapa)

- Altura real da pilha de cabeçalhos do evento nas 3 larguras (R3).
- Linhas de `/eventos` e da grade de `/carga-descarga` em celular, tablet e 1280 px.
- Sobreposição de controles e rótulos em `/arena/[slug]`, e mover pontos sem mouse.
- Peso e tempo de `/solicitacoes/nova` e das leituras "por peça" da visão geral.
- Painéis fixos com conteúdo mais alto que a tela (item do evento, Biblioteca).
- Se o botão de cancelar some mesmo no pedido pré-reunião já registrado na ata (R2).
