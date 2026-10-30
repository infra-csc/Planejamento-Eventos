"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icons";
import { useNavegacaoPendente } from "./navegacao";

/** sucesso = algo foi feito; info = aviso neutro; erro = falhou (role=alert). */
export type TipoToast = "info" | "sucesso" | "erro";
type AcaoToast = { rotulo: string; onClick: () => void | Promise<void> };
type ItemToast = { id: number; mensagem: string; tipo: TipoToast; desfazer?: () => void | Promise<void>; acao?: AcaoToast; grupo?: string; restante: number; inicio: number | null };

const ICONE: Record<TipoToast, { nome: NomeIcone; cor: string }> = {
  sucesso: { nome: "check-circulo", cor: "text-success-light" },
  info: { nome: "info", cor: "text-on-dark-2" },
  erro: { nome: "erro", cor: "text-white" },
};

const MAXIMO = 3;
let lista: ItemToast[] = [];
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const ouvintes = new Set<() => void>();

function emitir() {
  lista = [...lista];
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function agendar(t: ItemToast) {
  t.inicio = Date.now();
  timers.set(
    t.id,
    setTimeout(() => remover(t.id), t.restante),
  );
}

function remover(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  lista = lista.filter((t) => t.id !== id);
  emitir();
}

/** Pausa todos os toasts enquanto o mouse ou o foco estão sobre eles (WCAG 2.2.1). */
function pausar() {
  for (const t of lista) {
    const timer = timers.get(t.id);
    if (!timer || t.inicio == null) continue;
    clearTimeout(timer);
    timers.delete(t.id);
    t.restante = Math.max(1500, t.restante - (Date.now() - t.inicio));
    t.inicio = null;
  }
}

function retomar() {
  for (const t of lista) if (!timers.has(t.id)) agendar(t);
}

/**
 * Toast escuro do handoff (§6): canto inferior direito, com ícone por tipo, "Desfazer" ou uma ação opcional.
 * Empilha até 3 (um novo não apaga o "Desfazer" do anterior), pausa no hover/foco e aceita Ctrl+Z.
 * `grupo`: um aviso novo do mesmo grupo substitui o anterior (cinco "adicionado" seguidos cobriam o resumo).
 */
export function toast(mensagem: string, opcoes?: { desfazer?: () => void | Promise<void>; acao?: AcaoToast; duracao?: number; tipo?: TipoToast; grupo?: string }) {
  if (opcoes?.grupo) for (const t of lista.filter((x) => x.grupo === opcoes.grupo)) remover(t.id);
  const item: ItemToast = {
    id: ++seq,
    mensagem,
    tipo: opcoes?.tipo ?? "info",
    desfazer: opcoes?.desfazer,
    acao: opcoes?.acao,
    grupo: opcoes?.grupo,
    // Com uma ação ("Descrever"), 8 s era pouco para chegar ao botão pelo teclado ou leitor de tela (WCAG 2.2.1,
    // auditoria 28/10 nº 137): 15 s, e o tempo para enquanto o mouse ou o foco estão no aviso.
    restante: opcoes?.duracao ?? (opcoes?.acao ? 15000 : opcoes?.desfazer ? 8000 : 5000),
    inicio: null,
  };
  lista = [...lista, item];
  while (lista.length > MAXIMO) {
    const velho = lista[0];
    remover(velho.id);
  }
  agendar(item);
  emitir();
}

export function toastErro(mensagem: string) {
  toast(mensagem, { tipo: "erro", duracao: 7000 });
}

export function toastSucesso(mensagem: string, opcoes?: { desfazer?: () => void | Promise<void>; acao?: AcaoToast; grupo?: string }) {
  toast(mensagem, { ...opcoes, tipo: "sucesso" });
}

async function executarDesfazer(t: ItemToast) {
  const f = t.desfazer;
  remover(t.id);
  await f?.();
}

async function executarAcao(t: ItemToast) {
  const f = t.acao?.onClick;
  remover(t.id);
  await f?.();
}

/**
 * "Carregando…" para leitor de tela quando uma navegação passa de 600 ms (barra do topo, abas,
 * paginação, linhas). Fica na mesma região aria-live dos toasts.
 */
function AnuncioNavegacao() {
  const pendente = useNavegacaoPendente();
  const [anunciar, setAnunciar] = useState(false);
  useEffect(() => {
    if (!pendente) {
      const t = setTimeout(() => setAnunciar(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setAnunciar(true), 600);
    return () => clearTimeout(t);
  }, [pendente]);
  return <span className="sr-only">{anunciar ? "Carregando…" : ""}</span>;
}

export function Toaster() {
  const itens = useSyncExternalStore(
    assinar,
    () => lista,
    () => lista,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (/^(input|textarea|select)$/i.test(alvo.tagName) || alvo.isContentEditable)) return;
      const ultimo = [...lista].reverse().find((t) => t.desfazer);
      if (!ultimo) return;
      e.preventDefault();
      void executarDesfazer(ultimo);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /*
   * Duas regiões vivas lado a lado: erro em `role="alert"` (interrompe) e o resto em `role="status"` (educado).
   * Antes o alerta ficava dentro do status (papéis aninhados, WCAG 4.1.3; auditoria 28/10 nº 137) e o leitor de
   * tela podia ler o erro duas vezes ou nenhuma. As duas existem sempre (região criada junto com o texto não é lida).
   * Erros ficam embaixo da pilha, mais perto do canto.
   */
  const daPilha = (tipo: "erro" | "outros") => itens.filter((t) => (tipo === "erro") === (t.tipo === "erro")).map((t) => <CartaoToast key={t.id} t={t} />);
  const pilha = "flex flex-col items-end gap-2 max-sm:items-stretch";
  return (
    <div
      className="no-print pointer-events-none fixed bottom-6 right-6 z-[var(--z-toast)] flex max-w-[520px] flex-col items-end max-sm:inset-x-3 max-sm:bottom-auto max-sm:top-[calc(env(safe-area-inset-top,0px)+12px)] max-sm:max-w-none max-sm:items-stretch [&_[data-toast]]:pointer-events-auto"
      onMouseEnter={pausar}
      onMouseLeave={retomar}
      onFocus={pausar}
      onBlur={retomar}
    >
      <div role="status" aria-live="polite" className={pilha}>
        <AnuncioNavegacao />
        {daPilha("outros")}
      </div>
      <div role="alert" className={cn(pilha, "[&:not(:empty)]:mt-2")}>
        {daPilha("erro")}
      </div>
    </div>
  );
}

function CartaoToast({ t }: { t: ItemToast }) {
  const icone = ICONE[t.tipo];
  const botaoAcao = cn(
    "ml-1 shrink-0 cursor-pointer rounded-chip border-0 bg-transparent px-1.5 py-0.5 text-corpo font-medium underline-offset-2 transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 max-md:min-h-10",
    t.tipo === "erro" ? "text-white focus-visible:outline-white" : "text-accent-light focus-visible:outline-accent-light",
  );
  return (
    <div data-toast className={cn("flex w-full animate-fade-up-rapido items-center gap-2.5 rounded-cartao py-2.5 pl-4 pr-2 text-white shadow-toast sm:w-auto", t.tipo === "erro" ? "bg-danger" : "bg-dark")}>
      <Icone nome={icone.nome} className={icone.cor} />
      <span className="min-w-0 flex-1 text-corpo">{t.mensagem}</span>
      {t.desfazer && (
        <button type="button" onClick={() => void executarDesfazer(t)} className={botaoAcao} title="Desfazer (Ctrl+Z)">
          Desfazer
        </button>
      )}
      {t.acao && (
        <button type="button" onClick={() => void executarAcao(t)} className={botaoAcao}>
          {t.acao.rotulo}
        </button>
      )}
      <button
        type="button"
        onClick={() => remover(t.id)}
        aria-label="Fechar aviso"
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white max-md:size-10"
      >
        <Icone nome="fechar" />
      </button>
    </div>
  );
}
