import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventoItens, pecas, projetoItens, solicitacaoItens, type AjusteBom, type BomSnapshotLinha } from "@/server/db/schema";
import { CANTONEIRA_UNIVERSAL, NOME_CANTONEIRA_UNIVERSAL, PECAS_UNIFICADAS } from "@/domain/tendas";
import { registrarHistorico } from "./support";

/** Junta as linhas da mesma peça (a da 3×3 virou a universal) somando as quantidades. */
function unificar<T extends { pecaId: string; codigo: string; nome: string; quantidade: number }>(lista: T[], de: string, para: { id: string; codigo: string; nome: string }): T[] {
  if (!lista.some((l) => l.pecaId === de)) return lista;
  const saida: T[] = [];
  for (const l of lista) {
    const novo = l.pecaId === de ? { ...l, pecaId: para.id, codigo: para.codigo, nome: para.nome } : l.pecaId === para.id ? { ...l, nome: para.nome } : l;
    const ja = saida.find((x) => x.pecaId === novo.pecaId);
    if (ja) ja.quantidade += novo.quantidade;
    else saida.push({ ...novo });
  }
  return saida;
}

/**
 * Uma vez só, ao subir (26/10): as cantoneiras de tenda 3×3 e 5×5 são a mesma peça. A da 5×5 vira
 * "Cantoneira universal" e a da 3×3 entra nela em todo lugar, somando: listas de peças dos projetos (todas as
 * versões), linhas e listas das atas, itens e ajustes das solicitações (rascunhos inclusive). A peça 3×3 fica
 * inativa no catálogo, sem apagar nada. As OS já geradas juntam as duas na leitura (`osParaLeitura`).
 */
export async function unificarCantoneiras(chave = "catalogo:cantoneira-universal:2026-10-26"): Promise<{ feito: false } | { feito: true; projetos: number; linhasAta: number; solicitacoes: number }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [marca] = await tx.insert(configuracoes).values({ chave, valor: JSON.stringify({ status: "em andamento" }) }).onConflictDoNothing({ target: configuracoes.chave }).returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false };
    const antigos = Object.keys(PECAS_UNIFICADAS);
    const rows = await tx.select().from(pecas).where(inArray(pecas.codigo, [CANTONEIRA_UNIVERSAL, ...antigos]));
    const universal = rows.find((p) => p.codigo === CANTONEIRA_UNIVERSAL);
    let nProjetos = 0;
    let nAta = 0;
    let nSolic = 0;
    if (universal) {
      const para = { id: universal.id, codigo: universal.codigo, nome: NOME_CANTONEIRA_UNIVERSAL };
      await tx.update(pecas).set({ nome: NOME_CANTONEIRA_UNIVERSAL, familia: "Tenda", ativo: true }).where(eq(pecas.id, universal.id));
      for (const antiga of rows.filter((p) => p.codigo !== CANTONEIRA_UNIVERSAL)) {
        // Listas de peças dos projetos: na mesma versão, soma na universal; senão a linha passa a ser a universal.
        const itens = await tx.select().from(projetoItens).where(inArray(projetoItens.pecaId, [antiga.id, universal.id]));
        const versoes = new Set(itens.filter((i) => i.pecaId === antiga.id).map((i) => i.versaoId));
        for (const versaoId of versoes) {
          const daVersao = itens.filter((i) => i.versaoId === versaoId);
          const total = daVersao.reduce((a, i) => a + i.quantidade, 0);
          const ficar = daVersao.find((i) => i.pecaId === universal.id) ?? daVersao[0];
          await tx.update(projetoItens).set({ pecaId: universal.id, quantidade: total }).where(eq(projetoItens.id, ficar.id));
          const sobram = daVersao.filter((i) => i.id !== ficar.id).map((i) => i.id);
          if (sobram.length) await tx.delete(projetoItens).where(inArray(projetoItens.id, sobram));
          nProjetos++;
        }

        // Atas: peça solta e a lista do projeto guardada na linha.
        nAta += (await tx.update(eventoItens).set({ pecaId: universal.id }).where(eq(eventoItens.pecaId, antiga.id)).returning({ id: eventoItens.id })).length;
        const comBom = await tx
          .select({ id: eventoItens.id, eventoId: eventoItens.eventoId, bom: eventoItens.bomSnapshot })
          .from(eventoItens)
          .where(sql`${eventoItens.bomSnapshot} @> ${JSON.stringify([{ pecaId: antiga.id }])}::jsonb`);
        for (const l of comBom) {
          await tx.update(eventoItens).set({ bomSnapshot: unificar<BomSnapshotLinha>(l.bom ?? [], antiga.id, para) }).where(eq(eventoItens.id, l.id));
          nAta++;
        }

        // Solicitações (rascunhos inclusive): peça pedida e ajustes da lista do projeto.
        nSolic += (await tx.update(solicitacaoItens).set({ pecaId: universal.id }).where(eq(solicitacaoItens.pecaId, antiga.id)).returning({ id: solicitacaoItens.id })).length;
        const comAjuste = await tx
          .select({ id: solicitacaoItens.id, ajustes: solicitacaoItens.ajustesBom })
          .from(solicitacaoItens)
          .where(sql`${solicitacaoItens.ajustesBom} @> ${JSON.stringify([{ pecaId: antiga.id }])}::jsonb`);
        for (const s of comAjuste) {
          await tx.update(solicitacaoItens).set({ ajustesBom: unificar<AjusteBom>(s.ajustes ?? [], antiga.id, para).filter((a) => a.quantidade !== 0) }).where(eq(solicitacaoItens.id, s.id));
          nSolic++;
        }

        await tx.update(pecas).set({ ativo: false, disponivelEmSolicitacoes: false }).where(eq(pecas.id, antiga.id));
        await registrarHistorico(tx, {
          entidade: "peca",
          entidadeId: antiga.id,
          acao: "EDITADO",
          descricao: `${antiga.nome} passou a ser ${NOME_CANTONEIRA_UNIVERSAL} (${universal.codigo}) em projetos, atas e solicitações`,
          usuarioId: null,
        });
      }
    }
    const resultado = { projetos: nProjetos, linhasAta: nAta, solicitacoes: nSolic };
    await tx.update(configuracoes).set({ valor: JSON.stringify({ status: "feito", em: new Date().toISOString(), ...resultado }) }).where(eq(configuracoes.chave, chave));
    return { feito: true, ...resultado };
  });
}
