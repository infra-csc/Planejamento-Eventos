import ExcelJS from "exceljs";
import { grupoDoCodigo, type MapaGrupos } from "@/domain/grupos-material";
import { montarFolhaSeparacao, standsDaOs } from "@/domain/folha-separacao";
import { ROTULO_KIT } from "@/domain/os";
import { formatarPeriodo } from "@/lib/format";
import type { OsConteudo } from "@/server/db/schema";
import { CHECK, faixaTitulo, impressao, tabela } from "./excel";

const COLUNAS = [
  { nome: "Material", largura: 24 },
  { nome: "Item", largura: 44 },
  { nome: "Quantidade", largura: 13, numero: true },
  { nome: "Unidade", largura: 10, alinhar: "center" as const },
  { nome: "Local", largura: 24 },
  { nome: "Sep.", largura: 7, alinhar: "center" as const },
  { nome: "Obs.", largura: 28 },
];

/**
 * Materiais KIT em Excel (03/11, logística): o que a área Kit pediu, numa lista só para quem entrega nesse local.
 * Mesma ordem e mesmas regras da folha de separação, sobre as linhas do Kit.
 */
export function pastaMateriaisKit(ev: { codigo: string; nome: string; dataInicio: string; dataFim: string }, kit: OsConteudo, mapa: MapaGrupos, versao: string, geradaPor: string, geradaEm: string) {
  // Locais de cada peça: nas linhas soltas e nos projetos que a levam.
  const locais = new Map<string, Set<string>>();
  const marcar = (codigo: string, destino: string | null) => {
    if (!destino?.trim()) return;
    if (!locais.has(codigo)) locais.set(codigo, new Set());
    locais.get(codigo)!.add(destino.trim());
  };
  for (const x of kit.individuais ?? []) marcar(x.codigo, x.destino);
  for (const p of kit.projetos ?? []) for (const pc of p.pecas) marcar(pc.codigo, p.destino);
  const codigoDe = new Map(kit.setores.flatMap((s) => s.linhas.map((l) => [l.pecaId, l.codigo] as const)));

  const secoes = montarFolhaSeparacao(
    kit.setores.flatMap((s) => s.linhas.map((l) => ({ ...l, setor: s.setor, grupo: grupoDoCodigo(mapa, l.codigo, s.setor) }))),
    { stands: standsDaOs(kit.projetos) },
  );
  const linhas: Array<Array<string | number | null>> = [
    ...secoes.flatMap((s) =>
      s.linhas.map((l) => [s.bloco ? `${s.bloco} · ${s.titulo}` : s.titulo, l.nota ? `${l.nome} (${l.nota})` : l.nome, l.total, l.unidade, [...(locais.get(codigoDe.get(l.chave.split("|").at(-1) ?? "") ?? "") ?? [])].join(" / ") || "—", CHECK, null]),
    ),
    ...[...kit.semSetor, ...kit.setores.flatMap((s) => s.avulsos)].map((x) => ["Fora do catálogo", x.descricao, x.quantidade, "un", x.destino?.trim() || "—", CHECK, null]),
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = "NorteLog";
  wb.created = new Date();
  const ws = wb.addWorksheet(ROTULO_KIT, { views: [{ showGridLines: false }] });
  const inicio = faixaTitulo(ws, COLUNAS.length, "NORTELOG", ROTULO_KIT, `${ev.codigo} · ${ev.nome} · ${formatarPeriodo(ev.dataInicio, ev.dataFim)} · ${versao}`);
  tabela(ws, "MateriaisKit", inicio, COLUNAS, linhas, { totais: false });
  const hf = (t: string) => t.replace(/&/g, "&&");
  impressao(ws, hf(`${ROTULO_KIT} · ${ev.codigo} · ${ev.nome} · ${versao}`), hf(`Separado por: ______________   Conferido por: ______________   Gerado ${geradaEm} por ${geradaPor}`), inicio, true);
  return wb;
}
