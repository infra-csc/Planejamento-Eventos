import { asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { estoqueItens, eventos, pecas } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { inconsistenciasDoEvento } from "@/domain/logistica";
import { hojeISO } from "@/lib/format";
import { datasDosEventos } from "./projecao";
import { diaBrasilia } from "./support";

/** O que falta acertar nos dados para a Projeção não calcular sobre número errado. Só aponta: a correção é manual. */
export async function dadosDoSaneamento(usuario: UsuarioAtual) {
  exigir(usuario, "logistica.cadastros");
  const db = await getDb();
  const [evs, listaPecas, itens] = await Promise.all([
    db
      .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, status: eventos.status, ataFechadaEm: eventos.ataFechadaEm, estrutura: eventos.estrutura, tourId: eventos.tourId, dataInicio: eventos.dataInicio, dataFim: eventos.dataFim, dataReuniao: eventos.dataReuniao, saidaPrevista: eventos.saidaPrevista, retornoPrevisto: eventos.retornoPrevisto })
      .from(eventos)
      .where(inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"]))
      .orderBy(asc(eventos.dataInicio)),
    db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome, unidade: pecas.unidade, tipoItem: pecas.tipoItem, volumeM3: pecas.volumeM3 }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome)),
    db.select({ id: estoqueItens.id, nome: estoqueItens.nome, categoria: estoqueItens.categoria, quantidade: estoqueItens.quantidade }).from(estoqueItens).where(isNull(estoqueItens.pecaId)).orderBy(asc(estoqueItens.categoria), asc(estoqueItens.nome)),
  ]);
  const datas = await datasDosEventos(db, evs);
  const hoje = hojeISO();
  return {
    eventos: evs.flatMap((e) => {
      const d = datas.get(e.id)!;
      const diaReuniao = diaBrasilia(e.dataReuniao);
      const problemas = inconsistenciasDoEvento({ dataInicio: e.dataInicio, diaReuniao, status: e.status, saida: d.saida, retorno: d.retorno }, hoje);
      return problemas.length ? [{ id: e.id, codigo: e.codigo, nome: e.nome, dataInicio: e.dataInicio, diaReuniao, problemas }] : [];
    }),
    totalEventos: evs.length,
    semTipo: listaPecas.filter((p) => !p.tipoItem),
    semVolume: listaPecas.filter((p) => p.volumeM3 == null),
    totalPecas: listaPecas.length,
    itensSemVinculo: itens,
    pecasParaVincular: listaPecas.map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo })),
  };
}
