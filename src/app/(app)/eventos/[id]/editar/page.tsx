import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { contarLinhasConferidas } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { toDateTimeLocal } from "@/lib/format";
import { NaoEncontradoError } from "@/domain/errors";
import { EventoForm } from "@/components/eventos/evento-form";
import { SituacaoEvento } from "@/components/eventos/situacao-evento";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("evento.editar");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  // Encerrado também volta para a visão geral: pela URL abria o formulário inteiro e só o salvar recusava (auditoria 30/10,
  // B-35). Quem reabre é a gestão, pelo cabeçalho.
  if (ev.status === "CANCELADO" || ev.status === "ENCERRADO") redirect(`/eventos/${id}`);
  // Adiar a reunião apaga as conferências: o diálogo avisa quantas (contadas no banco, sem montar a ata; nº 146).
  const conferidas = ev.status === "EM_REUNIAO" ? await contarLinhasConferidas(id) : 0;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h2 className="m-0 text-titulo font-semibold tracking-[-0.01em]">Editar evento</h2>
      <EventoForm
        valores={{
          id: ev.id,
          nome: ev.nome,
          cliente: ev.cliente,
          local: ev.local,
          dataInicio: ev.dataInicio,
          dataReuniao: toDateTimeLocal(ev.dataReuniao),
          janelaAlteracoesAte: ev.janelaAlteracoesAte,
        }}
        cancelarHref={`/eventos/${ev.id}`}
      />
      <SituacaoEvento eventoId={ev.id} codigo={ev.codigo} status={ev.status} conferidas={conferidas} />
    </div>
  );
}
