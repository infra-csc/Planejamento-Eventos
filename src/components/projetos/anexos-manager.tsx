"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { anexarArquivoAction, removerAnexoAction } from "@/app/(app)/projetos/actions";
import { Button, SubmitButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/field";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";

type Anexo = { id: string; tipo: "IMAGEM" | "PDF"; nomeArquivo: string; tamanho: number };

function tamanho(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

export function AnexosManager({ projetoId, anexos, podeGerenciar }: { projetoId: string; anexos: Anexo[]; podeGerenciar: boolean }) {
  const [state, action] = useActionState(anexarArquivoAction, ESTADO_INICIAL);
  const inputRef = useRef<HTMLInputElement>(null);
  const [remover, setRemover] = useState<Anexo | null>(null);
  useActionFeedback(state, () => {
    if (inputRef.current) inputRef.current.value = "";
  });
  const imagens = anexos.filter((a) => a.tipo === "IMAGEM");
  const pdfs = anexos.filter((a) => a.tipo === "PDF");

  return (
    <div>
      {anexos.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-muted">Nenhum anexo. {podeGerenciar ? "Adicione imagens (PNG/JPG/WEBP) ou o PDF técnico." : ""}</p>}
      {imagens.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4">
          {imagens.map((a) => (
            <figure key={a.id} className="group relative">
              <a href={`/api/anexos/${a.id}`} target="_blank">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/anexos/${a.id}`} alt={a.nomeArquivo} className="aspect-square w-full rounded-md border border-line object-cover" />
              </a>
              <figcaption className="mt-1 truncate text-xs text-ink-muted">{a.nomeArquivo}</figcaption>
              {podeGerenciar && (
                <button type="button" onClick={() => setRemover(a)} className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-danger shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`Remover ${a.nomeArquivo}`}>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
      {pdfs.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {pdfs.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <a href={`/api/anexos/${a.id}`} target="_blank" className="flex min-w-0 items-center gap-2 text-info hover:underline">
                <FileText className="size-4 shrink-0" /> <span className="truncate">{a.nomeArquivo}</span> <span className="text-xs text-ink-muted">{tamanho(a.tamanho)}</span>
              </a>
              {podeGerenciar && (
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemover(a)}>
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeGerenciar && (
        <ActionForm action={action} className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <input type="hidden" name="projetoId" value={projetoId} />
          <input ref={inputRef} type="file" name="arquivo" accept="image/png,image/jpeg,image/webp,application/pdf" required className="text-[13px] file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-2.5 file:py-1.5 file:text-[13px] file:font-medium" aria-label="Arquivo" />
          <SubmitButton size="sm" variant="secondary">
            <Upload className="size-3.5" /> Enviar
          </SubmitButton>
          <FormError message={!state.ok ? state.erro : null} />
        </ActionForm>
      )}
      {remover && <ConfirmDialog open onOpenChange={(o) => !o && setRemover(null)} title="Remover anexo" description={remover.nomeArquivo} confirmLabel="Remover" danger action={removerAnexoAction} hidden={{ anexoId: remover.id }} />}
    </div>
  );
}
