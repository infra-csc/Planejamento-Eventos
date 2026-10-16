import ExcelJS from "exceljs";
import { COLUNAS_CARGA, MAX_LINHAS_IMPORTACAO, MAX_QUANTIDADE, rotuloEventoModelo } from "@/domain/carga-importacao";
import type { EventoCarga } from "@/domain/carga-descarga";
import { COR, textoSeguro } from "./excel";

/** Cor de cada grupo de colunas (o mesmo azul/laranja do calendário: ↑ carga, ↓ descarga). */
const GRUPO = { Veículo: { fundo: COR.escuro, claro: "FFF3EEEF" }, Ida: { fundo: "FF2F5D86", claro: "FFEAF1F7" }, Volta: { fundo: "FF9A5B12", claro: "FFFBF1E4" } } as const;
const PRIMEIRA = 3;
const ULTIMA = PRIMEIRA + MAX_LINHAS_IMPORTACAO - 1;
const letra = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/**
 * Modelo para subir veículos de carga em lote: aba "Veículos" (uma linha por veículo, com listas
 * suspensas para evento, tipo e sim/não e células de data e hora), aba "Eventos" (os eventos que
 * recebem veículos, de onde vem a lista) e aba "Como preencher" (regras e um exemplo).
 */
export function montarModeloCarga(eventos: ReadonlyArray<EventoCarga & { ativo: boolean }>, hoje: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();

  // Próximos primeiro (desde a semana passada), depois os mais antigos.
  const corte = new Date(Date.parse(`${hoje}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const lista = eventos.filter((e) => e.ativo);
  const ordenados = [...lista.filter((e) => e.data >= corte).sort((a, b) => a.data.localeCompare(b.data)), ...lista.filter((e) => e.data < corte).sort((a, b) => b.data.localeCompare(a.data))];

  /* ---------------------------- Veículos ---------------------------- */
  const ws = wb.addWorksheet("Veículos", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }], properties: { tabColor: { argb: COR.vinho } } });
  COLUNAS_CARGA.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.largura;
  });
  // Linha 1: faixa do grupo (Veículo · Ida · Volta).
  for (const grupo of ["Veículo", "Ida", "Volta"] as const) {
    const idx = COLUNAS_CARGA.map((c, i) => (c.grupo === grupo ? i + 1 : 0)).filter(Boolean);
    const [ini, fim] = [idx[0], idx[idx.length - 1]];
    ws.mergeCells(1, ini, 1, fim);
    const cel = ws.getCell(1, ini);
    cel.value = grupo === "Ida" ? "IDA · galpão → evento (↑ carga no galpão)" : grupo === "Volta" ? "VOLTA · evento → galpão (↓ descarga no galpão)" : "VEÍCULO";
    cel.font = { bold: true, size: 10, color: { argb: COR.branco } };
    cel.alignment = { vertical: "middle", horizontal: "center" };
    for (let c = ini; c <= fim; c++) ws.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRUPO[grupo].fundo } };
  }
  ws.getRow(1).height = 22;
  // Linha 2: títulos (é por eles que a importação acha as colunas) com a dica no comentário.
  COLUNAS_CARGA.forEach((c, i) => {
    const cel = ws.getCell(2, i + 1);
    cel.value = c.obrigatoria ? `${c.titulo} *` : c.titulo;
    cel.font = { bold: true, size: 9, color: { argb: COR.escuro } };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRUPO[c.grupo].claro } };
    cel.alignment = { vertical: "middle", wrapText: true };
    cel.border = { bottom: { style: "medium", color: { argb: GRUPO[c.grupo].fundo } } };
    cel.note = { texts: [{ text: c.dica }] };
  });
  ws.getRow(2).height = 32;

  // Formatos e validações das linhas de dados (uma regra por faixa; os tipos do ExcelJS não expõem a API de faixa).
  const validacoes = (ws as unknown as { dataValidations: { add(faixa: string, v: ExcelJS.DataValidation): void } }).dataValidations;
  const rotulosEventos = ordenados.map(rotuloEventoModelo);
  COLUNAS_CARGA.forEach((c, i) => {
    const col = letra(i);
    const faixa = `${col}${PRIMEIRA}:${col}${ULTIMA}`;
    const aviso = { showInputMessage: true, promptTitle: c.titulo, prompt: c.dica.slice(0, 250) };
    if (c.tipo === "dataHora") {
      ws.getColumn(i + 1).numFmt = "dd/mm/yyyy hh:mm";
      validacoes.add(faixa, {
        type: "date",
        operator: "greaterThan",
        formulae: [new Date(Date.UTC(2020, 0, 1))],
        allowBlank: true,
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Data e hora",
        error: "Use dd/mm/aaaa hh:mm, ex.: 16/10/2026 08:00.",
        ...aviso,
      });
    } else if (c.tipo === "evento") {
      if (rotulosEventos.length)
        validacoes.add(faixa, {
          type: "list",
          allowBlank: true,
          formulae: [`Eventos!$A$2:$A$${rotulosEventos.length + 1}`],
          showErrorMessage: true,
          errorStyle: "warning",
          errorTitle: "Evento",
          error: "Escolha um evento da lista (aba Eventos) ou digite o código, ex.: EVT-0195.",
          ...aviso,
        });
    } else if (c.tipo === "tipo") {
      validacoes.add(faixa, { type: "list", allowBlank: true, formulae: ['"carreta,truck,toco"'], showErrorMessage: true, errorStyle: "stop", errorTitle: "Tipo", error: "carreta, truck ou toco.", ...aviso });
    } else if (c.tipo === "simNao") {
      validacoes.add(faixa, { type: "list", allowBlank: true, formulae: ['"sim,não"'], showErrorMessage: true, errorStyle: "stop", errorTitle: c.titulo, error: "sim ou não (vazio = não).", ...aviso });
    } else if (c.tipo === "quantidade") {
      validacoes.add(faixa, { type: "whole", operator: "between", formulae: [1, MAX_QUANTIDADE], allowBlank: true, showErrorMessage: true, errorStyle: "stop", errorTitle: "Quantidade", error: `De 1 a ${MAX_QUANTIDADE}.`, ...aviso });
    } else {
      validacoes.add(faixa, { type: "textLength", operator: "lessThanOrEqual", formulae: [c.chave.endsWith("Obs") ? 2000 : 500], allowBlank: true, ...aviso });
    }
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUNAS_CARGA.length } };

  /* ---------------------------- Eventos ----------------------------- */
  const we = wb.addWorksheet("Eventos", { views: [{ state: "frozen", ySplit: 1 }] });
  we.columns = [
    { header: "Evento (escolha na lista da aba Veículos)", key: "rotulo", width: 56 },
    { header: "Código", key: "codigo", width: 11 },
    { header: "Data", key: "data", width: 12 },
    { header: "Local", key: "local", width: 48 },
  ];
  we.getRow(1).font = { bold: true, size: 9, color: { argb: COR.branco } };
  we.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.escuro } };
  ordenados.forEach((e, i) => {
    we.addRow({ rotulo: textoSeguro(rotulosEventos[i]), codigo: e.codigo, data: new Date(`${e.data}T00:00:00Z`), local: textoSeguro(e.local ?? "") });
  });
  we.getColumn("data").numFmt = "dd/mm/yyyy";
  if (!ordenados.length) we.addRow({ rotulo: "Nenhum evento ativo: cadastre o evento no sistema antes de importar." });

  /* ------------------------- Como preencher ------------------------- */
  const wi = wb.addWorksheet("Como preencher");
  wi.getColumn(1).width = 4;
  wi.getColumn(2).width = 110;
  const linhas: Array<[string, "titulo" | "item" | "texto"]> = [
    ["Carga e descarga do galpão · importação em lote", "titulo"],
    ["Uma linha por veículo na aba Veículos. Depois, no sistema: Carga e descarga › Cadastro › Importar planilha.", "texto"],
    ["O sistema mostra a conferência linha a linha antes de gravar: nada entra sem você confirmar.", "texto"],
    ["", "texto"],
    ["Regras", "titulo"],
    ["Evento e Tipo são obrigatórios. O evento precisa existir no sistema (aba Eventos); se não estiver lá, crie o evento primeiro.", "item"],
    ["Datas com hora: dd/mm/aaaa hh:mm (ex.: 16/10/2026 08:00). Data sem hora não é aceita.", "item"],
    ["Ida (se não descartada): informe o início ou o fim da carga no galpão. O fim não pode ser antes do início.", "item"],
    ["Volta (se não descartada): informe ao menos o fim ou o início da carga, a chegada ou a descarga no galpão.", "item"],
    ["Descartar: escreva sim para o veículo que só vai (descartar volta) ou só volta (descartar ida). Não descarte os dois.", "item"],
    ["Tipo de carga: kit, ceno, estrutura, ativação, separados por vírgula. Na volta, vazio = o mesmo da ida.", "item"],
    ["Destino da ida vazio = local do evento. Destino da volta vazio = Galpão.", "item"],
    [`Quantidade: para vários veículos iguais, use uma linha só com a quantidade (até ${MAX_QUANTIDADE}).`, "item"],
    ["Pode importar a mesma planilha de novo: veículos iguais aos já cadastrados no evento não são duplicados; só entram os novos.", "item"],
    [`Até ${MAX_LINHAS_IMPORTACAO} linhas por arquivo. Não mude os títulos da linha 2 (é por eles que o sistema acha as colunas).`, "item"],
    ["", "texto"],
    ["Exemplo (uma carreta com ida e volta)", "titulo"],
    ["Evento: EVT-0195 · Bota Pra Correr RJ · 18/10/2026   Tipo: carreta   Identificação: ABC-1234 / Zaqueu", "texto"],
    ["Ida: tipo de carga = kit, estrutura · o que vai = box, pórtico e 4 tendas · início 16/10/2026 08:00 · fim 16/10/2026 12:30 · descarga no destino 18/10/2026 06:00", "texto"],
    ["Volta: fim da carga 18/10/2026 20:00 · descarga no galpão 19/10/2026 09:00 (tipo de carga vazio = o mesmo da ida)", "texto"],
  ];
  linhas.forEach(([t, estilo], i) => {
    const cel = wi.getCell(i + 2, 2);
    cel.value = estilo === "item" ? `•  ${t}` : t;
    cel.alignment = { wrapText: true, vertical: "top" };
    cel.font = estilo === "titulo" ? { bold: true, size: i === 0 ? 14 : 11, color: { argb: i === 0 ? COR.vinho : COR.escuro } } : { size: 10, color: { argb: COR.escuro } };
  });

  return wb;
}
