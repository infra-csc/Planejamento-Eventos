import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { podeGerenciarEstoque } from "@/domain/estoque";
import { requireUsuario } from "@/server/auth/session";
import { NaoEncontradoError } from "@/domain/errors";
import { obterItemAtivacao } from "@/server/services/ativacao";
import { diaMes, diaMesHora, formatarData, periodoCurto } from "@/lib/format";
import { adicionarAnexoEstoqueAction, removerAnexoEstoqueAction } from "@/app/(app)/ativacao/actions";
import { PageHeader, Section, Metric, MetricStrip } from "@/components/ui/layout";
import { Tag } from "@/components/ui/badge";
import { Codigo } from "@/components/ui/numero";
import { AnexosPeca } from "@/components/catalogo/anexos-peca";
import { BotaoReformaItem } from "@/components/estoque/botao-reforma-item";
import { BotaoEditarItemEstoque } from "@/components/estoque/estoque-tela";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const { id } = await params;
  const d = await obterItemAtivacao(usuario, id).catch(() => null);
  return { title: d ? `Ativação · ${d.item.nome}` : "Ativação" };
}

/** Um item do estoque da Ativação: quanto tem e onde está, fotos, eventos que levam, retornos, reformas e histórico. */
export default async function ItemAtivacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const { id } = await params;
  // Catálogo para o "Editar item" (mesma consulta da lista do estoque), em paralelo com o item.
  const [d, catalogo] = await Promise.all([
    obterItemAtivacao(usuario, id).catch((e) => {
      if (e instanceof NaoEncontradoError) notFound();
      throw e;
    }),
    getDb().then((db) => db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome))),
  ]);
  const { item, situacao } = d;
  const reformasAbertas = d.reformas.filter((r) => r.status === "ABERTA");
  const anexosItem = d.anexos.filter((a) => !a.reformaId);
  const anexosReforma = d.anexos.filter((a) => a.reformaId);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[{ label: "Ativação", href: "/ativacao" }, { label: item.nome }]}
        title={item.nome}
        eyebrow={
          <>
            <span>{item.categoria}</span>
            <span aria-hidden>·</span>
            {item.peca ? (
              <span>
                sai com a OS como <Codigo>{item.peca.codigo}</Codigo> ({item.peca.nome})
              </span>
            ) : (
              <span>sem peça do catálogo: não sai com a OS</span>
            )}
            {!item.ativo && <Tag tom="neutral">inativo</Tag>}
          </>
        }
        description={item.observacao ?? undefined}
        actions={
          <>
            <BotaoReformaItem item={{ id: item.id, nome: item.nome, quantidade: item.quantidade }} />
            <BotaoEditarItemEstoque item={item} catalogo={catalogo} />
          </>
        }
      />

      <MetricStrip>
        <Metric label="Em posse" valor={situacao.emPosse} hint="em bom estado, no galpão ou em evento" />
        <Metric label="Em evento" valor={situacao.emEvento} hint={situacao.reservado ? `+${situacao.reservado} reservado para eventos que vão montar` : "saiu com a OS e não voltou"}  />
        <Metric label="Em reforma" valor={situacao.emReforma} tom={situacao.emReforma ? "warning" : "neutro"} href="/ativacao/reformas" />
        <Metric label="Disponível agora" valor={situacao.disponivel} hint={item.comprar ? `comprar ${item.comprar}` : undefined} tom={situacao.disponivel === 0 ? "danger" : "success"} />
      </MetricStrip>

      <Section titulo="Fotos e anexos" sub="Fotos de estrago e orçamentos ficam em Reformas.">
        <AnexosPeca
          pecaId={item.id}
          anexos={anexosItem}
          podeGerenciar
          urlBase="/api/ativacao/anexos"
          campos={{ itemId: item.id }}
          adicionar={adicionarAnexoEstoqueAction}
          remover={removerAnexoEstoqueAction}
          vazio="Nenhuma foto ainda. Inclua uma foto do item: ela aparece na lista do estoque e nos detalhes da solicitação."
        />
      </Section>

      {/* A frase de apoio de cada seção só aparece quando há o que explicar: vazia, a seção dizia a mesma coisa
          duas vezes ("Nada em reforma agora." em cima de "Este item nunca foi para reforma."). */}
      <Section titulo="Eventos" sub={d.eventos.length ? "Com OS que leva o item e retorno ainda não registrado." : undefined}>
        {d.eventos.length === 0 ? (
          <p className="m-0 px-cartao py-4 text-pequeno text-muted">{item.peca ? "Nenhum evento com OS leva este item agora." : "Ligue o item a uma peça do catálogo (Editar item, no topo) para ele sair com a OS."}</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-line-row p-0">
            {d.eventos.map((e) => (
              <li key={e.evento.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-cartao py-2.5 text-corpo">
                <Link href={`/eventos/${e.evento.id}`} className="font-medium text-ink no-underline hover:underline">
                  {e.evento.nome}
                </Link>
                <span className="text-pequeno text-ink-3">
                  <Codigo>{e.evento.codigo}</Codigo> · <span className="numero">{periodoCurto(e.evento.dataMontagem, e.evento.dataDesmontagem)}</span>
                </span>
                <span className="numero ml-auto font-semibold">{e.levou}</span>
                <Tag tom={e.saiu ? "warning" : "info"}>{e.saiu ? "fora · retorno pendente" : "reservado"}</Tag>
              </li>
            ))}
          </ul>
        )}
        {d.eventos.some((e) => e.saiu) && (
          <p className="m-0 border-t border-line-soft px-cartao py-2.5 text-pequeno">
            <Link href="/ativacao/retornos" className="link">
              Registrar retornos
            </Link>
          </p>
        )}
      </Section>

      <Section titulo="Reformas" sub={reformasAbertas.length ? `${reformasAbertas.reduce((a, r) => a + r.quantidade, 0)} em reforma agora.` : d.reformas.length ? "Nada em reforma agora." : undefined}>
        {d.reformas.length === 0 ? (
          <p className="m-0 px-cartao py-4 text-pequeno text-muted">Este item nunca foi para reforma.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-line-row p-0">
            {d.reformas.map((r) => (
              <li key={r.id} className="px-cartao py-2.5 text-pequeno">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <b className="numero text-corpo font-semibold">{r.quantidade}</b>
                  <span className="text-ink-2">{r.motivo || "sem motivo informado"}</span>
                  <Tag tom={r.status === "ABERTA" ? "warning" : "success"} className="ml-auto">
                    {r.status === "ABERTA" ? "em reforma" : `concluída · ${r.consertados ?? 0} voltaram${r.baixados ? `, ${r.baixados} baixados` : ""}`}
                  </Tag>
                </span>
                <span className="mt-0.5 block text-rotulo text-muted">
                  {r.evento ? `voltou do ${r.evento.codigo} ${r.evento.nome}` : "separado no estoque"} · desde {diaMes(r.criadoEm)}
                  {r.local && ` · em ${r.local}`}
                  {r.previsao && ` · previsão ${formatarData(r.previsao)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {reformasAbertas.length > 0 && (
          <div className="border-t border-line-soft">
            <p className="m-0 px-cartao pt-3 text-pequeno font-medium text-ink-2">Fotos do estrago e orçamentos da reforma em andamento</p>
            <AnexosPeca
              pecaId={item.id}
              anexos={anexosReforma}
              podeGerenciar
              urlBase="/api/ativacao/anexos"
              campos={{ itemId: item.id, reformaId: reformasAbertas[0].id }}
              adicionar={adicionarAnexoEstoqueAction}
              remover={removerAnexoEstoqueAction}
              vazio="Nenhuma foto da reforma ainda."
            />
          </div>
        )}
      </Section>

      <Section titulo="Retornos">
        {d.retornos.length === 0 ? (
          <p className="m-0 px-cartao py-4 text-pequeno text-muted">Nenhum retorno registrado.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-line-row p-0">
            {d.retornos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-cartao py-2.5 text-pequeno">
                <span className="font-medium text-ink">
                  <Codigo>{r.evento.codigo}</Codigo> {r.evento.nome}
                </span>
                <span className="text-ink-2">
                  levou {r.levou} · <span className="text-success">{r.voltaram} voltaram</span>
                  {r.reforma > 0 && <span className="text-warning"> · {r.reforma} para reforma</span>}
                  {r.perdidos > 0 && <span className="text-danger"> · {r.perdidos} perdidos</span>}
                </span>
                <span className="ml-auto text-rotulo text-muted">
                  {r.por ?? "—"} · {diaMesHora(r.em)}
                </span>
                {r.observacao && <span className="basis-full text-rotulo text-muted">{r.observacao}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titulo="Histórico" sub={d.historico.length >= 30 ? "Últimas 30 mudanças." : undefined}>
        {d.historico.length === 0 ? (
          <p className="m-0 px-cartao py-4 text-pequeno text-muted">Sem registros.</p>
        ) : (
          <ol className="m-0 list-none divide-y divide-line-row p-0">
            {d.historico.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-3 px-cartao py-2 text-pequeno">
                <span className="text-ink-2">{h.descricao}</span>
                <span className="ml-auto text-rotulo text-muted">
                  {h.por ?? "Sistema"} · {diaMesHora(h.criadoEm)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
