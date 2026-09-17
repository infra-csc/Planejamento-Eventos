"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/** Anexos do app ganham a miniatura webp (320 px) na lista; o lightbox continua abrindo o original. */
function miniaturaDe(src: string) {
  return src.startsWith("/api/anexos/") && !src.includes("?") ? `${src}?w=320` : src;
}

/**
 * Miniatura que abre a imagem em tamanho grande por cima da tela (Esc ou clique fora fecha),
 * sem sair da página — usada nos projetos padrão (renders e modulações).
 */
export function ImagemZoom({ src, alt, className, legenda }: { src: string; alt: string; className?: string; legenda?: string }) {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberta]);

  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setAberta(true); }} className={cn("block cursor-zoom-in border-0 bg-transparent p-0", className)} aria-label={`Ampliar ${alt}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={miniaturaDe(src)} alt={alt} className="block h-full w-full rounded-[inherit] bg-white object-contain" loading="lazy" decoding="async" />
      </button>
      {aberta &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={alt} onClick={() => setAberta(false)} className="fixed inset-0 z-[var(--z-toast)] flex items-center justify-center bg-[rgba(22,23,26,0.82)] p-4 backdrop-blur-[2px] sm:p-8">
            <figure className="m-0 flex max-h-full max-w-[1200px] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} className="max-h-[calc(100vh-96px)] max-w-full rounded-cartao bg-white object-contain shadow-modal" />
              <figcaption className="flex items-center gap-3 text-pequeno text-white/80">
                {legenda ?? alt}
                <button type="button" onClick={() => setAberta(false)} className="cursor-pointer rounded-controle border border-white/30 bg-transparent px-2.5 py-1 text-pequeno text-white hover:bg-white/10">
                  Fechar (Esc)
                </button>
              </figcaption>
            </figure>
          </div>,
          document.body,
        )}
    </>
  );
}
