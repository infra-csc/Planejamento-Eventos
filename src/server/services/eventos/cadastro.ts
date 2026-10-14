import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { formatarDataHora } from "@/lib/format";
import { bloquearEvento, notificar, proximoCodigo, registrarHistorico, usuariosRequisitantes } from "../support";

/* ------------------------------------------------------------------ */
/* Criar / editar                                                       */
/* ------------------------------------------------------------------ */

export type DadosEvento = {
  nome: string;
  cliente: string | null;
  local: string | null;
  dataInicio: string;
  dataReuniao: Date;
  /** Fim da janela de alterações pós-ata (opcional; sem data = até encerrar). */
  janelaAlteracoesAte?: string | null;
  /*
   * Não pedidos no cadastro. Sem valor: montagem, fim e desmontagem viram a data do evento
   * (período usado na consolidação) e o responsável é quem criou. Scripts ainda podem informar.
   */
  dataMontagem?: string;
  dataFim?: string;
  dataDesmontagem?: string;
  dataCarga?: string | null;
  responsavelId?: string;
};

function validarOrdemDatas(d: { dataMontagem: string; dataInicio: string; dataFim: string; dataDesmontagem: string }) {
  if (d.dataInicio < d.dataMontagem || d.dataFim < d.dataInicio || d.dataDesmontagem < d.dataFim) {
    throw new ValidacaoError("As datas precisam seguir a ordem: montagem, início, fim e desmontagem.");
  }
}

/** Período interno do evento: usa o informado; senão preserva o atual se ainda couber na nova data; senão, o próprio dia do evento. */
function periodoEvento(dados: DadosEvento, atual?: { dataMontagem: string; dataFim: string; dataDesmontagem: string; dataCarga: string | null }) {
  const ini = dados.dataInicio;
  // Mantém o que ainda faz sentido com o novo início: fim/desmontagem só caem para o próprio dia se ficaram antes dele.
  const fim = dados.dataFim ?? (atual && atual.dataFim >= ini ? atual.dataFim : ini);
  const desmontagem = dados.dataDesmontagem ?? (atual && atual.dataDesmontagem >= fim ? atual.dataDesmontagem : fim);
  const montagem = dados.dataMontagem ?? (atual && atual.dataMontagem <= ini ? atual.dataMontagem : ini);
  const p = {
    dataMontagem: montagem,
    dataInicio: ini,
    dataFim: fim,
    dataDesmontagem: desmontagem,
    dataCarga: dados.dataCarga !== undefined ? dados.dataCarga : (atual?.dataCarga ?? null),
  };
  validarOrdemDatas(p);
  return p;
}

export async function criarEvento(usuario: UsuarioAtual, dados: DadosEvento) {
  exigir(usuario, "evento.criar");
  const periodo = periodoEvento(dados);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const codigo = await proximoCodigo(tx, "evento");
    const [ev] = await tx
      .insert(eventos)
      .values({
        nome: dados.nome,
        cliente: dados.cliente ?? "",
        local: dados.local ?? "",
        ...periodo,
        dataReuniao: dados.dataReuniao,
        janelaAlteracoesAte: dados.janelaAlteracoesAte ?? null,
        // Quem cria o evento responde por ele.
        responsavelId: dados.responsavelId ?? usuario.id,
        codigo,
        criadoPorId: usuario.id,
      })
      .returning();
    await registrarHistorico(tx, {
      eventoId: ev.id,
      entidade: "evento",
      entidadeId: ev.id,
      acao: "CRIADO",
      descricao: `Evento criado — ${ev.nome}${ev.cliente ? ` · ${ev.cliente}` : ""}`,
      usuarioId: usuario.id,
      dadosDepois: dados,
    });
    await notificar(tx, {
      usuarioIds: await usuariosRequisitantes(tx),
      tipo: "EVENTO_CRIADO",
      titulo: `Novo evento em preparação: ${ev.nome}`,
      mensagem: `Envie as necessidades da sua área até a reunião de OS (${formatarDataHora(dados.dataReuniao)}).`,
      link: `/eventos/${ev.id}`,
    });
    return ev;
  });
}

export async function editarEvento(usuario: UsuarioAtual, id: string, dados: DadosEvento) {
  exigir(usuario, "evento.editar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, id);
    const atual = await tx.query.eventos.findFirst({ where: eq(eventos.id, id) });
    if (!atual) throw new NaoEncontradoError("Evento");
    if (atual.status === "CANCELADO") throw new DomainError("Evento cancelado não pode ser editado.");
    if (atual.status === "ENCERRADO") throw new DomainError("Evento encerrado não pode ser editado. Se precisar, a gestão reabre em exceção.");
    const reuniaoMudou = Math.abs(atual.dataReuniao.getTime() - dados.dataReuniao.getTime()) >= 60_000;
    if (atual.status !== "PREPARACAO" && reuniaoMudou) {
      throw new ValidacaoError("A reunião de OS já começou ou aconteceu; a data dela não muda mais.", { dataReuniao: "Reunião já iniciada ou realizada." });
    }
    const periodo = periodoEvento(dados, atual);
    const [ev] = await tx
      .update(eventos)
      .set({
        nome: dados.nome,
        cliente: dados.cliente ?? "",
        local: dados.local ?? "",
        ...periodo,
        dataReuniao: dados.dataReuniao,
        janelaAlteracoesAte: dados.janelaAlteracoesAte ?? null,
        // Responsável não muda pela edição (é quem criou), salvo quando informado explicitamente.
        responsavelId: dados.responsavelId ?? atual.responsavelId,
      })
      .where(eq(eventos.id, id))
      .returning();
    const antes = {
      nome: atual.nome,
      cliente: atual.cliente,
      local: atual.local,
      dataMontagem: atual.dataMontagem,
      dataInicio: atual.dataInicio,
      dataFim: atual.dataFim,
      dataDesmontagem: atual.dataDesmontagem,
      dataReuniao: atual.dataReuniao,
      dataCarga: atual.dataCarga,
      responsavelId: atual.responsavelId,
    };
    await registrarHistorico(tx, {
      eventoId: id,
      entidade: "evento",
      entidadeId: id,
      acao: "EDITADO",
      descricao: "Dados do evento alterados",
      usuarioId: usuario.id,
      dadosAntes: antes,
      dadosDepois: dados,
    });
    // Reunião remarcada: as áreas precisam saber o novo prazo para enviar as necessidades.
    // (O lembrete automático usa a data na chave de deduplicação e volta a avisar para a nova data.)
    if (reuniaoMudou) {
      await registrarHistorico(tx, {
        eventoId: id,
        entidade: "evento",
        entidadeId: id,
        acao: "REUNIAO_REMARCADA",
        descricao: `Reunião de OS remarcada de ${formatarDataHora(atual.dataReuniao)} para ${formatarDataHora(dados.dataReuniao)}`,
        usuarioId: usuario.id,
        dadosAntes: { dataReuniao: atual.dataReuniao },
        dadosDepois: { dataReuniao: dados.dataReuniao },
      });
      await notificar(tx, {
        usuarioIds: await usuariosRequisitantes(tx),
        tipo: "REUNIAO_REMARCADA",
        titulo: `Reunião de OS remarcada: ${ev.nome}`,
        mensagem: `Nova data: ${formatarDataHora(dados.dataReuniao)} (era ${formatarDataHora(atual.dataReuniao)}). Envie as necessidades da sua área até lá.`,
        link: `/eventos/${id}`,
        excetoUsuarioId: usuario.id,
      });
    }
    return ev;
  });
}
