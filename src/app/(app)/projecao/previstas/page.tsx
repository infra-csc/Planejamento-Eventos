import type { Metadata } from "next";
import { asc, eq, inArray } from "drizzle-orm";
import { requirePermissao } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { eventos, pecas } from "@/server/db/schema";
import { pode } from "@/domain/permissions";
import { listarAlmoxarifados, listarLocadores } from "@/server/services/logistica";
import { listarCoberturas } from "@/server/services/saldo";
import { PageHeader } from "@/components/ui/layout";
import { CoberturasTela } from "@/components/logistica/coberturas-tela";

export const metadata: Metadata = { title: "Locação e compra previstas" };

export default async function PrevistasPage() {
  const usuario = await requirePermissao("projecao.ver");
  const db = await getDb();
  const [lista, almoxarifados, locadores, listaPecas, listaEventos] = await Promise.all([
    listarCoberturas(db),
    listarAlmoxarifados(db),
    listarLocadores(),
    db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome)),
    db.select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome }).from(eventos).where(inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])).orderBy(asc(eventos.dataInicio)),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Locação e compra previstas" description="O que vai entrar para cobrir uma falta. Registrada aqui, a falta some da Projeção. É só registro: a contratação segue fora do sistema." breadcrumbs={[{ label: "Projeção", href: "/projecao" }, { label: "Previstas" }]} />
      <CoberturasTela
        podeEditar={pode(usuario, "logistica.previsao")}
        lista={lista.map((c) => ({ id: c.id, tipo: c.tipo, pecaId: c.pecaId, peca: `${c.peca.codigo} · ${c.peca.nome}`, almoxarifadoId: c.almoxarifadoId, almoxarifado: c.almoxarifado.nome, quantidade: c.quantidade, locadorId: c.locadorId, locador: c.locador?.nome ?? null, dataEntrada: c.dataEntrada, dataDevolucao: c.dataDevolucao, eventoId: c.eventoId, evento: c.evento ? `${c.evento.codigo} · ${c.evento.nome}` : null, observacao: c.observacao }))}
        almoxarifados={almoxarifados.filter((a) => a.ativo).map((a) => ({ value: a.id, label: a.nome }))}
        locadores={locadores.filter((l) => l.ativo).map((l) => ({ value: l.id, label: l.nome }))}
        pecas={listaPecas.map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo }))}
        eventos={listaEventos.map((e) => ({ value: e.id, label: e.nome, descricao: e.codigo }))}
        principalId={almoxarifados.find((a) => a.principal)?.id ?? null}
      />
    </div>
  );
}
