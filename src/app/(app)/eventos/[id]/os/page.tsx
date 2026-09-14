import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { requirePermissao } from "@/server/auth/session";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsVersoes } from "@/server/services/os";
import { getDb } from "@/server/db";
import { diffOS, osIguais, SETOR_LABEL, totalPecas } from "@/domain/os";
import { EmptyState, Notice, Panel, TableWrap } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Badge } from "@/components/ui/badge";
import { formatarDataHora } from "@/lib/format";
import type { OsGatilho } from "@/server/db/schema";

const GATILHO_LABEL: Record<OsGatilho, string> = {
  ATA_FECHADA: "Ata fechada",
  RESPOSTA_SOLICITACAO: "Resposta a solicitação",
  CORRECAO_RESPOSTA: "Correção de resposta",
  AJUSTE_LOGISTICA: "Ajuste da logística",
  ATUALIZACAO_PROJETO: "Atualização de projeto",
  REABERTURA: "Reabertura",
  ENCERRAMENTO: "Encerramento (OS final)",
};

export default async function OsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.ver");
  const { id } = await params;
  const { v } = await searchParams;
  const [ev, versoes, atual] = await Promise.all([obterEvento(usuario, id), listarOsVersoes(id), calcularOsAtual(await getDb(), id)]);
  const selecionada = v ? versoes.find((x) => String(x.numero) === v) : null;
  const os = selecionada ? selecionada.conteudo : atual;
  const ultima = versoes[0];
  const emDia = ultima ? osIguais(ultima.conteudo, atual) : false;

  if (!ev.ataFechadaEm && versoes.length === 0) {
    return (
      <Panel>
        <EmptyState title="A OS ainda não foi gerada" description="Ela é criada automaticamente quando a logística fecha a ata da reunião. Até lá, a aba Ata mostra a prévia do que será somado." compact />
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <div className="space-y-4 lg:col-span-3">
        {selecionada ? (
          <Notice tone="info">
            Exibindo a versão {selecionada.numero} ({GATILHO_LABEL[selecionada.gatilho]}, {formatarDataHora(selecionada.geradaEm)}).{" "}
            <Link href={`/eventos/${id}/os`} className="underline">
              Voltar para a OS atual
            </Link>
            .
          </Notice>
        ) : !emDia && ultima ? (
          <Notice tone="warning">A ata atual difere da última versão gerada. Isso não deveria acontecer; exporte com cautela e avise o administrador.</Notice>
        ) : null}

        {os.setores.length === 0 && os.semSetor.length === 0 && (
          <Panel>
            <EmptyState title="OS vazia" description="Nenhuma linha da ata gera peças." compact />
          </Panel>
        )}

        {os.setores.map((s) => (
          <Panel
            key={s.setor}
            title={`OS · ${SETOR_LABEL[s.setor]}`}
            description={`${s.linhas.length} tipo(s) de peça · ${s.linhas.reduce((a, l) => a + l.total, 0)} unidades`}
            actions={
              <a href={`/api/os/${id}/${s.setor}${selecionada ? `?v=${selecionada.numero}` : ""}`} className={buttonClasses({ size: "sm" })}>
                <Download className="size-3.5" /> CSV
              </a>
            }
            padded={false}
          >
            <TableWrap>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Peça</th>
                    <th className="num">Total</th>
                    <th className="hidden md:table-cell">Composição</th>
                  </tr>
                </thead>
                <tbody>
                  {s.linhas.map((l) => (
                    <tr key={l.pecaId}>
                      <td className="font-medium tabular">{l.codigo}</td>
                      <td>{l.nome}</td>
                      <td className="num tabular font-semibold">
                        {l.total} <span className="text-xs font-normal text-ink-muted">{l.unidade}</span>
                      </td>
                      <td className="hidden md:table-cell text-xs text-ink-muted">{l.origens.map((o) => `${o.descricao} → ${o.quantidade}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        ))}

        {os.semSetor.length > 0 && (
          <Panel title="Itens avulsos (sem peça de catálogo)" description="Listados para separação manual; não entram na soma por peça." padded={false}>
            <TableWrap>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th className="num">Qtd.</th>
                    <th>Destino</th>
                    <th>Área</th>
                  </tr>
                </thead>
                <tbody>
                  {os.semSetor.map((a, i) => (
                    <tr key={i}>
                      <td>{a.descricao}</td>
                      <td className="num tabular">{a.quantidade}</td>
                      <td>{a.destino ?? "—"}</td>
                      <td>{a.area ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </div>

      <div className="space-y-4">
        <Panel title="Exportar">
          <div className="flex flex-col gap-2">
            <ButtonLink href={`/impressao/os/${id}${selecionada ? `?v=${selecionada.numero}` : ""}`} target="_blank">
              <Printer className="size-4" /> Imprimir / PDF
            </ButtonLink>
            <p className="text-xs text-ink-muted">Total de peças: {totalPecas(os)}. A OS nunca é editada à mão: mudanças vêm de respostas e ajustes registrados.</p>
          </div>
        </Panel>
        <Panel title="Versões" description="Cada resposta ou ajuste gera uma versão. O que mudou aparece em relação à anterior." padded={false}>
          <ol className="divide-y divide-line">
            {versoes.map((ver, idx) => {
              const anterior = versoes[idx + 1];
              const diff = anterior ? diffOS(anterior.conteudo, ver.conteudo) : [];
              const ativa = selecionada ? selecionada.id === ver.id : idx === 0;
              return (
                <li key={ver.id} className={`px-4 py-3 text-[13px] ${ativa ? "bg-brand-soft/50" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Link href={idx === 0 ? `/eventos/${id}/os` : `/eventos/${id}/os?v=${ver.numero}`} className="font-medium text-ink hover:underline">
                      v{ver.numero} · {GATILHO_LABEL[ver.gatilho]}
                    </Link>
                    {ver.gatilho === "ENCERRAMENTO" && <Badge tone="brand">final</Badge>}
                  </div>
                  <p className="text-xs text-ink-muted">
                    {formatarDataHora(ver.geradaEm)} · {ver.geradaPor?.nome ?? "—"}
                  </p>
                  {ver.descricao && <p className="mt-0.5 text-xs text-ink-secondary">{ver.descricao}</p>}
                  {anterior && (
                    <p className="mt-1 text-xs text-ink-secondary">
                      {diff.length === 0 ? "Sem mudança nas quantidades." : diff.map((d) => `${d.codigo}: ${d.antes} → ${d.depois}`).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </div>
  );
}

