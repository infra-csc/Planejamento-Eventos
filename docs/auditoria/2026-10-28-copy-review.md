# Revisão de texto (copy-review) — app inteiro · 28/10/2026

Agente: **copy-review** (`.claude/agents/copy-review.md`). Só relatório: nenhuma linha do app foi alterada, sem
commit nem push. Base: `main` em `2bb3745` (28/10; o `git pull` não foi rodado porque outros agentes trabalham
na mesma cópia). **Retomado em 29/10** sobre `d3de62d`: os dois commits novos (`07ad7fa` quadro de tendas numa
gravação só, `d3de62d` folha de separação com estrutura locada) foram lidos e entraram como #1 (nova chamada),
#76–#80; a passada no navegador foi concluída para os perfis que faltavam no servidor de demonstração reiniciado.

## 1. Resumo

O texto do app está, no geral, **bem escrito**: acentuação correta em praticamente toda a interface (a busca por
`Logistica|Area|Nao|Conferencia|…` sem acento não achou nenhum texto visível), plurais calculados na maior parte
das telas, aspas curvas e reticências “…” na maioria dos rótulos, botões com verbo + objeto e confirmações que
nomeiam o objeto e a consequência. Os problemas estão concentrados em:

1. **Mensagens de erro do servidor com concordância errada** — `NaoEncontradoError` monta “`${entidade} não
   encontrado.`” e é chamada com entidades femininas em ~40 lugares (“Solicitação não encontrado.”, “Peça não
   encontrado.”, “Linha da ata não encontrado.”, “Uma das peças selecionadas não encontrado.”). **P1.**
2. **Texto quebrado** na importação de carga: “(use**kit**, ceno, estrutura, ativação)” — falta o espaço. **P1.**
   E o campo “Estoque próprio” da peça diz que o número é “usado na consolidação por período”, uma tela que
   está desligada. **P1.**
3. **“item(ns)”, “projeto(s)”, “peça(s)” e o jargão “BOM”** em mensagens de erro e no histórico. **P2.**
4. **Termos que variam entre telas** para o mesmo conceito: *fora do catálogo / item avulso / outro item / descrito
   à mão*; *inativar / desabilitar*; *vincular / ligar*; *Requisitante / Solicitante*; *conferência / consolidação*;
   *grupo da biblioteca / grupo de prova / prova / evento*; abas de fase (“Preparação”, “Aberto”, “Realizados”) ×
   selos (“Em preparação”, “Aberto a alterações”, “Realizado”). **P2.**
5. **Mensagens que mandam usar um botão que não existe com esse nome** (“Use “Corrigir”.”, “Use cancelar.”) e
   uma que aponta para a aba errada (“use o ajuste … na aba Ata”). **P2.**
6. **Exportações em Excel** com palavras sem acento (ATA DE REUNIAO, OBSERVACOES, RESPONSAVEL PELA O.S,
   REFERENCIA, Transito, Plastico, Agua, Isotonico, Proteina, aluminio, Telescopica) e “O.S” / “O.S.” / “OS”
   misturados. Copiam a planilha da cenografia de propósito — confirmar com a equipe antes de mudar. **P2.**
7. **Downloads e anexos** que, com a sessão vencida ou sem permissão, abrem uma aba com JSON cru
   (`{"erro":"Não autenticado"}`), sem dizer o que fazer. **P2.**
8. Estilo (**P3**): pontuação final dos toasts, “tente de novo” × “tente novamente”, primeira pessoa (“Não
   consegui…”, “Tentaremos…”), aspas retas em ~10 mensagens, “Faltam conferir”, “Peça ao administrador” (ambíguo
   num app em que *peça* é um objeto), nomes de arquivos exportados sem padrão.
9. **Novo em 29/10** (commits `07ad7fa` e `d3de62d`): o histórico do quadro de tendas escreve “1 fechamentos e
   1 calhas por tenda” (**P2**, #76); a estrutura locada agora tira também tina, pallet de ferro e cinta catraca
   da folha, mas checkbox, aviso da folha, toast e histórico ainda dizem só “box Q30, tendas e estaiamento”
   (**P2**, #80); e ajustes menores de redação em “Tendas de local não informado: …” e no aviso “A logística
   ajustou as tendas: GV: …” (#77–#79).

Contagem: **3 P1** (#1, #2, #4), **30 P2**, **47 P3** (tabela na seção 4). Nenhuma mudança proposta quebra seletor de
`e2e/*.spec.ts`, salvo os nomes de arquivo exportado (#69); 6 delas exigem atualizar asserções de testes
unitários (seção 6).

## 2. Cobertura real

| Frente | Como | Situação |
|---|---|---|
| Todos os textos de `src/**` (`.ts`/`.tsx`, sem `*.test.ts`) | Extração pela AST do TypeScript: texto JSX, atributos (`title`, `aria-label`, `placeholder`, `label`, `hint`, `description`, `confirmLabel`…), literais e templates em propriedades e chamadas (toasts, `throw new …Error`, `erro:`, `mensagem:`, `descricao:` do histórico, notificações, cabeçalhos de Excel/CSV). 7.466 trechos; 6.971 depois de tirar classes CSS, lidos um a um por arquivo. | **Completo** (345 arquivos com texto). |
| Mensagens de erro do servidor | `src/domain/errors.ts`, todos os `throw new DomainError/ValidacaoError/NaoEncontradoError/SemPermissaoError` em `src/server/services/**`, `src/lib/action.ts`, `src/lib/schemas.ts` (zod), retornos `{ ok:false, erro }` das 16 *server actions* | **Completo.** |
| Exportações | Excel da ata (`/api/eventos/[id]/ata/excel` e `/lista`), OS (`excel`, `estrutura`, `marcenaria`, `complemento`, CSV por setor), histórico CSV, modelo de carga e descarga, impressões (`/impressao/os`, `/ata`, `/arena`) | **Lido no código** (cabeçalhos, títulos, rodapés, nomes de aba e de arquivo). Os arquivos não foram baixados e abertos no Excel. |
| Notificações | `criarNotificacao`/títulos e mensagens em `transicoes.ts`, `envio.ts`, `rascunho.ts`, `resposta.ts`, `cadastro.ts`, `fora-catalogo.ts`, `pendencias.ts`, `jobs/verificacoes.ts`, `recuperacao.ts` | **Completo no código.** |
| E-mails | O app não envia e-mail (“Este ambiente não envia e-mail”; link de acesso é copiado pelo admin). | Não se aplica. |
| Texto em contexto, por perfil | Script próprio (Playwright, 1 chromium headless, só leitura) no servidor de demonstração `http://localhost:3100`: 38 rotas fixas + 39 com id (3 eventos com todas as abas, conferência, impressões, item do evento, 3 solicitações, projeto, peça, arena, item da Ativação) para admin, Marina (Logística), Helena (Gestão), Bruno (Cenografia), Paulo (Produção), Júlia (Ativação), Diego (Gráfica) e Lúcia (Atendimento), + tentativa de login do inativo (Tiago). Coleta de `innerText`, `title`, `aria-label`, `placeholder` e rótulos de botões/links, varridos por padrões (`undefined/NaN`, códigos de enum, “(s)”, “...”, aspas retas, “1 itens”, palavras sem acento). | **Completo no desktop (1366 px)**: 616 leituras, 77 telas × 8 perfis, todas sem erro. Matriz na seção 7. |
| Celular (375 px) | — | **Não verificado** nesta rodada (o texto é o mesmo componente; quebras de linha e truncamentos ficam para o design/a11y). |
| Estados que exigem gravar (modais abertos, toasts de sucesso/erro disparados, “depois da ata” em evento real, muitos registros) | — | **Lidos só no código**, não disparados na tela: a regra desta rodada era não gravar no banco do servidor compartilhado. |
| “Ver como” do admin | Lido no código (`app-shell.tsx`, `ver-como/actions.ts`, `support.ts`). | Não exercitado na tela. |
| Tela de login | Lida (código e tela) só para relatar — o agente não muda a tela de login. | Relatado. |

O que **ficou de fora** de propósito: o texto que vem do banco (nomes de peças, projetos, observações digitadas,
descrições do seed) — quando aparece algo estranho, está marcado como “dado”, não como correção de código.

## 3. Inventário varrido

### Páginas (52 `page.tsx`)

| Área | Rotas |
|---|---|
| Painel e conta | `/`, `/perfil`, `/notificacoes`, `/sem-permissao`, 404 do app e 404 raiz, `error.tsx`, `global-error.tsx` |
| Eventos | `/eventos`, `/eventos/novo`, `/eventos/[id]` (visão geral), `/ata`, `/os`, `/solicitacoes`, `/historico`, `/editar`, `/carga`, `/reuniao`, `/itens/[linhaId]`, `/conferencia/[id]` |
| Solicitações | `/solicitacoes` (6 abas), `/solicitacoes/nova` (e edição `?id=`), `/solicitacoes/[id]` (e modo fila “Responder em sequência”) |
| Biblioteca | `/biblioteca` (Projetos, Catálogo de peças, Fora do catálogo), `/projetos/novo`, `/projetos/[id]`, `/projetos/[id]/editar`, `/catalogo` (redireciona), `/catalogo/nova`, `/catalogo/[id]/editar` |
| Ativação | `/ativacao` (Estoque), `/ativacao/retornos`, `/ativacao/reformas`, `/ativacao/itens/[id]`, `/estoque` |
| Operação | `/calendario`, `/carga-descarga`, `/carga-descarga/cadastro`, `/arena`, `/arena/nova`, `/arena/[slug]`, `/historico`, `/consolidacao`, `/consolidacao/pendencias`, `/pendencias` (as três últimas desligadas em `src/domain/telas.ts`) |
| Admin | `/admin`, `/admin/usuarios`, `/admin/areas`, `/admin/configuracoes` |
| Impressão | `/impressao/os/[id]`, `/impressao/ata/[id]`, `/impressao/arena/[slug]`, `impressao/error.tsx` |
| Acesso | `/login`, `/recuperar-senha`, `/redefinir-senha/[token]` |

### Rotas de API (16) — mensagens e arquivos

`anexos/[id]`, `ativacao/anexos/[id]`, `pecas/anexos/[id]`, `arenas/[slug]/planta` (erros JSON), `auth/portal`
(redireciona com `?erro=portal-*`), `busca` (resultados da busca global), `carga-descarga/modelo` (planilha
modelo, 3 abas), `cron/verificacoes` (notificações de prazo e de reunião), `eventos/[id]/ata/excel`,
`eventos/[id]/ata/lista`, `historico/csv`, `os/[id]/excel`, `os/[id]/estrutura`, `os/[id]/marcenaria`,
`os/[id]/complemento`, `os/[id]/[setor]` (CSV).

### Server actions (16 arquivos, ~84 funções)

`admin`, `arena` + `arenas-actions`, `ativacao`, `biblioteca`, `carga-descarga`, `catalogo`, `eventos` (19),
`notificacoes`, `pendencias`, `perfil`, `projetos`, `solicitacoes` (9), `ver-como`, `(auth)`. Cada `erro:`,
`mensagem:` e o texto do toast que dispara foram lidos.

### Permissões (`src/domain/permissions.ts`)

29 ações: `evento.ver/criar/editar/transicionar/reabrir`, `ata.consolidar/ajustar`,
`conferencia.editar_descricao`, `solicitacao.criar/ver_todas/responder`, `os.ver/exportar`,
`catalogo.ver/gerenciar`, `projeto.ver/gerenciar`, `consolidacao.ver`, `arena.ver/editar`, `carga.ver/editar`,
`pendencias.ver/resolver`, `historico.ver_tudo`, `admin.usuarios/areas/configuracoes`. Para texto, o que importa:
os rótulos (`PERFIL_LABEL`) e descrições (`PERFIL_DESCRICAO`) dos perfis, a mensagem padrão de
`SemPermissaoError` e a tela `/sem-permissao`.

## 4. Achados — texto atual → proposto

Tipos: **ortografia** (inclui concordância e acento), **termo** (termo inconsistente), **botão** (botão vago),
**erro** (erro sem saída), **outro**. Prioridade: **P1** errado ou induz ao erro · **P2** inconsistente · **P3** estilo.
Coluna “Teste”: ⚠ = muda texto usado em teste (detalhe na seção 6).

### 4.1 P1

| # | Atual | Proposto | Onde | Tipo | Teste |
|---|---|---|---|---|---|
| 1 | `${entidade} não encontrado.` → “Solicitação não encontrado.”, “Peça não encontrado.”, “Arena não encontrado.”, “Reforma não encontrado.”, “Linha da ata não encontrado.”, “Versão da ata não encontrado.”, “Uma das peças selecionadas não encontrado.”, “Posição editada não encontrado.” | Frase neutra que serve para qualquer entidade e diz o que fazer: “Não encontramos ${entidade.toLowerCase()}. Atualize a página: o registro pode ter sido excluído ou alterado por outra pessoa.” (ou um 2º parâmetro de gênero: “Peça não encontrada…”) | `src/domain/errors.ts:19`; chamadas femininas em `services/solicitacoes/*` (12), `catalogo.ts` (5), `conferencia.ts` (5), `ativacao.ts` (4), `arena*.ts` (5), `biblioteca-lote.ts` (4), `export/ata.ts:50`, `eventos/ata.ts:173,286`, `linha-do-tempo.ts:139`, e a nova `conferencia.ts:657` (“Peça TND5-FECH não encontrado.”, `07ad7fa`) | ortografia + erro | — |
| 2 | `"x" não existe (usekit, ceno, estrutura, ativação)` | `“x” não existe: use kit, ceno, estrutura ou ativação.` | `src/domain/carga-importacao.ts:158` (aparece na conferência da importação de planilha) | ortografia | — |
| 4 | “Estoque próprio — Quantidade da empresa. Usado na consolidação por período (integração futura com o sistema de Logística).” | A tela de consolidação está desligada; o texto promete algo que a pessoa não encontra. “Quantidade que a empresa tem. Hoje é só registro: nenhuma tela soma este número.” (ou tirar o hint) | `src/components/catalogo/peca-form.tsx:69` | outro | — |

### 4.2 P2

| # | Atual | Proposto | Onde | Tipo | Teste |
|---|---|---|---|---|---|
| 3 | Quem abre `/consolidacao` (tela desligada em `TELAS_INATIVAS`, fora do menu) vê na aba do navegador “Demanda de peças · Planejamento” e no corpo “Erro 404 · Não encontrado · Este registro não existe, foi excluído ou o endereço está incompleto.” | O título da aba deveria acompanhar (“Não encontrado”) e a 404 do app não falar de “registro” quando é uma página: “Esta página não existe ou não está disponível. Confira o endereço ou volte ao painel.” | `src/app/(app)/consolidacao/page.tsx:26` (metadata), `src/app/(app)/not-found.tsx:22` | outro | — |
| 5 | “Ainda há 3 item(ns) de necessidades pré-reunião sem resposta.” | “Ainda há 3 itens de necessidades pré-reunião sem resposta.” (plural calculado) | `src/server/services/eventos/transicoes.ts:128` | ortografia | — |
| 6 | “A peça está no BOM de 2 projeto(s) ativo(s): …. Remova-a dos projetos antes de inativar.” | “A peça está na lista de peças de 2 projetos ativos: …. Tire a peça desses projetos antes de inativá-la.” | `src/server/services/catalogo.ts:145` | termo + ortografia | ⚠ manter “projeto” (`integracao.test.ts:646`) |
| 7 | `"Fechamento X" não pode entrar em BOM: é sempre lançada como item avulso.` | “Fechamento X” não entra na lista de peças de projeto: é sempre pedida solta, com destino. | `src/server/services/projetos.ts:164` | termo | — |
| 8 | Histórico: “Grupo "X" excluído: 2 projeto(s) e 1 peça(s) passaram para Padrão.” | “Grupo “X” excluído: 2 projetos e 1 peça passaram para Padrão.” | `src/server/services/projetos.ts:61` | ortografia | — |
| 9 | Histórico: “(sem mudança no BOM)” | “(sem mudança na lista de peças)” | `src/server/services/projetos.ts:225`, `src/server/services/biblioteca-lote.ts:107` | termo | — |
| 10 | Abas de `/eventos`: “Preparação · Em reunião · Aberto · Encerrado · **Realizados** · Cancelado” | Usar os mesmos rótulos dos selos (`EVENTO_STATUS_LABEL`): “Em preparação · Em reunião · Aberto a alterações · Encerrado · Realizado · Cancelado” (ou encurtar os dois juntos) | `src/app/(app)/eventos/page.tsx:30-35` × `src/domain/evento.ts:115-119`, `src/components/ui/badge.tsx:76` | termo | — |
| 11 | Perfil “**Requisitante**” (admin › usuários, perfil, histórico “Requisitante · Produção”, login de demonstração) × “**Solicitante** · Produção” (menu “Ver o app como…”) × “Solicitante” (ficha do item) | Escolher um. Sugestão: **Solicitante** (é o verbo que o app usa: “solicitação”, “área solicitante”) em `PERFIL_LABEL` — ou trocar o menu para “Requisitante · …”. | `src/domain/permissions.ts:129`, `src/components/shell/app-shell.tsx:314`, `src/app/(app)/eventos/[id]/itens/[linhaId]/page.tsx:239` | termo | ⚠ `ver-como.test.ts:122` |
| 12 | Tipo de item: “Item avulso” (form de incluir na ata, OS, Excel “Itens avulsos”, “Soltas e avulsos”), “Outro item” (nova solicitação), “descrito à mão”, “fora de catálogo” × **“fora do catálogo”** (Biblioteca, ata, conferência, selos) | **Fora do catálogo** em tudo que a pessoa lê: “Item fora do catálogo”; aba da OS “Soltas e fora do catálogo” (como na visão geral); Excel “Itens fora do catálogo”; impressão “Itens fora do catálogo”. “Outro item” pode ficar como atalho da busca, com a descrição “item fora do catálogo, descrito à mão”. | `src/components/eventos/linha-ata-form.tsx:27`, `src/domain/os.ts:107,160`, `src/server/services/eventos/comum.ts:10`, `src/components/eventos/os-visoes.tsx:99`, `src/app/api/os/[id]/excel/route.ts:93,201-216`, `src/app/(app)/eventos/[id]/os/page.tsx:42`, `src/app/impressao/os/[id]/page.tsx:108`, `src/domain/solicitacao.ts:288`, `src/server/services/eventos/ata.ts:231` | termo | — |
| 13 | Biblioteca em lote: “Desabilitar selecionados”, “itens desabilitados”, “Nenhum item foi desabilitado” × resto do app “Inativar / inativada / Inativos” | **Inativar**: “Inativar selecionados”, “3 itens inativados”, “Nenhum item foi inativado”. | `src/components/biblioteca/selecao-em-lote.tsx:97,103,175,182,187-189,194,248`, `src/app/(app)/biblioteca/actions.ts:37`, `src/server/services/biblioteca-lote.ts:54` | termo | ⚠ `biblioteca-lote.test.ts` (“Nenhum item foi desabilitado”) |
| 14 | Ativação: “Ligados ao catálogo”, “Ligue o item a uma peça do catálogo”, “Os itens ligados a uma peça”, “Ligado a uma peça do catálogo…”, “Essa peça já está ligada a …” × vocabulário **vincular** | “Vinculados ao catálogo”, “Vincule o item a uma peça do catálogo (Editar item, no topo)…”, “Os itens vinculados a uma peça…”, “Essa peça já está vinculada a …” | `src/components/estoque/estoque-tela.tsx:85,311`, `src/app/(app)/ativacao/itens/[id]/page.tsx:98`, `src/app/(app)/ativacao/(abas)/retornos/page.tsx:18`, `src/components/estoque/retornos-tela.tsx:42`, `src/server/services/estoque.ts:64` | termo | ⚠ `ativacao.test.ts:131` (`/já está ligada/`) |
| 15 | “Bloqueia novos envios de necessidades e abre a **consolidação** da ata.” (modal Iniciar reunião) e notificação “…enquanto a logística **consolida** a ata.” | “…e abre a **conferência** da ata.” / “…enquanto a logística confere a ata.” | `src/domain/evento.ts:35`, `src/server/services/eventos/transicoes.ts:217` | termo | — |
| 16 | “Criar grupo… — **Escreva o nome do evento**” (organizar projetos em lote) × “Nome livre para organizar projetos — **não vincula o projeto a um evento**” e “Os grupos são independentes dos eventos” | “Criar grupo… — Escreva o nome do grupo (ex.: a prova)” | `src/components/biblioteca/organizar-projetos-dialog.tsx:139` × `src/components/projetos/grupo-projeto-field.tsx:29`, `src/app/(app)/biblioteca/page.tsx:221` | termo | — |
| 17 | Mesmo conceito com 4 nomes: “Grupo da biblioteca”, “Grupos de prova” (modal Gerenciar grupos), “Prova” (origem da peça: “As mesmas provas dos grupos de projetos”), “grupo Padrão” | **Grupo da biblioteca** como nome do campo; “prova” só como exemplo do que o grupo costuma ser. Modal: “Grupos da biblioteca”. Origem da peça: “De um grupo (prova)” | `src/components/projetos/gerenciar-grupos.tsx:46`, `src/components/catalogo/origem-peca-field.tsx:48-65` | termo | — |
| 18 | “Esta resposta não pode mais ser desfeita. Use “Corrigir”.” / “…depois da resposta. Use “Corrigir”.” | O botão se chama “Corrigir resposta”: “…Use “Corrigir resposta”.” | `src/server/services/solicitacoes/resposta.ts:379,389` | botão | — |
| 19 | “Só rascunhos podem ser excluídos. Use cancelar.” | “Só rascunhos podem ser excluídos. Para tirar uma solicitação já enviada, use “Cancelar solicitação”.” | `src/server/services/solicitacoes/rascunho.ts:155` | botão + erro | — |
| 20 | “A conferência acontece antes de fechar a ata. Depois disso, use o ajuste com justificativa **na aba Ata**.” | O ajuste pós-ata é feito nos itens do evento: “…Depois disso, ajuste o item na visão geral do evento (Itens do evento), com justificativa.” | `src/server/services/conferencia.ts:245` | erro | — |
| 21 | `Ação "Fechar ata" não é possível no estado atual do evento.` | “Não dá para “Fechar ata” agora: o evento mudou de fase. Atualize a página.” | `src/server/services/eventos/transicoes.ts:241` | erro | — |
| 22 | Download/anexo com sessão vencida ou sem permissão abre aba com `{"erro":"Não autenticado"}`, `{"erro":"Sem permissão"}`, `{"erro":"Evento não encontrado"}`, `{"erro":"Setor inválido"}` | Para rotas abertas por link (Excel, CSV, PDF, anexos): redirecionar para `/login?next=…` ou responder uma página curta: “Sua sessão expirou. Entre de novo e repita a exportação.” / “Seu perfil não pode baixar este arquivo.” | `src/app/api/os/[id]/excel/route.ts:223-231` e as outras 10 rotas de arquivo (`ata/excel`, `ata/lista`, `estrutura`, `marcenaria`, `complemento`, `[setor]`, `historico/csv`, `carga-descarga/modelo`, `anexos`, `pecas/anexos`, `ativacao/anexos`, `arenas/[slug]/planta`) | erro | — |
| 23 | Título da semana no calendário de carga: “11 cargas, 9 descargas, **1 eventos**” (visto na tela, `title` e `aria-label`) | Plural calculado: “1 evento”, “1 carga”, “1 descarga” | `src/components/carga/calendario-carga.tsx:427-428` | ortografia | — |
| 24 | Excel “Lista da ata”: “ATA DE REUNIAO - …”, seção “OBSERVACOES” (a linha de baixo já tem “DATA REUNIÃO O.S.”) | “ATA DE REUNIÃO - …”, “OBSERVAÇÕES” | `src/server/export/ata-lista-xlsx.ts:38,78` | ortografia | — |
| 25 | Linhas fixas da lista: “Cavaletes Transito”, “Palet Plastico”, “Agua Montagem CX”, “Agua KIT CX”, “Agua Prova CX”, “Isotonico”, “Proteina”, “Escadas de aluminio”, “Tina 1000l”, “Palet Ferro”, “Cones GRANDES/PEQUENOS” | “Cavaletes trânsito”, “Pallet plástico”, “Água montagem (cx)”, “Água kit (cx)”, “Água prova (cx)”, “Isotônico”, “Proteína”, “Escadas de alumínio”, “Tina 1.000 L”, “Pallet ferro”, “Cones grandes/pequenos” — **confirmar com a cenografia**: o comentário do arquivo diz que é o modelo exato da planilha deles | `src/server/export/ata-lista.ts:26-65` | ortografia | ⚠ `src/domain/arena/arena.test.ts` usa “Cochos para água” (não muda) |
| 26 | OS de estrutura: “O.S. DE ESTRUTURAS”, “RESPONSAVEL PELA O.S”, aba “SOMATORIA”, “Plataforma Telescopica”, “Graple”, “ângulos 15”, “AGUA DE MONTAGEM”; OS de marcenaria: “O.S DE MARCENARIA”, “REFERENCIA” | “O.S. DE ESTRUTURAS”, “RESPONSÁVEL PELA O.S.”, “SOMATÓRIA”, “Plataforma telescópica”, “Grapple”, “Ângulos 15”, “ÁGUA DE MONTAGEM”, “O.S. DE MARCENARIA”, “REFERÊNCIA” — mesma ressalva (modelo da cenografia) | `src/server/export/os-estrutura-xlsx.ts:18,24,76`, `src/server/export/os-estrutura.ts:31,35-37,95`, `src/server/export/os-marcenaria-xlsx.ts:37,54`, descrição em `src/app/(app)/eventos/[id]/os/page.tsx:43` | ortografia | ⚠ `src/app/api/os/[id]/estrutura/route.test.ts:85` espera as abas `["TOTAL", "SOMATORIA"]` |
| 27 | “Ordem de **S**erviço · EVT-…” (Excel) × “Ordem de serviço” (tela, impressão) | “Ordem de serviço · EVT-…” | `src/app/api/os/[id]/excel/route.ts:42` | ortografia | — |
| 28 | Origem da linha: “Pedido **da** área” (ata) × “Pedido **de** área” (ata para outra área, visão geral) × “Solicitação da área” (Excel) | “Pedido da área” em todos; para quem não é da área: “Pedido de outra área” (como já está em `export/ata.ts:41`) | `src/app/(app)/eventos/[id]/ata/page.tsx:22,51`, `src/app/(app)/eventos/[id]/page.tsx:94`, `src/server/export/ata.ts:44` | termo | — |
| 29 | Solicitações › aba “Na ata”, vazio: “Nenhum **pedido** na ata · **Pedidos** pré-reunião enviados ficam aqui…” | “Nenhuma solicitação na ata · Solicitações pré-reunião enviadas ficam aqui até a reunião de OS do evento.” | `src/app/(app)/solicitacoes/page.tsx:116` | termo | — |
| 30 | Notificação e histórico “FORA DA JANELA: SOL-… ” (caixa-alta) | “Fora da janela: SOL-… · Área” | `src/server/services/solicitacoes/envio.ts:147,193` | outro | — |
| 76 | Histórico do quadro de tendas: “Tendas de GV: 2 → 3 tendas · **1 fechamentos** e **1 calhas** por tenda” (o rótulo é sempre o plural de `PAPEIS_TENDA`) | Plural calculado: “1 fechamento e 1 calha por tenda”, “2 fechamentos e 0 calha” → “sem calha” | `src/server/services/conferencia.ts:749-751` (`resumoPorTenda`, novo em `07ad7fa`) | ortografia | — |
| 80 | Estrutura locada: desde `d3de62d` a folha também tira **tina 1000, pallet de ferro e cinta catraca** (estaio dos stands), mas os textos continuam dizendo só “box truss Q30, peças de tenda e estaiamento” — e na própria folha o bloco se chama “Estaio”, não “estaiamento”. Quem separa pode achar que a tina e o pallet foram esquecidos. | Checkbox: “Box truss Q30, peças de tenda e estaio (tina, pallet de ferro, cinta, malote, estaca, corda) não saem na folha.” · Folha: “Estrutura locada no local: box truss Q30, tendas e estaio (tina, pallet, cinta…) não estão nesta folha.” · Toast e histórico com o mesmo termo “estaio” | `src/components/eventos/separacao-locada.tsx:25,34`, `src/app/impressao/os/[id]/page.tsx:100`, `src/server/services/separacao.ts:45` × `src/domain/folha-separacao.ts:55` | termo | — |
| 31 | “Senha do app — Quem entra pelo **portal Norte**…” × “**Portal NORTE**” (login) × “Norte Mkt” | Um só nome do portal: “Portal Norte” (ou “Portal NORTE”, se for a marca do portal) | `src/app/(app)/perfil/page.tsx:75`, `src/app/(auth)/login/login-form.tsx:92-96`, `src/app/(auth)/login/page.tsx:11-14`, `src/server/auth/portal-entrada.ts:54` (tela de login: só relatar) | termo | — |

### 4.3 P3

| # | Atual | Proposto | Onde | Tipo |
|---|---|---|---|---|
| 32 | Toasts com e sem ponto final: “Área atualizada”, “Item atualizado”, “Retorno registrado” × “Planta atualizada.”, “Peça reativada.”, “Anexo adicionado.”, “Arena excluída.” | Toast curto **sem** ponto final (a maioria). Tirar o ponto de `arenas-actions.ts:83,93,103,146`, `catalogo/actions.ts:37,71`, `projetos/actions.ts:52,64,77,88`, `ativacao/actions.ts:138`, `anexos-peca.tsx:111,119`, `encerrar-sessoes.tsx:17`, `perfil/actions.ts:42` | vários | outro |
| 33 | “Tente novamente” (6×) × “Tente de novo” (18×) | “Tente de novo” | `src/lib/action.ts:70`, `src/server/auth/session.ts:58` (login), `src/server/services/projetos.ts:78`, `src/components/biblioteca/selecao-em-lote.tsx:103,127`, `src/components/biblioteca/organizar-projetos-dialog.tsx:99` | outro |
| 34 | Primeira pessoa: “Não consegui ler a imagem…”, “Não consegui abrir o arquivo…”, “Não achei a aba Veículos…”, “Tentaremos de novo na próxima alteração.” | Impessoal como o resto: “Não foi possível ler a imagem “x”. Envie outra foto.”, “Não foi possível abrir o arquivo…”, “A aba Veículos com os títulos do modelo não foi encontrada…”, “O rascunho tenta salvar de novo na próxima alteração.” | `src/server/services/ativacao.ts:308`, `catalogo.ts:246`, `carga-importacao.ts:47,70`, `src/components/solicitacoes/nova/use-autosave-solicitacao.ts:98` | outro (⚠ `carga-importacao.test.ts` usa `/Não consegui abrir/`) |
| 35 | Aspas retas em texto: `voltou para "sem posição"`, `A área vê "parcial: 3 de 4"`, `Grupo "X" excluído`, `"foto.heic" passa de 8 MB`, `Área "X" alterada` | Aspas curvas “ ” | `src/components/arena/use-edicao-arena.ts:227`, `src/components/eventos/conferencia-ata.tsx:243`, `src/components/projetos/gerenciar-grupos.tsx:31`, `src/server/services/ativacao.ts:286,289,308,317`, `catalogo.ts:228,231,246`, `admin.ts:45,49`, `carga-importacao.ts` (domínio) `:158,169,178,204-205` | ortografia |
| 36 | “**Peça** ao administrador para definir a sua área” / “Peça um novo link ao administrador” (num app em que “peça” é objeto) | “Fale com o administrador para definir a sua área…”, “Solicite um novo link ao administrador…” | `src/app/(app)/solicitacoes/nova/page.tsx:131`, `src/server/services/solicitacoes/rascunho.ts:20,34`, `src/server/services/recuperacao.ts:76`, `src/app/(auth)/redefinir-senha/[token]/page.tsx:16` | outro |
| 37 | “Sua área está desativada. Peça ao administrador.” | “Sua área está inativa. Fale com o administrador para reativá-la ou mudar a sua área.” | `src/server/services/solicitacoes/rascunho.ts:34` | erro |
| 38 | “Faltam conferir 3 linhas da ata.” / “Faltam descrever 2 unidades.” | “Falta conferir 3 linhas da ata.” / “Falta descrever 2 unidades.” | `src/components/eventos/banner-reuniao.tsx:54`, `src/components/solicitacoes/nova/descricoes-item.tsx:136` | ortografia |
| 39 | “Marque cada uma no **check** à esquerda da linha.” | “…na caixa à esquerda da linha.” | `src/components/eventos/banner-reuniao.tsx:54` | outro |
| 40 | “Você tem 2 rascunhos ou devolvidas esperando você” | “2 rascunhos ou devolvidas esperando você” | `src/app/(app)/solicitacoes/page.tsx:204` | outro |
| 41 | “Nada com **esses** filtros” × “Nada com **estes** filtros” (5×) | “Nada com estes filtros” | `src/app/(app)/solicitacoes/page.tsx:194`, `src/components/eventos/conferencia-ata.tsx:1193` (“Nenhuma linha com esses filtros”) | outro |
| 42 | `/pendencias` filtrado por evento, vazio: “Nenhuma neste evento” | “Nenhuma pendência neste evento” | `src/app/(app)/pendencias/page.tsx:103` (tela desligada hoje) | outro |
| 43 | “+3 **reservado** para eventos que vão montar”; reforma “concluída · **1 voltaram**” | “+3 reservados…” (plural); “1 voltou / 3 voltaram” | `src/app/(app)/ativacao/itens/[id]/page.tsx:76,135` | ortografia |
| 44 | Confirmação “Tirar das solicitações” com botão “**Tirar**” / “**Liberar**” | “Tirar das solicitações” / “Liberar nas solicitações” no botão | `src/components/projetos/disponivel-toggle.tsx:26` | botão |
| 45 | Envio de planta: botão de confirmar “**Enviar**” | “Enviar planta” | `src/app/(app)/arena/arena-acoes.tsx:56` | botão |
| 46 | Estoque, campo peça: botão “**Tirar**” | “Tirar a peça” (ou “Desvincular”) | `src/components/estoque/estoque-tela.tsx:335` | botão |
| 47 | Toast de lote: “Pronto.” (quando a action não traz mensagem) | “Itens atualizados” | `src/components/biblioteca/selecao-em-lote.tsx:123` | outro |
| 48 | “Incluir veículo” (aba Carga do evento) × “Novo veículo” (calendário e mesmo componente em outra largura) | “Novo veículo” nos dois (a dica do vazio também cita um ou outro) | `src/components/carga/carga-evento.tsx:74,85` | termo |
| 49 | “Preencha o modelo e **suba** todos de uma vez.” | “…e envie todos de uma vez.” | `src/components/carga/importar-carga.tsx:29` | outro |
| 50 | Google Planilhas: “Arquivo › Fazer download › .xlsx” × “Google Planilhas › Baixar › .xlsx” | Um caminho só: “Arquivo › Fazer download › Microsoft Excel (.xlsx)” | `src/app/(app)/carga-descarga/actions.ts:90`, `src/server/services/carga-importacao.ts:47` | outro |
| 51 | “Sugerida: terça, 35 dias antes do evento, às **14:00**.” × “Ex.: 08/06 às **14h**” | Usar o formato de `format.ts` em ambos | `src/components/eventos/evento-form.tsx:71`, `src/components/eventos/dados-reuniao-form.tsx:94-97` | outro |
| 52 | Trocar de evento: “2 itens **referenciam** a ata do evento anterior e serão removidos da solicitação.” | “2 itens vêm da ata do evento anterior e saem da solicitação.” | `src/components/solicitacoes/nova-solicitacao-form.tsx:439` | outro |
| 53 | “A linha da ata **referenciada** não existe mais.” | “A linha da ata escolhida não existe mais. Escolha outra linha ou tire o item da solicitação.” | `src/domain/solicitacao.ts:237` | erro |
| 54 | “…a logística vai vincular ao catálogo ou cadastrar a peça, e você será **avisado**.” | “…e você recebe um aviso.” | `src/app/(app)/solicitacoes/[id]/page.tsx:305` | outro |
| 55 | “Adicione ao menos uma peça à **lista de materiais**” | “…à lista de peças” | `src/lib/schemas.ts:149`, `src/server/services/projetos.ts:156` | termo |
| 56 | Modal Iniciar reunião: descrição (“Bloqueia novos envios…”) + aviso (“Os envios de necessidades ficam bloqueados…”) dizem a mesma coisa | Manter só o aviso (ou só a descrição) | `src/components/eventos/acoes-evento.tsx:127,151` + `src/domain/evento.ts:35` | outro |
| 57 | Aba da OS “Itens · ajustar” | “Itens (ajustar)” ou “Ajustar itens” | `src/components/eventos/os-visoes.tsx:100` | outro |
| 58 | Legenda da tabela “Itens da ata **de** reunião de OS” × título “Ata **da** reunião de OS” | “Itens da ata da reunião de OS” | `src/components/arena/painel-ponto.tsx:132` | ortografia |
| 59 | “Confirme antes de **fechar a carga**.” (conferência planta × ata na arena) | “Confirme antes de liberar a carga.” — ou o termo que a logística usa; “fechar a carga” não aparece em nenhuma outra tela | `src/components/arena/painel-conferencia.tsx:43` | termo |
| 60 | Trilha “**Sem acesso**” × título “Sem permissão” | “Sem permissão” | `src/components/shell/trilha.tsx:54` | termo |
| 61 | “Ir para o **P**ainel” (global-error) × “Ir para o painel”; impressão “**Voltar** para o painel” | “Ir para o painel” nos três | `src/app/global-error.tsx:37`, `src/app/impressao/error.tsx:26` | outro |
| 62 | Botões de impressão: “Imprimir / salvar PDF” (arena) × “Imprimir ou salvar em PDF” (OS) | “Imprimir ou salvar em PDF” | `src/app/impressao/arena/[slug]/imprimir-botao.tsx:8` | outro |
| 63 | “Mude o grupo **e/ou** a categoria…” | “Mude o grupo, a categoria ou os dois…” | `src/components/biblioteca/organizar-projetos-dialog.tsx:113` | outro |
| 64 | “O módulo é da Ativação e do administrador.” / “O estoque é da Ativação e do administrador.” (erro de permissão) | “Só a Ativação e o administrador mexem no estoque. Se precisar, fale com o administrador.” | `src/server/services/ativacao.ts:25`, `src/server/services/estoque.ts:12` | erro (⚠ `estoque.test.ts:32` espera `/Ativação/` — manter a palavra) |
| 65 | “Você não tem permissão para executar esta ação.” (padrão de `SemPermissaoError`) | “Seu perfil não pode fazer isto. Se precisar, fale com o administrador.” | `src/domain/errors.ts:24` | erro (⚠ 3 testes usam `/permissão/` — manter a palavra) |
| 66 | “Dados inválidos.” (32×) e “Ação inválida.” — só aparecem com payload malformado (bug ou adulteração) | “Não foi possível salvar. Atualize a página e tente de novo.” | `src/app/(app)/*/actions.ts` (32 ocorrências), `eventos/actions.ts:82` | erro |
| 67 | Login, `?erro=portal-desativado`: “…não está configurada neste servidor (**PORTAL_SSO_SECRET**).” | “A entrada pelo Portal NORTE não está ativa. Entre com e-mail e senha ou avise o administrador.” (a variável vai para o log, não para a tela) | `src/app/(auth)/login/page.tsx:13` (tela de login: só relatar) | erro |
| 68 | CSV do histórico: colunas “Entidade”, “Id” | “Tipo de registro”, “Código interno” (ou tirar) | `src/app/api/historico/csv/route.ts:32` | outro |
| 69 | Nomes de arquivo exportado sem padrão: `ATA-EVT-0001-v3.xlsx`, `ATA NOME v3.xlsx`, `OS-EVT-0001-v3.xlsx`, `OS ESTRUTURA_NOME_v3.xlsx`, `OS CENO MARCENARIA_NOME_v3.xlsx`, `complemento-os-evt-0001-desde-v2.xlsx`, `historico-2026-10-28.csv`, `Modelo carga e descarga 28-10-2026.xlsx` | Um padrão: “TIPO CÓDIGO NOME vN.xlsx” (ex.: `OS EVT-0001 Night Run v3.xlsx`, `OS estrutura EVT-0001 … v3.xlsx`, `Complemento OS EVT-0001 desde v2.xlsx`, `Histórico 28-10-2026.csv`). As duas planilhas no modelo da cenografia podem manter o nome que a equipe espera. | `src/app/api/**/route.ts` (`Content-Disposition`) | outro (⚠ `exportacoes.spec.ts`/testes checam `-v1.xlsx`, `em-construcao.xlsx`, `previa`) |
| 70 | “Cliente/gestão” × “Cliente / gestão” (rodapé e assinatura do Excel da ata) | “Cliente / gestão” | `src/app/api/eventos/[id]/ata/excel/route.ts:54` | ortografia |
| 71 | Excel da ata, aba “Pedidos das áreas”: coluna “Na ata” × impressão da ata, mesma tabela: “Atendido” | Um nome: “Na ata” | `src/app/impressao/ata/[id]/page.tsx:181` × `ata/excel/route.ts:156` | termo |
| 73 | Título da aba da impressão: “OS Festival Praia Sonora 2026” (sem código) × “Ata EVT-0001 v1 · Festival…”; `/consolidacao/pendencias` sem título próprio (“Planejamento de Eventos”) | “OS EVT-0001 v3 · Festival Praia Sonora 2026” (mesmo padrão da ata) | `src/app/impressao/os/[id]/page.tsx:21`, `src/app/(app)/consolidacao/pendencias/page.tsx` | outro |
| 74 | Usuário inativo (Tiago) no login com e-mail e senha: “E-mail ou senha inválidos.” — a pessoa acha que errou a senha e tenta de novo até cair em “Muitas tentativas”. (Pelo portal, a mesma situação diz “Sua conta está inativa neste app”.) | Sem revelar se a conta existe: “E-mail ou senha inválidos. Se a sua conta foi desativada, fale com o administrador.” | `src/server/auth/session.ts:68` (tela de login: só relatar) | erro |
| 75 | Painel do solicitante › “O que mudou”: quatro linhas seguidas “Item de Produção foi ajustado” — não dá para saber qual item | Se o nome do item puder aparecer para outras áreas (a ata já é visível a todos), “Pórtico 4 m (Produção) foi ajustado”; se não, agrupar: “3 itens de Produção foram ajustados” | `src/server/services/dashboard.ts:414` (decisão de privacidade: confirmar com a lógica) | outro |
| 77 | Histórico do quadro de tendas: “Tendas de **local não informado**: …” e “Tendas de GV: 2 → 3 **tendas** · …” (repete “tendas”) | “Tendas em GV: 2 → 3 · por tenda: 2 fechamentos e 1 calha — motivo”; sem local: “Tendas sem local: …” | `src/server/services/conferencia.ts:690,708,732` (novo em `07ad7fa`) | outro |
| 78 | Aviso pós-ata: “A logística ajustou as tendas: GV: 2 → 3 tendas, 4 → 6 fechamentos; Depósito: …” (dois-pontos em sequência) | “A logística ajustou as tendas — GV: 2 → 3 tendas, 4 → 6 fechamentos; Depósito: …” | `src/server/services/conferencia.ts:566,743` (novo em `07ad7fa`) | outro |
| 79 | Título de notificação “Ajuste na OS: **EVT-0001**” (projeto atualizado) × “Ajuste na OS: **Festival Praia Sonora 2026**” (ajustes da logística) | Nome do evento nos dois (é o que as outras notificações usam) | `src/server/services/eventos/versoes.ts:80` × `src/server/services/conferencia.ts:327,477,566` | termo |
| 72 | Painel do admin › Áreas: a mesma frase “Todas as áreas ativas participam de qualquer evento.” aparece na nota, no vazio e no modal | Deixar na nota da lista; no vazio: “Crie a primeira área em “Nova área”.” | `src/app/(app)/admin/page.tsx:118,129`, `src/components/admin/areas-painel.tsx:41` | outro |

### 4.4 Texto que vem do banco (não se corrige no código)

- Descrições de projetos do seed com aspas retas (“Variação de "3 Challenge" usada em Bravus Speed…”) — aparece
  no `title` da Biblioteca e da nova solicitação. Corrigir no cadastro (ou no seed), não no código.
- Nomes de eventos com “Rj” em caixa mista (“Night Run Rj”), vindos da importação do Ummense.
- Inventário inicial da Ativação (`src/data/estoque-ativacao-2025.json`, 244 itens, importado uma vez para o
  banco): “Adptador de Privada Infantil”, “Bacia de Plastico”, “Bandeja Decorativa (Plastico)”, “Cadeira Plática”,
  “Carimbo de plático”, “Mesa de Plático”, “Taça de Acrilico”, “Poltrona Inflável + Apoio de Pe” e “De/Do” com
  maiúscula no meio de ~30 nomes (“Capa De Puff”, “Base De Ombrelone”). Como já está no banco, a correção é em
  Ativação › Editar item; o JSON só importa para instalações novas.

## 5. Glossário — termo escolhido para cada conceito que varia

| Conceito | Usar | Evitar / variações encontradas |
|---|---|---|
| Item que a área descreveu à mão, sem peça/projeto | **fora do catálogo** (“item fora do catálogo”) | item avulso, avulsos, outro item (só como atalho da busca), materiais fora **de** catálogo, sem peça de catálogo |
| Peça do catálogo pedida sem projeto | **peça solta** / “soltas” | — (consistente) |
| Lista de peças de um projeto padrão | **lista de peças** | BOM, lista de materiais |
| Tirar do uso sem apagar | **inativar / inativo / reativar** | desabilitar, desativar (para usuário e área fica **desativar acesso** / inativa — já consistente lá) |
| Ligar item fora do catálogo ou do estoque a uma peça | **vincular / vinculado** | ligar, ligado, ligue |
| Perfil de quem pede | **Solicitante** (ou Requisitante — escolher um) | os dois juntos |
| Pedido de uma área | **solicitação** (formal, listas, filtros); “pedido” só em frase corrida (“quem pediu”, “pedido da área”) | “Nenhum pedido na ata” em aba de solicitações |
| Pedido antes da reunião | **necessidade pré-reunião** | — |
| Pedido depois da ata | **alteração pós-ata** | — |
| O que a logística faz na reunião | **conferir / conferência** | consolidar, consolidação (a palavra fica só para a tela desligada “Demanda de peças”) |
| Agrupar projetos na biblioteca | **grupo da biblioteca** (o nome costuma ser a prova) | grupo de prova, “nome do evento” |
| Evento de corrida (marca) | **prova** (“Itens específicos da prova”, “De uma prova”) | — |
| Fases do evento | **Em preparação · Em reunião · Aberto a alterações · Encerrado · Realizado · Cancelado** | “Preparação”, “Aberto”, “Realizados” só nas abas |
| Linha da ata vinda de solicitação | **Pedido da área** / **Pedido de outra área** | Pedido de área, Solicitação da área |
| Linha incluída sem solicitação | **Incluída pela logística** | — (consistente) |
| Ordem de serviço | **OS** na tela; **Ordem de serviço** por extenso; “O.S.” só no modelo da cenografia | Ordem de Serviço, O.S, O.S. |
| Remover algo | **Remover** (botão de ação); “tirar” em frase corrida | “Tirar” sozinho em botão |
| Retentar | **tente de novo** | tente novamente |
| Encaminhar ao admin | **fale com o administrador** | peça ao administrador |
| Portal de entrada | **Portal NORTE** (como no login) | portal Norte |
| Voltar ao início | **Ir para o painel** | Ir para o Painel, Voltar para o painel |

## 6. Impacto em testes e seletores E2E

- **`e2e/*.spec.ts`**: nenhuma proposta deste relatório muda os textos usados como seletor (lista extraída:
  “Conferência da ata”, “Na ata”, “Iniciar reunião”, “Fechar ata e gerar OS”, “Pronto para enviar”, “Reunião de
  OS”, “Dados da reunião”, “Marcar 2 como conferidas”, “Conferir as 2 restantes”, “Linhas conferidas”, “Fechar
  aviso”, “Criar evento”, “Entrar”, “E-mail”, “Senha”, “Atendido”, “Público esperado”, “Caminhão sai”, “Data do
  evento”, “Alterações até”, “Cliente”, “Nome”, “Buscar projeto padrão”, `/^Título/`, `/^Enviar( solicitação)?$/`,
  `/^Atender/`, `/^Alteração pós-ata ·/`, `/^(Adicione o que precisa|Outros itens)$/`, “Andamento da reunião”,
  “Aumentar”, “2 de 2 descritas”, rótulos `Quantidade de …`, `Descrição de …`, `Adicionar …`).
  Exceção: **#69** (nomes de arquivo) — os testes de rota conferem `OS-${código}-v1.xlsx`, `-v1.xlsx`
  (`src/app/api/os/[id]/excel/route.test.ts:76,87`) e `em-construcao.xlsx`
  (`src/app/api/eventos/[id]/ata/excel/route.test.ts:113`); confira também `e2e/exportacoes.spec.ts`, que baixa
  os arquivos.
- **Testes unitários que mudam junto** (atualizar a asserção ao trocar o texto):
  - #11 `src/server/auth/ver-como.test.ts:122` espera `Requisitante · ${área}`;
  - #13 `src/server/services/biblioteca-lote.test.ts` espera “Nenhum item foi desabilitado”;
  - #14 `src/server/services/ativacao.test.ts:131` espera `/já está ligada/`;
  - #34 `src/server/services/carga-importacao.test.ts` espera `/Não consegui abrir/`;
  - #26 `src/app/api/os/[id]/estrutura/route.test.ts:85` (nomes das abas) e `src/server/export/os-estrutura.test.ts`
    se a aba “SOMATORIA” mudar;
  - mantêm a palavra-chave (não quebram se a proposta for seguida): #6 `/projeto/` (`integracao.test.ts:646`),
    #64 `/Ativação/` (`estoque.test.ts:32`), #65 `/permissão/` (3 testes).
- **Nome acessível (WCAG 2.5.3)**: as propostas de botão (#44, #45, #46) mudam o texto visível; onde houver
  `aria-label` igual, trocar junto.

## 7. Matriz tela × perfil (texto lido em contexto, desktop)

Legenda: ✓ = tela aberta e texto lido; “→ sem permissão ✓” = redireciona para `/sem-permissao` (texto da tela
lido); “→ 404 ✓” = responde “Não encontrado” (texto lido); “não verificado” = não deu para abrir nesta rodada.
Celular (375 px): **não verificado** para todos os perfis. Usuário inativo (Tiago): ver nota abaixo da tabela.

| Tela | admin | logistica | gestao | cenografia | producao | ativacao | grafica | atendimento |
|---|---|---|---|---|---|---|---|---|
| `/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/novo` | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/calendario` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes/nova` | ✓ | → sem permissão ✓ | → sem permissão ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/biblioteca` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/biblioteca?aba=pecas` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/biblioteca?aba=fora` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/catalogo/nova` | ✓ | ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/projetos/novo` | ✓ | ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/arena` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/arena/nova` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/carga-descarga` | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/carga-descarga/cadastro` | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/consolidacao` | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ |
| `/consolidacao?aba=faltando` | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ |
| `/consolidacao/pendencias` | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ |
| `/pendencias` | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ |
| `/pendencias?situacao=resolvidas` | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ |
| `/ativacao` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/ativacao/retornos` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/ativacao/reformas` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/historico` | ✓ | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/notificacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/perfil` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/admin` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/admin/usuarios` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/admin/areas` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/admin/configuracoes` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/sem-permissao` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/rota-que-nao-existe` | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ | → 404 ✓ |
| `/solicitacoes?filtro=NA_ATA` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes?filtro=ATRASADAS` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes?filtro=RASCUNHO` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes?filtro=RESPONDIDA` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos?fase=CANCELADO` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos?busca=zzzz` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/ata` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/os` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/solicitacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/historico` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/eventos/:id/editar` | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/eventos/:id/carga` | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/conferencia/:id` | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/impressao/os/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/impressao/ata/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/solicitacoes/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/projetos/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/projetos/:id/editar` | ✓ | ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/catalogo/:id/editar` | ✓ | ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ |
| `/arena/:slug` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/impressao/arena/:slug` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/ativacao/itens/:id` | ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | → sem permissão ✓ | ✓ | → sem permissão ✓ | → sem permissão ✓ |

Usuário inativo (Tiago Moreira): entrar com e-mail e senha mostra “E-mail ou senha inválidos.” (achado #74).
Total: 616 leituras (77 telas × 8 perfis), nenhuma com erro de navegação; admin, logística, gestão e cenografia lidos em 28/10 (base `2bb3745`), os demais perfis relidos em 29/10 no build novo (`d3de62d`). Nas telas com id usou-se o mesmo evento/solicitação/projeto para todos os perfis (EVT-0001, EVT-0003, EVT-0005, três SOL, um projeto, uma peça, a arena Eco Run e um item da Ativação).

## 8. Notas para outros agentes (fora do foco de texto)

- `/pendencias` e `/consolidacao` estão desligadas em `src/domain/telas.ts` (fora do menu, 404 para todos os
  perfis), mas a resposta de item ainda mostra a tag “pendência de compra/locação” para itens antigos
  (`item-resposta.tsx:707`) — conferir se faz sentido com a tela desligada (lógica/UX).
- Sem permissão, telas como `/eventos/novo` ou `/ativacao` **carregam e só depois** (≈0,8 s) trocam para
  `/sem-permissao` pelo cliente; a navegação seguinte da pessoa pode ser “atropelada” por esse redirecionamento
  atrasado (foi o que interrompeu a primeira passada automática). Vale um olhar de UX/desempenho.
- A extração e o script de leitura estão no scratchpad da sessão (não versionados): `extrair.cjs` (AST → TSV de
  textos) e `ler-telas.cjs` (leitura por perfil). Podem virar ferramenta do repositório se a equipe quiser repetir
  a revisão.
