/**
 * Log geral: quem vê, filtros por categoria/evento/pessoa/texto, facetas e exportação.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { SemPermissaoError } from "@/domain/errors";
import { criarPeca, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { exportarHistoricoGeral, listarHistoricoGeral, resumoHistorico } from "./historico-geral";

let E: Elenco;
let eventoId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  eventoId = (await novoEvento(E.logistica)).id;
  await criarPeca();
}, 120_000);

describe("histórico geral", () => {
  it("só logística, gestão e administração abrem", async () => {
    await expect(listarHistoricoGeral(E.requisitante)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(listarHistoricoGeral(E.cenografia)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(listarHistoricoGeral(E.gestao)).resolves.toBeTruthy();
  });

  it("lista do mais recente para o mais antigo, com autor, categoria e evento", async () => {
    const r = await listarHistoricoGeral(E.admin, { periodo: "tudo" });
    expect(r.total).toBeGreaterThan(0);
    for (let i = 1; i < r.itens.length; i++) expect(r.itens[i - 1].em.getTime()).toBeGreaterThanOrEqual(r.itens[i].em.getTime());
    const doEvento = r.itens.find((h) => h.entidade === "evento" && h.entidadeId === eventoId);
    expect(doEvento?.categoria).toBe("eventos");
    expect(doEvento?.autor?.nome).toBe("Logística Um");
    expect(doEvento?.evento?.codigo).toMatch(/^EVT-/);
  });

  it("filtra por categoria, evento, pessoa e texto; as facetas ignoram o próprio filtro", async () => {
    const evs = await listarHistoricoGeral(E.admin, { periodo: "tudo", categoria: "eventos" });
    expect(evs.itens.length).toBeGreaterThan(0);
    expect(evs.itens.every((h) => h.categoria === "eventos")).toBe(true);
    // Categoria sem registros: a lista fica vazia, mas a aba "Eventos" continua contando.
    const vazia = await listarHistoricoGeral(E.admin, { periodo: "tudo", categoria: "arena" });
    expect(vazia.itens).toHaveLength(0);
    expect(vazia.porCategoria.eventos).toBe(evs.total);

    const ev = await listarHistoricoGeral(E.admin, { periodo: "tudo", eventoId });
    expect(ev.itens.every((h) => h.eventoId === eventoId)).toBe(true);

    const quem = await listarHistoricoGeral(E.admin, { periodo: "tudo", usuarioId: E.logistica.id });
    expect(quem.itens.length).toBeGreaterThan(0);
    expect(quem.itens.every((h) => h.autor?.id === E.logistica.id)).toBe(true);
    // A faceta de pessoas ignora o filtro de pessoa e traz a contagem de cada uma.
    expect(quem.pessoas.find((p) => p.id === E.logistica.id)?.n).toBe(quem.total);

    const texto = await listarHistoricoGeral(E.admin, { periodo: "tudo", busca: "criad" });
    expect(texto.itens.every((h) => /criad/i.test(h.descricao) || /criad/i.test(h.acao))).toBe(true);
  });

  it("período de hoje inclui o que acabou de acontecer e o resumo bate", async () => {
    const hoje = await listarHistoricoGeral(E.admin, { periodo: "hoje" });
    const resumo = await resumoHistorico(E.admin);
    expect(hoje.total).toBe(resumo.hoje);
    expect(resumo.pessoas30).toBeGreaterThan(0);
  });

  it("exporta tudo o que os filtros pegam, além da primeira página", async () => {
    const lista = await listarHistoricoGeral(E.admin, { periodo: "tudo", porPagina: 10 });
    const exp = await exportarHistoricoGeral(E.admin, { periodo: "tudo" });
    expect(exp.itens.length).toBe(lista.total);
  });
});
