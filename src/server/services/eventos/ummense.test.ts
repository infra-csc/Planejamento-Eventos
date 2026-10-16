/**
 * Lote do Ummense (28/11 a 31/12/2026): cria uma vez, deixa de fora o que já existe, reunião numa terça
 * a 35+ dias do evento, uma notificação só; rodar de novo não cria nada.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq, gte, like } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventos, historico, notificacoes, usuarios } from "@/server/db/schema";
import { reuniaoDoEvento, type FotoDoUmmense } from "@/domain/ummense";
import foto from "@/data/ummense-eventos.json";
import { formatarDataHora } from "@/lib/format";
import { migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { criarEvento } from "./cadastro";
import { importarLoteDoUmmense, LOTE_UMMENSE } from "./ummense";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

const doLote = (foto as FotoDoUmmense).eventos.filter((e) => e.data >= LOTE_UMMENSE.de && e.data <= LOTE_UMMENSE.ate);

describe("reunião de OS do evento", () => {
  it("sempre terça, 35 dias antes ou um pouco mais", () => {
    for (const e of doLote) {
      const r = reuniaoDoEvento(e.data);
      const dias = (Date.parse(e.data) - Date.parse(r)) / 86_400_000;
      expect(new Date(`${r}T12:00:00Z`).getUTCDay()).toBe(2);
      expect(dias).toBeGreaterThanOrEqual(35);
      expect(dias).toBeLessThanOrEqual(41);
    }
    expect(reuniaoDoEvento("2026-11-28")).toBe("2026-10-20"); // sábado → 39 dias
    expect(reuniaoDoEvento("2026-11-29")).toBe("2026-10-20"); // domingo → 40 dias
    expect(reuniaoDoEvento("2026-12-01")).toBe("2026-10-27"); // terça → 35 dias
  });
});

describe("lote do Ummense", () => {
  it("cria uma vez, sem o que já existe, e não repete", async () => {
    // Já cadastrado com outro nome: "Bravus Speed - Etapa 2" (29/11) = "BRAVUS SPEED 2".
    const bravus = await criarEvento(E.logistica, { nome: "BRAVUS SPEED 2", cliente: null, local: "São Paulo", dataInicio: "2026-11-29", dataReuniao: new Date("2026-10-20T17:00:00Z") });
    const db = await getDb();
    const antes = await db.select({ id: eventos.id }).from(eventos);

    const r = await importarLoteDoUmmense();
    expect(r.feito).toBe(true);
    if (!r.feito) return;
    expect(r.jaExistiam.join(" ")).toMatch(/Bravus Speed - Etapa 2/);
    expect(r.criados).toHaveLength(doLote.length - r.jaExistiam.length - r.pulados.length);
    expect(r.criados.every((c) => c.data >= "2026-11-28" && c.data <= "2026-12-31")).toBe(true);

    const novos = await db.select().from(eventos).where(gte(eventos.dataInicio, "2026-11-28"));
    const criados = novos.filter((e) => e.id !== bravus.id && !antes.some((a) => a.id === e.id));
    expect(criados).toHaveLength(r.criados.length);
    const sp = criados.find((e) => e.nome === "NIGHT RUN - ETAPA 2 - SÃO PAULO")!;
    expect(sp).toMatchObject({ dataInicio: "2026-11-28", local: "São Paulo", status: "PREPARACAO" });
    const [resp] = await db.select({ perfil: usuarios.perfil }).from(usuarios).where(eq(usuarios.id, sp.responsavelId));
    expect(resp.perfil).toBe("ADMIN");
    expect(formatarDataHora(sp.dataReuniao)).toMatch(/20\/10\/2026.*14:00/);

    // Histórico de cada um e uma notificação só por requisitante.
    const hist = await db.select({ d: historico.descricao }).from(historico).where(and(eq(historico.eventoId, sp.id), eq(historico.acao, "CRIADO")));
    expect(hist[0].d).toMatch(/importado do Ummense, data não confirmada/);
    const avisos = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, E.requisitante.id), like(notificacoes.titulo, "%calendário do Ummense%")));
    expect(avisos).toHaveLength(1);

    // De novo (outro start do servidor): nada.
    expect(await importarLoteDoUmmense()).toEqual({ feito: false });
    expect((await db.select({ id: eventos.id }).from(eventos)).length).toBe(antes.length + r.criados.length);
    const [marca] = await db.select().from(configuracoes).where(eq(configuracoes.chave, LOTE_UMMENSE.chave));
    expect(JSON.parse(marca.valor)).toMatchObject({ status: "feito", criados: r.criados.map((c) => c.codigo) });
  });
});
