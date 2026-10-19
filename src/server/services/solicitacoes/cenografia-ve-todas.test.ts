/**
 * Cenografia consulta as solicitações de todas as áreas (monta o que as outras pedem), mas: rascunho de
 * outra área continua invisível, os rascunhos dela aparecem e ela não edita pedido de outra área.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { podeEditarSolicitacao, podeVerSolicitacao } from "@/domain/permissions";
import { enviarSolicitacao, itemAvulso, migrarBanco, montarElenco, novoEvento, rascunho, type Elenco } from "@/test/apoio";
import { paginarSolicitacoes } from "./consultas";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("Cenografia vê todas as áreas", { timeout: 60_000 }, () => {
  it("vê o pedido enviado de outra área e os próprios rascunhos; não vê rascunho alheio nem edita pedido de outra área", async () => {
    const ev = await novoEvento(E.logistica);
    const deOutra = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Banner", 2)]);
    const rascunhoAlheio = await rascunho(E.requisitante, ev.id);
    const meuRascunho = await rascunho(E.cenografia, ev.id);

    const pag = await paginarSolicitacoes(E.cenografia, { filtro: "TODAS", porPagina: 50, eventoId: ev.id });
    const codigos = pag.itens.map((s) => s.codigo);
    expect(codigos).toContain(deOutra.codigo);
    expect(codigos).toContain(meuRascunho.codigo);
    expect(codigos).not.toContain(rascunhoAlheio.codigo);

    expect(podeVerSolicitacao(E.cenografia, { areaId: deOutra.areaId, status: "RESPONDIDA" })).toBe(true);
    expect(podeVerSolicitacao(E.cenografia, { areaId: deOutra.areaId, status: "RASCUNHO" })).toBe(false);
    expect(podeEditarSolicitacao(E.cenografia, { areaId: deOutra.areaId })).toBe(false);
  });
});
