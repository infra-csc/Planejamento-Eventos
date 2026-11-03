import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { calcularOS, diffOS, ehAreaKit, osIguais, osParaLeitura, resumoVersaoOs, totalPecas, type LinhaAta } from "./os";
import { consolidar } from "./consolidacao";
import { montarAtaLista } from "@/server/export/ata-lista";
import { pastaMateriaisKit } from "@/server/export/os-kit-xlsx";

const lona = { id: "p-lona", codigo: "TND5-LONA", nome: "Lona de tenda 5×5", setor: "TENDA" as const, unidade: "un" };
const tenda = { codigo: "PRJ-T", nome: "Tenda 5×5 m", versao: 1, bom: [{ pecaId: "p-lona", codigo: "TND5-LONA", nome: "Lona de tenda 5×5", setor: "TENDA" as const, unidade: "un", quantidade: 1 }] };
const projeto = (id: string, quantidade: number, areaNome: string | null, destino: string | null): LinhaAta => ({ id, tipo: "PROJETO", quantidade, destino, areaNome, projeto: tenda });
const solta = (id: string, quantidade: number, areaNome: string | null): LinhaAta => ({ id, tipo: "PECA", quantidade, destino: null, areaNome, peca: lona });
const fora = (id: string, quantidade: number, areaNome: string | null): LinhaAta => ({ id, tipo: "AVULSO", quantidade, destino: "Kit", areaNome, descricaoLivre: "Saco de brinde" });

describe("Materiais KIT (03/11: outro local de entrega, lista à parte)", () => {
  it("reconhece a área pelo nome, em qualquer caixa", () => {
    expect(["Kit", "KIT", " kit "].every(ehAreaKit)).toBe(true);
    expect(["Ativação", "Kit de montagem", "", null, undefined].some(ehAreaKit)).toBe(false);
  });

  it("o pedido do Kit sai da lista geral: não soma com a mesma peça das outras áreas", () => {
    const os = calcularOS([projeto("a", 3, "Ativação", "Arena"), projeto("k", 2, "Kit", "Kit"), fora("f", 5, "Kit")]);
    expect(os.setores[0].linhas[0].total).toBe(3);
    expect(os.projetos?.map((p) => p.quantidade)).toEqual([3]);
    expect(os.semSetor).toEqual([]);
    expect(os.kit?.setores[0].linhas[0].total).toBe(2);
    expect(os.kit?.projetos?.map((p) => p.destino)).toEqual(["Kit"]);
    expect(os.kit?.semSetor.map((a) => a.descricao)).toEqual(["Saco de brinde"]);
  });

  it("sem pedido do Kit, a OS fica igual à de antes (sem o bloco)", () => {
    expect(calcularOS([projeto("a", 3, "Ativação", null)])).not.toHaveProperty("kit");
    expect(calcularOS([projeto("k", 0, "Kit", null)])).not.toHaveProperty("kit");
  });

  it("mudança só no Kit é mudança da OS: gera versão e aparece no resumo, marcada", () => {
    const antes = calcularOS([projeto("a", 3, "Ativação", null), projeto("k", 2, "Kit", null)]);
    const depois = calcularOS([projeto("a", 3, "Ativação", null), projeto("k", 4, "Kit", null)]);
    expect(osIguais(antes, depois)).toBe(false);
    expect(diffOS(antes, depois)).toEqual([expect.objectContaining({ codigo: "TND5-LONA", nome: "Lona de tenda 5×5 (Kit)", antes: 2, depois: 4, kit: true })]);
    expect(resumoVersaoOs(antes, depois)).toBe("Kit TND5-LONA +2");
    expect(osIguais(calcularOS([fora("f", 1, "Kit")]), calcularOS([fora("f", 2, "Kit")]))).toBe(false);
  });

  it("passar um pedido para o Kit aparece como saiu de um lado e entrou no outro, sem mudar o total", () => {
    const antes = calcularOS([projeto("x", 2, "Ativação", null)]);
    const depois = calcularOS([projeto("x", 2, "Kit", null)]);
    expect(diffOS(antes, depois).map((d) => [d.kit ?? false, d.antes, d.depois]).sort()).toEqual([
      [false, 2, 0],
      [true, 0, 2],
    ]);
    expect(totalPecas(antes)).toBe(totalPecas(depois));
  });

  it("a leitura trata a lista do Kit como a geral (prisma comum fora)", () => {
    const prisma = { ...lona, id: "p-prisma", codigo: "PRISMA", nome: "Prisma" };
    const os = osParaLeitura(calcularOS([{ ...solta("k", 2, "Kit"), peca: prisma }, solta("k2", 1, "Kit")]));
    expect(os.kit?.setores.flatMap((s) => s.linhas.map((l) => l.codigo))).toEqual(["TND5-LONA"]);
  });

  it("a consolidação de estoque continua contando o que vai para o Kit", () => {
    const os = calcularOS([projeto("a", 3, "Ativação", null), projeto("k", 2, "Kit", null)]);
    const [p] = consolidar(
      [{ id: "e", codigo: "EVT", nome: "Evento", dataMontagem: "2026-11-10", dataDesmontagem: "2026-11-12", os, projetado: {} }],
      [{ id: "p-lona", codigo: "TND5-LONA", nome: "Lona", setor: "TENDA", unidade: "un", estoqueProprio: 10 }] as never,
      { inicio: "2026-11-10", fim: "2026-11-12" },
    );
    expect(p.pico).toBe(5);
  });

  it("a lista de materiais da ata traz o Kit em seção própria, fora das outras", () => {
    const d = montarAtaLista(calcularOS([projeto("k", 2, "Kit", "Kit")]));
    expect(d.kit.titulo).toBe("MATERIAIS KIT");
    expect(d.kit.linhas).toEqual([{ item: "Lona de tenda 5×5", quantidade: 2, obs: "Tenda 5×5 m · Kit × 2" }]);
    expect(montarAtaLista(calcularOS([projeto("a", 2, "Ativação", null)])).kit.linhas).toEqual([]);
  });

  it("o Excel traz só o Kit, com local e coluna de separação", async () => {
    const os = calcularOS([projeto("a", 9, "Ativação", "Arena"), projeto("k", 2, "Kit", "Kit"), fora("f", 5, "Kit")]);
    const wb = pastaMateriaisKit({ codigo: "EVT-1", nome: "Evento", dataInicio: "2026-11-10", dataFim: "2026-11-10" }, os.kit!, {}, "v1", "Fulano", "03/11/2026 10:00");
    const lido = new ExcelJS.Workbook();
    await lido.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const ws = lido.getWorksheet("Materiais KIT")!;
    const celulas: unknown[][] = [];
    ws.eachRow((r) => celulas.push((r.values as unknown[]).slice(1)));
    const lona5 = celulas.find((c) => c[1] === "Lona de tenda 5×5")!;
    expect(lona5.slice(2, 6)).toEqual([2, "un", "Kit", "☐"]);
    expect(celulas.find((c) => c[1] === "Saco de brinde")?.slice(0, 5)).toEqual(["Fora do catálogo", "Saco de brinde", 5, "un", "Kit"]);
    expect(celulas.flat()).not.toContain(9);
  });
});
