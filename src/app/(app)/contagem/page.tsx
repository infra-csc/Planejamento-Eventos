import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { datasDasContagens, dadosDaContagem } from "@/server/services/saldo";
import { listarAlmoxarifados } from "@/server/services/logistica";
import { diaMesISO } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { FiltroSelectUrl } from "@/components/ui/filtro-select-url";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { ContagemTela } from "@/components/logistica/contagem-tela";

export const metadata: Metadata = { title: "Contagem de saldo" };

export default async function ContagemPage({ searchParams }: { searchParams: Promise<{ almoxarifado?: string }> }) {
  const usuario = await requirePermissao("logistica.contagem");
  const sp = await searchParams;
  const [todos, datas] = await Promise.all([listarAlmoxarifados(), datasDasContagens()]);
  const almoxarifados = todos.filter((a) => a.ativo);
  const atual = almoxarifados.find((a) => a.id === sp.almoxarifado) ?? almoxarifados.find((a) => a.principal) ?? almoxarifados[0];
  if (!atual) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Contagem de saldo" />
        <Section>
          <EmptyState icone="caixa" title="Nenhum almoxarifado ativo" description="Cadastre um almoxarifado em Cadastros logísticos." />
        </Section>
      </div>
    );
  }
  const d = await dadosDaContagem(usuario, atual.id);
  const contadoEm = datas.porAlmoxarifado.get(atual.id);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contagem de saldo"
        description="O saldo nunca é digitado solto: o que você conta aqui vira lançamento, e a Projeção libera este almoxarifado."
        actions={<FiltroSelectUrl param="almoxarifado" rotulo="Almoxarifado" todas={atual.nome} opcoes={almoxarifados.filter((a) => a.id !== atual.id).map((a) => ({ value: a.id, label: a.nome }))} className="sm:w-[220px]" />}
        meta={contadoEm ? <Badge tom="success">contado em {diaMesISO(contadoEm)}</Badge> : <Badge tom="warning">não conferido</Badge>}
      />
      <ContagemTela key={atual.id} almoxarifadoId={atual.id} almoxarifadoNome={atual.nome} jaContado={d.jaContado} pecas={d.pecas} locadores={d.locadores} saldosDeLocador={d.saldosDeLocador} historico={d.historico} />
    </div>
  );
}
