import type { Metadata } from "next";
import { desc, inArray } from "drizzle-orm";
import { requirePermissao } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { eventos } from "@/server/db/schema";
import { listarAreasCache } from "@/server/cache";
import { listarAlmoxarifados, listarEventosPai, listarLocadores, listarPerfis, listarTours } from "@/server/services/logistica";
import { datasDasContagens } from "@/server/services/saldo";
import { PageHeader } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";
import { AlmoxarifadosPainel, EventosPaiPainel, LocadoresPainel, PerfisPainel, ToursPainel } from "@/components/logistica/cadastros-painel";

export const metadata: Metadata = { title: "Cadastros logísticos" };

const ABAS = [
  ["almoxarifados", "Almoxarifados"],
  ["locadores", "Locadores"],
  ["perfis", "Perfis de veículo"],
  ["eventos-pai", "Eventos pai"],
  ["tours", "Tours"],
] as const;

export default async function CadastrosPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requirePermissao("logistica.cadastros");
  const { aba: pedida } = await searchParams;
  const aba = ABAS.find(([k]) => k === pedida)?.[0] ?? "almoxarifados";
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Cadastros logísticos" description="O que a Projeção e a contagem usam. Listas simples: nada aqui muda regra." />
      <TabsNav rotulo="Cadastros logísticos" tabs={ABAS.map(([k, label]) => ({ href: `/cadastros?aba=${k}`, label, exact: true, ativo: k === aba }))} />
      {aba === "almoxarifados" && <Almoxarifados />}
      {aba === "locadores" && <LocadoresPainel lista={await listarLocadores()} />}
      {aba === "perfis" && <PerfisPainel lista={await listarPerfis()} />}
      {aba === "eventos-pai" && <EventosPaiPainel lista={await listarEventosPai()} />}
      {aba === "tours" && <Tours />}
    </div>
  );
}

async function Almoxarifados() {
  const [lista, datas, areas] = await Promise.all([listarAlmoxarifados(), datasDasContagens(), listarAreasCache()]);
  return (
    <AlmoxarifadosPainel
      lista={lista.map((a) => ({ id: a.id, nome: a.nome, endereco: a.endereco, areaId: a.areaId, area: a.area?.nome ?? null, principal: a.principal, ativo: a.ativo, contadoEm: datas.porAlmoxarifado.get(a.id) ?? null }))}
      areas={areas.filter((a) => a.ativo).map((a) => ({ value: a.id, label: a.nome }))}
    />
  );
}

async function Tours() {
  const db = await getDb();
  const [lista, evs] = await Promise.all([listarTours(), db.select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome }).from(eventos).where(inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])).orderBy(desc(eventos.dataInicio))]);
  return <ToursPainel lista={lista.map((t) => ({ id: t.id, nome: t.nome, ativo: t.ativo, eventos: t.eventos.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome })) }))} eventos={evs} />;
}
