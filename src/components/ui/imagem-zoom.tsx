"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Anexos do app ganham a miniatura webp (320 px) na lista; o lightbox continua abrindo o original. */
function miniaturaDe(src: string) {
  return src.startsWith("/api/anexos/") && !src.includes("?") ? `${src}?w=320` : src;
}

/**
 * Miniatura que abre a imagem em tamanho grande por cima da tela (Esc ou clique fora fecha),
 * sem sair da página — usada nos projetos padrão (renders e modulações).
 * Radix Dialog cuida do foco preso, do Esc, da rolagem travada e de devolver o foco à miniatura.
 */
export function ImagemZoom({ src, alt, className, legenda }: { src: string; alt: string; className?: string; legenda?: string }) {
  const [aberta, setAberta] = useState(false);

  return (
    <DialogPrimitive.Root open={aberta} onOpenChange={setAberta}>
      <DialogPrimitive.Trigger asChild>
        {/* stopPropagation: a miniatura pode estar numa linha clicável (LinhaLink). */}
        <button type="button" onClick={(e) => e.stopPropagation()} className={cn("block cursor-zoom-in border-0 bg-transparent p-0", className)} aria-label={`Ampliar ${alt}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={miniaturaDe(src)} alt={alt} className="block h-full w-full rounded-[inherit] bg-white object-contain" loading="lazy" decoding="async" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[calc(var(--z-dialogo)+3)] animate-fade-up-rapido bg-scrim-forte backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // O portal ainda borbulha no React: sem isto, o clique chegaria à linha clicável por trás.
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setAberta(false);
          }}
          className="fixed inset-0 z-[calc(var(--z-dialogo)+4)] flex items-center justify-center p-4 focus:outline-none sm:p-8"
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <figure className="m-0 flex max-h-full max-w-[1200px] flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-[calc(100vh-96px)] max-w-full rounded-cartao bg-white object-contain shadow-modal" />
            <figcaption className="flex items-center gap-3 text-pequeno text-white/80">
              {legenda ?? alt}
              <DialogPrimitive.Close className="cursor-pointer rounded-controle border border-white/30 bg-transparent px-2.5 py-1 text-pequeno text-white hover:bg-white/10">Fechar (Esc)</DialogPrimitive.Close>
            </figcaption>
          </figure>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
