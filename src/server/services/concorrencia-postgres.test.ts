/**
 * Concorrência contra um PostgreSQL de verdade, com várias conexões (pool do node-postgres): o
 * PGlite dos outros testes tem uma conexão só e serializa tudo, então as travas (`for update`,
 * `bloquearEvento`) só são postas à prova aqui.
 *
 * Só roda com TEST_DATABASE_URL definida — e ela precisa apontar para um banco DESCARTÁVEL (as
 * migrações são aplicadas e o teste grava dados com nomes únicos; nada é apagado). Sem ela, o
 * arquivo inteiro é pulado. No CI, o job `postgres` do ci.yml roda com o serviço Postgres dele.
 *
 *   TEST_DATABASE_URL=postgres://postgres:ci@localhost:5432/npe npx vitest run src/server/services/concorrencia-postgres.test.ts
 *
 * CONCORRENCIA_EM_PGLITE=1 roda os mesmos cenários no PGlite em memória (sem concorrência real):
 * serve só para validar o próprio teste quando não há Postgres à mão.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ALVO = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (url) {
    process.env.DATABASE_URL = url;
    delete process.env.PGLITE_DATA_DIR;
    return "postgres" as const;
  }
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  return process.env.CONCORRENCIA_EM_PGLITE === "1" ? ("pglite" as const) : null;
});

import { and, eq, isNull } from "drizzle-orm";
import { getConnection, getDb } from "@/server/db";
import { eventoItens, osVersoes, solicitacaoItens, solicitacoes } from "@/server/db/schema";
import { DomainError } from "@/domain/errors";
import { conferirTodasLinhas, incluirLinhaAta } from "./eventos";
import { enviarSolicitacao, obterSolicitacao, responderItem, salvarSolicitacaoCompleta } from "./solicitacoes";
import { ajustarLinhaNaConferencia } from "./conferencia";
import { criarPeca, enviarSolicitacao as criarEEnviar, eventoAberto, incluirPeca, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";

/** Rodadas de cada cenário: aumenta a chance de pegar as duas ordens de chegada. */
const RODADAS = 6;

let E: Elenco;
let pecaId: string;

/**
 * Toda falha de uma operação concorrente precisa ser erro de regra com mensagem para o usuário
 * (DomainError). Deadlock (40P01), violação de unicidade (23505) ou falha de serialização (40001)
 * chegam como erro cru do driver e viram tela de erro.
 */
function soErrosDeRegra(resultados: PromiseSettledResult<unknown>[]) {
  for (const r of resultados) {
    if (r.status === "rejected") {
      const e = r.reason as { code?: string; message?: string };
      expect(r.reason, `erro cru do banco: ${e?.code ?? ""} ${e?.message ?? String(r.reason)}`).toBeInstanceOf(DomainError);
    }
  }
}

describe.skipIf(!ALVO)(`concorrência (${ALVO ?? "sem TEST_DATABASE_URL"})`, { timeout: 120_000 }, () => {
  beforeAll(async () => {
    await migrarBanco();
    E = await montarElenco();
    pecaId = (await criarPeca()).id;
  }, 180_000);

  afterAll(async () => {
    // O pool do node-postgres segura o processo aberto.
    if (ALVO === "postgres") await (await getConnection()).close();
  });

  it("duas pessoas respondendo o mesmo item ao mesmo tempo: uma resposta, uma linha, uma versão de OS", async () => {
    const db = await getDb();
    for (let i = 0; i < RODADAS; i++) {
      const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
      const s = await criarEEnviar(E.requisitante, E.logistica, ev.id, [itemAvulso("Tenda 5x5", 3)]);
      const versoesAntes = (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length;
      const r = await Promise.allSettled([
        responderItem(E.logistica, s.itens[0].id, { status: "ATENDIDO" }),
        responderItem(E.logistica2, s.itens[0].id, i % 2 ? { status: "PARCIAL", quantidadeAtendida: 1, observacaoLogistica: "Só uma" } : { status: "ATENDIDO" }),
      ]);
      soErrosDeRegra(r);
      expect(r.filter((x) => x.status === "fulfilled"), `rodada ${i}`).toHaveLength(1);
      const linhas = await db.select().from(eventoItens).where(eq(eventoItens.solicitacaoItemId, s.itens[0].id));
      expect(linhas).toHaveLength(1);
      const item = (await obterSolicitacao(E.logistica, s.id)).itens[0];
      // A linha da ata bate com a resposta que venceu.
      expect(linhas[0].quantidade).toBe(item.quantidadeAtendida);
      expect((await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length).toBe(versoesAntes + 1);
    }
  });

  it("autosave do rascunho × envio: o envio leva a versão final e nada muda depois de enviado", async () => {
    const db = await getDb();
    for (let i = 0; i < RODADAS; i++) {
      const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
      const r0 = await salvarSolicitacaoCompleta(E.requisitante, { eventoId: ev.id, titulo: "Rascunho", observacao: null, enviar: false, itens: [itemAvulso("Original")] });
      const autosave = () => salvarSolicitacaoCompleta(E.requisitante, { id: r0.id, eventoId: ev.id, titulo: "Rascunho editado", observacao: null, enviar: false, itens: [itemAvulso("Novo A"), itemAvulso("Novo B", 2)] });
      const envio = () => enviarSolicitacao(E.requisitante, r0.id);
      const r = await Promise.allSettled(i % 2 ? [envio(), autosave()] : [autosave(), envio()]);
      soErrosDeRegra(r);
      const [resEnvio, resAutosave] = i % 2 ? r : [r[1], r[0]];
      expect(resEnvio.status, `rodada ${i}: o envio precisa passar`).toBe("fulfilled");
      const s = await db.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, r0.id) });
      const itens = await db.select().from(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, r0.id));
      expect(s?.status).toBe("ENVIADA");
      // Tudo o que está gravado foi enviado junto (nenhum item entrou em rascunho depois do envio).
      expect(itens.every((it) => it.status === "EM_ANALISE")).toBe(true);
      const descricoes = itens.map((it) => it.descricaoLivre).sort();
      if (resAutosave.status === "fulfilled") {
        expect(descricoes).toEqual(["Novo A", "Novo B"]);
        expect(s?.titulo).toBe("Rascunho editado");
      } else {
        expect(String((resAutosave.reason as Error).message)).toMatch(/rascunho/i);
        expect(descricoes).toEqual(["Original"]);
        expect(s?.titulo).toBe("Rascunho");
      }
    }
  });

  it("conferir as restantes × ajuste na conferência × linha nova: sem travamento, nada conferido às cegas", async () => {
    const db = await getDb();
    for (let i = 0; i < RODADAS; i++) {
      const ev = await novoEvento(E.logistica);
      const [a, b, c] = [await incluirPeca(E.logistica, ev.id, pecaId, 5, E.areas.a.id), await incluirPeca(E.logistica, ev.id, pecaId, 5, E.areas.a.id), await incluirPeca(E.logistica, ev.id, pecaId, 5, E.areas.a.id)];
      const naTela = [a.id, b.id, c.id];
      const ops = [
        () => conferirTodasLinhas(E.logistica, ev.id, naTela),
        () => ajustarLinhaNaConferencia(E.logistica2, ev.id, b.id, 3, "Duas reservadas para outro evento", { quantidadeEsperada: 5 }),
        () => incluirLinhaAta(E.logistica2, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId, descricaoLivre: null, quantidade: 1, destino: "Palco", areaId: null, justificativa: null }),
      ];
      const ordem = i % 2 ? [2, 1, 0] : [0, 1, 2];
      const r = await Promise.allSettled(ordem.map((k) => ops[k]()));
      soErrosDeRegra(r);
      expect(r.every((x) => x.status === "fulfilled"), `rodada ${i}`).toBe(true);
      const linhas = await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.ativo, true)));
      const porId = new Map(linhas.map((l) => [l.id, l]));
      expect(porId.get(b.id)?.quantidade).toBe(3);
      for (const id of naTela) expect(porId.get(id)?.conferidoEm, id).not.toBeNull();
      // A linha que chegou depois da tela não foi conferida junto.
      const naoConferidas = await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.ativo, true), isNull(eventoItens.conferidoEm)));
      expect(naoConferidas.map((l) => l.destino)).toEqual(["Palco"]);
    }
  });
});
