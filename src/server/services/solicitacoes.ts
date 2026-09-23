/**
 * Serviço de solicitações — fachada. A implementação fica em `./solicitacoes/`, dividida por responsabilidade:
 * - consultas.ts: lista, paginação, fila, detalhe e descrição do item;
 * - rascunho.ts: criar/editar rascunho, itens e o formulário completo;
 * - envio.ts: enviar, cancelar, devolver e o registro automático da pré-reunião na ata;
 * - resposta.ts: resposta por item, correção, "atender tudo" e desfazer;
 * - pendencias.ts: pendências de compra/locação;
 * - comum.ts: regras e mensagens compartilhadas.
 * Os imports de outros módulos continuam apontando para este arquivo.
 */
export {
  descricaoItem,
  eventosComSolicitacoes,
  FILTROS_LISTA,
  listarFila,
  listarSolicitacoes,
  obterSolicitacao,
  obterSolicitacaoMemo,  paginarSolicitacoes,
  primeiraDaFila,
  type FiltroLista,
  type FiltroSolicitacoes,
  type Solicitacao,
  type SolicitacaoItem,
  type SolicitacaoLista,
} from "./solicitacoes/consultas";
export { MSG_TITULO_OBRIGATORIO } from "./solicitacoes/comum";
export { atualizarCabecalho, criarRascunho, excluirRascunho, salvarItem, salvarSolicitacaoCompleta, type DadosSolicitacaoCompleta } from "./solicitacoes/rascunho";
export { cancelarSolicitacao, devolverSolicitacao, enviarSolicitacao, registrarPreReuniaoNaAta, registrarPreReunioesPendentes } from "./solicitacoes/envio";
export { atenderTudo, desfazerResposta, JANELA_DESFAZER_MS, responderItem, responderNaTransacao } from "./solicitacoes/resposta";
export { listarPendenciasCompra, listarPendenciasResolvidas, resolverPendenciaCompra, type PendenciaCompra } from "./solicitacoes/pendencias";
