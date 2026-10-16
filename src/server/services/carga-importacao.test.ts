/**
 * Importação em lote: o modelo gerado pelo sistema, preenchido como uma pessoa faria no Excel, volta
 * pela conferência e pela importação; importar de novo não duplica; só logística e administrador.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import ExcelJS from "exceljs";
import { COLUNAS_CARGA, rotuloEventoModelo } from "@/domain/carga-importacao";
import { montarModeloCarga } from "@/server/export/carga-modelo";
import { migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { listarCarga } from "./carga-descarga";
import { importarVeiculosCarga, previaImportacaoCarga } from "./carga-importacao";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

const col = (chave: string) => COLUNAS_CARGA.findIndex((c) => c.chave === chave) + 1;

/** Baixa o modelo, preenche as linhas (a partir da 3) e devolve o arquivo como a pessoa enviaria. */
async function planilhaPreenchida(linhas: Array<Record<string, ExcelJS.CellValue>>) {
  const { eventos } = await listarCarga(E.logistica);
  const modelo = await montarModeloCarga(eventos, "2026-10-16").xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(modelo as ArrayBuffer);
  const ws = wb.getWorksheet("Veículos")!;
  linhas.forEach((l, i) => {
    for (const [k, v] of Object.entries(l)) ws.getCell(3 + i, col(k)).value = v;
  });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("importação de carga por planilha", () => {
  it("modelo → conferência → importação; reimportar não duplica", async () => {
    const ev = await novoEvento(E.logistica);
    const evento = (await listarCarga(E.logistica, { eventoId: ev.id })).eventos[0];

    // O modelo traz o evento na aba Eventos (de onde vem a lista suspensa).
    const modelo = new ExcelJS.Workbook();
    await modelo.xlsx.load((await montarModeloCarga([{ ...evento, ativo: true }], "2026-10-16").xlsx.writeBuffer()) as ArrayBuffer);
    expect(modelo.getWorksheet("Eventos")!.getCell("A2").value).toBe(rotuloEventoModelo(evento));
    expect(modelo.getWorksheet("Veículos")!.getCell(2, 1).value).toBe("Evento *");

    const arquivo = await planilhaPreenchida([
      {
        evento: rotuloEventoModelo(evento),
        tipo: "carreta",
        ident: "ABC-1234",
        quantidade: 2,
        idaTags: "kit, estrutura",
        idaInicioCarga: new Date("2026-10-16T08:00:00Z"),
        idaFimCarga: "16/10/2026 12:30",
        voltaFimCarga: "18/10/2026 20:00",
        voltaDescarga: new Date("2026-10-19T09:00:00Z"),
      },
      { evento: evento.codigo, tipo: "toco", voltaDescartar: "sim", idaFimCarga: "17/10/2026 10:00" },
      { evento: evento.codigo, tipo: "van", idaFimCarga: "17/10/2026" },
    ]);

    const previa = await previaImportacaoCarga(E.logistica, arquivo);
    expect(previa.linhas.map((l) => [l.linha, l.novos, l.erros.length])).toEqual([
      [3, 2, 0],
      [4, 1, 0],
      [5, 0, 2],
    ]);
    expect(previa.linhas[2].erros.join(" ")).toMatch(/Tipo.*Ida: fim da carga: falta a hora/);
    expect(previa.linhas[0].veiculo).toMatchObject({ tipo: "carreta", ida: { fimCarga: "2026-10-16T12:30", tags: ["kit", "estrutura"] }, volta: { tags: ["kit", "estrutura"], descargaGalpao: "2026-10-19T09:00" } });

    const validas = previa.linhas.filter((l) => !l.erros.length).map((l) => ({ linha: l.linha, eventoId: l.eventoId!, veiculo: l.veiculo!, quantidade: l.quantidade }));
    expect(await importarVeiculosCarga(E.logistica, validas)).toMatchObject({ criados: 3, ignorados: 0 });
    expect((await listarCarga(E.logistica, { eventoId: ev.id })).veiculos.map((v) => v.tipo).sort()).toEqual(["carreta", "carreta", "toco"]);

    // A mesma planilha de novo: a conferência mostra "já cadastrado" e a importação não cria nada.
    const denovo = await previaImportacaoCarga(E.logistica, arquivo);
    expect(denovo.linhas.slice(0, 2).map((l) => [l.novos, l.jaExistiam])).toEqual([
      [0, 2],
      [0, 1],
    ]);
    expect(await importarVeiculosCarga(E.logistica, validas)).toMatchObject({ criados: 0, ignorados: 3 });
    expect((await listarCarga(E.logistica, { eventoId: ev.id })).veiculos).toHaveLength(3);
  });

  it("só logística e administrador; arquivo que não é do modelo tem mensagem clara", async () => {
    const arquivo = await planilhaPreenchida([]);
    await expect(previaImportacaoCarga(E.requisitante, arquivo)).rejects.toThrow();
    await expect(previaImportacaoCarga(E.admin, arquivo)).rejects.toThrow(/nenhuma linha preenchida/);
    await expect(previaImportacaoCarga(E.logistica, new TextEncoder().encode("não é xlsx").buffer as ArrayBuffer)).rejects.toThrow(/Não consegui abrir/);
    const outra = new ExcelJS.Workbook();
    outra.addWorksheet("Plan1").addRow(["Nome", "Valor"]);
    await expect(previaImportacaoCarga(E.logistica, (await outra.xlsx.writeBuffer()) as ArrayBuffer)).rejects.toThrow(/aba Veículos/);
  });
});
