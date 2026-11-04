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
- A tela de login continua fora: só herda as cores pelos tokens. Ver "Decisões em aberto".

## Etapas

| Etapa | Situação | Observação |
|---|---|---|
| 1. Auditoria | Feita | Mapa em `01-mapa-de-paginas.md`; componentes e áreas sensíveis em `02-componentes-e-areas-sensiveis.md` |
| 2. Marca | Feita | Logo, símbolo branco e favicon do kit, sem alteração; prints, Excel e página de erro de download |
| 3. Design system | Feita na base | Tokens em `globals.css`, doc em `docs/design-system.md`. Faltam as duplicações fora de `ui/` (48 botões, 46 tabelas à mão) |
| 4. Estrutura global | Feita | Menu grafite, canto da marca, itens e permissões iguais; cabeçalho do evento mais baixo |
| 5. Páginas | Em andamento | Todas herdam a base; revisão estrutural tela a tela no checklist abaixo |
| 6. Modais e estados | Em andamento | 12 de 15 fotografados; base dos modais aplicada; vazios padronizados nos casos do mapa |
| 7. UX | Em andamento | R3, R14, R15 (item), R17, R18, R19 e parte de R20 |
| 8. Responsividade | Em andamento | Varredura a 390 e 820 px sem rolagem lateral; falta olhar tela a tela |
| 9. Refinamento | A fazer | |
| 10. Teste visual | Em andamento | 47 telas a 1440 e 390 px com admin; 6 telas com solicitante |
| 11. QA e regressão | Em andamento | Ver "Testes" |
| 12. Consistência final | A fazer | |

## Checklist de páginas

`[x]` = revisada na tela com a base nova. `[ ]` = herda a base, falta revisão estrutural. Página só conta como concluída
depois de ver os estados e modais dela.

- [x] Base visual em todas as 47 telas fotografadas
- [~] Painel, Eventos, evento (visão geral, OS), Conferência, Calendário, Solicitação (detalhe), Carga, Notificações: vistos em tamanho real, falta passar pelos estados e modais de cada uma
- [ ] Evento: Ata, Solicitações, Carga, Histórico, Editar, Item
- [ ] Solicitações: lista, nova
- [ ] Biblioteca, projeto, peça
- [ ] Arena 3D: lista, nova, mapa
- [ ] Carga e descarga: cadastro
- [ ] Ativação: estoque, retornos, reformas, item
- [ ] Histórico, Perfil
- [ ] Administração: usuários, áreas, configurações
- [ ] Impressões: OS, ata, arena (logo aplicado; falta ver o PDF)
- [x] Login, recuperar e redefinir senha: fora do escopo, só tokens

## Fora do redesign (mudam regra ou comportamento)

Registrados no mapa e não mexidos: R1 (mesma linha corrigida em vários lugares), R2 (trocar evento do rascunho, retirar
pedido), R8 (salvar automático), R10 (recorte perdido ao voltar), R11 (clique da linha), paginação do estoque (nº 44).
R21 (código técnico à vista) fica porque o documento manda não remover informação.

Achado fora do escopo: em `/arena`, as ações da linha aparecem no celular sem checar `podeEditar`, ao contrário do desktop (`arena/page.tsx:109` × `:151`). Mexer nisso é permissão: fica para decisão.

## Decisões em aberto

1. Login: tem painel escuro à esquerda, como o do Miró. Trocar exige liberar a regra de não mexer no login.
2. Acentos nas planilhas no modelo da cenografia: continuam como estão (design system § 9).

## Testes

Atualizar a cada lote, só com o que foi executado de fato.

**04/11, base da marca (sem commit, em `redesign/nortelog`):**
- `tsc` e `eslint`: sem erros.
- Vitest: 829 passaram, 3 ignorados (832).
- Playwright: 38 de 38, desktop e celular, com axe (contraste, alvo de toque) e varredura por seis perfis.
- Varredura visual a 1440, 820 e 390 px: 47 telas com admin, sem erro 500 e sem rolagem lateral. Solicitante: 6 telas a 1440 px.
- Diff contra `1ee5c6f`: em rotas de API, só o texto "NORTE MKT" → "NORTELOG" no título das planilhas; em `src/domain` e `src/server`, só valores de cor. Nenhum `actions.ts`, serviço, autenticação, banco ou proxy alterado.

**Não testado:** PDF real das impressões e Excel abertos no programa (ver o logo e as cores no arquivo final); estados de erro e carregamento uma a uma; Arena 3D com interação; perfis cenografia e gestão com olhar visual (só a varredura automática).

## Próximo passo

Revisão estrutural do que falta no checklist: Biblioteca, Ativação, Arena, Administração, Nova solicitação, depois estados e modais de cada tela. Depois, duplicações (etapa 12) e o refinamento crítico (etapa 9). Antes de publicar: abrir PDF e Excel finais.
