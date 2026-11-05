import ExcelJS from "exceljs";
import { CAMADA_LABEL, type Celula, type Semana } from "@/domain/projecao";
import { COR, faixaTitulo, impressao, tabela, textoSeguro } from "./excel";

const diaMes = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

type LinhaMatriz = { peca: { codigo: string; nome: string; unidade: string }; celulas: Celula[]; naoConferida: boolean };
type LinhaFalta = Semana & { faltam: number; dia: string; peca: { codigo: string; nome: string }; eventos: Array<{ eventoCodigo: string; eventoNome: string; quantidade: number; camada: keyof typeof CAMADA_LABEL }> };

/** Projeção em Excel: a matriz (com a mesma cor da tela) e a lista de faltas. */
export function pastaProjecao(dados: { semanas: Semana[]; linhas: LinhaMatriz[]; faltas: LinhaFalta[] }, contexto: string, geradaEm: string, almoxarifado = "Consolidado") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NorteLog";
  wb.created = new Date();
  const ws = wb.addWorksheet("Matriz", { views: [{ showGridLines: false }] });
  const colunas = [{ nome: "Código", largura: 18 }, { nome: "Peça", largura: 44 }, ...dados.semanas.map((s) => ({ nome: diaMes(s.inicio), largura: 9, numero: true }))];
  const inicio = faixaTitulo(ws, colunas.length, "NORTELOG", "Projeção de estoque", `${contexto} · gerada em ${geradaEm}`);
  tabela(ws, "Matriz", inicio, colunas, dados.linhas.map((l) => [l.peca.codigo, l.naoConferida ? `${l.peca.nome} (não conferida)` : l.peca.nome, ...l.celulas.map((c) => c.minimo)]), { totais: false });
  dados.linhas.forEach((l, i) =>
    l.celulas.forEach((c, j) => {
      if (c.tom === "ok") return;
      const cel = ws.getCell(inicio + 1 + i, 3 + j);
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.tom === "falta" ? "FFFBE4E2" : "FFFBF1CC" } };
      cel.font = { bold: c.tom === "falta", color: { argb: c.tom === "falta" ? "FFB3261E" : "FF7A5F00" } };
    }),
  );
  impressao(ws, "Projeção de estoque", `Gerada em ${geradaEm}`, inicio, true);

  const wf = wb.addWorksheet("Faltas", { views: [{ showGridLines: false }] });
  const colFaltas = [{ nome: "Semana", largura: 16 }, { nome: "Código", largura: 18 }, { nome: "Peça", largura: 44 }, { nome: "Almoxarifado", largura: 22 }, { nome: "Faltam", largura: 10, numero: true }, { nome: "Pior dia", largura: 10 }, { nome: "Eventos", largura: 70 }];
  const iniF = faixaTitulo(wf, colFaltas.length, "NORTELOG", "Lista de faltas", contexto);
  tabela(
    wf,
    "Faltas",
    iniF,
    colFaltas,
    dados.faltas.map((f) => [`${diaMes(f.inicio)} a ${diaMes(f.fim)}`, f.peca.codigo, f.peca.nome, almoxarifado, f.faltam, diaMes(f.dia), [...new Set(f.eventos.map((e) => `${e.eventoCodigo} ${e.eventoNome} (${e.quantidade}, ${CAMADA_LABEL[e.camada]})`))].join("; ")]),
    { totais: false },
  );
  impressao(wf, "Lista de faltas", `Gerada em ${geradaEm}`, iniF, true);
  return wb;
}

type Bloco = { nome: string; quantidade: number; destino: string | null; montador: string | null; pecas: Array<{ codigo: string; nome: string; unidade: string; total: number }> };

/** Documento técnico para o fornecedor de estrutura: o que ele monta, mais o que a Norte envia. */
export function pastaFornecedor(ev: { codigo: string; nome: string; fornecedorEstrutura: string | null }, terceirizadas: Bloco[], enviadoPelaNorte: Bloco[], pdfs: Array<{ nomeArquivo: string; projeto: string }>, geradaEm: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NorteLog";
  wb.created = new Date();
  const colunas = [{ nome: "Item", largura: 40 }, { nome: "Qtd. do item", largura: 12, numero: true }, { nome: "Local", largura: 24 }, { nome: "Código", largura: 18 }, { nome: "Peça", largura: 44 }, { nome: "Total", largura: 10, numero: true }, { nome: "Unidade", largura: 9 }];
  const linhas = (lista: Bloco[]) => lista.flatMap((b) => (b.pecas.length ? b.pecas.map((p) => [b.nome, b.quantidade, b.destino ?? b.montador ?? "", p.codigo, p.nome, p.total, p.unidade]) : [[b.nome, b.quantidade, b.destino ?? b.montador ?? "", "", "", null, ""]]));
  const sub = `${ev.codigo} · ${ev.nome}${ev.fornecedorEstrutura ? ` · ${ev.fornecedorEstrutura}` : ""} · gerado em ${geradaEm}`;
  const ws = wb.addWorksheet("Estrutura terceirizada", { views: [{ showGridLines: false }] });
  const ini = faixaTitulo(ws, colunas.length, "NORTELOG", "Documento técnico para o fornecedor", sub);
  tabela(ws, "Terceirizadas", ini, colunas, linhas(terceirizadas), { totais: false });
  impressao(ws, "Documento técnico para o fornecedor", sub, ini, true);
  const wn = wb.addWorksheet("Enviado pela Norte", { views: [{ showGridLines: false }] });
  const iniN = faixaTitulo(wn, colunas.length, "NORTELOG", "Enviado pela Norte", sub);
  if (enviadoPelaNorte.length) tabela(wn, "Enviado", iniN, colunas.map((c) => (c.nome === "Local" ? { ...c, nome: "Montador" } : c)), enviadoPelaNorte.flatMap((b) => b.pecas.map((p) => [b.nome, b.quantidade, b.montador ?? "", p.codigo, p.nome, p.total, p.unidade])), { totais: false });
  else wn.getCell(iniN, 1).value = "Nenhum complemento ao montador.";
  if (pdfs.length) {
    const wp = wb.addWorksheet("PDFs dos projetos", { views: [{ showGridLines: false }] });
    wp.getColumn(1).width = 44;
    wp.getColumn(2).width = 60;
    const c = wp.getCell(1, 1);
    c.value = "Arquivos dos projetos (baixe pela versão em PDF deste documento)";
    c.font = { bold: true, color: { argb: COR.marca } };
    pdfs.forEach((p, i) => {
      wp.getCell(i + 2, 1).value = textoSeguro(p.projeto);
      wp.getCell(i + 2, 2).value = textoSeguro(p.nomeArquivo);
    });
  }
  return wb;
}

/** Modelo da contagem: uma linha por peça ativa, com a quantidade em branco. */
export function modeloContagem(pecas: ReadonlyArray<{ codigo: string; nome: string; unidade: string }>) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NorteLog";
  const ws = wb.addWorksheet("Contagem", { views: [{ showGridLines: false, state: "frozen", ySplit: 5 }] });
  const colunas = [{ nome: "Código", largura: 20 }, { nome: "Peça", largura: 50 }, { nome: "Unidade", largura: 9 }, { nome: "Proprietário", largura: 22 }, { nome: "Quantidade", largura: 12, numero: true }];
  const ini = faixaTitulo(ws, colunas.length, "NORTELOG", "Contagem de saldo", "Quantidade em branco = não contada. Proprietário em branco = Norte; para locador, repita a peça em outra linha.");
  tabela(ws, "Contagem", ini, colunas, pecas.map((p) => [p.codigo, p.nome, p.unidade, "", null]), { totais: false });
  return wb;
}

/** Modelo do saneamento das peças: o que já está preenchido vem na planilha; em branco não muda nada. */
export function modeloPecasLogistica(pecas: ReadonlyArray<{ codigo: string; nome: string; tipoItem: string | null; volumeM3: number | null; estoqueMinimo: number | null; apelidos: string[]; codigoBarras: string | null }>) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NorteLog";
  const ws = wb.addWorksheet("Peças", { views: [{ showGridLines: false, state: "frozen", ySplit: 5 }] });
  const colunas = [{ nome: "Código", largura: 20 }, { nome: "Peça", largura: 50 }, { nome: "Tipo", largura: 14 }, { nome: "m³", largura: 9, numero: true }, { nome: "Estoque mínimo", largura: 10, numero: true }, { nome: "Apelidos", largura: 30 }, { nome: "Código de barras", largura: 20 }];
  const ini = faixaTitulo(ws, colunas.length, "NORTELOG", "Tipo e m³ das peças", "Tipo: Retornável ou Consumível. m³ por unidade como viaja. Apelidos separados por ponto e vírgula. Em branco não muda nada.");
  tabela(ws, "Pecas", ini, colunas, pecas.map((p) => [p.codigo, p.nome, p.tipoItem === "RETORNAVEL" ? "Retornável" : p.tipoItem === "CONSUMIVEL" ? "Consumível" : "", p.volumeM3, p.estoqueMinimo, p.apelidos.join("; "), p.codigoBarras ?? ""]), { totais: false });
  return wb;
}
