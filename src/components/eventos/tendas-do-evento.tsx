"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { conferirLinhaAction } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { descricaoDaUnidade } from "@/domain/unidades-tenda";
import { EditarTendaDialog, type TendaDoLocal } from "./acoes-linha-evento";
import type { LinhaMesmoItem } from "./mesmo-item-no-evento";

/** Um local da tenda no evento: as linhas dele (uma da reunião, outra incluída depois…) somadas num quadro só. */
export type LocalDaTenda = { chave: string; quadro: TendaDoLocal; linhas: LinhaMesmoItem[] };

/**
 * Quadro das tendas de um projeto no evento, como na solicitação: um local por linha com tendas, fechamentos e calhas,
 * quem pediu e o "Editar" do local; total embaixo. A descrição de cada tenda abre embaixo do local.
 */
export function TendasDoEvento({
  eventoId,
  atualId,
  locais,
  editavel,
  ataFechada,
  podeConferir,
}: {
  eventoId: string;
  atualId: string;
  locais: LocalDaTenda[];
  editavel: boolean;
  ataFechada: boolean;
  podeConferir: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const temCalha = locais.some((l) => l.quadro.temCalha);
  const soma = (f: (q: TendaDoLocal) => number) => locais.reduce((a, l) => a + f(l.quadro), 0);
  const colunas = 4 + (temCalha ? 1 : 0) + (editavel ? 1 : 0);
  const emEdicao = locais.find((l) => l.chave === editando);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <CaptionOculta>Tendas por local</CaptionOculta>
        <thead>
          <tr>
            <Th>Local</Th>
            <Th largura={84} alinhar="right">Tendas</Th>
            <Th largura={112} alinhar="right">Fechamentos</Th>
            {temCalha && <Th largura={84} alinhar="right">Calhas</Th>}
            <Th className="hidden md:table-cell">Pedido por</Th>
            {editavel && <Th largura={96}><span className="sr-only">Ações</span></Th>}
          </tr>
        </thead>
        <tbody>
          {locais.map((l) => (
            <LinhaLocal key={l.chave} eventoId={eventoId} atualId={atualId} local={l} temCalha={temCalha} colunas={colunas} editavel={editavel} podeConferir={podeConferir} onEditar={() => setEditando(l.chave)} />
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-subtle">
            <th scope="row" className="px-cartao py-2.5 text-pequeno font-semibold text-ink">
              Total · {locais.length} {locais.length === 1 ? "local" : "locais"}
            </th>
            <td className="numero px-3 py-2.5 text-right text-corpo font-semibold text-ink">{soma((q) => q.tendas)}</td>
            <td className="numero px-3 py-2.5 text-right text-corpo font-semibold text-ink">{soma((q) => q.fechamentos)}</td>
            {temCalha && <td className="numero px-3 py-2.5 text-right text-corpo font-semibold text-ink">{soma((q) => q.calhas)}</td>}
            <td className="hidden md:table-cell" />
            {editavel && <td />}
          </tr>
        </tfoot>
      </table>
      {emEdicao && <EditarTendaDialog eventoId={eventoId} tenda={emEdicao.quadro} ataFechada={ataFechada} onFechar={() => setEditando(null)} />}
    </div>
  );
}

function LinhaLocal({
  eventoId,
  atualId,
  local,
  temCalha,
  colunas,
  editavel,
  podeConferir,
  onEditar,
}: {
  eventoId: string;
  atualId: string;
  local: LocalDaTenda;
  temCalha: boolean;
  colunas: number;
  editavel: boolean;
  podeConferir: boolean;
  onEditar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const { quadro, linhas } = local;
  const atual = linhas.some((x) => x.id === atualId);
  const areas = [...new Set(linhas.map((x) => x.area ?? "Logística"))].join(", ");
  // "incluída por Fulano" em cada linha vira só os nomes, uma vez cada.
  const quem = [...new Set(linhas.map((x) => x.solicitante?.replace(/^incluída por /, "")).filter(Boolean))].join(", ");
  const temDescricao = linhas.some((x) => x.codigo || x.descricao || x.observacao || (x.descricoesPorUnidade ?? []).some(Boolean));
  const celula = "border-b border-line-row px-3 py-2.5 align-top";
  return (
    <>
      <tr className={cn(atual && "bg-selected")}>
        <th scope="row" className={cn(celula, "pl-cartao font-normal")}>
          <span className="flex items-start gap-2.5">
            <Conferencia eventoId={eventoId} linhas={linhas} podeConferir={podeConferir} rotulo={quadro.local ?? "Local não informado"} />
            <span className="min-w-0">
              <span className="block text-corpo font-medium text-ink">{quadro.local ?? <span className="text-muted">local não informado</span>}</span>
              {linhas.length > 1 && <span className="block text-rotulo text-ink-3">{linhas.length} linhas somadas neste local</span>}
              <span className="block text-rotulo text-ink-3 md:hidden">
                {areas}
                {quem ? ` · ${quem}` : ""}
              </span>
              <span className="mt-0.5 flex flex-wrap gap-x-3 text-rotulo">
                {atual ? <span className="font-medium text-accent">você está aqui</span> : <Link href={`/eventos/${eventoId}/itens/${linhas[0].id}`} className="link">abrir</Link>}
                {temDescricao && (
                  <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="link cursor-pointer border-0 bg-transparent p-0 text-rotulo">
                    {aberto ? "Esconder pedido" : "Ver pedido"}
                  </button>
                )}
              </span>
            </span>
          </span>
        </th>
        <td className={cn(celula, "numero text-right text-corpo font-semibold text-ink")}>{quadro.tendas}</td>
        <td className={cn(celula, "numero text-right text-corpo text-ink")}>{quadro.fechamentos}</td>
        {temCalha && <td className={cn(celula, "numero text-right text-corpo text-ink")}>{quadro.temCalha ? quadro.calhas : "—"}</td>}
        <td className={cn(celula, "hidden text-pequeno text-ink-2 md:table-cell")}>
          {areas}
          {quem && <span className="block text-rotulo text-ink-3">{quem}</span>}
        </td>
        {editavel && (
          <td className={cn(celula, "pr-cartao text-right")}>
            <Button variant="ghost" size="xs" onClick={onEditar} aria-label={`Editar tendas de ${quadro.local ?? "local não informado"}`}>
              <Icone nome="lapis" className="size-3.5" />
              Editar
            </Button>
          </td>
        )}
      </tr>
      {aberto && (
        <tr className={cn(atual && "bg-selected")}>
          <td colSpan={colunas} className="border-b border-line-row px-cartao pb-3 pt-0">
            <div className="ml-12 flex flex-col gap-2">
              {linhas.map((x) => (
                <Descricao key={x.id} linha={x} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** O que a área escreveu: a descrição do pedido, a de cada tenda e a observação. */
function Descricao({ linha }: { linha: LinhaMesmoItem }) {
  // Uma descrição só vale para todas as tendas: aparece uma vez, sem repetir "Tenda 1, Tenda 2…".
  const unica = linha.descricoesPorUnidade?.length === 1 ? descricaoDaUnidade(linha.descricoesPorUnidade, 1) : null;
  const porUnidade = (linha.descricoesPorUnidade?.length ?? 0) > 1 ? Array.from({ length: Number.isSafeInteger(linha.quantidade) ? Math.min(linha.quantidade, 50) : 0 }, (_, i) => descricaoDaUnidade(linha.descricoesPorUnidade, i + 1)) : [];
  const temPorUnidade = porUnidade.some(Boolean);
  return (
    <div className="rounded-controle bg-subtle px-3 py-2 text-pequeno text-ink-2">
      {linha.codigo && (
        <p className="m-0 text-rotulo text-ink-3">
          <Codigo>{linha.codigo}</Codigo>
          {linha.solicitante ? ` · ${linha.solicitante}` : ""}
        </p>
      )}
      {linha.descricao && <p className="m-0 mt-0.5 whitespace-pre-line break-words">{linha.descricao}</p>}
      {unica && unica !== linha.descricao && <p className="m-0 mt-0.5 whitespace-pre-line break-words">{unica}</p>}
      {temPorUnidade && (
        <ol className="m-0 mt-1 list-none p-0">
          {porUnidade.map((d, i) => (
            <li key={i} className="whitespace-pre-line break-words">
              <span className="font-medium text-ink">Tenda {i + 1}:</span> {d ?? <span className="text-muted">sem descrição</span>}
            </li>
          ))}
        </ol>
      )}
      {linha.observacao && (
        <p className="m-0 mt-0.5 whitespace-pre-line break-words">
          <span className="text-muted">Obs.: </span>
          {linha.observacao}
        </p>
      )}
    </div>
  );
}

/** Check de conferência do local (todas as linhas dele); sem permissão, só mostra o estado. */
function Conferencia({ eventoId, linhas, podeConferir, rotulo }: { eventoId: string; linhas: LinhaMesmoItem[]; podeConferir: boolean; rotulo: string }) {
  const router = useRouter();
  const [marcada, setMarcada] = useState(linhas.every((x) => x.conferidoEm));
  const [pendente, iniciar] = useTransition();
  const classe = cn("grid size-8 shrink-0 place-items-center rounded-full border-2", marcada ? "border-success bg-success text-white" : "border-line-strong text-transparent");
  if (!podeConferir) {
    return (
      <span role="img" aria-label={marcada ? "Conferido" : "Não conferido"} title={marcada ? "Conferido" : "Não conferido"} className={classe}>
        <Icone nome="check" tamanho={16} />
      </span>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={`${rotulo}: ${marcada ? "conferido, clique para desfazer" : "marcar como conferido"}`}
      title={marcada ? "Conferido — clique para desfazer" : "Marcar como conferido"}
      disabled={pendente}
      onClick={() => {
        const v = !marcada;
        setMarcada(v);
        iniciar(async () => {
          for (const x of linhas) {
            const r = await conferirLinhaAction(eventoId, x.id, v);
            if (!r.ok) {
              setMarcada(!v);
              toastErro(r.erro);
              return;
            }
            if (r.dados && r.dados.conferidas === r.dados.total) toastSucesso("Todas as linhas conferidas. Registre os presentes e feche a ata.");
          }
          router.refresh();
        });
      }}
      className={cn(classe, "cursor-pointer transition-colors hover:border-success disabled:cursor-progress disabled:opacity-60", !marcada && "hover:text-success")}
    >
      <Icone nome="check" tamanho={16} />
    </button>
  );
}
