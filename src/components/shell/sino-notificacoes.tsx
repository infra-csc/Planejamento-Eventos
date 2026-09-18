"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tempoRelativo } from "@/lib/format";
import { ChipMono } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { marcarNotificacaoLidaAction, marcarTodasNotificacoesLidasAction, notificacoesRecentesAction, type NotificacaoResumo } from "@/app/(app)/notificacoes/actions";

/**
 * Sino do cabeçalho: abre um painel com as notificações recentes ali mesmo, sem sair da página.
 * Clicar numa notificação marca como lida e só então navega; "Ver todas" leva à tela completa.
 */
export function SinoNotificacoes({ naoLidas }: { naoLidas: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<NotificacaoResumo[] | null>(null);
  const [carregando, iniciar] = useTransition();
  const raiz = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLSpanElement>(null);

  const carregar = () => iniciar(async () => setLista(await notificacoesRecentesAction()));

  const alternar = () => {
    setAberto((v) => {
      if (!v) carregar();
      return !v;
    });
  };

  // Fecha ao clicar fora ou apertar Esc (o Esc devolve o foco ao sino).
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botaoRef.current?.focus();
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  // Ao abrir, o foco vai para a primeira notificação (ou para o título enquanto a lista carrega).
  useEffect(() => {
    if (!aberto) return;
    const ativo = document.activeElement;
    if (ativo !== botaoRef.current && ativo !== tituloRef.current && ativo !== document.body) return;
    (painelRef.current?.querySelector<HTMLElement>("[data-notificacao]") ?? tituloRef.current)?.focus();
  }, [aberto, lista]);

  const abrir = (n: NotificacaoResumo) => {
    setAberto(false);
    iniciar(async () => {
      if (!n.lida) await marcarNotificacaoLidaAction(n.id);
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  };

  const marcarTodas = () =>
    iniciar(async () => {
      await marcarTodasNotificacoesLidasAction();
      setLista((l) => (l ? l.map((n) => ({ ...n, lida: true })) : l));
      router.refresh();
    });

  const pendentes = lista ? lista.filter((n) => !n.lida).length : naoLidas;

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botaoRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={alternar}
        className={cn("flex h-[30px] cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-controle border border-transparent bg-transparent px-2.5 text-pequeno text-ink-2 hover:bg-black/[0.04]", aberto && "bg-black/[0.04]")}
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        <span className="max-sm:sr-only">Notificações</span>
        {naoLidas > 0 && <ChipMono tom="accent">{naoLidas}</ChipMono>}
      </button>

      {aberto && (
        <div ref={painelRef} role="dialog" aria-label="Notificações" className="absolute right-0 top-[calc(100%+8px)] z-[var(--z-popover)] flex max-h-[min(560px,calc(100dvh-90px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-cartao border border-line-strong bg-surface shadow-popover animate-fade-up-rapido">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
            <span ref={tituloRef} tabIndex={-1} className="text-corpo font-semibold text-ink focus:outline-none">
              Notificações
              {pendentes > 0 && <span className="ml-2 font-normal text-pequeno text-muted">{pendentes} não {pendentes === 1 ? "lida" : "lidas"}</span>}
            </span>
            {pendentes > 0 && (
              <Button variant="link" size="sm" onClick={marcarTodas} disabled={carregando}>
                Marcar todas como lidas
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={carregando && !lista}>
            {!lista ? (
              <p className="m-0 px-4 py-8 text-center text-pequeno text-muted">Carregando…</p>
            ) : lista.length === 0 ? (
              <p className="m-0 px-4 py-8 text-center text-pequeno text-muted">Nenhuma notificação. Quando algo precisar de você, aparece aqui.</p>
            ) : (
              lista.map((n) => (
                <button
                  key={n.id}
                  data-notificacao=""
                  type="button"
                  onClick={() => abrir(n)}
                  className={cn("flex w-full cursor-pointer items-start gap-3 border-0 border-b border-line-row px-4 py-3 text-left last:border-b-0 hover:bg-subtle", !n.lida ? "bg-selected" : "bg-transparent")}
                >
                  <span aria-hidden className={cn("mt-1.5 size-[7px] shrink-0 rounded-full", n.lida ? "bg-transparent" : n.prazo ? "bg-danger" : "bg-accent")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-corpo leading-[1.35] text-ink", !n.lida && "font-medium")}>
                      {!n.lida && <span className="sr-only">Não lida: </span>}
                      {n.titulo}
                    </span>
                    <span className="mt-0.5 block text-pequeno leading-[1.4] text-ink-3">{n.mensagem}</span>
                    <span className="mt-1 block font-mono text-rotulo text-meta">{tempoRelativo(n.criadoEm)}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <Link href="/notificacoes" onClick={() => setAberto(false)} className="block border-t border-line-soft bg-subtle px-4 py-2.5 text-center text-pequeno text-accent no-underline hover:underline">
            Ver todas as notificações
          </Link>
        </div>
      )}
    </div>
  );
}
