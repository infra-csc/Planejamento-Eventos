"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useRef, useState } from "react";
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
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  useActionFeedback(state, () => {
    if (inputRef.current) inputRef.current.value = "";
    setNomeArquivo(null);
  });
  const imagens = anexos.filter((a) => a.tipo === "IMAGEM");
  const pdfs = anexos.filter((a) => a.tipo === "PDF");

  return (
    <div>
      {anexos.length === 0 && <p className="px-[18px] py-6 text-center text-[12.5px] text-muted">Nenhum anexo. {podeGerenciar ? "Adicione imagens (PNG/JPG/WEBP) ou o PDF técnico." : ""}</p>}
      {imagens.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-[18px] sm:grid-cols-3 md:grid-cols-4">
          {imagens.map((a) => (
            <figure key={a.id} className="group relative m-0">
              <a href={`/api/anexos/${a.id}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/anexos/${a.id}`} alt={a.nomeArquivo} className="aspect-square w-full rounded-controle border border-line object-cover" />
              </a>
              <figcaption className="mt-1 truncate text-[11.5px] text-muted">{a.nomeArquivo}</figcaption>
              {podeGerenciar && (
                <button
                  type="button"
                  onClick={() => setRemover(a)}
                  className="absolute right-1.5 top-1.5 grid size-7 cursor-pointer place-items-center rounded-[7px] border border-line bg-surface/95 text-[15px] leading-none text-danger shadow-pill sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  aria-label={`Remover ${a.nomeArquivo}`}
                >
                  ×
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
      {pdfs.length > 0 && (
        <ul className="m-0 list-none divide-y divide-line-row border-t border-line-soft p-0">
          {pdfs.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-[18px] py-2.5 text-[13px]">
              <a href={`/api/anexos/${a.id}`} target="_blank" rel="noopener" className="link flex min-w-0 items-center gap-2">
                <span className="truncate">{a.nomeArquivo}</span> <span className="text-[11.5px] text-muted">{tamanho(a.tamanho)}</span>
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
        <ActionForm action={action} className="flex flex-wrap items-center gap-2 border-t border-line-soft px-[18px] py-3">
          <input type="hidden" name="projetoId" value={projetoId} />
          {/* O input nativo fica escondido; o rótulo faz as vezes de botão e mostra o arquivo escolhido. */}
          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] border border-line-control bg-surface px-3 text-[12.5px] text-ink-2 hover:bg-subtle focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
            <input ref={inputRef} type="file" name="arquivo" accept="image/png,image/jpeg,image/webp,application/pdf" required className="sr-only" aria-label="Arquivo" onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)} />
            Escolher arquivo
          </label>
          <span className="min-w-0 max-w-[260px] truncate text-[12.5px] text-muted">{nomeArquivo ?? "PNG, JPG, WEBP ou PDF · até 8 MB"}</span>
          <SubmitButton size="sm" variant="secondary" disabled={!nomeArquivo}>
            Enviar
          </SubmitButton>
          <FormError message={!state.ok ? state.erro : null} />
        </ActionForm>
      )}
      {remover && <ConfirmDialog open onOpenChange={(o) => !o && setRemover(null)} title="Remover anexo" description={remover.nomeArquivo} confirmLabel="Remover" danger action={removerAnexoAction} hidden={{ anexoId: remover.id }} />}
    </div>
  );
}
