"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./icons";
import { IndicadorLink } from "./indicador-link";

export type Aba = { href: string; label: string; n?: number | string | null; exact?: boolean; /** Força o estado ativo (abas por query string, onde o pathname não muda). */ ativo?: boolean };

/*
 * Aba: 14/20 + 9 px em cima e embaixo + sublinhado de 2 px = 40 px (alvo de toque sem mudar o desktop).
 * Foco com anel interno: o trilho rola na horizontal e cortaria um anel externo.
 */
const abaCls = (ativo: boolean) =>
  cn(
    "relative -mb-px flex min-h-10 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-t-controle border-0 border-b-2 bg-transparent px-3.5 py-[9px] text-corpo no-underline transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    ativo ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink",
  );

function Contador({ n, ativo }: { n: number | string | null | undefined; ativo: boolean }) {
  if (n == null || n === 0 || n === "") return null;
  return <span className={cn("numero rounded-chip px-1.5 py-px text-rotulo font-medium", ativo ? "bg-accent-bg text-accent" : "bg-neutral-bg text-muted")}>{n}</span>;
}

const trilho = "flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Trilho que rola na horizontal e esmaece a borda do lado em que há mais abas escondidas.
 * Ao montar, traz a aba ativa para a área visível (celular).
 */
function useTrilhoRolavel<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [mais, setMais] = useState<{ esq: boolean; dir: boolean }>({ esq: false, dir: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ativo = el.querySelector<HTMLElement>('[aria-current="page"],[aria-selected="true"]');
    if (ativo && el.scrollWidth > el.clientWidth) {
      const alvo = ativo.offsetLeft - (el.clientWidth - ativo.offsetWidth) / 2;
      el.scrollLeft = Math.max(0, alvo);
    }
    const medir = () => {
      const esq = el.scrollLeft > 2;
      const dir = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setMais((m) => (m.esq === esq && m.dir === dir ? m : { esq, dir }));
    };
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, []);
  const faixa = 28;
  const mascara =
    mais.esq || mais.dir
      ? `linear-gradient(to right, ${mais.esq ? "transparent" : "#000"} 0, #000 ${mais.esq ? faixa : 0}px, #000 calc(100% - ${mais.dir ? faixa : 0}px), ${mais.dir ? "transparent" : "#000"} 100%)`
      : undefined;
  const rolar = (lado: 1 | -1) => ref.current?.scrollBy({ left: lado * ref.current.clientWidth * 0.66, behavior: "smooth" });
  return { ref, mais, rolar, estilo: mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined };
}

/**
 * Setas nas bordas do trilho quando há abas escondidas. Só o esmaecido não bastava: a 375 px as abas de
 * /solicitacoes paravam em "Aguardando respo…" e ninguém via que havia mais (auditoria 30/10, parte A N13).
 * Fora da árvore de acessibilidade e do Tab: pelo teclado, a aba focada já rola para a vista.
 */
function SetasTrilho({ mais, rolar }: { mais: { esq: boolean; dir: boolean }; rolar: (lado: 1 | -1) => void }) {
  const seta = "absolute top-1/2 z-[1] grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-3 shadow-pill transition-colors duration-150 hover:text-ink";
  return (
    <>
      {mais.esq && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => rolar(-1)} className={cn(seta, "left-0")}>
          <Icone nome="chevron-esquerda" />
        </button>
      )}
      {mais.dir && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => rolar(1)} className={cn(seta, "right-0")}>
          <Icone nome="chevron-direita" />
        </button>
      )}
    </>
  );
}

/** A margem padrão só entra se quem usa não pediu outra (o `cn` não resolve conflito de classes: "mb-5 mb-0" ficava com 20 px). */
const semMargem = (className?: string) => !/(^|\s)!?mb-/.test(className ?? "");

/** Abas sublinhadas por rota (aba ativa = pathname). A aba clicada pulsa o sublinhado enquanto a página carrega. */
export function TabsNav({ tabs, className, rotulo = "Seções do evento" }: { tabs: Aba[]; className?: string; rotulo?: string }) {
  const pathname = usePathname();
  const { ref, estilo, mais, rolar } = useTrilhoRolavel<HTMLElement>();
  return (
    <div className={cn("relative", semMargem(className) && "mb-5")}>
      <nav ref={ref} style={estilo} className={cn(trilho, className)} aria-label={rotulo}>
        {tabs.map((t) => {
          const ativo = t.ativo ?? (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/"));
          return (
            <Link key={t.href} href={t.href} aria-current={ativo ? "page" : undefined} className={abaCls(ativo)}>
              {t.label}
              <Contador n={t.n} ativo={ativo} />
              {!ativo && <IndicadorLink lugar="sublinhado" />}
            </Link>
          );
        })}
      </nav>
      <SetasTrilho mais={mais} rolar={rolar} />
    </div>
  );
}

export type AbaControlada<K extends string> = { chave: K; label: string; n?: number | string | null; tom?: "warning" };

/**
 * As mesmas abas, controladas por estado (role=tablist), para trocar painéis sem mudar de rota:
 * biblioteca, administração, painel da reunião, vincular ao catálogo, tipo de item na solicitação.
 */
export function TabsControladas<K extends string>({ abas, valor, onChange, rotulo, className, compacta }: { abas: AbaControlada<K>[]; valor: K; onChange: (k: K) => void; rotulo: string; className?: string; compacta?: boolean }) {
  const { ref, estilo, mais, rolar } = useTrilhoRolavel<HTMLDivElement>();
  // Comportamento de abas (WAI-ARIA): uma parada de Tab no grupo (a aba escolhida) e as setas trocam de aba.
  // Antes cada aba era uma parada e as setas não faziam nada (auditoria 28/10 nº 66).
  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const atual = abas.findIndex((a) => a.chave === valor);
    const n = abas.length;
    const proximo = e.key === "ArrowRight" ? (atual + 1) % n : e.key === "ArrowLeft" ? (atual - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (proximo === null || n === 0) return;
    e.preventDefault();
    onChange(abas[proximo].chave);
    ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[proximo]?.focus();
  };
  const algumAtivo = abas.some((a) => a.chave === valor);
  return (
    <div className={cn("relative", semMargem(className) && (compacta ? "mb-3" : "mb-4"))}>
      <div ref={ref} style={estilo} role="tablist" aria-label={rotulo} onKeyDown={aoTeclar} className={cn(trilho, className)}>
        {abas.map((a, i) => {
          const ativo = a.chave === valor;
          return (
            <button key={a.chave} type="button" role="tab" aria-selected={ativo} tabIndex={ativo || (!algumAtivo && i === 0) ? 0 : -1} onClick={() => onChange(a.chave)} className={cn(abaCls(ativo), compacta && "px-3 py-2 md:min-h-0", a.tom === "warning" && !ativo && "text-warning")}>
              {a.label}
              <Contador n={a.n} ativo={ativo} />
            </button>
          );
        })}
      </div>
      <SetasTrilho mais={mais} rolar={rolar} />
    </div>
  );
}
