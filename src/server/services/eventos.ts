/**
 * Serviço de eventos — fachada. A implementação fica em `./eventos/`, dividida por responsabilidade:
 * - consultas.ts: listas, detalhe, histórico, resumos e contadores;
 * - cadastro.ts: criar/editar evento;
 * - transicoes.ts: máquina de estados (um efeito por ação);
 * - reuniao.ts: observações, dados da reunião e conferência das linhas;
 * - ata.ts: linhas da ata, versões, inclusão/ajuste direto e lista de peças (snapshotBom);
 * - referencias.ts: opções de projetos e peças para os formulários (em cache).
 * Os imports de outros módulos continuam apontando para este arquivo.
 */
export {
  ACOES_COM_MOTIVO,
  contarItensPendentesPreReuniao,
  linhasAtaResumidas,
  listarEventos,
  listarEventosAceitando,
  obterEvento,
  obterHistoricoEvento,  resumoAbasEvento,
  solicitacoesPendentes,
  type EventoLista,
  type FiltroEventos,
} from "./eventos/consultas";
export { criarEvento, editarEvento, type DadosEvento } from "./eventos/cadastro";
export { transicionarEvento } from "./eventos/transicoes";
export { conferirLinha, conferirTodasLinhas, salvarDadosReuniao, salvarObservacoesReuniao, type DadosReuniao } from "./eventos/reuniao";
export {
  alterarQuantidadeLinha,
  atualizarVersaoLinha,
  incluirLinhaAta,
  listarAtaVersoes,
  obterLinhasAta,
  snapshotBom,
  type DadosLinhaAta,
  type LinhaAtaDetalhe,
} from "./eventos/ata";
export { opcoesReferencias, opcoesReferenciasResumidas, type OpcoesReferencias } from "./eventos/referencias";
