# Entregáveis — Norte Mkt · Planejamento de Eventos

Complementa [01-analise-e-especificacao.md](01-analise-e-especificacao.md) (requisitos, fluxos, estados, modelo de dados, permissões, regras e lacunas). Aqui: o que foi implementado, decisões, testes, problemas corrigidos e melhorias.

## 1. Visão geral do produto (o que foi entendido do PowerPoint)

O briefing descreve uma agência de eventos cujo processo de pedido de estruturas (box truss, tendas, marcenaria) é verbal, com ata manual, alterações por WhatsApp e OS montada em Excel com erro de fórmula. O sistema substitui isso por uma cadeia determinística — **catálogo de peças → projeto padrão com BOM → evento usa N projetos → OS = Σ BOM × quantidade** — envolta em um processo com estados: preparação (áreas registram necessidades) → reunião (logística consolida e fecha a ata) → aberto a alterações (solicitações respondidas item a item) → encerrado por comando da logística.

## 2. Requisitos identificados

Ver §1–§7 da especificação. Resumo: 5 perfis, 22 ações de permissão, 6 estados de evento, 6 estados de solicitação, 4 estados de item, OS por setor com versionamento, consolidação por período, notificações com propósito, histórico completo.

## 3. Funcionalidades implementadas

| Módulo | Funcionalidades |
|---|---|
| Autenticação | login, logout, recuperação de senha (link em log — RV-20), troca de senha, limite de tentativas |
| Painel | próxima ação por perfil: fila da logística ordenada por prazo, rascunhos/devolvidas e respostas do requisitante, visão da gestão |
| Eventos | lista com filtros por URL, criar/editar, detalhe com abas (visão geral, ata, solicitações, OS, histórico), ações da máquina de estados com justificativa, aviso de carga, aviso de versão defasada |
| Consolidação da reunião | necessidades por área com resposta por item inline, inclusão direta de linhas, observações da reunião, verificação de pendências antes de fechar |
| Ata | linhas consolidadas, alteração de quantidade/remoção (com justificativa após fechamento), atualização de versão de projeto, ata congelada (snapshot) com solicitações pré-reunião |
| OS | cálculo por setor (Estrutura, Tenda, Marcenaria) com decomposição por origem, itens avulsos, versões com diff, CSV por setor, impressão/PDF com campo de separação |
| Solicitações | rascunho com autosave, itens (projeto/peça/avulso; adicionar/alterar quantidade/remover), aviso de duplicidade, envio com prazo, cancelamento, devolução, resposta por item (atendido/parcial/não atendido + observação obrigatória + pendência), correção com justificativa |
| Projetos padrão | biblioteca, editor de BOM, versionamento automático, anexos (imagens/PDF em banco), inativação, usos defasados |
| Catálogo | peças com setor, família, unidade, estoque próprio, “sempre avulsa” (fechamento de tenda), inativação bloqueada quando em BOM |
| Consolidação | demanda × estoque por período com pico diário; pendências de compra/locação |
| Notificações | central com não lidas, marcar lidas; 11 gatilhos com propósito (§11 da especificação) |
| Administração | usuários/perfis/áreas, configurações (SLA, lembrete, bloqueio de encerramento) |
| Histórico | por evento e por projeto; toda transição, resposta e ajuste com autor/data/justificativa |

## 4. Mapa de telas

Implementado conforme §10 da especificação: 33 rotas (todas dinâmicas, autenticadas via `proxy.ts` + verificação no servidor), mais `/api/anexos/[id]`, `/api/os/[id]/[setor]` (CSV) e `/impressao/os/[id]`. Estados de tela: carregando (skeleton), vazio com próxima ação, erro com tentar novamente/offline, sem permissão (403), 404, salvando/salvo (autosave), confirmações com justificativa.

## 5. Fluxos

Implementados os fluxos de §9 da especificação, incluindo os caminhos alternativos: devolução para ajuste, correção de resposta, bloqueio de envio em evento encerrado com rascunho preservado, aviso de duplicidade, envio idempotente, bloqueio de encerramento com pendências, reabertura pela gestão, reunião adiada, atualização de versão de projeto, acesso direto a URL sem permissão.

## 6. Estados

Máquinas de estado em `src/domain/evento.ts` e `src/domain/solicitacao.ts`, com testes unitários. A UI só exibe ações que o domínio permite para o estado e perfil; o servidor valida de novo em toda mutação.

## 7. Modelo de dados

18 tabelas em `src/server/db/schema.ts` (migração em `drizzle/`). Entidades: Area, Usuario, Sessao, TokenRecuperacao, Peca, Projeto, ProjetoVersao, ProjetoItem, Anexo, Evento, EventoItem (linha da ata com snapshot do BOM), Solicitacao, SolicitacaoItem, AtaVersao, OsVersao, Historico, Notificacao, Configuracao, Sequencia. Exclusão lógica em eventos, solicitações, itens da ata, peças e projetos.

## 8. Perfis e permissões

Matriz em `src/domain/permissions.ts` (§4.2 da especificação), aplicada via `exigir()` nos serviços e `requirePermissao()` nas páginas. Requisitantes só veem/editam solicitações da própria área; rascunhos pertencem à área (RV-07).

## 9. Regras de negócio

RN-01 a RN-14 (§7 da especificação) implementadas. Destaques verificados por teste: OS = Σ BOM × quantidade; resposta por item com observação obrigatória para parcial/não atendido; quantidade parcial entre 1 e solicitada−1; remoção não admite parcial; fechamento de tenda não entra em BOM; encerramento manual; ata congelada.

## 10. Lacunas encontradas no PowerPoint

§2 e §8 da especificação. Principais: campos do evento, quem cria o evento, formato da OS/ata, o que acontece com pendentes ao encerrar, prazo, data de corte, reabertura, pendência de compra, áreas fixas, códigos de peça, autenticação/usuários, estoque, versionamento de projetos, notificações, auditoria.

## 11. Decisões tomadas

- Stack Next.js + Drizzle + PostgreSQL (PGlite local, Postgres do Replit em produção), alinhada aos outros projetos da empresa no Replit.
- Anexos guardados no banco (bytea, até 8 MB) para sobreviver a deployments sem disco persistente.
- OS versionada por snapshot a cada mudança; ata congelada como snapshot ao fechar.
- Versão de projeto congelada na linha da ata (snapshot do BOM), com atualização explícita pela logística.
- Consolidação por pico diário, não soma bruta.
- Sem e-mail no MVP: notificações internas; link de recuperação de senha no log.
- Verificações de prazo (SLA vencido, lembrete de reunião) executadas por requisição, no máximo a cada 5 minutos, sem cron externo.
- Formulários submetem via transição (não `action` nativo) para preservar o que o usuário digitou quando o servidor devolve erro de validação.

## 12. Pontos marcados como REGRA A VALIDAR

RV-01 a RV-21 (§8 da especificação), cada um com o padrão implementado. Os que mais afetam a operação: RV-11 (pendência de compra manual ao responder), RV-12 (ajuste direto da ata com justificativa), RV-13 (encerramento bloqueado com pendentes — configurável), RV-14 (só gestão reabre), RV-16 (48 h corridas — configurável), RV-17 (solicitação pode reduzir/remover), RV-20 (recuperação de senha sem SMTP).

## 13. Arquitetura implementada

- `src/domain`: regras puras (permissões, estados, cálculo de OS, consolidação, validação de resposta) — 21 testes unitários.
- `src/server/services`: casos de uso transacionais; cada um autoriza, aplica a regra, persiste, registra histórico e notifica dentro da mesma transação.
- `src/app/**/actions.ts`: Server Actions finas (parse Zod → serviço → revalidate); erros de domínio viram `{ ok:false, erro, campos }`.
- `src/components/ui`: biblioteca interna (Button, Field, Badge, Panel, Dialog, Dropdown, ConfirmDialog, TabsNav, FiltersBar, ActionForm).
- Segurança: sessão em cookie HttpOnly/SameSite, hash bcrypt, tokens de recuperação com hash e expiração, limite de tentativas de login, autorização no servidor em toda leitura/mutação, uploads validados por tipo/tamanho e servidos por rota autenticada, IDs opacos (UUID).

## 14. Testes realizados

| Tipo | O quê | Resultado |
|---|---|---|
| Unitários (Vitest) | cálculo de OS (soma, agrupamento, setores, diff), máquinas de estado, resposta por item, permissões, consolidação por pico | 21/21 |
| Fumaça de serviços (`npm run test:smoke`) | 33 cenários: bloqueios de transição, justificativas obrigatórias, permissões por perfil, devolução/reenvio/correção com efeito na ata, anexos bytea, catálogo e admin | 33/33 |
| Seed pelos serviços reais | 9 eventos em todos os estados, 20 solicitações, versões de ata/OS, reabertura, cancelamento, projeto com nova versão | executa sem erro |
| Navegador (dev) | login errado/correto, painel, lista e detalhe de eventos, ata, OS com versões e diff, histórico, solicitações com atraso, responder item parcial com pendência, projetos e detalhe, catálogo com filtro por URL, consolidação, pendências, notificações (inclusive SLA vencido gerado pelo job), perfil, logout, redirecionamento 403 para requisitante em OS/consolidação/admin, criação de rascunho, item com validação (quantidade 0) e aviso “já existe na ata”, envio com confirmação | OK após correções |
| Build de produção | `next build` | OK, 33 rotas |
| Typecheck / lint | `tsc`, ESLint (regras do React Compiler) | 0 erros |

**Não verificado no navegador** (pane do navegador ficou oculto e bloqueou a hidratação das páginas transmitidas por streaming): diálogos de transição de evento (fechar ata, encerrar, reabrir, cancelar), upload de anexo pela tela, formulários de administração, e as capturas de tela em tablet/celular. Os mesmos fluxos foram validados no nível de serviço; a camada de diálogo (`ConfirmDialog`) foi validada no envio de solicitação. Recomendo uma passada manual nesses pontos ao abrir o app.

## 15. Problemas encontrados e corrigidos

1. Formulários perdiam o conteúdo quando o servidor devolvia erro de validação (reset automático do React 19) → `ActionForm` submete via transição.
2. `buttonClasses` importado de módulo cliente em página de servidor quebrava a aba OS → separado em `button-classes.ts`.
3. Comparação de OS por string falhava porque JSONB não preserva ordem de chaves → `osIguais()` semântico.
4. Checkbox desmarcado falhava na validação Zod (“expected nonoptional”) e o erro ficava invisível → schema `bool` opcional e erro sempre exibido no formulário.
5. Diálogo de envio de solicitação passava a action já vinculada ao `useActionState`, causando `formData.get is not a function` → passa a action crua.
6. Datas em histórico/notificações usavam o fuso do servidor → `formatarDataHora` com America/Sao_Paulo.
7. PGlite não criava o diretório de dados → `mkdirSync` antes de abrir.
8. Painel vazio quando a solicitação não tinha observação; títulos de aba genéricos; texto de status duplicado em “Nova solicitação”; 40 notificações não lidas no seed.
9. Regras do React Compiler (setState em effect, reatribuição no render) e navegação por `window.location` → refatorados.

## 16. Melhorias adicionadas além do PowerPoint

Todas marcadas como otimização de produto (não estavam no briefing):

- MEL-01 perfil Administrador; MEL-02 versionamento de projeto com snapshot e atualização explícita; MEL-03 alteração/remoção de linhas da ata via solicitação; MEL-04 devolução para ajuste; MEL-05 correção de resposta com justificativa; MEL-06 aviso de duplicidade; MEL-07 versões de OS comparáveis; MEL-08 consolidação por pico diário; MEL-09 indicador de prazo/atraso e notificação de SLA; MEL-10 painel orientado à próxima ação.
- Extras de implementação: ata congelada com as respostas pré-reunião; OS de impressão com coluna de separação e assinaturas; CSV por setor; filtros persistidos na URL; lembrete automático para áreas que não enviaram necessidades; bloqueio de inativação de peça em uso; bloqueio de autodesativação do administrador.

## Próximos passos sugeridos

1. Validar com as áreas os pontos RV (especialmente RV-11, RV-12, RV-13, RV-16) e ajustar em Configurações ou no código.
2. Configurar SMTP e trocar a recuperação de senha por e-mail real.
3. Passada manual nos diálogos de transição de evento e nas telas de administração no navegador.
4. Fase 4/5: integração com o sistema de Logística (estoque real) e com Compras (pendências).

## 17. Redesenho a partir do handoff do Claude Design

Fonte: `docs/design-handoff/` (README com tokens, telas, estados, microinterações, acessibilidade e cálculos; protótipo `.dc.html`; `dados.js`). Fidelidade alta, regras de negócio preservadas.

### O que mudou na interface

- Tokens do handoff no Tailwind 4 (`@theme`): paleta vinho/escuro, Geist + Roboto Mono, raios 7–12 px, erro em `#a8400f` (não vermelho), animações `fadeUp` e `pulseDot` só onde o handoff pede.
- Shell: barra lateral escura com contadores derivados, trilha no cabeçalho, busca global `⌘K` agrupada (Ações, Eventos, Solicitações, Biblioteca) com permissão por perfil, largura mínima 1000 px.
- Login em dois painéis com números reais; bloco de demonstração só fora de produção (ou `EXIBIR_DEMO=true`).
- Painel por perfil (logística, gestão, requisitante, administrador) com métricas derivadas, fila por prazo e “Atender” de um clique para solicitações com um item.
- Eventos agrupados por urgência com barras de fase; evento com linha do tempo de 4 fases e abas Visão geral, Ata, Consolidar ata, Solicitações, OS [vN] e Histórico.
- Consolidar ata: banner escuro com progresso, cartões por solicitação, atalhos A/P/N/Esc, ata ao vivo à direita, observações com salvamento automático.
- OS: cartão escuro de diferenças, comparação entre versões (`?v=&base=`), setores com origens, itens avulsos, versões clicáveis.
- Solicitações: pills com contagem, cabeçalhos ordenáveis com `aria-sort`, paginação de 8; detalhe com modo fila, “Atender tudo”, devolução, correção com justificativa e toast com “Desfazer”.
- Nova solicitação em página única: evento (tipo derivado da fase), itens com −/+ e destino, abas de busca, contexto com validação no blur e resumo ao tentar enviar; edita rascunhos (`?rascunho=`).
- Biblioteca (projetos com BOM lateral e marca “novo na vN”; catálogo ordenável com paginação de 12), Consolidação (15/30/60 dias, barra com traço de estoque, pendências), Administração (usuários com modal, áreas, configurações), Notificações, estados de carregamento, erro e 404.

### Regras e serviços novos (necessários para o design)

- Códigos `EVT-`, `SOL-`, `PRJ-`.
- Prazo: “vencido/há N dias”, “em Nh”, “em Nd”; só solicitações abertas ficam atrasadas. Necessidade pré-reunião tem prazo na própria reunião.
- Desfazer resposta: só o autor, até 10 minutos, só a primeira resposta (correções usam “Corrigir”); reverte ata, recalcula status, gera versão da OS em alteração e registra `RESPOSTA_DESFEITA`.
- Atender tudo; salvar solicitação completa (cabeçalho + itens numa transação, envio opcional).
- Consolidação com demanda projetada de eventos sem ata fechada (itens em análise), marcada como “projetado”.
- Convite de usuário por link de acesso (7 dias, uso único) em vez de senha inicial; e-mail somente leitura na edição; perfil Logística passa a exigir área.
- Configurações novas: aviso de prazo próximo (12 h) e antecedência da reunião (0 h). Notificação `PRAZO_PROXIMO`.

### Testes do redesenho

| Tipo | O quê | Resultado |
|---|---|---|
| Typecheck / lint | `tsc --noEmit`, ESLint com regras do React Compiler | 0 erros, 0 avisos |
| Unitários (Vitest) | anteriores + consolidação projetada, classificação do histórico, rótulos de prazo, janela pré-reunião | 25/25 |
| Fumaça de serviços | seções 0–7: painel e consolidação derivados, transições, devolução/correção, anexos, admin com convite por link, formulário completo, prazo pré-reunião, desfazer, atender tudo, busca por área | todos os cenários passaram (após corrigir uma asserção de projeção que olhava a janela errada) |
| Build de produção | `next build` | OK, 38 rotas |
| Navegador (dev, 1280 px) | login com bloco de demonstração, painel da logística, “Atender” de um clique com toast e “Desfazer” (contador 4 → 3 → 4), lista de eventos agrupada | OK |
| Varredura de rotas autenticada (Logística) | 135 URLs: todas as abas dos 9 eventos (inclui comparação de OS), 20 solicitações com e sem modo fila, biblioteca com ordenação/paginação, consolidação 30/60 dias, redirecionamentos das rotas antigas, 404 | 134 × 200 sem tela de erro; 404 esperado na rota inexistente; nenhum erro no servidor |

**Não verificado no navegador:** interações de clique dentro das abas (atalhos A/P/N, modais de transição, modal de usuário, formulário de nova solicitação) — o painel do navegador ficou oculto e trava navegação e streaming. Esses fluxos estão cobertos no nível de serviço pelo teste de fumaça; recomendo uma passada manual com os perfis de demonstração.

### Desvios conscientes do handoff

| Handoff | Implementado | Motivo |
|---|---|---|
| Modal de usuário diz “recebe um e-mail para definir a senha” | Texto adaptado e link exibido ao administrador | Não há SMTP no MVP |
| Diff da OS por soma acumulada das versões do intervalo | Diferença direta entre os snapshots das duas versões | Mesmo resultado líquido, sem risco de acumular erro; snapshots já existem |
| Botões de criar/editar evento, projeto e peça só disparam toast | Fluxos reais mantidos com o novo visual | Já existiam no MVP |
| Pendências “até ser resolvida” | Lista mostra pendências de eventos não encerrados/cancelados; não há ação de resolver | Integração com Compras é fase futura (RV-11) |
| Aba “Consolidar ata” só durante a reunião | Também em preparação, com botão “Iniciar reunião” no banner | Permite responder o que já chegou antes da reunião |
| “Alterar linha da ata” não aparece na Nova solicitação | Quarta aba para eventos abertos | Mantém MEL-03 (alterar/remover linha via solicitação) |
| Ordenação/paginação só em Solicitações e Catálogo | Igual; eventos agrupados, usuários com busca e filtro | Seguido como está (§11 do handoff) |
| Focus trap nos modais ausente no protótipo | Radix Dialog com focus trap e devolução de foco | Resolve pendência de acessibilidade do §11 |
| Ações de exceção (voltar para preparação, cancelar) no cabeçalho | Movidas para a página de edição do evento | Cabeçalho fica com a próxima ação da fase |
