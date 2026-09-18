"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useEffect, useRef, useState } from "react";
import { anexarArquivoAction, removerAnexoAction } from "@/app/(app)/projetos/actions";
import { Button, SubmitButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonClasses } from "@/components/ui/button-classes";
import { IconButton } from "@/components/ui/icon-button";
import { IconeFechar } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/layout";
import { FormError } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { ESTADO_INICIAL } from "@/lib/action";
import { ImagemZoom } from "@/components/ui/imagem-zoom";

type Anexo = { id: string; tipo: "IMAGEM" | "PDF"; nomeArquivo: string; tamanho: number };

/** Mesmo limite e tipos do servidor: avisa antes de enviar, sem esperar o upload falhar. */
const LIMITE_ANEXO = 8 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function validarArquivo(f: File): string | null {
  if (!TIPOS_ACEITOS.includes(f.type)) return `“${f.name}” não é PNG, JPG, WEBP ou PDF. Escolha outro arquivo.`;
  if (f.size > LIMITE_ANEXO) return `“${f.name}” tem ${tamanho(f.size)}; o limite é 8 MB. Reduza o arquivo ou envie outro.`;
  return null;
}

function tamanho(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

export function AnexosManager({ projetoId, anexos, podeGerenciar }: { projetoId: string; anexos: Anexo[]; podeGerenciar: boolean }) {
  const [state, action] = useActionState(anexarArquivoAction, ESTADO_INICIAL);
  const inputRef = useRef<HTMLInputElement>(null);
  const [remover, setRemover] = useState<Anexo | null>(null);
  // Arquivo escolhido, lembrado junto do resultado da action daquele momento: depois de um envio com sucesso, some sozinho.
  const [selecao, setSelecao] = useState<{ nome: string; estado: typeof state } | null>(null);
  const nomeArquivo = selecao && (selecao.estado === state || !state.ok) ? selecao.nome : null;
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  // Erro do servidor fica visível até a pessoa escolher outro arquivo (só no FormError, sem toast repetido).
  const [estadoVisto, setEstadoVisto] = useState(state);
  const erroServidor = !state.ok && state !== estadoVisto ? state.erro : null;
  const ultimo = useRef(state);
  useEffect(() => {
    if (ultimo.current === state) return;
    ultimo.current = state;
    if (state.ok && state.mensagem) {
      toast(state.mensagem);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state]);
  const imagens = anexos.filter((a) => a.tipo === "IMAGEM");
  const pdfs = anexos.filter((a) => a.tipo === "PDF");

  return (
    <div>
      {anexos.length === 0 && <EmptyState compact title="Nenhum anexo" description={podeGerenciar ? "Adicione imagens (PNG/JPG/WEBP) ou o PDF técnico." : undefined} />}
      {imagens.length > 0 && (
        <div className="grid grid-cols-1 gap-3 p-cartao sm:grid-cols-2">
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
            <li key={a.id} className="flex items-center justify-between gap-3 px-cartao py-2.5 text-corpo">
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
        <ActionForm action={action} className="flex flex-wrap items-center gap-2 border-t border-line-soft px-cartao py-3">
          <input type="hidden" name="projetoId" value={projetoId} />
          {/* O input nativo fica escondido; o rótulo faz as vezes de botão e mostra o arquivo escolhido. */}
          <label className={buttonClasses({ variant: "secondary", size: "sm", className: "font-normal text-ink-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent" })}>
            <input ref={inputRef} type="file" name="arquivo" accept="image/png,image/jpeg,image/webp,application/pdf" required className="sr-only" aria-label="Arquivo" onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const erro = f ? validarArquivo(f) : null;
                setEstadoVisto(state);
                setErroLocal(erro);
                if (erro) e.target.value = "";
                setSelecao(f && !erro ? { nome: f.name, estado: state } : null);
              }}
              aria-invalid={Boolean(erroLocal ?? erroServidor) || undefined}
            />
            Escolher arquivo
          </label>
          <span className="min-w-0 max-w-[260px] truncate text-pequeno text-muted">{nomeArquivo ?? "PNG, JPG, WEBP ou PDF · até 8 MB"}</span>
          <SubmitButton size="sm" variant="secondary" disabled={!nomeArquivo}>
            Enviar
          </SubmitButton>
          <div className="basis-full empty:hidden">
            <FormError message={erroLocal ?? erroServidor} />
          </div>
        </ActionForm>
      )}
      {remover && <ConfirmDialog open onOpenChange={(o) => !o && setRemover(null)} title="Remover anexo" description={remover.nomeArquivo} confirmLabel="Remover" danger action={removerAnexoAction} hidden={{ anexoId: remover.id }} />}
    </div>
  );
}
