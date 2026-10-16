import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, usuarios, veiculosCarga } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { normalizarVeiculo, TIPO_VEICULO_LABEL, validarVeiculo, type DadosVeiculo, type EventoCarga, type VeiculoCarga } from "@/domain/carga-descarga";
import { registrarHistorico } from "./support";

/** Veículo como a tela usa: os dados, o evento e quem cadastrou/alterou por último. */
export type VeiculoCargaView = VeiculoCarga & { atualizadoEm: string; atualizadoPor: string | null; criadoPor: string | null };

const descricaoVeiculo = (v: Pick<DadosVeiculo, "tipo" | "ident">, evento: string) => `${TIPO_VEICULO_LABEL[v.tipo]}${v.ident ? ` (${v.ident})` : ""} · ${evento}`;

/**
 * Tudo que o calendário de carga precisa: os veículos (com o evento de cada um) e os eventos que podem
 * receber veículos (os ativos, para escolher no cadastro). O volume é pequeno (dezenas de eventos por
 * ano): uma carga só, e o calendário filtra por semana na tela.
 */
export async function listarCarga(usuario: UsuarioAtual, filtro: { eventoId?: string } = {}) {
  exigir(usuario, "carga.ver");
  const db = await getDb();
  const [linhas, evs] = await Promise.all([
    db
      .select({ v: veiculosCarga, criadoPor: usuarios.nome })
      .from(veiculosCarga)
      .leftJoin(usuarios, eq(veiculosCarga.criadoPorId, usuarios.id))
      .where(filtro.eventoId ? eq(veiculosCarga.eventoId, filtro.eventoId) : undefined)
      .orderBy(asc(veiculosCarga.criadoEm)),
    db
      .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, dataInicio: eventos.dataInicio, local: eventos.local, status: eventos.status })
      .from(eventos)
      .where(filtro.eventoId ? eq(eventos.id, filtro.eventoId) : ne(eventos.status, "CANCELADO"))
      .orderBy(asc(eventos.dataInicio)),
  ]);
  // Quem alterou por último (nome), numa consulta só.
  const ids = [...new Set(linhas.map((l) => l.v.atualizadoPorId).filter((x): x is string => Boolean(x)))];
  const nomes = ids.length ? new Map((await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, ids))).map((u) => [u.id, u.nome])) : new Map<string, string>();
  const veiculos: VeiculoCargaView[] = linhas.map(({ v, criadoPor }) => ({
    id: v.id,
    eventoId: v.eventoId,
    tipo: v.tipo,
    ident: v.ident,
    ida: v.ida,
    volta: v.volta,
    atualizadoEm: v.atualizadoEm.toISOString(),
    // Só conta como alteração depois do cadastro (no cadastro as duas datas são iguais).
    atualizadoPor: v.atualizadoPorId && v.atualizadoEm.getTime() !== v.criadoEm.getTime() ? (nomes.get(v.atualizadoPorId) ?? null) : null,
    criadoPor: criadoPor ?? null,
  }));
  // Evento cancelado com veículo continua aparecendo (o veículo existe); no cadastro só os ativos.
  const comVeiculo = new Set(veiculos.map((v) => v.eventoId));
  const eventosCarga: Array<EventoCarga & { ativo: boolean }> = evs
    .filter((e) => e.status !== "CANCELADO" || comVeiculo.has(e.id))
    .map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, data: e.dataInicio, local: e.local, ativo: e.status !== "CANCELADO" && e.status !== "ENCERRADO" }));
  return { veiculos, eventos: eventosCarga, podeEditar: usuario.perfil === "ADMIN" || usuario.perfil === "LOGISTICA" };
}

/** Cria (sem `id`) ou substitui um veículo de um evento. Valida as regras da ida e da volta. */
export async function salvarVeiculoCarga(usuario: UsuarioAtual, dados: { id?: string | null; eventoId: string; veiculo: DadosVeiculo }) {
  exigir(usuario, "carga.editar");
  const v = normalizarVeiculo(dados.veiculo);
  const erro = validarVeiculo(v);
  if (erro) throw new ValidacaoError(erro.mensagem, { [erro.campo]: erro.mensagem });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, dados.eventoId), columns: { id: true, nome: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status === "CANCELADO") throw new DomainError("O evento foi cancelado: não recebe veículos.");
    if (dados.id) {
      const antes = await tx.query.veiculosCarga.findFirst({ where: eq(veiculosCarga.id, dados.id) });
      if (!antes) throw new NaoEncontradoError("Veículo");
      await tx
        .update(veiculosCarga)
        .set({ eventoId: ev.id, tipo: v.tipo, ident: v.ident, ida: v.ida, volta: v.volta, atualizadoPorId: usuario.id, atualizadoEm: new Date() })
        .where(eq(veiculosCarga.id, dados.id));
      await registrarHistorico(tx, {
        eventoId: ev.id,
        entidade: "veiculo_carga",
        entidadeId: dados.id,
        acao: "CARGA_VEICULO_EDITADO",
        descricao: `Veículo de carga editado: ${descricaoVeiculo(v, ev.nome)}`,
        usuarioId: usuario.id,
        dadosAntes: { tipo: antes.tipo, ident: antes.ident, ida: antes.ida, volta: antes.volta },
        dadosDepois: v,
      });
      return { id: dados.id };
    }
    const [novo] = await tx
      .insert(veiculosCarga)
      .values({ eventoId: ev.id, tipo: v.tipo, ident: v.ident, ida: v.ida, volta: v.volta, criadoPorId: usuario.id, atualizadoPorId: usuario.id })
      .returning({ id: veiculosCarga.id });
    await registrarHistorico(tx, {
      eventoId: ev.id,
      entidade: "veiculo_carga",
      entidadeId: novo.id,
      acao: "CARGA_VEICULO_CRIADO",
      descricao: `Veículo de carga cadastrado: ${descricaoVeiculo(v, ev.nome)}`,
      usuarioId: usuario.id,
      dadosDepois: v,
    });
    return { id: novo.id };
  });
}

/** Cópia integral (tipo, identificação, ida e volta) no mesmo evento. */
export async function duplicarVeiculoCarga(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "carga.editar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const v = await tx.query.veiculosCarga.findFirst({ where: eq(veiculosCarga.id, id), with: { evento: { columns: { nome: true } } } });
    if (!v) throw new NaoEncontradoError("Veículo");
    const [novo] = await tx
      .insert(veiculosCarga)
      .values({ eventoId: v.eventoId, tipo: v.tipo, ident: v.ident, ida: v.ida, volta: v.volta, criadoPorId: usuario.id, atualizadoPorId: usuario.id })
      .returning({ id: veiculosCarga.id });
    await registrarHistorico(tx, {
      eventoId: v.eventoId,
      entidade: "veiculo_carga",
      entidadeId: novo.id,
      acao: "CARGA_VEICULO_DUPLICADO",
      descricao: `Veículo de carga duplicado: ${descricaoVeiculo(v, v.evento.nome)}`,
      usuarioId: usuario.id,
    });
    return { id: novo.id };
  });
}

export async function excluirVeiculoCarga(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "carga.editar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const v = await tx.query.veiculosCarga.findFirst({ where: eq(veiculosCarga.id, id), with: { evento: { columns: { nome: true } } } });
    if (!v) throw new NaoEncontradoError("Veículo");
    await tx.delete(veiculosCarga).where(and(eq(veiculosCarga.id, id)));
    await registrarHistorico(tx, {
      eventoId: v.eventoId,
      entidade: "veiculo_carga",
      entidadeId: id,
      acao: "CARGA_VEICULO_EXCLUIDO",
      descricao: `Veículo de carga excluído: ${descricaoVeiculo(v, v.evento.nome)}`,
      usuarioId: usuario.id,
      dadosAntes: { tipo: v.tipo, ident: v.ident, ida: v.ida, volta: v.volta },
    });
  });
}

/** Quantos veículos de carga o evento tem (contador da aba). */
export async function contarVeiculosCarga(eventoId: string) {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(veiculosCarga).where(eq(veiculosCarga.eventoId, eventoId));
  return r?.n ?? 0;
}
