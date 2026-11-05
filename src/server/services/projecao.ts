import { and, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { anexos, eventos, eventosPai, pecas, perfisVeiculo, projetos, projetoVersoes, solicitacaoItens, solicitacoes, tours, veiculosCarga, type AtendePor, type EstruturaEvento } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError } from "@/domain/errors";
import { grupoDaLinha, grupoDaPeca, grupoDoProjeto, type GrupoMaterial } from "@/domain/grupos-material";
import { atendimentoDaLinha, atendimentoDaPeca, datasPrevistas, estimarVeiculos, type DatasPrevistas } from "@/domain/logistica";
import { calcularOS, semPrismaComum, setoresComKit, type LinhaAta } from "@/domain/os";
import { blocosDoEvento, CENARIOS, eventosDoPeriodo, projetar, semanasDoPeriodo, type Camada, type Cobertura, type Demanda, type OpcoesProjecao, type SaldoBase } from "@/domain/projecao";
import { STATUS_ABERTOS } from "@/domain/solicitacao";
import { addDiasISO, hojeISO } from "@/lib/format";
import { almoxarifadoPrincipal, listarAlmoxarifados } from "./logistica";
import { montarLinhasAtaDeEventos } from "./os";
import { datasDasContagens, listarCoberturas, saldosAtuais } from "./saldo";
import { obterConfiguracoes, type Executor } from "./support";

/**
 * Da ata ao que sai do galpão: a mesma conta da OS (`calcularOS`) linha a linha, separada por camada e por quem atende.
 * Sem checagem de permissão: quem chama já checou.
 */

type EventoBase = { id: string; codigo: string; nome: string; status: string; ataFechadaEm: Date | null; estrutura: EstruturaEvento; tourId: string | null; dataInicio: string; dataFim: string; saidaPrevista: string | null; retornoPrevisto: string | null };
type CatalogoPeca = { id: string; codigo: string; nome: string; setor: string; familia: string; unidade: string; tipoItem: "RETORNAVEL" | "CONSUMIVEL" | null; estoqueMinimo: number | null; volumeM3: number | null };
export type LinhaLocacao = { eventoId: string; eventoCodigo: string; eventoNome: string; pecaId: string; quantidade: number; saida: string; retorno: string; origem: string };

export async function diasPadrao(ex: Executor) {
  const cfg = await obterConfiguracoes(ex);
  return { antes: Number(cfg.saida_dias_antes), depois: Number(cfg.retorno_dias_depois) };
}

/** Saída e retorno de cada evento: veículos cadastrados, data editada ou a calculada. */
export async function datasDosEventos(ex: Executor, evs: readonly EventoBase[]): Promise<Map<string, DatasPrevistas>> {
  const dias = await diasPadrao(ex);
  const ids = evs.map((e) => e.id);
  const veiculos = ids.length ? await ex.select({ eventoId: veiculosCarga.eventoId, ida: veiculosCarga.ida, volta: veiculosCarga.volta }).from(veiculosCarga).where(inArray(veiculosCarga.eventoId, ids)) : [];
  return new Map(evs.map((e) => [e.id, datasPrevistas(e, dias, veiculos.filter((v) => v.eventoId === e.id))]));
}

/** Peças do que a linha pede, com a mesma conta da OS (inclui as unificadas; o prisma comum já vem como grades). */
function pecasDaLinha(l: LinhaAta, quantidade = l.quantidade) {
  if (quantidade <= 0) return [];
  return setoresComKit(calcularOS([{ ...l, quantidade }])).flatMap((s) => semPrismaComum(s.linhas).map((x) => ({ pecaId: x.pecaId, total: x.total, setor: s.setor })));
}

export async function demandasDosEventos(ex: Executor, evs: readonly EventoBase[], catalogo: ReadonlyMap<string, CatalogoPeca>, principalId: string | null) {
  const datas = await datasDosEventos(ex, evs);
  const ids = evs.map((e) => e.id);
  const linhasPorEvento = await montarLinhasAtaDeEventos(ex, ids);
  const tourNomes = new Map((await ex.select({ id: tours.id, nome: tours.nome }).from(tours)).map((t) => [t.id, t.nome]));
  const pendentes = ids.length
    ? await ex
        .select({ id: solicitacaoItens.id, eventoId: solicitacoes.eventoId, operacao: solicitacaoItens.operacao, status: solicitacaoItens.status, eventoItemId: solicitacaoItens.eventoItemId, projetoVersaoId: solicitacaoItens.projetoVersaoId, pecaId: solicitacaoItens.pecaId, quantidade: solicitacaoItens.quantidadeSolicitada, solicitacaoStatus: solicitacoes.status })
        .from(solicitacaoItens)
        .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
        .where(and(inArray(solicitacoes.eventoId, ids), eq(solicitacoes.excluida, false)))
    : [];
  const statusDoItem = new Map(pendentes.map((p) => [p.id, p.status]));
  const demandas: Demanda[] = [];
  const locacao: LinhaLocacao[] = [];
  let foraDoCatalogo = 0;

  const lancar = (ev: EventoBase, peca: { pecaId: string; total: number; setor: string }, grupo: GrupoMaterial, atendePor: AtendePor | null, almoxarifadoId: string | null, camada: Camada, origem: string) => {
    const c = catalogo.get(peca.pecaId);
    const dt = datas.get(ev.id);
    if (!c || !dt) return;
    const a = atendimentoDaPeca(atendimentoDaLinha({ atendePor, grupo }, ev.estrutura), peca.setor);
    const base = { eventoId: ev.id, eventoCodigo: ev.codigo, eventoNome: ev.nome, pecaId: peca.pecaId, quantidade: peca.total, saida: dt.saida, retorno: dt.retorno, origem };
    if (a.atendePor === "LOCACAO_VIA_GALPAO") locacao.push(base);
    // Terceirizado e compra não consomem o estoque nem entram na Projeção.
    if (a.atendePor !== "GALPAO_NORTE") return;
    const alm = almoxarifadoId ?? principalId;
    if (!alm) return;
    demandas.push({ ...base, tourId: ev.tourId, tourNome: ev.tourId ? (tourNomes.get(ev.tourId) ?? null) : null, almoxarifadoId: alm, camada, tipoItem: c.tipoItem, aDefinir: a.aDefinir });
  };

  for (const ev of evs) {
    const linhas = linhasPorEvento.get(ev.id) ?? [];
    for (const l of linhas) {
      const reg = l.registro;
      const grupo = grupoDaLinha({ tipo: l.tipo, projeto: reg.projeto, peca: reg.peca });
      const item = reg.solicitacaoItemId ? statusDoItem.get(reg.solicitacaoItemId) : undefined;
      // Aceita = ata fechada ou item respondido como atendido ou parcial (a linha já tem a quantidade atendida).
      const camada: Camada = ev.ataFechadaEm || item === "ATENDIDO" || item === "PARCIAL" ? "CONFIRMADA" : "ESTIMADA";
      const origem = [l.areaNome ?? "Logística", l.projeto?.nome].filter(Boolean).join(" · ");
      if (l.tipo === "AVULSO") foraDoCatalogo++;
      for (const p of pecasDaLinha(l)) lancar(ev, p, grupo, reg.atendePor, reg.almoxarifadoId, camada, origem);
    }
    // Pedido ainda sem resposta: o que entraria a mais, como estimada. O que já tem linha na ata não conta de novo.
    const comLinha = new Set(linhas.map((l) => l.registro.solicitacaoItemId).filter(Boolean));
    for (const p of pendentes) {
      if (p.eventoId !== ev.id || p.status !== "EM_ANALISE" || !STATUS_ABERTOS.includes(p.solicitacaoStatus) || comLinha.has(p.id)) continue;
      if (p.operacao === "ALTERAR_QUANTIDADE") {
        const l = linhas.find((x) => x.id === p.eventoItemId);
        if (!l) continue;
        const reg = l.registro;
        const grupo = grupoDaLinha({ tipo: l.tipo, projeto: reg.projeto, peca: reg.peca });
        for (const x of pecasDaLinha(l, p.quantidade - l.quantidade)) lancar(ev, x, grupo, reg.atendePor, reg.almoxarifadoId, "ESTIMADA", "Alteração em análise");
      } else if (p.operacao === "ADICIONAR" && p.pecaId) {
        const c = catalogo.get(p.pecaId);
        if (c) lancar(ev, { pecaId: p.pecaId, total: p.quantidade, setor: c.setor }, grupoDaPeca(c), null, null, "ESTIMADA", "Pedido em análise");
      } else if (p.operacao === "ADICIONAR" && p.projetoVersaoId) {
        const versao = await ex.query.projetoVersoes.findFirst({ where: eq(projetoVersoes.id, p.projetoVersaoId), with: { itens: { columns: { pecaId: true, quantidade: true } } } });
        const proj = versao ? await ex.query.projetos.findFirst({ where: eq(projetos.id, versao.projetoId), columns: { nome: true, categoria: true } }) : null;
        if (!versao || !proj) continue;
        for (const b of versao.itens) {
          const c = catalogo.get(b.pecaId);
          if (c) lancar(ev, { pecaId: b.pecaId, total: b.quantidade * p.quantidade, setor: c.setor }, grupoDoProjeto(proj), null, null, "ESTIMADA", `Pedido em análise · ${proj.nome}`);
        }
      }
    }
  }
  return { demandas, locacao, foraDoCatalogo, datas };
}

const colunasEvento = { id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, status: eventos.status, ataFechadaEm: eventos.ataFechadaEm, estrutura: eventos.estrutura, tourId: eventos.tourId, eventoPaiId: eventos.eventoPaiId, dataInicio: eventos.dataInicio, dataFim: eventos.dataFim, saidaPrevista: eventos.saidaPrevista, retornoPrevisto: eventos.retornoPrevisto };
const colunasPeca = { id: pecas.id, codigo: pecas.codigo, nome: pecas.nome, setor: pecas.setor, familia: pecas.familia, unidade: pecas.unidade, tipoItem: pecas.tipoItem, estoqueMinimo: pecas.estoqueMinimo, volumeM3: pecas.volumeM3 };

export type FiltrosProjecao = {
  inicio?: string;
  semanas?: number;
  almoxarifadoId?: string | null;
  camadas?: readonly Camada[];
  incluirADefinir?: boolean;
  eventoPaiId?: string | null;
  tourId?: string | null;
  setor?: string | null;
  familia?: string | null;
  busca?: string | null;
  soFaltas?: boolean;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");

/** A Projeção com os filtros da tela e do Excel. */
export async function calcularProjecao(usuario: UsuarioAtual, f: FiltrosProjecao = {}) {
  exigir(usuario, "projecao.ver");
  const db = await getDb();
  const inicio = f.inicio ?? hojeISO();
  const camadas = f.camadas?.length ? f.camadas : CENARIOS.antecipada.camadas;
  const [listaAlm, datasContagem, saldos, evs, listaPecas, coberturas, pais, listaTours, principal] = await Promise.all([
    listarAlmoxarifados(db),
    datasDasContagens(db),
    saldosAtuais(db),
    // Folga para trás: evento que saiu antes da contagem e ainda não voltou entra pela volta.
    db.select(colunasEvento).from(eventos).where(and(inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO"]), or(gte(eventos.dataFim, addDiasISO(inicio, -180)), gte(eventos.retornoPrevisto, addDiasISO(inicio, -180))))),
    db.select(colunasPeca).from(pecas),
    listarCoberturas(db),
    db.select({ id: eventosPai.id, nome: eventosPai.nome }).from(eventosPai).where(eq(eventosPai.ativo, true)),
    db.select({ id: tours.id, nome: tours.nome }).from(tours).where(eq(tours.ativo, true)),
    almoxarifadoPrincipal(db),
  ]);
  const catalogo = new Map(listaPecas.map((p) => [p.id, p]));
  const filtrados = evs.filter((e) => (!f.eventoPaiId || e.eventoPaiId === f.eventoPaiId) && (!f.tourId || e.tourId === f.tourId));
  const { demandas, locacao, foraDoCatalogo, datas } = await demandasDosEventos(db, filtrados, catalogo, principal?.id ?? null);

  const ativos = listaAlm.filter((a) => a.ativo);
  const liberados = ativos.flatMap((a) => {
    const contadoEm = datasContagem.porAlmoxarifado.get(a.id);
    return contadoEm ? [{ id: a.id, contadoEm }] : [];
  });
  const porAlmPeca = new Map<string, SaldoBase>();
  for (const s of saldos) {
    const k = `${s.almoxarifadoId}|${s.pecaId}`;
    const atual = porAlmPeca.get(k);
    porAlmPeca.set(k, { pecaId: s.pecaId, almoxarifadoId: s.almoxarifadoId, quantidade: (atual?.quantidade ?? 0) + s.quantidade, contadoEm: datasContagem.porPeca.get(k) ?? null });
  }
  // Peça contada e zerada não tem linha de saldo, mas foi conferida.
  for (const [k, em] of datasContagem.porPeca) {
    if (porAlmPeca.has(k)) continue;
    const [almoxarifadoId, pecaId] = k.split("|");
    porAlmPeca.set(k, { pecaId, almoxarifadoId, quantidade: 0, contadoEm: em });
  }
  const paraCobertura: Cobertura[] = coberturas.map((c) => ({ id: c.id, tipo: c.tipo, pecaId: c.pecaId, almoxarifadoId: c.almoxarifadoId, quantidade: c.quantidade, dataEntrada: c.dataEntrada, dataDevolucao: c.dataDevolucao, rotulo: `${c.tipo === "LOCACAO" ? `Locação · ${c.locador?.nome ?? ""}` : "Compra"}` }));
  const opcoes: OpcoesProjecao = { inicio, semanas: f.semanas, camadas, incluirADefinir: f.incluirADefinir ?? true, almoxarifadoId: f.almoxarifadoId ?? null };
  const r = projetar({ pecas: listaPecas, saldos: [...porAlmPeca.values()], almoxarifados: liberados, demandas, coberturas: paraCobertura, opcoes });

  const combina = (id: string) => {
    const p = catalogo.get(id);
    if (!p) return false;
    if (f.setor && p.setor !== f.setor) return false;
    if (f.familia && p.familia !== f.familia) return false;
    if (f.busca?.trim() && !semAcento(`${p.codigo} ${p.nome}`).includes(semAcento(f.busca.trim()))) return false;
    return true;
  };
  const comFalta = new Set(r.faltas.map((x) => x.pecaId));
  const linhas = r.linhas
    .filter((l) => combina(l.pecaId) && (!f.soFaltas || comFalta.has(l.pecaId)))
    .map((l) => ({ ...l, peca: catalogo.get(l.pecaId)! }))
    .sort((a, b) => Number(comFalta.has(b.pecaId)) - Number(comFalta.has(a.pecaId)) || a.peca.nome.localeCompare(b.peca.nome, "pt-BR"));
  const dentro = (d: { almoxarifadoId: string }) => liberados.some((a) => a.id === d.almoxarifadoId) && (!f.almoxarifadoId || d.almoxarifadoId === f.almoxarifadoId);
  const demandasVisiveis = demandas.filter((d) => dentro(d) && camadas.includes(d.camada) && (opcoes.incluirADefinir || !d.aDefinir));
  const faltas = r.faltas.filter((x) => combina(x.pecaId)).map((x) => ({ ...x, peca: catalogo.get(x.pecaId)!, eventos: eventosDoPeriodo(demandasVisiveis, x.pecaId, x.dia, x.dia) }));

  return {
    semanas: r.semanas,
    linhas,
    faltas,
    avisos: r.avisos.map((a) => ({ ...a, peca: catalogo.get(a.pecaId) })).filter((a) => a.peca),
    demandas: demandasVisiveis,
    coberturas: paraCobertura.filter((c) => dentro(c)),
    locacao: locacao.filter((l) => combina(l.pecaId)).map((l) => ({ ...l, peca: catalogo.get(l.pecaId)! })),
    foraDoCatalogo,
    almoxarifados: ativos.map((a) => ({ id: a.id, nome: a.nome, area: a.area?.nome ?? null, principal: a.principal, contadoEm: datasContagem.porAlmoxarifado.get(a.id) ?? null })),
    eventosPai: pais,
    tours: listaTours,
    semDatasValidas: filtrados.filter((e) => {
      const d = datas.get(e.id);
      return d && d.retorno < d.saida;
    }).length,
    familias: [...new Set(listaPecas.map((p) => p.familia).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    camadas,
    incluirADefinir: opcoes.incluirADefinir,
  };
}

export const semanasPadrao = () => semanasDoPeriodo(hojeISO());

/** Quantos veículos o evento (ou o tour dele) precisa, pelo volume do que sai do galpão e pelos perfis de referência. */
export async function estimativaDoEvento(eventoId: string, ex?: Executor) {
  const db = ex ?? (await getDb());
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, tourId: true } });
  if (!ev) throw new NaoEncontradoError("Evento");
  const evs = await db.select(colunasEvento).from(eventos).where(ev.tourId ? eq(eventos.tourId, ev.tourId) : eq(eventos.id, eventoId));
  const [listaPecas, perfis, principal] = await Promise.all([db.select(colunasPeca).from(pecas), db.select().from(perfisVeiculo).where(and(eq(perfisVeiculo.referencia, true), eq(perfisVeiculo.ativo, true))), almoxarifadoPrincipal(db)]);
  const catalogo = new Map(listaPecas.map((p) => [p.id, p]));
  const { demandas } = await demandasDosEventos(db, evs, catalogo, principal?.id ?? "principal");
  const itens = blocosDoEvento(demandas).map((b) => ({ pecaId: b.pecaId, quantidade: b.quantidade, volumeM3: catalogo.get(b.pecaId)?.volumeM3 ?? null }));
  return { ...estimarVeiculos(itens, perfis), temPerfil: perfis.length > 0, tour: Boolean(ev.tourId) };
}

/** Eventos que saem nos próximos dias, com a estimativa de veículos de cada um (calendário de Carga e descarga). */
export async function estimativasProximas(hoje: string, dias = 30, limite = 20) {
  const db = await getDb();
  const evs = await db.select(colunasEvento).from(eventos).where(inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"]));
  const datas = await datasDosEventos(db, evs);
  const ate = addDiasISO(hoje, dias);
  const proximos = evs
    .map((e) => ({ ...e, saida: datas.get(e.id)!.saida }))
    .filter((e) => e.saida >= hoje && e.saida <= ate)
    .sort((a, b) => a.saida.localeCompare(b.saida))
    .slice(0, limite);
  const lista = [];
  for (const e of proximos) lista.push({ id: e.id, codigo: e.codigo, nome: e.nome, saida: e.saida, estimativa: await estimativaDoEvento(e.id, db) });
  return lista;
}

/** Documento técnico para o fornecedor: só as linhas terceirizadas, com box truss e tendas, mais o que a Norte envia ao montador. */
export async function documentoFornecedor(eventoId: string, ex?: Executor) {
  const db = ex ?? (await getDb());
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
  if (!ev) throw new NaoEncontradoError("Evento");
  const linhas = (await montarLinhasAtaDeEventos(db, [eventoId])).get(eventoId) ?? [];
  type Bloco = { id: string; nome: string; quantidade: number; destino: string | null; montador: string | null; pecas: Array<{ codigo: string; nome: string; unidade: string; total: number }> };
  const terceirizadas: Bloco[] = [];
  const enviadoPelaNorte: Bloco[] = [];
  const projetoIds = new Set<string>();
  for (const l of linhas) {
    if (l.quantidade <= 0) continue;
    const reg = l.registro;
    const grupo = grupoDaLinha({ tipo: l.tipo, projeto: reg.projeto, peca: reg.peca });
    const a = atendimentoDaLinha({ atendePor: reg.atendePor, grupo }, ev.estrutura);
    const nome = l.projeto?.nome ?? l.peca?.nome ?? l.descricaoLivre ?? "Item fora do catálogo";
    const todas = setoresComKit(calcularOS([l])).flatMap((s) => semPrismaComum(s.linhas).map((x) => ({ setor: s.setor, codigo: x.codigo, nome: x.nome, unidade: x.unidade, total: x.total })));
    const bloco = { id: l.id, nome, quantidade: l.quantidade, destino: l.destino, montador: reg.montador };
    if (a.atendePor === "FORNECEDOR_EXTERNO") {
      const doFornecedor = todas.filter((x) => atendimentoDaPeca(a, x.setor).atendePor === "FORNECEDOR_EXTERNO");
      terceirizadas.push({ ...bloco, pecas: doFornecedor });
      if (reg.projetoId) projetoIds.add(reg.projetoId);
    } else if (a.atendePor === "GALPAO_NORTE" && reg.montador) {
      enviadoPelaNorte.push({ ...bloco, pecas: todas });
    }
  }
  const pdfs = projetoIds.size ? await db.select({ id: anexos.id, nomeArquivo: anexos.nomeArquivo, projeto: projetos.nome }).from(anexos).innerJoin(projetos, eq(anexos.projetoId, projetos.id)).where(and(inArray(anexos.projetoId, [...projetoIds]), eq(anexos.tipo, "PDF"))) : [];
  return { evento: ev, terceirizadas, enviadoPelaNorte, pdfs };
}
