import { describe, expect, it } from "vitest";
import { ARENA_ECO_RUN_SP_2026 as arena, ATA_ECO_RUN_SP } from "./eco-run-sp-2026";
import { amostrar, buscarPontos, comprimento, comprimentoPercurso, itensNaoPosicionados, limitesArena, poligonoFaixa, pontoNaDistancia } from "./geometria";
import { CAMADAS, CATEGORIAS, GRUPOS_CAMADAS, camadasEssenciais } from "./categorias";
import { derivarDivergencias, divergenciasDaArena, divergenciasDoPonto } from "./conferencia";

describe("arena Eco Run SP 2026", () => {
  it("usa só itens que existem na ata", () => {
    const itens = new Set(ATA_ECO_RUN_SP.map((i) => `${i.secao}|${i.item}`));
    for (const p of arena.pontos) for (const i of p.itensAta) expect(itens.has(`${i.secao}|${i.item}`)).toBe(true);
  });

  it("não tem ids repetidos e toda categoria tem visual", () => {
    const ids = arena.pontos.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of arena.pontos) expect(CATEGORIAS[p.categoria]).toBeDefined();
  });

  it("reproduz as cotas da planta: curral branco com 73 m e pórticos nas pontas", () => {
    const branco = arena.currais.find((c) => c.id === "branco")!;
    expect(comprimento(branco.eixo)).toBeGreaterThan(68);
    expect(comprimento(branco.eixo)).toBeLessThan(78);
    const largada = arena.pontos.find((p) => p.id === "largada")!;
    const chegada = arena.pontos.find((p) => p.id === "chegada")!;
    expect(largada.posicao[0]).toBeGreaterThan(100);
    expect(chegada.posicao[0]).toBeLessThan(-480);
  });

  it("divide os itens de ativação por marca e não associa a marca que mudou de nome", () => {
    const livelo = arena.pontos.find((p) => p.id === "estande-livelo")!;
    expect(livelo.itensAta.find((i) => i.item === "Puffs")?.quantidade).toBe(10);
    const mudas = arena.pontos.find((p) => p.id === "estande-mudas")!;
    expect(mudas.itensAta.some((i) => i.item.startsWith("Bancadas"))).toBe(false);
    expect(arena.pontos.filter((p) => p.tipo === "Estande 9x6")).toHaveLength(8);
  });

  it("mostra o que ficou fora do mapa em vez de esconder", () => {
    const fora = itensNaoPosicionados(arena).map((i) => i.item);
    expect(fora).toContain("Cochos para água");
    expect(fora).toContain("Trimandala");
    expect(fora).not.toContain("Palco 8x4");
    expect(arena.semPosicaoNaPlanta[0].item).toContain("Trimandala");
  });

  it("encontra pontos por nome, número da legenda ou item da ata", () => {
    expect(buscarPontos(arena.pontos, "medica").map((p) => p.id)).toContain("tenda-medica");
    expect(buscarPontos(arena.pontos, "12").map((p) => p.id)).toContain("guarda-volumes");
    expect(buscarPontos(arena.pontos, "banheiro")).toHaveLength(1);
  });
});

describe("conferência planta × ata", () => {
  it("lista as 11 divergências, cada uma apontando para pontos que existem", () => {
    const lista = divergenciasDaArena(arena);
    expect(lista).toHaveLength(11);
    const ids = new Set(arena.pontos.map((p) => p.id));
    for (const d of lista) {
      expect(d.pontoIds.length).toBeGreaterThan(0);
      for (const id of d.pontoIds) expect(ids.has(id)).toBe(true);
    }
    expect(lista[0].tipo).toBe("quantidade");
    expect(lista[lista.length - 1].tipo).toBe("sem-cota");
    expect(divergenciasDoPonto(arena, "palco").map((d) => d.id)).toEqual(["geradores"]);
  });

  it("a derivação por texto (compatibilidade) encontra os mesmos pontos", () => {
    const declaradas = new Set(arena.divergencias!.flatMap((d) => d.pontoIds));
    const derivadas = new Set(derivarDivergencias({ ...arena, divergencias: undefined }).flatMap((d) => d.pontoIds));
    expect([...derivadas].sort()).toEqual([...declaradas].sort());
    expect(derivarDivergencias({ ...arena, divergencias: undefined })).toHaveLength(11);
  });

  it("grupos de camadas cobrem cada camada uma única vez", () => {
    const agrupadas = GRUPOS_CAMADAS.flatMap((g) => g.camadas);
    expect([...agrupadas].sort()).toEqual(CAMADAS.map((c) => c.id).sort());
    expect(camadasEssenciais().publico).toBe(false);
  });
});

describe("geometria", () => {
  it("interpola início, fim e direção", () => {
    const eixo = arena.percurso.trechos[0].eixo;
    expect(pontoNaDistancia(eixo, 0).ponto).toEqual(eixo[0]);
    expect(pontoNaDistancia(eixo, 1e9).ponto).toEqual(eixo[eixo.length - 1]);
    expect(amostrar(eixo, 50)).toHaveLength(50);
    // Só os corredores dentro da planta (largada, via norte, chegada): cerca de 790 m.
    expect(comprimentoPercurso(arena)).toBeGreaterThan(600);
  });

  it("faixa tem o dobro de pontos do eixo e envolve o eixo", () => {
    const eixo = arena.currais[1].eixo;
    expect(poligonoFaixa(eixo, 9)).toHaveLength(eixo.length * 2);
  });

  it("enquadra chegada, largada e marco", () => {
    const l = limitesArena(arena, 0);
    expect(l.minX).toBeLessThan(-500);
    expect(l.maxX).toBeGreaterThan(140);
    expect(l.minZ).toBeLessThanOrEqual(-101);
  });
});

describe("posições editadas na Arena 3D", () => {
  it("mover desloca o ponto e as estruturas juntos, sem mudar a arena original", async () => {
    const { aplicarPosicoes } = await import("./posicoes");
    const p = arena.pontos.find((x) => x.modelos.length > 0)!;
    const alvo: [number, number] = [p.posicao[0] + 10, p.posicao[1] - 5];
    const nova = aplicarPosicoes(arena, [{ chave: p.id, tipo: "MOVER", nome: null, categoria: null, rotuloTipo: null, itemAta: null, x: alvo[0], z: alvo[1] }]);
    const movido = nova.pontos.find((x) => x.id === p.id)!;
    expect(movido.posicao).toEqual([Math.round(alvo[0] * 10) / 10, Math.round(alvo[1] * 10) / 10]);
    expect(movido.modelos[0].posicao[0] - p.modelos[0].posicao[0]).toBeCloseTo(10, 0);
    expect(arena.pontos.find((x) => x.id === p.id)!.posicao).toEqual(p.posicao);
  });

  it("ponto novo de linha da ata sai de 'sem posição'", async () => {
    const { aplicarPosicoes, chaveItemAta, chavePontoNovo } = await import("./posicoes");
    const fora = itensNaoPosicionados(arena)[0];
    const nova = aplicarPosicoes(arena, [{ chave: chavePontoNovo("ata", chaveItemAta(fora)), tipo: "NOVO", nome: fora.item, categoria: null, rotuloTipo: null, itemAta: chaveItemAta(fora), x: 1, z: 2 }]);
    expect(itensNaoPosicionados(nova).some((i) => chaveItemAta(i) === chaveItemAta(fora))).toBe(false);
    expect(nova.pontos.length).toBe(arena.pontos.length + 1);
  });

  it("ponto novo da legenda da planta sai da lista da planta", async () => {
    const { aplicarPosicoes, chavePontoNovo } = await import("./posicoes");
    const item = arena.semPosicaoNaPlanta[0];
    if (!item) return;
    const nova = aplicarPosicoes(arena, [{ chave: chavePontoNovo("planta", item.item), tipo: "NOVO", nome: item.item, categoria: "operacao", rotuloTipo: null, itemAta: null, x: 0, z: 0 }]);
    expect(nova.semPosicaoNaPlanta.some((s) => s.item === item.item)).toBe(false);
  });
});
