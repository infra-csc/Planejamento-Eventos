import { describe, expect, it } from "vitest";
import { aplicarCarregamento, chaveFora, linhasCarregamento, mudancasCarregamento, type AjusteCarregamento, type Carregamento } from "./carregamento";
import { calcularOS, type LinhaAta } from "./os";
import { montarOsEstrutura } from "@/server/export/os-estrutura";

const box = { pecaId: "p-box", codigo: "BOX-1000", nome: "Box truss 1 m", setor: "ESTRUTURA" as const, unidade: "un", quantidade: 4 };
const projeto = (id: string, quantidade: number, nome = "Stand"): LinhaAta => ({ id, tipo: "PROJETO", quantidade, destino: null, areaNome: "Produção", projeto: { codigo: `PRJ-${nome}`, nome, versao: 1, bom: [box] } });
const solta = (id: string, quantidade: number): LinhaAta => ({ id, tipo: "PECA", quantidade, destino: "Arena", areaNome: "Produção", peca: { id: "p-box", codigo: "BOX-1000", nome: "Box truss 1 m", setor: "ESTRUTURA", unidade: "un" } });
const fora = (quantidade: number): LinhaAta => ({ id: "f", tipo: "AVULSO", quantidade, destino: "GV", areaNome: "Produção", descricaoLivre: "Lona especial" });
const ajuste = (chave: string, carregado: number, parcial: Partial<AjusteCarregamento> = {}): Carregamento => ({
  [chave]: { chave, pecaId: "p-box", codigo: chave, nome: "Box truss 1 m", setor: "ESTRUTURA", unidade: "un", carregado, pedidoNaHora: 44, motivo: "Faltou no galpão", porNome: "Marina", em: "2026-11-04T10:00:00Z", ...parcial },
});

describe("carregamento: o que foi no caminhão, sem mudar a OS", () => {
  const os = calcularOS([projeto("a", 10), solta("s", 4), fora(3)]);

  it("sem ajuste, carregado é igual ao pedido e nada aparece como mudança", () => {
    const linhas = linhasCarregamento(os, {});
    expect(linhas.find((l) => l.chave === "BOX-1000")).toMatchObject({ pedido: 44, carregado: 44 });
    expect(mudancasCarregamento(linhas)).toEqual([]);
    expect(aplicarCarregamento(os, {})).toBe(os);
  });

  it("a linha mostra pedido e carregado lado a lado", () => {
    const linhas = linhasCarregamento(os, ajuste("BOX-1000", 30));
    expect(mudancasCarregamento(linhas).map((l) => [l.pedido, l.carregado, l.ajuste?.motivo])).toEqual([[44, 30, "Faltou no galpão"]]);
  });

  it("a OS original não é alterada", () => {
    const antes = JSON.stringify(os);
    aplicarCarregamento(os, ajuste("BOX-1000", 30));
    expect(JSON.stringify(os)).toBe(antes);
  });

  it("a folha sai com o carregado, e o total da SOMATORIA bate: tira primeiro das soltas, depois dos projetos", () => {
    const d = montarOsEstrutura(aplicarCarregamento(os, ajuste("BOX-1000", 30)));
    const linha = d.pecas.find((p) => p.codigo === "BOX-1000")!;
    expect(linha.total).toBe(30);
    const soma = d.somatoria.linhas.find((l) => l.rotulo === linha.rotulo)!;
    expect(soma.extras).toBe(0);
    expect(soma.porProjeto.reduce((a, b) => a + b, 0)).toBe(30);
  });

  it("corte só nas soltas não mexe no projeto", () => {
    const r = aplicarCarregamento(os, ajuste("BOX-1000", 42));
    expect(r.individuais?.[0].quantidade).toBe(2);
    expect(r.projetos?.[0].pecas[0].total).toBe(40);
  });

  it("zerado sai da folha", () => {
    const r = aplicarCarregamento(os, ajuste("BOX-1000", 0));
    expect(r.setores.flatMap((s) => s.linhas)).toEqual([]);
  });

  it("a mais soma no total e na peça solta", () => {
    const r = aplicarCarregamento(os, ajuste("BOX-1000", 50));
    expect(r.setores[0].linhas[0].total).toBe(50);
    expect(r.individuais?.reduce((a, x) => a + x.quantidade, 0)).toBe(10);
    expect(r.projetos?.[0].pecas[0].total).toBe(40);
  });

  it("item que a OS não tem entra como a mais, com pedido zero", () => {
    const nova = ajuste("CONE-G", 20, { pecaId: "p-cone", nome: "Cone grande", setor: "ARENA", pedidoNaHora: 0 });
    expect(mudancasCarregamento(linhasCarregamento(os, nova)).map((l) => [l.chave, l.pedido, l.carregado])).toEqual([["CONE-G", 0, 20]]);
    const r = aplicarCarregamento(os, nova);
    expect(r.setores.find((s) => s.setor === "ARENA")?.linhas[0]).toMatchObject({ codigo: "CONE-G", total: 20 });
  });

  it("item fora do catálogo também muda, pelo nome e local", () => {
    const chave = chaveFora("Lona especial", "GV");
    const r = aplicarCarregamento(os, { [chave]: { chave, pecaId: null, codigo: null, nome: "Lona especial · GV", setor: null, unidade: "un", carregado: 1, pedidoNaHora: 3, motivo: "Rasgou", porNome: "Marina", em: "" } });
    expect(r.semSetor[0].quantidade).toBe(1);
  });

  it("depois da mudança na OS, o ajuste continua e a linha sabe que o pedido era outro", () => {
    const depois = calcularOS([projeto("a", 12), solta("s", 4), fora(3)]);
    const l = linhasCarregamento(depois, ajuste("BOX-1000", 30)).find((x) => x.chave === "BOX-1000")!;
    expect(l).toMatchObject({ pedido: 52, carregado: 30 });
    expect(l.ajuste?.pedidoNaHora).toBe(44);
  });
});
