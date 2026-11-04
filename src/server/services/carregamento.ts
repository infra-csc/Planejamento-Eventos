import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventos, pecas, solicitacaoItens, solicitacoes } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { chaveFora, linhasCarregamento, textoMudanca, type AjusteCarregamento, type Carregamento } from "@/domain/carregamento";
import { calcularOS } from "@/domain/os";
import { montarLinhasAta } from "./os";
import { bloquearEvento, notificar, registrarHistorico, usuariosComPedidoNoEvento, type Executor } from "./support";

/**
 * O que foi de fato carregado de cada evento, quando difere da OS. Guardado em `configuracoes` por evento (como a folha de
 * separação), sem tabela nova: quando vier o carregamento por veículo (briefing NorteLog, fase 3), estes dados são o ponto de partida.
 */
const chave = (eventoId: string) => `carregamento:${eventoId}`;
const MOTIVO_MAX = 300;

async function lerCarregamento(ex: Executor, eventoId: string): Promise<Carregamento> {
  const [c] = await ex.select({ valor: configuracoes.valor }).from(configuracoes).where(eq(configuracoes.chave, chave(eventoId)));
  if (!c) return {};
  try {
    return JSON.parse(c.valor) as Carregamento;
  } catch {
    return {};
  }
}

export async function obterCarregamento(eventoId: string): Promise<Carregamento> {
  return lerCarregamento(await getDb(), eventoId);
}

export type MudancaCarregamento = { chave?: string; pecaId?: string; carregado: number; motivo: string };

/**
 * Grava o que foi carregado e avisa quem pediu cada item. Não gera versão da OS. Voltar ao número do pedido apaga o ajuste.
 * O que muda na mesma gravação vai num aviso só, por pessoa, com o que interessa a ela.
 */
export async function salvarCarregamento(usuario: UsuarioAtual, eventoId: string, mudancas: MudancaCarregamento[]) {
  exigir(usuario, "ata.ajustar");
  if (mudancas.length === 0) throw new ValidacaoError("Nada para salvar.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, nome: true, status: true, ataFechadaEm: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status === "CANCELADO") throw new DomainError("Evento cancelado: o carregamento não muda mais.");
    if (!ev.ataFechadaEm) throw new DomainError("O carregamento abre quando a ata fecha.");

    const atas = await montarLinhasAta(tx, eventoId);
    const atual = await lerCarregamento(tx, eventoId);
    const linhas = linhasCarregamento(calcularOS(atas), atual);
    const agora = new Date().toISOString();
    const alteradas: Array<{ chave: string; codigo: string | null; nome: string; pedido: number; carregado: number; motivo: string; antes: number }> = [];

    for (const m of mudancas) {
      if (!Number.isInteger(m.carregado) || m.carregado < 0 || m.carregado > 1_000_000) throw new ValidacaoError("Quantidade deve ser um inteiro entre 0 e 1.000.000.");
      const motivo = (m.motivo ?? "").trim().slice(0, MOTIVO_MAX);
      let linha = linhas.find((l) => l.chave === m.chave);
      if (!linha && m.pecaId) {
        // Item a mais: peça do catálogo que a OS não tem (ou que já tem: aí é só outra quantidade dela).
        const p = await tx.query.pecas.findFirst({ where: eq(pecas.id, m.pecaId), columns: { id: true, codigo: true, nome: true, setor: true, unidade: true } });
        if (!p) throw new NaoEncontradoError("Peça");
        linha = linhas.find((l) => l.chave === p.codigo) ?? { chave: p.codigo, pecaId: p.id, codigo: p.codigo, nome: p.nome, setor: p.setor, unidade: p.unidade, pedido: 0, carregado: 0, ajuste: null };
      }
      if (!linha) throw new NaoEncontradoError("Item do carregamento");
      if (m.carregado === linha.carregado) continue;
      if (m.carregado === linha.pedido) {
        delete atual[linha.chave];
      } else {
        const ajuste: AjusteCarregamento = { chave: linha.chave, pecaId: linha.pecaId, codigo: linha.codigo, nome: linha.nome, setor: linha.setor, unidade: linha.unidade, carregado: m.carregado, pedidoNaHora: linha.pedido, motivo, porNome: usuario.nome, em: agora };
        atual[linha.chave] = ajuste;
      }
      alteradas.push({ chave: linha.chave, codigo: linha.codigo, nome: linha.nome, pedido: linha.pedido, carregado: m.carregado, motivo, antes: linha.carregado });
    }
    if (alteradas.length === 0) return { alteradas: 0 };

    const valor = JSON.stringify(atual);
    await tx.insert(configuracoes).values({ chave: chave(eventoId), valor }).onConflictDoUpdate({ target: configuracoes.chave, set: { valor, atualizadoEm: new Date() } });
    for (const a of alteradas) {
      await registrarHistorico(tx, {
        eventoId,
        entidade: "evento",
        entidadeId: eventoId,
        acao: "CARREGAMENTO_AJUSTE",
        descricao: a.carregado === a.pedido ? `Carregamento: ${a.nome} voltou ao pedido (${a.pedido})` : `Carregamento: ${textoMudanca(a)}${a.motivo ? `. Observação: ${a.motivo}` : ""}`,
        usuarioId: usuario.id,
        dadosAntes: { carregado: a.antes },
        dadosDepois: { carregado: a.carregado, pedido: a.pedido },
      });
    }

    // Quem pediu cada item: a linha da ata aponta para o item da solicitação. O que veio de regra ou da logística não tem
    // solicitante: aí avisa quem pediu alguma coisa no evento, para nenhuma mudança passar em silêncio.
    const idsItem = [...new Set(atas.map((l) => l.registro.solicitacaoItemId).filter((x): x is string => Boolean(x)))];
    const autores = idsItem.length
      ? await tx.select({ item: solicitacaoItens.id, autor: solicitacoes.criadoPorId }).from(solicitacaoItens).innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id)).where(inArray(solicitacaoItens.id, idsItem))
      : [];
    const autorDo = new Map(autores.map((a) => [a.item, a.autor]));
    const quemPediu = (a: (typeof alteradas)[number]) => {
      const ids = atas
        .filter((l) => {
          if (l.tipo === "PROJETO") return l.projeto?.bom.some((b) => b.codigo === a.codigo);
          if (l.tipo === "PECA") return l.peca?.codigo === a.codigo;
          return chaveFora(l.descricaoLivre ?? "", l.destino) === a.chave;
        })
        .map((l) => (l.registro.solicitacaoItemId ? autorDo.get(l.registro.solicitacaoItemId) : undefined))
        .filter((x): x is string => Boolean(x));
      return [...new Set(ids)];
    };
    const porPessoa = new Map<string, typeof alteradas>();
    let doEvento: string[] | null = null;
    for (const a of alteradas) {
      let ids = quemPediu(a);
      if (ids.length === 0) ids = doEvento ??= await usuariosComPedidoNoEvento(tx, eventoId);
      for (const id of ids) porPessoa.set(id, [...(porPessoa.get(id) ?? []), a]);
    }
    for (const [usuarioId, itens] of porPessoa) {
      const partes = itens.slice(0, 3).map((a) => (a.carregado === a.pedido ? `${a.nome} voltou ao pedido` : a.motivo ? `${textoMudanca(a)} (${a.motivo})` : textoMudanca(a)));
      const resto = itens.length - partes.length;
      await notificar(tx, {
        usuarioIds: [usuarioId],
        tipo: "CARREGAMENTO_AJUSTE",
        titulo: `Carregamento mudou: ${ev.nome}`,
        mensagem: `${partes.join(" · ")}${resto > 0 ? ` · e mais ${resto}` : ""}. A OS não muda.`,
        link: `/eventos/${eventoId}/carregamento`,
        excetoUsuarioId: usuario.id,
      });
    }
    return { alteradas: alteradas.length };
  });
}
