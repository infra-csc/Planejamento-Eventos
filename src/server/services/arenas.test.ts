import { describe, expect, it } from "vitest";
import { ARENA_ECO_RUN_SP_2026 } from "../../../scripts/dados/arena-eco-run-sp-2026";
import { ataDoEvento, copiarLayout, detectarMimeImagem, gerarSlugArena, layoutEmBranco, montarBaseArena } from "./arenas";

describe("gerarSlugArena", () => {
  it("tira acento, põe em minúsculas e troca o resto por hífen", () => {
    expect(gerarSlugArena("Eco Run — São Paulo 2026!", [])).toBe("eco-run-sao-paulo-2026");
    expect(gerarSlugArena("  Maratona   de Floripa ", [])).toBe("maratona-de-floripa");
  });

  it("sufixa -2, -3… quando já existe", () => {
    expect(gerarSlugArena("Corrida X", ["corrida-x"])).toBe("corrida-x-2");
    expect(gerarSlugArena("Corrida X", ["corrida-x", "corrida-x-2"])).toBe("corrida-x-3");
  });

  it("nunca usa o slug de uma arena fixa nem uma rota reservada", () => {
    expect(gerarSlugArena("Eco Run SP 2026", [])).toBe("eco-run-sp-2026-2");
    expect(gerarSlugArena("Nova", [])).toBe("nova-2");
  });

  it("nome sem letras vira 'arena'", () => {
    expect(gerarSlugArena("!!!", [])).toBe("arena");
  });
});

describe("detectarMimeImagem", () => {
  it("reconhece PNG, JPG e WebP pelos bytes", () => {
    expect(detectarMimeImagem(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectarMimeImagem(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectarMimeImagem(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("recusa o que não é imagem, mesmo com nome de imagem", () => {
    expect(detectarMimeImagem(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(detectarMimeImagem(new TextEncoder().encode("<svg xmlns"))).toBeNull();
    expect(detectarMimeImagem(new Uint8Array([]))).toBeNull();
  });
});

describe("ataDoEvento", () => {
  it("usa a área como seção e junta a mesma linha pedida para destinos diferentes", () => {
    const ata = ataDoEvento([
      { nome: "Tenda 3x3", quantidade: 2, destino: "Largada", areaNome: "Marketing" },
      { nome: "Tenda 3x3", quantidade: 3, destino: "Chegada", areaNome: "Marketing" },
      { nome: "Tenda 3x3", quantidade: 1, destino: null, areaNome: "Operações" },
      { nome: "Grade", quantidade: 40, destino: null, areaNome: null },
    ]);
    expect(ata).toEqual([
      { secao: "Marketing", item: "Tenda 3x3", quantidade: 5, detalhe: "Largada · Chegada" },
      { secao: "Operações", item: "Tenda 3x3", quantidade: 1 },
      { secao: "Logística", item: "Grade", quantidade: 40 },
    ]);
  });
});

describe("layout da arena nova", () => {
  it("área em branco centrada no marco", () => {
    const l = layoutEmBranco(300, 200);
    expect(l.area).toEqual({ minX: -150, maxX: 150, minZ: -100, maxZ: 100 });
    expect(l.pontos).toEqual([]);
    expect(l.zonas).toEqual([]);
  });

  it("copiar layout leva a geometria e solta os pontos da ata de origem", () => {
    const origem = ARENA_ECO_RUN_SP_2026;
    const alvo = origem.pontos[0];
    const l = copiarLayout(origem, [{ chave: alvo.id, tipo: "MOVER", nome: null, categoria: null, rotuloTipo: null, itemAta: null, x: alvo.posicao[0] + 10, z: alvo.posicao[1] }]);
    expect(l.zonas).toEqual(origem.zonas);
    expect(l.percurso).toEqual(origem.percurso);
    expect(l.pontos).toHaveLength(origem.pontos.length);
    expect(l.pontos[0].posicao[0]).toBeCloseTo(alvo.posicao[0] + 10, 1);
    for (const p of l.pontos) {
      expect(p.itensAta).toEqual([]);
      expect(p.observacoes).toEqual([]);
      expect(p.status).toBeNull();
    }
    // A origem não muda.
    expect(origem.pontos[0].posicao).toEqual(alvo.posicao);
    expect(origem.pontos.some((p) => p.itensAta.length > 0)).toBe(true);
  });

  it("base nova não carrega ata nem divergências da origem", () => {
    const base = montarBaseArena(
      "corrida-x",
      { codigo: "EVT-0042", nome: "Corrida X", cliente: "", local: "Parque", dataInicio: "2026-10-04", dataMontagem: "2026-10-02", dataReuniao: new Date("2026-09-20T13:00:00Z"), reuniaoPresentes: "Ana, Bruno; Carla", publicoEsperado: 3000, arenaDescarrega: null },
      copiarLayout(ARENA_ECO_RUN_SP_2026),
      "planta.png",
    );
    expect(base.slug).toBe("corrida-x");
    expect(base.evento.sku).toBe("EVT-0042");
    expect(base.evento.presentesReuniao).toEqual(["Ana", "Bruno", "Carla"]);
    expect(base.evento.montagem).toBe("Montagem a partir de 02/10/2026");
    expect(base.ata).toEqual([]);
    expect(base.divergencias).toEqual([]);
    expect(base.fonte.rotuloAta).toBe("Ata EVT-0042");
  });
});
