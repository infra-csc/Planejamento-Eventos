import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { abaOsMarcenaria } from "./os-marcenaria-xlsx";
import type { OsMarcenaria } from "./os-marcenaria";

// PNG de 1×1 px (a foto real vem do anexo; aqui só importa a escala).
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

describe("OS de marcenaria em Excel (31/10: sem código e sem observação, foto maior)", () => {
  const dados: OsMarcenaria = {
    semProjetos: false,
    totalPecas: 14,
    secoes: [
      {
        nome: "STANDS",
        itens: [
          {
            item: "STAND 9×6 M (4 UNID)",
            projetoCodigo: "PRJ-S",
            pecas: [
              { nome: "COLUNA FRONTAL DE STAND 4X40", quantidade: 8, referencia: "COL-FRONTAL", observacao: null },
              { nome: "TESTEIRA DE STAND 9 M", quantidade: 4, referencia: "TESTEIRA-9M", observacao: "Credenciamento" },
            ],
          },
        ],
      },
    ],
  } as OsMarcenaria;

  it("colunas ITEM, PEÇAS, QUANTIDADE e FOTO; o local vai junto da peça", () => {
    const wb = new ExcelJS.Workbook();
    const ws = abaOsMarcenaria(wb, { nome: "Evento", dataCarga: null, responsavelEvento: "Fulano" }, dados);
    const cabecalho = [2, 3, 4, 5, 6].map((c) => ws.getCell(9, c).value);
    expect(cabecalho).toEqual(["ITEM", "PEÇAS", "QUANTIDADE", "FOTO", null]);
    expect(ws.getCell(10, 3).value).toBe("COLUNA FRONTAL DE STAND 4X40");
    expect(ws.getCell(11, 3).value).toBe("TESTEIRA DE STAND 9 M (Credenciamento)");
    expect(ws.getCell(10, 4).value).toBe(8);
    // Nenhuma célula com o código da peça.
    for (let r = 1; r <= 12; r++) for (let c = 1; c <= 7; c++) expect(String(ws.getCell(r, c).value ?? "")).not.toMatch(/COL-FRONTAL|TESTEIRA-9M/);
  });

  it("foto bem maior que a miniatura antiga (104 × 72 px), na coluna FOTO", () => {
    const wb = new ExcelJS.Workbook();
    const imagem = { buffer: png, extension: "png" as const, largura: 400, altura: 300 };
    const ws = abaOsMarcenaria(wb, { nome: "Evento", dataCarga: null, responsavelEvento: "Fulano" }, dados, {
      pecas: new Map([["COL-FRONTAL", imagem]]),
      projetos: new Map(),
    });
    const [img] = ws.getImages();
    expect(Math.floor(Number(img.range.tl.col))).toBe(4);
    const ext = (img.range as unknown as { ext: { width: number; height: number } }).ext;
    expect(ext.height).toBe(140);
    expect(ext.width).toBeGreaterThan(104);
    expect(ws.getRow(10).height).toBe(110);
  });
  it("seção sem item não aparece (ATIVAÇÃO e MESAS vazias saíam com uma linha em branco)", () => {
    const comVazias = { ...dados, secoes: [{ nome: "MESAS", itens: [] }, ...dados.secoes, { nome: "ATIVAÇÃO", itens: [] }] } as OsMarcenaria;
    const ws = abaOsMarcenaria(new ExcelJS.Workbook(), { nome: "Evento", dataCarga: null, responsavelEvento: "Fulano" }, comVazias);
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => textos.push(String(c.value ?? ""))));
    expect(textos).toContain("STANDS");
    expect(textos).not.toContain("MESAS");
    expect(textos).not.toContain("ATIVAÇÃO");
  });
});
