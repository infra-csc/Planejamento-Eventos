import "server-only";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError } from "@/domain/errors";
import { listarAtaVersoes, obterEvento, obterLinhasAta } from "@/server/services/eventos";
import type { AtaConteudo, AtaReuniao } from "@/server/db/schema";
import { pode } from "@/domain/permissions";

/** Observações da reunião são nota interna de quem conduz: não saem para as áreas. */
const veObservacoes = (usuario: UsuarioAtual) => pode(usuario, "ata.consolidar") || pode(usuario, "historico.ver_tudo");

/** Pedidos das áreas: quem não vê todas as solicitações leva só os da própria área. */
function filtrarPorArea(usuario: UsuarioAtual, lista: AtaConteudo["solicitacoesPreReuniao"]) {
  if (pode(usuario, "solicitacao.ver_todas")) return lista;
  // Pelo id da área (o nome pode mudar depois do fechamento); atas antigas, sem id, pelo nome.
  return lista.filter((s) => (s.areaId ? s.areaId === usuario.areaId : s.area === usuario.areaNome));
}

/**
 * Ata pronta para exportar (Excel, impressão). Vem da versão congelada quando a ata já fechou;
 * antes disso, é a ata em construção com o que a logística já preencheu.
 */
export type AtaExport = {
  evento: { codigo: string; nome: string; cliente: string; local: string; dataMontagem: string; dataInicio: string; dataFim: string; dataDesmontagem: string; dataCarga: string | null; dataReuniao: Date; responsavel: string };
  versao: number | null;
  reuniao: AtaReuniao | null;
  observacoes: string | null;
  linhas: Array<{ tipo: "PROJETO" | "PECA" | "AVULSO"; descricao: string; codigo: string | null; versao: number | null; quantidade: number; destino: string | null; area: string | null; origem: string; conferidoPor: string | null }>;
  solicitacoesPreReuniao: AtaConteudo["solicitacoesPreReuniao"];
};

/**
 * Na ata em construção a origem é o código da solicitação ("SOL-0012"). Quem não vê todas as
 * solicitações não vê o código de pedido de outra área (a tela da ata também esconde).
 */
function origemVisivel(usuario: UsuarioAtual, l: { origemLabel: string; origemSolicitacaoId: string | null; registro: { areaId: string | null } }) {
  if (!l.origemSolicitacaoId || pode(usuario, "solicitacao.ver_todas") || l.registro.areaId === usuario.areaId) return l.origemLabel;
  return "Pedido de outra área";
}

const ORIGEM_LABEL: Record<string, string> = { SOLICITACAO: "Solicitação da área", AJUSTE_LOGISTICA: "Incluída pela logística" };

export async function montarAtaExport(usuario: UsuarioAtual, eventoId: string, versaoPedida?: number): Promise<AtaExport> {
  const [ev, versoes] = await Promise.all([obterEvento(usuario, eventoId), listarAtaVersoes(eventoId)]);
  const base = { codigo: ev.codigo, nome: ev.nome, cliente: ev.cliente, local: ev.local, dataMontagem: ev.dataMontagem, dataInicio: ev.dataInicio, dataFim: ev.dataFim, dataDesmontagem: ev.dataDesmontagem, dataCarga: ev.dataCarga, dataReuniao: ev.dataReuniao, responsavel: ev.responsavel.nome };
  const sel = versaoPedida ? versoes.find((v) => v.numero === versaoPedida) : versoes[0];
  if (versaoPedida && !sel) throw new NaoEncontradoError("Versão da ata");
  if (sel) {
    const c = sel.conteudo;
    return {
      evento: base,
      versao: sel.numero,
      reuniao: c.reuniao ?? {
        iniciadaEm: null,
        fechadaEm: sel.fechadaEm.toISOString(),
        fechadaPor: sel.fechadaPor?.nome ?? null,
        conduzidaPor: ev.responsavel.nome,
        presentes: null,
        publicoEsperado: null,
        caminhaoCarrega: null,
        caminhaoSai: null,
        arenaDescarrega: null,
        kitDescarrega: null,
      },
      observacoes: veObservacoes(usuario) ? c.observacoes : null,
      linhas: c.linhas.map((l) => ({ tipo: l.tipo, descricao: l.descricao, codigo: l.codigo, versao: l.versao, quantidade: l.quantidade, destino: l.destino, area: l.area, origem: ORIGEM_LABEL[l.origem] ?? l.origem, conferidoPor: l.conferidoPor ?? null })),
      solicitacoesPreReuniao: filtrarPorArea(usuario, c.solicitacoesPreReuniao),
    };
  }
  const linhas = await obterLinhasAta(eventoId);
  return {
    evento: base,
    versao: null,
    reuniao: {
      iniciadaEm: ev.reuniaoIniciadaEm?.toISOString() ?? null,
      fechadaEm: "",
      fechadaPor: null,
      conduzidaPor: ev.responsavel.nome,
      presentes: ev.reuniaoPresentes,
      publicoEsperado: ev.publicoEsperado,
      caminhaoCarrega: ev.caminhaoCarrega,
      caminhaoSai: ev.caminhaoSai,
      arenaDescarrega: ev.arenaDescarrega,
      kitDescarrega: ev.kitDescarrega,
    },
    observacoes: veObservacoes(usuario) ? ev.observacoesReuniao : null,
    linhas: linhas.map((l) => ({ tipo: l.tipo, descricao: l.descricao, codigo: l.tipo === "PROJETO" ? (l.projeto?.codigo ?? null) : l.tipo === "PECA" ? (l.peca?.codigo ?? null) : null, versao: l.versao, quantidade: l.quantidade, destino: l.destino, area: l.areaNome, origem: origemVisivel(usuario, l), conferidoPor: l.conferidoPor ?? null })),
    solicitacoesPreReuniao: [],
  };
}
