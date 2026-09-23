import { describe, expect, it } from "vitest";
import { ARENA_ECO_RUN_SP_2026 as arena, ATA_ECO_RUN_SP } from "../../../scripts/dados/arena-eco-run-sp-2026";
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

describe("giro na edição do mapa", () => {
  it("MOVER com giro gira as estruturas em torno do ponto e soma a rotação dos modelos", async () => {
    const { aplicarPosicoes, girarVec } = await import("./posicoes");
    const p = arena.pontos.find((x) => x.modelos.length > 1 && x.modelos.some((m) => m.posicao[0] !== x.posicao[0] || m.posicao[1] !== x.posicao[1]))!;
    const giro = Math.PI / 2;
    const nova = aplicarPosicoes(arena, [{ chave: p.id, tipo: "MOVER", nome: null, categoria: null, rotuloTipo: null, itemAta: null, x: p.posicao[0] + 20, z: p.posicao[1], rotacao: giro }]);
    const girado = nova.pontos.find((x) => x.id === p.id)!;
    expect(girado.rotacao).toBe(giro);
    girado.modelos.forEach((m, i) => {
      const antes = p.modelos[i];
      const [rx, rz] = girarVec([antes.posicao[0] - p.posicao[0], antes.posicao[1] - p.posicao[1]], giro);
      expect(m.posicao[0]).toBeCloseTo(girado.posicao[0] + rx, 0);
      expect(m.posicao[1]).toBeCloseTo(girado.posicao[1] + rz, 0);
      // Distância ao ponto preservada: gira junto, não deforma.
      expect(Math.hypot(m.posicao[0] - girado.posicao[0], m.posicao[1] - girado.posicao[1])).toBeCloseTo(Math.hypot(antes.posicao[0] - p.posicao[0], antes.posicao[1] - p.posicao[1]), 0);
      if (m.tipo !== "espaco" && antes.tipo !== "espaco") {
        const esperado = (antes.rotacao ?? 0) + giro;
        expect(Math.cos(m.rotacao ?? 0)).toBeCloseTo(Math.cos(esperado), 5);
        expect(Math.sin(m.rotacao ?? 0)).toBeCloseTo(Math.sin(esperado), 5);
      }
    });
    expect(girado.observacoes.some((o) => o.includes("90° anti-horário"))).toBe(true);
    expect(p.rotacao).toBeUndefined();
  });

  it("sem giro, mover não mexe na orientação dos modelos", async () => {
    const { aplicarPosicoes } = await import("./posicoes");
    const p = arena.pontos.find((x) => x.modelos.some((m) => m.tipo !== "espaco"))!;
    for (const rotacao of [null, undefined, 0]) {
      const nova = aplicarPosicoes(arena, [{ chave: p.id, tipo: "MOVER", nome: null, categoria: null, rotuloTipo: null, itemAta: null, x: p.posicao[0], z: p.posicao[1] + 3, rotacao }]);
      const movido = nova.pontos.find((x) => x.id === p.id)!;
      expect(movido.modelos.map((m) => ("rotacao" in m ? m.rotacao : undefined))).toEqual(p.modelos.map((m) => ("rotacao" in m ? m.rotacao : undefined)));
    }
  });

  it("NOVO guarda o giro no ponto", async () => {
    const { aplicarPosicoes } = await import("./posicoes");
    const nova = aplicarPosicoes(arena, [{ chave: "novo:livre:abc", tipo: "NOVO", nome: "Grade / barreira", categoria: "operacao", rotuloTipo: null, itemAta: null, x: 5, z: 6, rotacao: -0.5 }]);
    expect(nova.pontos.find((x) => x.id === "novo:livre:abc")!.rotacao).toBe(-0.5);
  });

  it("gira no mesmo sentido do three.js e normaliza o ângulo", async () => {
    const { girarVec, normalizarAngulo, descreverGiro } = await import("./posicoes");
    // rotation.y positivo leva o leste (+x) para o norte (−z): anti-horário visto de cima.
    const [x, z] = girarVec([1, 0], Math.PI / 2);
    expect(x).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(-1, 9);
    expect(normalizarAngulo(Math.PI * 2 + 0.25)).toBeCloseTo(0.25, 6);
    expect(normalizarAngulo(-Math.PI - 0.1)).toBeCloseTo(Math.PI - 0.1, 6);
    // 24 passos de 15° dão a volta sem resíduo.
    let a = 0;
    for (let i = 0; i < 24; i++) a = normalizarAngulo(a + Math.PI / 12);
    expect(Math.abs(a)).toBeLessThan(1e-5);
    expect(descreverGiro(Math.PI / 6)).toBe("30° anti-horário");
    expect(descreverGiro(-Math.PI / 12)).toBe("15° horário");
    expect(descreverGiro(0)).toBeNull();
  });
});

describe("régua e quantidades", () => {
  it("formata a distância: inteira no mapa (uma casa abaixo de 10 m) e com uma casa na barra", async () => {
    const { distancia, distanciaPrecisa, rotuloDistancia } = await import("./posicoes");
    expect(distancia([0, 0], [30, 40])).toBe(50);
    expect(rotuloDistancia(38.2)).toBe("38 m");
    expect(rotuloDistancia(7.46)).toBe("7,5 m");
    expect(rotuloDistancia(9.97)).toBe("10 m");
    expect(rotuloDistancia(1234.4)).toBe("1.234 m");
    expect(distanciaPrecisa(38.24)).toBe("38,2 m");
    expect(distanciaPrecisa(1234.56)).toBe("1.234,6 m");
  });

  it("soma as quantidades da ata do ponto e ignora linhas sem quantidade", async () => {
    const { quantidadeAta } = await import("./posicoes");
    const item = (quantidade: number | null) => ({ secao: "X", item: `i${quantidade}`, quantidade });
    expect(quantidadeAta({ itensAta: [item(40), item(3), item(null)] })).toBe(43);
    expect(quantidadeAta({ itensAta: [item(null)] })).toBeNull();
    expect(quantidadeAta({ itensAta: [] })).toBeNull();
  });
});

describe("formas dos itens acrescentados", () => {
  it("cada atalho de Adicionar ao mapa tem forma; o resto vira marcador ou fica só no pino", async () => {
    const { formaDoPonto, formaPeloNome } = await import("./categorias");
    const esperado: Record<string, string> = {
      Árvore: "arvore",
      Bueiro: "bueiro",
      Poste: "poste",
      "Desnível / rampa": "rampa",
      "Grade / barreira": "grade",
      "Tenda extra": "tenda",
      "Banheiro químico": "banheiro",
      "Ponto de energia": "energia",
    };
    for (const [nome, forma] of Object.entries(esperado)) expect(formaPeloNome(nome)).toBe(forma);
    const base = { modelos: [], categoria: "operacao" as const };
    expect(formaDoPonto({ ...base, id: "novo:livre:1", nome: "Caixa de concreto da prefeitura" })).toBe("marcador");
    expect(formaDoPonto({ ...base, id: "novo:ata:X|y", nome: "Cochos para água", categoria: "obstaculo" })).toBe("marcador");
    expect(formaDoPonto({ ...base, id: "novo:ata:X|y", nome: "Cochos para água" })).toBeNull();
    // Ponto da planta nunca ganha forma genérica: o que ele tem é o modelo (ou só o pino).
    expect(formaDoPonto({ ...base, id: "palco", nome: "Árvore" })).toBeNull();
    const comModelo = arena.pontos.find((p) => p.modelos.length > 0)!;
    expect(formaDoPonto({ ...comModelo, id: "novo:livre:2", nome: "Árvore" })).toBeNull();
  });
});

describe("rótulos sem sobreposição", () => {
  it("fica o de maior prioridade, respeita a margem e não cobre pino alheio", async () => {
    const { rotulosSemSobreposicao, PRIORIDADE_ROTULO: P } = await import("./categorias");
    const caixa = (id: string, x0: number, prioridade: number, desempate = 0) => ({ id, x0, y0: 0, x1: x0 + 50, y1: 14, prioridade, desempate });
    // Selecionado entra sempre; o comum que encosta nele (dentro da margem) sai.
    expect([...rotulosSemSobreposicao([caixa("a", 0, P.comum), caixa("b", 53, P.selecionado)])]).toEqual(["b"]);
    // Longe o bastante, os dois ficam.
    expect(rotulosSemSobreposicao([caixa("a", 0, P.comum), caixa("b", 60, P.comum)]).size).toBe(2);
    // Foco vence principal; entre iguais, o mais perto (menor desempate).
    expect([...rotulosSemSobreposicao([caixa("p", 0, P.principal), caixa("f", 20, P.foco)])]).toEqual(["f"]);
    expect([...rotulosSemSobreposicao([caixa("longe", 0, P.comum, 0.9), caixa("perto", 20, P.comum, 0.1)])]).toEqual(["perto"]);
    // Rótulo em cima do pino de outro ponto não aparece; o próprio pino não conta.
    const pinos = [
      { id: "a", x0: -8, y0: 10, x1: 8, y1: 30 },
      { id: "c", x0: 20, y0: 5, x1: 36, y1: 25 },
    ];
    expect(rotulosSemSobreposicao([caixa("a", 0, P.principal)], pinos).size).toBe(0);
    expect(rotulosSemSobreposicao([caixa("a", 0, P.principal)], pinos.slice(0, 1)).size).toBe(1);
    expect(rotulosSemSobreposicao([caixa("a", 0, P.selecionado)], pinos).size).toBe(1);
  });

  it("nenhum par de rótulos aceitos se sobrepõe, com qualquer disposição", async () => {
    const { rotulosSemSobreposicao } = await import("./categorias");
    let semente = 7;
    const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
    const rotulos = Array.from({ length: 120 }, (_, i) => {
      const x0 = rnd() * 600;
      const y0 = rnd() * 400;
      return { id: String(i), x0, y0, x1: x0 + 30 + rnd() * 80, y1: y0 + 14, prioridade: 1 + Math.floor(rnd() * 3) };
    });
    const aceitos = rotulosSemSobreposicao(rotulos);
    const lista = rotulos.filter((r) => aceitos.has(r.id));
    expect(lista.length).toBeGreaterThan(10);
    for (const a of lista) for (const b of lista) if (a !== b) expect(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0).toBe(false);
  });
});
