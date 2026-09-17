import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento, obterLinhasAta } from "@/server/services/eventos";
import { listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { obterEventoCache } from "@/server/cache";
import { pode } from "@/domain/permissions";
import { totalPecas } from "@/domain/os";
import { classificarHistorico, COR_HISTORICO } from "@/domain/historico";
import { diaMes, diaMesHora, diaMesISO, hojeISO, isoSP, periodoCurto } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { Section } from "@/components/ui/layout";

const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86_400_000);
const contagem = (n: number, hoje: string, passado: string) => (n === 0 ? hoje : n > 0 ? `faltam ${n} ${n === 1 ? "dia" : "dias"}` : `${passado} há ${-n} ${-n === 1 ? "dia" : "dias"}`);

/** Cartão de fase: o que está acontecendo agora, para quem só quer entender o evento. */
function Cartao({ rotulo, valor, sub, tom = "neutro", href }: { rotulo: string; valor: React.ReactNode; sub?: React.ReactNode; tom?: "neutro" | "destaque" | "ok" | "atencao"; href?: string }) {
  const cls = cn(
    "flex min-w-0 flex-col gap-1 rounded-[12px] border px-4 py-3.5 no-underline",
    tom === "destaque" && "border-dark bg-dark text-white",
    tom === "ok" && "border-success-border bg-success-bg",
    tom === "atencao" && "border-warning-border bg-warning-bg",
    tom === "neutro" && "border-line bg-surface",
    href && "transition-colors hover:border-accent",
  );
  const conteudo = (
    <>
      <span className={cn("text-[11.5px] font-medium uppercase tracking-[0.06em]", tom === "destaque" ? "text-on-dark-3" : "text-muted")}>{rotulo}</span>
      <span className={cn("text-[22px] font-semibold leading-[1.1] tracking-[-0.02em]", tom === "destaque" ? "text-white" : "text-ink")}>{valor}</span>
      {sub && <span className={cn("text-[12.5px] leading-[1.4]", tom === "destaque" ? "text-on-dark-2" : "text-ink-3")}>{sub}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {conteudo}
    </Link>
  ) : (
    <div className={cls}>{conteudo}</div>
  );
}

type Grupo = { nome: string; codigo: string | null; capaId: string | null; quantidade: number; destinos: Set<string>; areas: Set<string>; ids: string[] };

/**
 * Visão geral do evento: um resumo visual para qualquer perfil (o que é, quando é, em que pé está,
 * o que vai ser montado e quem está envolvido). A parte de gestão (mudanças, ajustes, atividade)
 * fica abaixo, sem competir com a leitura rápida.
 */
export default async function EventoVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, linhas, historico, versoes] = await Promise.all([obterEventoCache(usuario, id), obterLinhasAta(id), obterHistoricoEvento(usuario, id, 6), listarOsResumo(id)]);
  const ultimaOs = versoes[0] ? (await obterConteudosOs(id, [versoes[0].numero])).get(versoes[0].numero) : null;
  const totalOs = ultimaOs ? totalPecas(ultimaOs) : 0;

  const projetos = linhas.filter((l) => l.tipo === "PROJETO");
  const pecasSoltas = linhas.filter((l) => l.tipo === "PECA");
  const foraCatalogo = linhas.filter((l) => l.tipo === "AVULSO");
  const posAta = linhas.filter((l) => l.posAta);
  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const unidades = linhas.reduce((a, l) => a + l.quantidade, 0);
  const porArea = new Map<string, number>();
  for (const l of linhas) porArea.set(l.areaNome ?? "Logística", (porArea.get(l.areaNome ?? "Logística") ?? 0) + 1);
  const areasEnvolvidas = [...porArea.entries()].sort((a, b) => b[1] - a[1]);
  const minhaArea = usuario.areaId;
  const deOutraArea = (l: (typeof linhas)[number]) => Boolean(minhaArea) && l.registro.areaId !== minhaArea;
  const AJUSTES = new Set(["ATA_QUANTIDADE", "ATA_REMOCAO", "AJUSTE_INCLUSAO", "CONFERENCIA_AJUSTE", "PECA_PROJETO_AJUSTADA", "ITEM_VINCULADO", "ATUALIZACAO_VERSAO"]);
  const ajustes = historico.filter((h) => h.entidade === "evento_item" && AJUSTES.has(h.acao));

  // Projetos agrupados (o mesmo projeto pode aparecer em várias linhas/destinos).
  const grupos = new Map<string, Grupo>();
  for (const l of projetos) {
    const k = l.projeto?.codigo ?? l.nome;
    const g = grupos.get(k) ?? { nome: l.nome, codigo: l.projeto?.codigo ?? null, capaId: null, quantidade: 0, destinos: new Set<string>(), areas: new Set<string>(), ids: [] };
    g.quantidade += l.quantidade;
    if (l.destino) g.destinos.add(l.destino);
    g.areas.add(l.areaNome ?? "Logística");
    g.ids.push(l.id);
    if (!g.capaId && l.capaId) g.capaId = l.capaId;
    grupos.set(k, g);
  }
  const galeria = [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade);

  const dEvento = diasAte(ev.dataInicio);
  const dReuniao = diasAte(isoSP(ev.dataReuniao));
  const fase =
    ev.status === "PREPARACAO"
      ? { rotulo: "Em preparação", valor: contagem(dReuniao, "reunião é hoje", "reunião foi"), sub: `As áreas enviam necessidades até a reunião de OS, ${diaMesHora(ev.dataReuniao)}.`, tom: "neutro" as const }
      : ev.status === "EM_REUNIAO"
        ? { rotulo: "Reunião de OS", valor: "acontecendo agora", sub: `${conferidas} de ${linhas.length} linhas conferidas.`, tom: "atencao" as const }
        : ev.status === "ABERTO"
          ? { rotulo: "Aberto a alterações", valor: ev.janelaAlteracoesAte ? `até ${diaMesISO(ev.janelaAlteracoesAte)}` : "até encerrar", sub: `Ata fechada em ${diaMes(ev.ataFechadaEm)}. Alterações entram como solicitação.`, tom: "ok" as const }
          : ev.status === "ENCERRADO"
            ? { rotulo: "Encerrado", valor: `OS final v${versoes[0]?.numero ?? "—"}`, sub: "Nada entra mais. O caminhão carrega o que está na OS.", tom: "neutro" as const }
            : { rotulo: "Cancelado", valor: "evento cancelado", sub: ev.canceladoMotivo ?? undefined, tom: "neutro" as const };

  return (
    <div className="flex flex-col gap-5">
      {/* Leitura rápida: quando é, em que pé está, o que vai ser montado. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo="Evento" valor={periodoCurto(ev.dataInicio, ev.dataFim)} sub={contagem(dEvento, "é hoje", "aconteceu")} tom="destaque" />
        <Cartao rotulo={fase.rotulo} valor={fase.valor} sub={fase.sub} tom={fase.tom} />
        <Cartao
          rotulo="Vai ser montado"
          valor={`${projetos.length + pecasSoltas.length + foraCatalogo.length} itens`}
          sub={`${projetos.length} ${projetos.length === 1 ? "projeto" : "projetos"} · ${unidades} unidades · ${areasEnvolvidas.length} ${areasEnvolvidas.length === 1 ? "área" : "áreas"}`}
          href={ev.ataFechadaEm ? `/eventos/${id}/os?visao=composicao` : `/eventos/${id}/ata`}
        />
        <Cartao
          rotulo="Ordem de serviço"
          valor={versoes.length ? `v${versoes[0].numero} · ${totalOs} peças` : "ainda não gerada"}
          sub={versoes.length ? `${versoes.length} ${versoes.length === 1 ? "versão" : "versões"} · última em ${diaMes(versoes[0].geradaEm)}${posAta.length ? ` · ${posAta.length} ${posAta.length === 1 ? "item" : "itens"} depois da ata` : ""}` : "gerada ao fechar a ata; veja a prévia"}
          href={pode(usuario, "os.ver") ? `/eventos/${id}/os` : undefined}
        />
      </div>

      <Section
        titulo="O que vai ser montado"
        sub={ev.ataFechadaEm ? "Projetos e peças que estão na OS. Clique para ver detalhes, quem pediu e o histórico." : "Projetos e peças já na ata em construção. Clique para ver detalhes e quem pediu."}
        acoes={
          <Link href={ev.ataFechadaEm ? `/eventos/${id}/os?visao=projetos` : `/eventos/${id}/ata`} className="link text-[12.5px]">
            Ver tudo
          </Link>
        }
      >
        {linhas.length === 0 ? (
          <div className="px-[18px] py-10 text-center">
            <p className="m-0 text-[14px] font-medium">Nada na ata ainda</p>
            <p className="mt-1 text-[12.5px] text-muted">Quando as áreas enviarem necessidades, os projetos aparecem aqui com foto.</p>
          </div>
        ) : (
          <div className="px-[18px] py-4">
            {galeria.length > 0 && (
              <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 xl:grid-cols-4">
                {galeria.map((g) => (
                  <li key={g.codigo ?? g.nome} className="overflow-hidden rounded-[10px] border border-line bg-surface">
                    <Link href={`/eventos/${id}/itens/${g.ids[0]}`} className="block no-underline">
                      {g.capaId ? <ImagemZoom src={`/api/anexos/${g.capaId}`} alt={g.nome} className="aspect-[4/3] w-full bg-white" /> : <div className="grid aspect-[4/3] w-full place-items-center bg-subtle text-[11.5px] text-meta">sem foto</div>}
                      <div className="px-3 py-2.5">
                        <p className="m-0 flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-[13px] font-medium text-ink" title={g.nome}>
                            {g.nome}
                          </span>
                          <span className="shrink-0 rounded-[5px] bg-dark px-1.5 font-mono text-[12px] text-accent-light">× {g.quantidade}</span>
                        </p>
                        <p className="mb-0 mt-0.5 truncate text-[11.5px] text-muted" title={[...g.destinos].join(" · ")}>
                          {[...g.destinos].join(" · ") || [...g.areas].join(" · ")}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {(pecasSoltas.length > 0 || foraCatalogo.length > 0) && (
              <div className={cn("flex flex-wrap gap-1.5", galeria.length > 0 && "mt-4 border-t border-line-soft pt-4")}>
                {pecasSoltas.map((l) => (
                  <Link key={l.id} href={`/eventos/${id}/itens/${l.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink no-underline hover:border-accent">
                    {l.nome} <span className="font-mono text-ink-3">× {l.quantidade}</span>
                  </Link>
                ))}
                {foraCatalogo.map((l) => (
                  <Link key={l.id} href={`/eventos/${id}/itens/${l.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-bg px-2.5 py-1 text-[12.5px] text-ink no-underline hover:border-warning">
                    {l.nome} <span className="font-mono text-ink-3">× {l.quantidade}</span>
                    <span className="text-[10.5px] text-warning">fora do catálogo</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          {ev.ataFechadaEm && (
            <Section titulo="Depois da ata" sub={posAta.length ? "Entrou na OS depois da reunião: alterações atendidas e ajustes da logística." : "Nada entrou depois da reunião. A OS reflete a ata."}>
              {posAta.slice(0, 8).map((l) => (
                <Link key={l.id} href={`/eventos/${id}/itens/${l.id}`} className="flex items-center gap-3 border-b border-line-row px-[18px] py-2.5 text-[13px] no-underline last:border-b-0 hover:bg-subtle">
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {l.nome}
                    {deOutraArea(l) && (
                      <Tag className="ml-2" tom="muted">
                        {l.areaNome ?? "Logística"}
                      </Tag>
                    )}
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-3">{l.origemLabel}</span>
                  <span className="shrink-0 font-mono text-[13px] font-medium text-ink">{l.quantidade}</span>
                </Link>
              ))}
              {posAta.length > 8 && (
                <Link href={`/eventos/${id}/os?visao=composicao`} className="link block px-[18px] py-2.5 text-[12.5px]">
                  Mais {posAta.length - 8} itens
                </Link>
              )}
            </Section>
          )}

          <Section titulo="Ajustes" sub={ajustes.length ? "Mudanças de quantidade, peças de projeto, retiradas e vínculos, com quem fez." : "Nenhum ajuste até agora."}>
            {ajustes.slice(0, 5).map((h) => (
              <Link key={h.id} href={`/eventos/${id}/itens/${h.entidadeId}`} className="flex gap-3 border-b border-line-row px-[18px] py-2.5 no-underline last:border-b-0 hover:bg-subtle">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2" title={h.descricao}>
                  {h.descricao}
                </span>
                <span className="shrink-0 text-[11.5px] text-muted">{h.usuario?.nome ?? "Sistema"}</span>
                <span className="shrink-0 font-mono text-[11.5px] text-meta">{diaMesHora(h.criadoEm)}</span>
              </Link>
            ))}
          </Section>

          <Section
            titulo="Atividade"
            acoes={
              <Link href={`/eventos/${id}/historico`} className="link text-[12.5px]">
                Ver histórico completo
              </Link>
            }
          >
            <div className="px-[18px] py-3.5">
              {historico.length === 0 && <p className="m-0 text-[12.5px] text-muted">Sem registros.</p>}
              {historico.map((h) => {
                const c = classificarHistorico(h);
                return (
                  <div key={h.id} className="flex gap-[13px] py-[7px]">
                    <span aria-hidden className={cn("mt-1.5 block size-[7px] shrink-0", c.tipo === "marco" ? "rounded-[2px]" : "rounded-full")} style={{ background: COR_HISTORICO[c.tipo] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink">{c.titulo}</span>
                      <span className="block text-[12px] text-muted">{c.detalhe || h.usuario?.nome || "Sistema"}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11.5px] text-meta">{diaMesHora(h.criadoEm)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section titulo="Quem está envolvido">
            <div className="px-[18px] py-3.5">
              <p className="m-0 flex items-center gap-2.5 text-[13px]">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-dark text-[12px] font-semibold text-white">{ev.responsavel.nome.slice(0, 1)}</span>
                <span>
                  <span className="block text-ink">{ev.responsavel.nome}</span>
                  <span className="block text-[11.5px] text-muted">responsável na logística</span>
                </span>
              </p>
              {areasEnvolvidas.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {areasEnvolvidas.map(([nome, n]) => (
                    <span key={nome} className="inline-flex items-center gap-1.5 rounded-full bg-control px-2.5 py-1 text-[12px] text-ink">
                      {nome} <span className="font-mono text-ink-3">{n}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mb-0 mt-3 text-[12.5px] text-muted">Nenhuma área enviou necessidades ainda.</p>
              )}
            </div>
          </Section>

          <Section titulo="Datas">
            <ol className="m-0 list-none px-[18px] py-3">
              {[
                { rotulo: "Reunião de OS", quando: diaMesHora(ev.dataReuniao), feito: Boolean(ev.ataFechadaEm) || ev.status === "EM_REUNIAO", atual: ev.status === "EM_REUNIAO" },
                { rotulo: "Ata fechada", quando: ev.ataFechadaEm ? diaMesHora(ev.ataFechadaEm) : "ainda não", feito: Boolean(ev.ataFechadaEm), atual: false },
                ...(ev.janelaAlteracoesAte ? [{ rotulo: "Alterações até", quando: diaMesISO(ev.janelaAlteracoesAte), feito: hojeISO() > ev.janelaAlteracoesAte, atual: false }] : []),
                { rotulo: "Evento", quando: periodoCurto(ev.dataInicio, ev.dataFim), feito: dEvento < 0, atual: dEvento === 0 },
              ].map((d, i, arr) => (
                <li key={d.rotulo} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < arr.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-line" />}
                  <span aria-hidden className={cn("relative mt-[5px] block size-[11px] shrink-0 rounded-full ring-2 ring-surface", d.atual ? "bg-accent" : d.feito ? "bg-dark" : "bg-line-strong")} />
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <span className={cn("text-[13px]", d.feito || d.atual ? "text-ink" : "text-ink-3")}>{d.rotulo}</span>
                    <span className="font-mono text-[12.5px] text-ink-2">{d.quando}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section titulo="Atalhos">
            <div className="flex flex-col gap-2 px-[18px] py-3.5">
              {pode(usuario, "solicitacao.criar") && (ev.status === "PREPARACAO" || ev.status === "ABERTO") && (
                <ButtonLink href={`/solicitacoes/nova?evento=${id}`} variant="primary" size="md" className="no-underline">
                  {ev.status === "PREPARACAO" ? "Enviar necessidades" : "Solicitar alteração"}
                </ButtonLink>
              )}
              {pode(usuario, "os.ver") && versoes.length > 0 && (
                <ButtonLink href={`/impressao/os/${id}`} target="_blank" variant="secondary" size="md" className="no-underline">
                  Imprimir OS v{versoes[0].numero}
                </ButtonLink>
              )}
              <ButtonLink href={`/eventos/${id}/solicitacoes`} variant="secondary" size="md" className="no-underline">
                Solicitações do evento
              </ButtonLink>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
