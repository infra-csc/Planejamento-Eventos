# Logística de materiais: V1 (briefing NorteLog v2, 02/11/2026)

Fase 0 (saneamento e cadastros) e Fase 1 (Projeção). O galpão não precisa operar pelo sistema: a Projeção cruza o saldo contado com os pedidos.

**Por enquanto, só o administrador vê e usa (decisão de 05/11).** Para os outros perfis o app segue como antes: sem menu, aba, selos nem campos novos, e o "Estoque próprio" continua no cadastro da peça. Para abrir, basta mudar as ações de `src/domain/permissions.ts` (o comentário lá diz quem o briefing prevê).

## Antes de publicar

A migração `drizzle/0021_logistica_v1.sql` só acrescenta (10 tabelas novas, colunas novas em `eventos`, `pecas` e `evento_itens`), mas o código novo lê essas colunas em quase todas as telas. **Publicar sem ela derruba o app.**

1. No Shell do Replit, no banco do workspace: `psql "$DATABASE_URL" -f drizzle/0021_logistica_v1.sql` (e a `0020`, se ainda não foi aplicada).
2. Publish. Se o Replit avisar que vai apagar tabela, **não confirme**.
3. Ao subir, o app cria sozinho os almoxarifados "Galpão principal" e "Ativação", se faltarem.

## O que entrou

| Item do briefing | Onde |
|---|---|
| Datas previstas, evento pai, tour | Aba Logística do evento; cadastros em `/cadastros`; X e Y em Administração › Configurações |
| Campo "Estrutura" e "Atende por" | Aba Logística do evento (cenografia e administrador) |
| Selo "Vai do nosso galpão" / "Fornecedor externo" | Lista do evento e item da solicitação |
| Documento técnico para o fornecedor | Aba Logística do evento: Excel e PDF |
| Tipo, m³, código de barras, apelidos, estoque mínimo | Cadastro da peça; em lote em `/saneamento?aba=pecas` |
| Almoxarifados, locadores, perfis de veículo | `/cadastros` |
| Ativação no catálogo | `/saneamento?aba=ativacao`: ligar a uma peça ou criar uma nova |
| Saneamento de datas | `/saneamento` |
| Contagem de saldo | `/contagem`: digitar ou importar planilha |
| Locação e compra previstas | `/projecao/previstas` |
| Projeção semanal por cenário | `/projecao`, com Excel da matriz e das faltas |
| Estimativa de veículos | Aba Carga e aba Logística do evento; `/carga-descarga` |

## Regras fixas (domain/logistica.ts, domain/projecao.ts, services/saldo.ts)

- O saldo é a soma das movimentações. A contagem compara com esse saldo e grava só a diferença. A primeira é `SALDO_INICIAL`; as outras, `AJUSTE_INVENTARIO`, com justificativa.
- `atende_por` nulo na linha significa "herda do evento". Por isso mudar a Estrutura muda só o que ninguém decidiu, sem reescrever linhas.
- Dia de saída conta como fora; dia de retorno já conta como de volta. A semana mostra o menor saldo dos dias.
- O que saiu antes da contagem não estava lá quando contaram: só a volta soma.
- Almoxarifado sem contagem fica fora da Projeção, com o selo "não conferido".

## Decisões que tomei e precisam de validação

- **Projeto com estrutura terceirizada:** sai com o fornecedor só o box truss e as tendas do projeto. A marcenaria do mesmo projeto continua saindo do galpão. O briefing fala em "peças de box truss" no critério e em "linhas de estrutura" no texto.
- **Almoxarifado × galpão:** segui o v2, que chama de almoxarifado. "Galpão Norte" fica como opção de "Atende por".
- **Estoque próprio e "em posse" da Ativação:** viram sugestão na primeira contagem, não saldo automático, porque o v2 decidiu "tudo é contado". O briefing longo pedia migrar direto.
- **X e Y:** padrão 3 e 3 dias até a logística definir (pendência do briefing).
- **Ordem do tour:** botões de subir e descer, em vez de arrastar.

## Fora desta entrega

- Pontos a alinhar com o Pedro: refino visual × "funcionalidade antes de acabamento"; OS "não é a lista de carga"; Retornos e Reformas da Ativação como só leitura (seguem editáveis).
- Fases 2, 3 e 4: as camadas comprometida e física aparecem na tela, marcadas como Fase 3, sem dado. Transferência entre almoxarifados é da Fase 2.
- E-mail: o app não tem provedor de e-mail. O e-mail semanal de faltas e o envio das notificações prioritárias dependem disso; na V1 nenhuma ação gera notificação prioritária.
- O documento técnico lista os PDFs dos projetos com link; não os junta num arquivo só.
- Veículo planejado com perfil real é da Fase 3: a estimativa usa só o perfil de referência de cada tipo.

## Glossário

Evento pai agrupa etapas (identidade). Tour é o roteiro logístico entre provas. Atende por: Galpão Norte, Fornecedor externo, Locação via galpão ou Compra/consumo. Proprietário: Norte ou um locador. Retornável volta do evento; consumível não volta. OC é Ordem de Compra, PC é Pedido de Compra e OE é Ordem de Expedição (Fase 3); OR não existe. Na Biblioteca, "kit" é só nome de projeto, nunca tipo; a Área Kit é a área interna.
