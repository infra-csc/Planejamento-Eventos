"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useRef, useState } from "react";
import { anexarArquivoAction, removerAnexoAction } from "@/app/(app)/projetos/actions";
import { Button, SubmitButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonClasses } from "@/components/ui/button-classes";
import { IconButton } from "@/components/ui/icon-button";
import { IconeFechar } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/layout";
import { FormError } from "@/components/ui/field";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";
import { ImagemZoom } from "@/components/ui/imagem-zoom";

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
      {anexos.length === 0 && <EmptyState compact title="Nenhum anexo." description={podeGerenciar ? "Adicione imagens (PNG/JPG/WEBP) ou o PDF técnico." : undefined} />}
      {imagens.length > 0 && (
        <div className="grid grid-cols-1 gap-3 p-[18px] sm:grid-cols-2">
          {imagens.map((a) => (
            <figure key={a.id} className="group relative m-0">
              <ImagemZoom src={`/api/anexos/${a.id}`} alt={a.nomeArquivo} className="aspect-[4/3] w-full overflow-hidden rounded-controle border border-line" />
              <figcaption className="mt-1 truncate text-rotulo text-muted">{a.nomeArquivo}</figcaption>
              {podeGerenciar && (
                <IconButton label={`Remover ${a.nomeArquivo}`} onClick={() => setRemover(a)} className="absolute right-1.5 top-1.5 border-line bg-surface/95 text-danger shadow-pill sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <IconeFechar />
                </IconButton>
              )}
            </figure>
          ))}
        </div>
      )}
      {pdfs.length > 0 && (
        <ul className="m-0 list-none divide-y divide-line-row border-t border-line-soft p-0">
          {pdfs.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-[18px] py-2.5 text-corpo">
              <a href={`/api/anexos/${a.id}`} target="_blank" rel="noopener" className="link flex min-w-0 items-center gap-2">
                <span className="truncate">{a.nomeArquivo}</span> <span className="text-rotulo text-muted">{tamanho(a.tamanho)}</span>
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
          <label className={buttonClasses({ variant: "secondary", size: "sm", className: "font-normal text-ink-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent" })}>
            <input ref={inputRef} type="file" name="arquivo" accept="image/png,image/jpeg,image/webp,application/pdf" required className="sr-only" aria-label="Arquivo" onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)} />
            Escolher arquivo
          </label>
          <span className="min-w-0 max-w-[260px] truncate text-pequeno text-muted">{nomeArquivo ?? "PNG, JPG, WEBP ou PDF · até 8 MB"}</span>
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
