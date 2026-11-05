import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { calcularProjecao } from "@/server/services/projecao";
import { CAMADAS, CENARIOS, SEMANAS_PADRAO, type Camada } from "@/domain/projecao";
import { SETORES } from "@/domain/constantes";
import { SETOR_LABEL } from "@/domain/os";
import { pode } from "@/domain/permissions";
import { diaMesISO, hojeISO } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { buttonClasses } from "@/components/ui/button-classes";
import { BuscaUrl } from "@/components/ui/busca-url";
import { FiltroSelectUrl } from "@/components/ui/filtro-select-url";
import { Icone } from "@/components/ui/icons";
import { Aviso, EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { FiltrosMarcaveis, InicioUrl, MatrizProjecao } from "@/components/logistica/matriz-projecao";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Projeção de estoque" };

const POR_PAGINA = 80;
const PERIODOS = [4, 8, 16, 26];

export default async function ProjecaoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await requirePermissao("projecao.ver");
  const sp = await searchParams;
  const camadas = (sp.camadas ?? CENARIOS.antecipada.camadas.join(",")).split(",").filter((c): c is Camada => (CAMADAS as readonly string[]).includes(c));
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(sp.inicio ?? "") ? sp.inicio! : hojeISO();
  const semanas = PERIODOS.includes(Number(sp.semanas)) ? Number(sp.semanas) : SEMANAS_PADRAO;
  const incluirADefinir = sp.adefinir !== "0";
  const soFaltas = sp.faltas === "1";
  const p = await calcularProjecao(usuario, {
    inicio,
    semanas,
    almoxarifadoId: sp.almoxarifado || null,
    camadas: camadas.length ? camadas : ["__nenhuma__" as Camada],
    incluirADefinir,
    eventoPaiId: sp.pai || null,
    tourId: sp.tour || null,
    setor: sp.setor || null,
    familia: sp.familia || null,
    busca: sp.q?.slice(0, 80) || null,
    soFaltas,
  });
  const liberados = p.almoxarifados.filter((a) => a.contadoEm);
  const naoConferidos = p.almoxarifados.filter((a) => !a.contadoEm);
  const escolhido = p.almoxarifados.find((a) => a.id === sp.almoxarifado);
  const qsExcel = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  const hrefCenario = (c: Camada[]) => hrefCom("/projecao", sp, { camadas: c.join(",") });
  const cenarioAtivo = (c: readonly Camada[]) => c.length === camadas.length && c.every((x) => camadas.includes(x));
  const visiveis = p.linhas.slice(0, POR_PAGINA);
  const idsVisiveis = new Set(visiveis.map((l) => l.pecaId));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Projeção de estoque"
        description="Por semana e por peça: o menor saldo previsto e onde falta. Cada semana mostra o pior dia, não o fim da semana."
        actions={
          <div className="flex flex-wrap gap-2">
            {pode(usuario, "logistica.contagem") && (
              <Link href="/contagem" className={buttonClasses({ variant: "secondary", size: "md", className: "no-underline" })}>
                Contagem de saldo
              </Link>
            )}
            <Link href="/projecao/previstas" className={buttonClasses({ variant: "secondary", size: "md", className: "no-underline" })}>
              Locação e compra previstas
            </Link>
            {/* Sem next/link: o prefetch geraria a planilha a cada visita. */}
            <a href={`/api/projecao/excel${qsExcel ? `?${qsExcel}` : ""}`} className={buttonClasses({ variant: "secondary", size: "md", className: "no-underline" })}>
              <Icone nome="download" />
              Excel
            </a>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-pequeno text-ink-2">
        {p.almoxarifados.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1.5">
            {a.nome}
            {a.contadoEm ? <Badge tom="success">contado em {diaMesISO(a.contadoEm)}</Badge> : <Badge tom="warning">não conferido</Badge>}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-cartao border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Pills
            rotulo="Cenário"
            itens={[
              { label: CENARIOS.decisao.rotulo, ativo: cenarioAtivo(CENARIOS.decisao.camadas), href: hrefCenario(CENARIOS.decisao.camadas) },
              { label: CENARIOS.antecipada.rotulo, ativo: cenarioAtivo(CENARIOS.antecipada.camadas), href: hrefCenario(CENARIOS.antecipada.camadas) },
            ]}
          />
          <FiltrosMarcaveis camadas={camadas} incluirADefinir={incluirADefinir} soFaltas={soFaltas} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
          <BuscaUrl placeholder="Peça ou código" ariaLabel="Buscar peça ou código" className="col-span-2" />
          <InicioUrl valor={sp.inicio ?? ""} />
          <FiltroSelectUrl param="semanas" rotulo="Período" todas={`${SEMANAS_PADRAO} semanas`} opcoes={PERIODOS.map((n) => ({ value: String(n), label: `${n} semanas` }))} className="md:w-[140px]" />
          <FiltroSelectUrl param="almoxarifado" rotulo="Almoxarifado" todas="Consolidado" opcoes={p.almoxarifados.map((a) => ({ value: a.id, label: a.nome }))} className="md:w-[190px]" />
          <FiltroSelectUrl param="setor" rotulo="Setor" todas="Todos os setores" opcoes={SETORES.map((s) => ({ value: s, label: SETOR_LABEL[s] }))} className="md:w-[170px]" />
          <FiltroSelectUrl param="familia" rotulo="Família" todas="Todas as famílias" opcoes={p.familias.map((f) => ({ value: f, label: f }))} className="md:w-[180px]" />
          {p.eventosPai.length > 0 && <FiltroSelectUrl param="pai" rotulo="Evento pai" todas="Todo evento pai" opcoes={p.eventosPai.map((x) => ({ value: x.id, label: x.nome }))} className="md:w-[180px]" />}
          {p.tours.length > 0 && <FiltroSelectUrl param="tour" rotulo="Tour" todas="Todo tour" opcoes={p.tours.map((x) => ({ value: x.id, label: x.nome }))} className="md:w-[170px]" />}
        </div>
      </div>

      {liberados.length === 0 ? (
        <Section>
          <EmptyState
            icone="caixa"
            title="Nenhum almoxarifado contado ainda"
            description="A Projeção é liberada almoxarifado por almoxarifado, conforme cada um é contado. Sem contagem, qualquer número aqui seria chute."
            action={
              pode(usuario, "logistica.contagem") ? (
                <Link href="/contagem" className={buttonClasses({ variant: "primary", size: "md", className: "no-underline" })}>
                  Fazer a primeira contagem
                </Link>
              ) : undefined
            }
          />
        </Section>
      ) : escolhido && !escolhido.contadoEm ? (
        <Section>
          <EmptyState icone="caixa" title={`${escolhido.nome} ainda não foi conferido`} description="Este almoxarifado entra na Projeção depois da primeira contagem. Até lá, veja o consolidado dos que já foram contados." />
        </Section>
      ) : (
        <>
          {naoConferidos.length > 0 && !escolhido && (
            <Aviso tom="neutro">
              O consolidado soma só o que já foi contado. Pedidos de {naoConferidos.map((a) => a.nome).join(" e ")} entram depois da contagem.
            </Aviso>
          )}
          {p.avisos.map((a) => (
            <Aviso key={`${a.tourId}-${a.pecaId}`} tom="warning">
              Tour {a.tourNome}: {a.peca?.nome} usa o maior valor ({a.maior}), mas há eventos ao mesmo tempo que pedem {a.pedido}. Revise.
            </Aviso>
          ))}
          <Section titulo="Saldo mínimo por semana" sub={`${p.faltas.length ? `${new Set(p.faltas.map((f) => f.pecaId)).size} ${new Set(p.faltas.map((f) => f.pecaId)).size === 1 ? "peça com falta" : "peças com falta"}. ` : "Nenhuma falta no período. "}Clique na semana para ver os eventos que explicam o número.`}>
            {visiveis.length === 0 ? (
              <EmptyState compact icone="busca" title="Nada para mostrar com estes filtros" description="Sem pedido nem previsão no período para o que está filtrado." />
            ) : (
              <MatrizProjecao semanas={p.semanas} linhas={visiveis} demandas={p.demandas.filter((d) => idsVisiveis.has(d.pecaId))} coberturas={p.coberturas.filter((c) => idsVisiveis.has(c.pecaId))} />
            )}
            {p.linhas.length > POR_PAGINA && <p className="m-0 border-t border-line-soft px-cartao py-2 text-pequeno text-ink-3">Mostrando {POR_PAGINA} de {p.linhas.length} peças, as com falta primeiro. Filtre para ver as outras, ou baixe o Excel.</p>}
          </Section>

          {p.faltas.length > 0 && (
            <Section titulo="Lista de faltas" sub="Por semana. Registre uma locação ou compra prevista e a falta coberta sai daqui.">
              <div className="overflow-x-auto">
                <table data-responsiva className="w-full border-collapse sm:min-w-[640px]">
                  <caption className="sr-only">Faltas por semana</caption>
                  <thead>
                    <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                      <th scope="col" className="px-cartao py-2.5">Semana</th>
                      <th scope="col" className="px-3 py-2.5">Peça</th>
                      <th scope="col" className="px-3 py-2.5">Almoxarifado</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Faltam</th>
                      <th scope="col" className="px-3 py-2.5 pr-cartao">Eventos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.faltas.slice(0, 100).map((f) => (
                      <tr key={`${f.inicio}-${f.pecaId}`} className="border-t border-line-row align-top">
                        <td className="numero whitespace-nowrap px-cartao py-2 text-pequeno text-ink-2">{diaMesISO(f.inicio)} a {diaMesISO(f.fim)}</td>
                        <th scope="row" className="px-3 py-2 text-left text-corpo font-normal text-ink">{f.peca.nome}</th>
                        <td className="px-3 py-2 text-pequeno text-ink-2">{escolhido?.nome ?? "Consolidado"}</td>
                        <td className="numero px-3 py-2 text-right text-corpo font-semibold text-danger">{f.faltam.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 pr-cartao text-pequeno text-ink-2">{[...new Set(f.eventos.map((e) => `${e.eventoCodigo} · ${e.eventoNome}`))].join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {p.locacao.length > 0 && (
            <Section titulo="Coberto por locação" sub="Linhas com Atende por = Locação via galpão: não consomem o estoque.">
              <ul className="m-0 list-none p-0">
                {p.locacao.slice(0, 60).map((l, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-line-row px-cartao py-2 text-pequeno first:border-t-0">
                    <span className="text-ink">{l.peca.nome} × {l.quantidade.toLocaleString("pt-BR")}</span>
                    <span className="text-ink-3">{l.eventoCodigo} · {diaMesISO(l.saida)} a {diaMesISO(l.retorno)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {p.foraDoCatalogo > 0 && <p className="m-0 text-pequeno text-ink-3">{p.foraDoCatalogo} {p.foraDoCatalogo === 1 ? "item fora do catálogo não entra" : "itens fora do catálogo não entram"} nesta conta: vincule ao catálogo para contar.</p>}
        </>
      )}
    </div>
  );
}
