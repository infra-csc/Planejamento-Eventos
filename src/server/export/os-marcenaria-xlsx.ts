import type ExcelJS from "exceljs";
import { cabecalho, CINZA, dataCurta, escrever, tituloSecao } from "./cenografia-xlsx";
import type { OsMarcenaria } from "./os-marcenaria";
import type { Imagem } from "./os-estrutura-xlsx";

/** Fotos da OS de marcenaria: da peça (por código) e, quando a peça não tem, a do projeto na 1ª linha do item. */
export type FotosMarcenaria = { pecas: ReadonlyMap<string, Imagem>; projetos: ReadonlyMap<string, Imagem> };

/** Miniatura na coluna FOTO: cabe numa linha de 60 pt (80 px), proporcional. */
const FOTO_ALTURA = 72;
const FOTO_LARGURA_MAX = 104;

/*
 * Desenho da OS de marcenaria (aba O.S) no modelo da planilha da cenografia. Sem banco nem auth:
 * a rota /api/os/[id]/marcenaria monta os dados e chama daqui.
 */

export type CabecalhoMarcenaria = { nome: string; dataCarga: string | null; responsavelEvento: string };

export function abaOsMarcenaria(wb: ExcelJS.Workbook, cab: CabecalhoMarcenaria, d: OsMarcenaria, fotos?: FotosMarcenaria) {
  const ws = wb.addWorksheet("O.S", { views: [{ showGridLines: false }] });
  // Coluna FOTO por último: quem carrega reconhece a peça pela imagem quando o nome confunde.
  [2, 34, 44, 14, 16, 26, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const idsImagem = new Map<Imagem, number>();
  const foto = (r: number, imagem: Imagem | undefined) => {
    if (!imagem) return;
    let id = idsImagem.get(imagem);
    if (id === undefined) {
      id = wb.addImage({ buffer: imagem.buffer as unknown as ExcelJS.Buffer, extension: imagem.extension });
      idsImagem.set(imagem, id);
    }
    const escala = Math.min(FOTO_ALTURA / imagem.altura, FOTO_LARGURA_MAX / imagem.largura);
    ws.getRow(r).height = 60;
    ws.addImage(id, { tl: { col: 6.06, row: r - 1 + 0.05 }, ext: { width: Math.round(imagem.largura * escala), height: Math.round(imagem.altura * escala) } });
  };

  escrever(ws, 2, 2, "O.S DE MARCENARIA", { bold: true, tamanho: 14, semBorda: true });
  const linhas: Array<[string, string]> = [
    ["EVENTO", cab.nome],
    ["DATA DA CARGA", dataCurta(cab.dataCarga)],
    ["RESPONSÁVEL DA CARGA", ""],
    ["RESPONSÁVEL DO EVENTO", cab.responsavelEvento],
  ];
  linhas.forEach(([k, val], i) => {
    escrever(ws, 3 + i, 4, k, { bold: true, fill: CINZA });
    escrever(ws, 3 + i, 5, val, { wrap: false });
    ws.mergeCells(3 + i, 5, 3 + i, 6);
  });

  let r = 8;
  for (const s of d.secoes) {
    tituloSecao(ws, r, 2, s.nome, 7);
    r++;
    cabecalho(ws, r, 2, ["ITEM", "PEÇAS", "QUANTIDADE", "REFERENCIA", "OBSERVAÇÃO", "FOTO"], 3);
    r++;
    if (s.itens.length === 0) {
      for (let c = 2; c <= 7; c++) escrever(ws, r, c, null);
      r++;
    }
    for (const it of s.itens) {
      it.pecas.forEach((p, k) => {
        escrever(ws, r, 2, k === 0 ? it.item : null, { bold: k === 0 });
        escrever(ws, r, 3, p.nome);
        escrever(ws, r, 4, p.quantidade);
        escrever(ws, r, 5, p.referencia);
        escrever(ws, r, 6, p.observacao);
        escrever(ws, r, 7, null);
        foto(r, (p.referencia ? fotos?.pecas.get(p.referencia) : undefined) ?? (k === 0 && it.projetoCodigo ? fotos?.projetos.get(it.projetoCodigo) : undefined));
        r++;
      });
      if (it.pecas.length > 1) ws.mergeCells(r - it.pecas.length, 2, r - 1, 2);
    }
  }
  if (d.semProjetos) {
    ws.getCell(r + 1, 2).value = "Versão gravada antes da visão por projeto: as peças de marcenaria não aparecem por projeto. Abra a versão atual.";
    ws.getCell(r + 1, 2).font = { italic: true, size: 9 };
  }
  return ws;
}
