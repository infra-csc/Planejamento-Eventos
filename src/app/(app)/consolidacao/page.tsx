import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { consolidarPeriodo } from "@/server/services/consolidacao";
import { SETOR_LABEL } from "@/domain/os";
import { EmptyState, Notice, PageHeader, Panel, Stat, TableWrap } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Badge } from "@/components/ui/badge";
import { PeriodoForm } from "@/components/consolidacao/periodo-form";
import { addDiasISO, formatarData, hojeISO } from "@/lib/format";

export const metadata: Metadata = { title: "Consolidação" };

export default async function ConsolidacaoPage({ searchParams }: { searchParams: Promise<{ inicio?: string; fim?: string }> }) {
  const usuario = await requirePermissao("consolidacao.ver");
  const sp = await searchParams;
  const hoje = hojeISO();
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(sp.inicio ?? "") ? sp.inicio! : hoje;
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(sp.fim ?? "") && sp.fim! >= inicio ? sp.fim! : addDiasISO(inicio, 30);
  const { eventos, pecas } = await consolidarPeriodo(usuario, { inicio, fim });
  const deficit = pecas.filter((p) => p.saldo < 0);

  return (
    <>
      <PageHeader title="Consolidação por período" description="Demanda de peças de todos os eventos que ocupam o período (montagem → desmontagem) × estoque próprio. Eventos simultâneos competem pela mesma peça; o pico diário mostra o pior dia. Visão inicial (RV-02): estoque vem do cadastro da peça." />
      <TabsNav className="mb-4" tabs={[{ href: "/consolidacao", label: "Demanda × estoque", exact: true }, { href: "/consolidacao/pendencias", label: "Pendências de compra/locação" }]} />
      <PeriodoForm inicio={inicio} fim={fim} />
      <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Eventos no período" value={eventos.length} />
        <Stat label="Peças demandadas" value={pecas.length} />
        <Stat label="Peças em déficit" value={deficit.length} tone={deficit.length > 0 ? "danger" : "success"} hint="pico acima do estoque" />
        <Stat label="Unidades a locar/comprar" value={deficit.reduce((a, p) => a + Math.abs(p.saldo), 0)} tone={deficit.length > 0 ? "warning" : undefined} />
      </div>

      {eventos.length > 0 && (
        <Notice tone="info" className="mb-4">
          Eventos considerados:{" "}
          {eventos.map((e, i) => (
            <span key={e.id}>
              {i > 0 && " · "}
              <Link href={`/eventos/${e.id}/os`} className="underline">
                {e.codigo} {e.nome}
              </Link>{" "}
              ({formatarData(e.dataMontagem)}–{formatarData(e.dataDesmontagem)})
            </span>
          ))}
        </Notice>
      )}

      <Panel padded={false}>
        {pecas.length === 0 ? (
          <EmptyState title="Nenhuma demanda no período" description="Não há eventos com OS ocupando estas datas, ou as atas ainda não têm linhas." compact />
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Peça</th>
                  <th className="hidden sm:table-cell">Setor</th>
                  <th className="num">Estoque</th>
                  <th className="num">Pico</th>
                  <th className="hidden md:table-cell">Dia do pico</th>
                  <th className="num">Saldo</th>
                  <th className="hidden lg:table-cell">Eventos no pico</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((p) => (
                  <tr key={p.pecaId}>
                    <td>
                      <span className="font-medium tabular">{p.codigo}</span> · {p.nome}
                    </td>
                    <td className="hidden sm:table-cell text-ink-muted">{SETOR_LABEL[p.setor]}</td>
                    <td className="num tabular">{p.estoque}</td>
                    <td className="num tabular font-medium">{p.pico}</td>
                    <td className="hidden md:table-cell tabular">{p.diaPico ? formatarData(p.diaPico) : "—"}</td>
                    <td className="num">
                      {p.saldo < 0 ? (
                        <Badge tone="danger">faltam {Math.abs(p.saldo)}</Badge>
                      ) : (
                        <span className="tabular text-success">+{p.saldo}</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell text-xs text-ink-muted">{p.eventosNoPico.map((e) => `${e.codigo} (${e.quantidade})`).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
