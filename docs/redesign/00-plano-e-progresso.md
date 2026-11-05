# Redesign NorteLog: plano e progresso

Segue o documento `Prompt_Mestre_Redesign_Completo_Claude_Code.docx`. Escopo só de UX/UI: nenhuma regra de negócio,
cálculo, permissão, validação, API, banco ou fluxo muda. Branch: `redesign/nortelog`, a partir do commit de referência
`1ee5c6f`. Nada desta branch está publicado.

Para continuar depois de uma interrupção: ler este arquivo, `git diff 1ee5c6f` e seguir o "Próximo passo".

## Decisões do dono do produto

- NorteLog é a nova marca: kit final, grafite `#242424` e laranja `#F06A2A`.
- Não pode parecer o Miró, sistema da gráfica (`grafica.appsnorte.com`), que usa cores quase iguais.
- Prévia aprovada em 03/11 ("pode iniciar a transição"): menu grafite, botão laranja com texto grafite, cinza neutro,
  cantos retos, títulos condensados.
- A tela de login entrou em 04/11, com a regra liberada pelo dono do produto: sem painel escuro, cartão único sobre o fundo cinza.

## Etapas

| Etapa | Situação | Observação |
|---|---|---|
| 1. Auditoria | Feita | Mapa em `01-mapa-de-paginas.md`; componentes e áreas sensíveis em `02-componentes-e-areas-sensiveis.md` |
| 2. Marca | Feita | Logo, símbolo branco e favicon do kit, sem alteração; prints, Excel e página de erro de download |
| 3. Design system | Feita na base | Tokens em `globals.css`, doc em `docs/design-system.md`. Faltam as duplicações fora de `ui/` (48 botões, 46 tabelas à mão) |
| 4. Estrutura global | Feita | Menu grafite, canto da marca, itens e permissões iguais; cabeçalho do evento mais baixo |
| 5. Páginas | Feita na base | Todas vistas em tamanho real com a marca nova; o que restou no mapa muda regra (ver abaixo) |
| 6. Modais e estados | Em andamento | 37 de cerca de 60 janelas abertas e vistas; vazios, 404, sem permissão e carregando vistos; erro de servidor não reproduzido |
| 7. UX | Em andamento | R3, R14, R15 (item), R17, R18, R19 e parte de R20 |
| 8. Responsividade | Em andamento | Varredura a 390 e 820 px sem rolagem lateral; falta olhar tela a tela |
| 9. Refinamento | Feita | Títulos numa tipografia só, espaços, cor como categoria, folhas impressas |
| 10. Teste visual | Em andamento | 47 telas a 1440 e 390 px com admin; 6 telas com solicitante |
| 11. QA e regressão | Em andamento | Ver "Testes" |
| 12. Consistência final | Parcial | Sem cor antiga no código e nos comentários, exceto a Arena; botões e tabelas à mão ficam: trocar traz risco de regressão sem mudar o que se vê |

## Checklist de páginas

`[x]` = revisada na tela com a base nova. `[ ]` = herda a base, falta revisão estrutural. Página só conta como concluída
depois de ver os estados e modais dela.

- [x] Base visual em todas as 47 telas fotografadas
- [x] Todas as telas vistas em tamanho real, em computador; em celular e tablet, pela varredura
- [~] Estados e janelas: 37 de cerca de 60 janelas
- [x] Impressões: OS, ata, mapa da arena e descarregamento abertas em PDF
- [x] Login, recuperar e redefinir senha: novo layout em 04/11 (o mesmo nas três), sem os números públicos e sem consulta ao banco

## Pedido à parte: aba Carregamento (04/11)

Não é redesign: é função nova, pedida pela logística. Na folha de estrutura é onde se carrega o caminhão, e nem sempre vai o que foi pedido.
Aba Carregamento no evento, depois da ata: logística e administrador alteram o carregado, com observação opcional; quem pediu é avisado e vê a diferença; a OS não muda, nem gera versão.
A OS de estrutura e a folha de separação da versão atual saem com o carregado e listam as mudanças. Guardado em `configuracoes`, sem migração. Materiais KIT ainda não entram.
A aba imprime a folha de descarregamento: os blocos da folha de estrutura, com os ajustes e a coluna Voltou em branco.
O carregamento por veículo (fase 3 do briefing NorteLog) continua por fazer; estes dados são o ponto de partida.

## Fora do redesign (mudam regra ou comportamento)

Registrados no mapa e não mexidos: R1 (mesma linha corrigida em vários lugares), R2 (trocar evento do rascunho, retirar
pedido), R8 (salvar automático), R10 (recorte perdido ao voltar), R11 (clique da linha), paginação do estoque (nº 44).
R21 (código técnico à vista) fica porque o documento manda não remover informação.

Achado fora do escopo: em `/arena`, as ações da linha aparecem no celular sem checar `podeEditar`, ao contrário do desktop (`arena/page.tsx:109` × `:151`). Mexer nisso é permissão: fica para decisão.

## Decisões em aberto

1. Acentos nas planilhas no modelo da cenografia: continuam como estão (design system § 9).

## Testes

Atualizar a cada lote, só com o que foi executado de fato.

**04/11, base da marca (sem commit, em `redesign/nortelog`):**
- `tsc` e `eslint`: sem erros.
- Vitest: 829 passaram, 3 ignorados (832).
- Playwright: 38 de 38, desktop e celular, com axe (contraste, alvo de toque) e varredura por seis perfis.
- Varredura visual a 1440, 820 e 390 px: 47 telas com admin, sem erro 500 e sem rolagem lateral. Solicitante: 6 telas a 1440 px.
- Diff contra `1ee5c6f`: em rotas de API, só o texto "NORTE MKT" → "NORTELOG" no título das planilhas; em `src/domain` e `src/server`, só valores de cor. Nenhum `actions.ts`, serviço, autenticação, banco ou proxy alterado.

**04/11, segundo lote e aba Carregamento (sem commit, em `redesign/nortelog`):**
- Vitest: 846 passaram, 3 ignorados (849). Playwright: 38 de 38, com a aba nova na varredura dos seis perfis.
- Fluxo da aba testado na tela: logística altera, quem pediu recebe o aviso e vê a diferença, a OS e a versão não mudam, a folha sai com o carregado, com e sem observação; a 390 px sem rolagem lateral.

**04/11, últimos ajustes:** Vitest 847 passaram, 3 ignorados (850). Playwright 38 de 38, com a folha de descarregamento e o menu que recolhe sozinho. Menu testado na tela: tempo, mouse em cima, troca de página, manter aberto, recolhido à mão e celular.

**Não testado:** Excel aberto no programa (só lido por biblioteca); erro de servidor e carregamento em todas as telas; Arena 3D com interação; janelas restantes.

## Próximo passo

Se quiser fechar 100%: abrir as janelas restantes.
