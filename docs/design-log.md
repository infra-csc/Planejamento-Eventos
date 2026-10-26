# Design log

Registro das revisões de design/UX: telas revisadas, problemas por prioridade, o que mudou, como foi
validado e o que ficou pendente. Uma seção por data. Prioridade: **P1** atrapalha concluir a tarefa da
tela; **P2** custa esforço ou leitura; **P3** acabamento/consistência.

## Checklist da revisão tela a tela (26/10/2026)

Ordem: telas críticas primeiro, depois o resto. Status: `[ ]` a revisar · `[x]` revisada (com mudanças ou
"sem mudanças", ver a seção da tela abaixo).

**Críticas**

- [x] 1. Nova solicitação — `/solicitacoes/nova`
- [ ] 2. Conferência da ata — `/conferencia/[id]` (e o redirecionamento `/eventos/[id]/reuniao`)
- [ ] 3. OS do evento — `/eventos/[id]/os` + folha de separação `/impressao/os/[id]`
- [ ] 4. Lista de eventos — `/eventos`
- [ ] 5. Evento — `/eventos/[id]` (visão geral) e abas: ata `/eventos/[id]/ata`, solicitações `/eventos/[id]/solicitacoes`, histórico `/eventos/[id]/historico`, carga `/eventos/[id]/carga`, linha da ata `/eventos/[id]/itens/[linhaId]`, editar `/eventos/[id]/editar`
- [ ] 6. Solicitações — `/solicitacoes` e `/solicitacoes/[id]`
- [ ] 7. Biblioteca — `/biblioteca` (projetos e peças; `/catalogo` e `/projetos` só redirecionam)
- [ ] 8. Painel — `/` (por perfil)

**Demais**

- [ ] 9. Novo evento — `/eventos/novo`
- [ ] 10. Impressão da ata — `/impressao/ata/[id]`
- [ ] 11. Projeto padrão — `/projetos/[id]`, `/projetos/[id]/editar`, `/projetos/novo` (e duplicar `?de=`)
- [ ] 12. Peça do catálogo — `/catalogo/nova`, `/catalogo/[id]/editar`
- [ ] 13. Calendário — `/calendario`
- [ ] 14. Carga e descarga — `/carga-descarga`, `/carga-descarga/cadastro`
- [ ] 15. Arena 3D — `/arena`, `/arena/nova`, `/arena/[slug]`, impressão `/impressao/arena/[slug]`
- [ ] 16. Consolidação — `/consolidacao` (`/consolidacao/pendencias` só redireciona)
- [ ] 17. Pendências — `/pendencias`
- [ ] 18. Estoque — `/estoque`
- [ ] 19. Histórico geral — `/historico`
- [ ] 20. Notificações — `/notificacoes`
- [ ] 21. Perfil — `/perfil`
- [ ] 22. Admin — `/admin` (abas usuários, áreas, configurações; `/admin/usuarios|areas|configuracoes` só redirecionam)
- [ ] 23. Sem permissão — `/sem-permissao`; 404 (`not-found.tsx`); erro (`error.tsx`)
- [ ] 24. Autenticação — `/login`, `/recuperar-senha`, `/redefinir-senha/[token]` (fora do escopo: a tela de login não é alterada)

## 26/10/2026 — revisão tela a tela

Ambiente da inspeção: app com o banco de demonstração do E2E (`.data/e2e`, `EXIBIR_DEMO=true`, porta 3100),
screenshots com Playwright/Chromium em 1280×800 (desktop), 375×812 (`devices["Pixel 5"]`) e, quando a
largura importava, 1680×900. Screenshots fora do repositório, em
`C:\Users\YAN~1.ARA\AppData\Local\Temp\claude\design-review\` (`antes-*` e `depois-*`, com perfil e tamanho
no nome). As primeiras fotos "antes" são do build de produção; as "depois", do `next dev` (o círculo "N"
no canto inferior esquerdo é o indicador do modo de desenvolvimento, não faz parte do app).

### 1. Nova solicitação — `/solicitacoes/nova`

Vista: requisitante Produção (área com lista padrão) e Gráfica (sem lista), sem evento e com evento
escolhido, com um item adicionado; desktop e celular.

- P2 — O vazio do passo "Detalhe cada item" mandava buscar "no passo 2", mas quando a área tem lista padrão
  a busca é o passo 3 (o 2 é a lista da área). Quem segue a instrução procura no lugar errado.
  **Resolvido:** o texto usa os números reais dos passos ("Ponha a quantidade na lista do passo 2 ou busque
  no passo 3…"; sem lista, "Busque no passo 2…").
- P3 — Na lista da área, o número das linhas automáticas (cavalete do cocho) ficava alinhado à direita,
  fora da coluna dos steppers. **Resolvido:** centralizado na largura do stepper (110 px; 130 px no celular).
- Sem mudança: hierarquia (passos numerados, resumo fixo com "Para enviar, falta"), barra fixa de envio no
  celular, aviso "Já pedido", toasts com "Descrever" — funcionam bem.

Arquivos: `src/components/solicitacoes/nova-solicitacao-form.tsx`, `src/components/solicitacoes/nova/lista-itens.tsx`,
`src/components/solicitacoes/nova/itens-da-area.tsx`.
Validação: tsc, eslint dos arquivos; screenshots `antes-producao-*-solicitacoes_nova*`, `antes-grafica-*`,
`depois-producao-*-solicitacoes_nova_evento_EVT_0002.png`.
