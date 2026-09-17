"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { iniciais } from "@/lib/format";
import { PERFIL_LABEL } from "@/domain/permissions";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { logoutAction } from "@/app/(auth)/actions";
import { Trilha } from "./trilha";
import { BuscaGlobal, abrirBuscaGlobal } from "./busca-global";

export type NavItem = { href: string; label: string; contagem?: number | null; secao?: string; ativoEm?: string[]; exato?: boolean };

/** "Atualizado há n min" desde a última navegação (a página é renderizada no servidor a cada visita). */
function Atualizado() {
  const [inicio] = useState(() => Date.now());
  const [agora, setAgora] = useState(inicio);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const min = Math.floor((agora - inicio) / 60_000);
  return <>{min < 1 ? "Atualizado agora" : `Atualizado há ${min} min`}</>;
}

/** ⌘K no Mac, Ctrl K nos demais (decidido no cliente para não divergir da renderização do servidor). */
function AtalhoBusca() {
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  return <>{mac ? "⌘K" : "Ctrl K"}</>;
}

/** Ícones do menu (traço 1.8, 18 px) — usados também no modo recolhido, onde só eles aparecem. */
function IconeNav({ href }: { href: string }) {
  const d: Record<string, React.ReactNode> = {
    "/": <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />,
    "/eventos": <><path d="M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z" /></>,
    "/calendario": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="9" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /></>,
    "/solicitacoes": <><path d="M6 3h9l5 5v13H6z" /><path d="M14 3v6h6M9 13h7M9 17h7" /></>,
    "/arena": <><path d="M3 9l9-5 9 5-9 5z" /><path d="M3 9v6l9 5 9-5V9" /></>,
    "/consolidacao": <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    "/biblioteca": <><path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4z" /><path d="M20 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" /></>,
    "/admin": <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  };
  const chave = Object.keys(d).find((k) => (k === "/" ? href === "/" : href.startsWith(k))) ?? "/eventos";
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {d[chave]}
    </svg>
  );
}

function ItemNav({ item, ativo, compacto }: { item: NavItem; ativo: boolean; compacto: boolean }) {
  const temContagem = item.contagem != null && item.contagem > 0;
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      title={compacto ? `${item.label}${temContagem ? ` (${item.contagem})` : ""}` : undefined}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-lg border border-transparent py-2 text-[13.5px] no-underline",
        compacto ? "justify-center px-0" : "px-2.5",
        ativo ? "bg-dark-2 font-medium text-white" : "text-on-dark-2 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {ativo && <span aria-hidden className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-[3px] bg-accent-light" />}
      <IconeNav href={item.href} />
      <span className={cn("flex-1 text-left", compacto && "sr-only")}>{item.label}</span>
      {temContagem && !compacto && (
        <span className={cn("rounded-[5px] px-1.5 py-px font-mono text-[11px]", ativo ? "bg-accent-light text-ink" : "bg-dark-3 text-on-dark-2")}>{item.contagem}</span>
      )}
      {temContagem && compacto && <span aria-hidden className="absolute right-2.5 top-2 size-[7px] rounded-full bg-accent-light" />}
    </Link>
  );
}

export function AppShell({ usuario, nav, naoLidas, children }: { usuario: UsuarioAtual; nav: NavItem[]; naoLidas: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const estaAtivo = (item: NavItem) =>
    item.exato ? pathname === item.href : [item.href, ...(item.ativoEm ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));
  const perfilTexto = PERFIL_LABEL[usuario.perfil] + (usuario.areaNome && usuario.areaNome !== PERFIL_LABEL[usuario.perfil] ? ` · ${usuario.areaNome}` : "");
  // Abaixo de 1024 px a sidebar vira uma gaveta aberta pelo botão de menu; fecha ao navegar ou com Esc.
  const [menuAberto, setMenuAberto] = useState(false);
  // No desktop a sidebar pode ficar recolhida (só ícones); a preferência fica no navegador.
  const [recolhido, setRecolhido] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência lida uma vez, só no cliente
      setRecolhido(localStorage.getItem("npe_menu_recolhido") === "1");
    } catch {}
  }, []);
  const alternarRecolhido = () => {
    setRecolhido((v) => {
      try {
        localStorage.setItem("npe_menu_recolhido", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };
  useEffect(() => {
    if (!menuAberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuAberto(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [menuAberto]);

  return (
    <div className="flex min-h-screen bg-page">
      <a href="#conteudo" className="no-print sr-only rounded-lg bg-dark px-3 py-2 text-[13px] text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[var(--z-toast)]">
        Pular para o conteúdo
      </a>
      {menuAberto && <button type="button" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} className="fixed inset-0 z-[var(--z-busca)] cursor-default border-0 bg-[rgba(22,23,26,0.45)] lg:hidden" />}
      {/* Fixa no desktop (200 px até 1280, 236 px acima); gaveta deslizante abaixo de 1024 px. */}
      <aside
        id="menu-principal"
        aria-label="Menu principal"
        onClick={(e) => {
          // Clicou num link da gaveta: fecha ao navegar.
          if ((e.target as HTMLElement).closest("a")) setMenuAberto(false);
        }}
        className={cn(
          "no-print flex h-screen w-[236px] shrink-0 flex-col bg-dark transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:translate-x-0",
          recolhido ? "lg:w-[64px]" : "lg:w-[200px] xl:w-[236px]",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-[calc(var(--z-busca)+1)] max-lg:shadow-[8px_0_32px_rgba(42,20,24,.35)]",
          !menuAberto && "max-lg:-translate-x-full",
        )}
      >
        <div className={cn("flex items-center pb-[18px] pt-5", recolhido ? "lg:flex-col lg:gap-3 lg:px-0" : "gap-2 pl-[18px] pr-3")}>
          <Link href="/" title="Planejamento · Norte Mkt" className="flex min-w-0 flex-1 items-center gap-[9px] no-underline">
            <span aria-hidden className="block size-5 shrink-0 rounded-[5px] bg-accent-light" />
            <span className={cn("min-w-0", recolhido && "lg:sr-only")}>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-on-dark-3">Norte Mkt</span>
              <span className="block text-[13.5px] font-semibold tracking-[-0.01em] text-white">Planejamento</span>
            </span>
          </Link>
          {/* Recolher/expandir: só no desktop (abaixo de lg a sidebar é gaveta). */}
          <button
            type="button"
            onClick={alternarRecolhido}
            aria-pressed={recolhido}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            className="hidden size-7 shrink-0 cursor-pointer place-items-center rounded-[6px] border border-dark-3 bg-transparent text-on-dark-2 hover:bg-white/[0.06] hover:text-white lg:grid"
          >
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform", recolhido && "rotate-180")}>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={abrirBuscaGlobal}
          title={recolhido ? "Buscar ou executar (Ctrl K)" : undefined}
          className={cn("mb-3.5 flex cursor-pointer items-center gap-2 rounded-lg border border-dark-3 bg-dark-4 py-2 text-[13px] text-on-dark-3 hover:text-on-dark-2", recolhido ? "mx-2.5 justify-center px-0" : "mx-3 px-2.5")}
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className={cn("flex-1 text-left", recolhido && "lg:sr-only")}>Buscar ou executar</span>
          <kbd className={cn("rounded-[4px] bg-dark-3 px-[5px] py-px font-mono text-[11px] text-on-dark-2", recolhido && "lg:hidden")}>
            <AtalhoBusca />
          </kbd>
        </button>

        <nav aria-label="Principal" className={cn("flex-1 overflow-y-auto", recolhido ? "px-2.5" : "px-3")}>
          {nav.map((item, i) => {
            const mostrarSecao = item.secao && nav.slice(0, i).every((n) => n.secao !== item.secao);
            return (
              <div key={item.href}>
                {mostrarSecao &&
                  (recolhido ? (
                    <hr className="mx-2 my-2.5 border-0 border-t border-dark-2" />
                  ) : (
                    <p className="mb-1.5 mt-[18px] px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-on-dark-4">{item.secao}</p>
                  ))}
                <ItemNav item={item} ativo={estaAtivo(item)} compacto={recolhido} />
              </div>
            );
          })}
        </nav>

        <div className={cn("flex items-center gap-2.5 border-t border-dark-2 py-3", recolhido ? "flex-col px-2" : "px-[18px]")}>
          <p className={cn("m-0 flex-1 text-[11px] text-on-dark-4", recolhido && "lg:sr-only")}>
            <Atualizado key={pathname} /> · v0.2
          </p>
          <form action={logoutAction}>
            <button type="submit" title="Sair" className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-on-dark-2 hover:text-white">
              {recolhido ? (
                <svg aria-label="Sair" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
                </svg>
              ) : (
                "Sair"
              )}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-[rgba(241,239,238,0.9)] px-4 backdrop-blur-[8px] sm:gap-3.5 lg:px-5 xl:px-7">
          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            aria-controls="menu-principal"
            onClick={() => setMenuAberto(true)}
            className="-ml-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-ink-2 hover:bg-black/[0.04] lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Trilha />
          <Link
            href="/notificacoes"
            className="flex h-[30px] items-center gap-[7px] whitespace-nowrap rounded-lg border border-transparent px-2.5 text-[12.5px] text-ink-2 no-underline hover:bg-black/[0.04]"
          >
            {naoLidas > 0 && <span aria-hidden className="size-[7px] rounded-full bg-danger" />}
            <span className={cn(naoLidas === 0 && "max-sm:sr-only")}>{naoLidas > 0 ? `${naoLidas} ${naoLidas === 1 ? "nova" : "novas"}` : "Notificações"}</span>
            {naoLidas === 0 && (
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sm:hidden">
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
            )}
          </Link>
          <div aria-hidden className="h-[22px] w-px bg-line max-sm:hidden" />
          <Dropdown>
            <DropdownTrigger className="flex cursor-pointer items-center gap-[9px] rounded-[9px] border border-transparent bg-transparent py-1 pl-1 pr-2 hover:bg-black/[0.04]" aria-label={`Menu de ${usuario.nome}`}>
              <span className="flex size-7 items-center justify-center rounded-[7px] bg-dark text-[11px] font-semibold text-accent-light">{iniciais(usuario.nome)}</span>
              <span className="text-left max-sm:hidden">
                <span className="block text-[12.5px] font-medium leading-[1.25] text-ink">{usuario.nome}</span>
                <span className="block text-[11px] leading-[1.25] text-muted">{perfilTexto}</span>
              </span>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>{usuario.email}</DropdownLabel>
              <DropdownSeparator />
              <DropdownItem onSelect={() => router.push("/perfil")}>Meu perfil</DropdownItem>
              <DropdownItem onSelect={() => logoutAction()} danger>
                Sair
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </header>

        {/* Sem overflow no <main>: um contêiner de rolagem aqui quebra o `sticky` das colunas laterais (ata, OS, biblioteca). */}
        <main id="conteudo" tabIndex={-1} className="flex-1 px-4 pb-16 pt-5 focus:outline-none sm:px-5 sm:pt-7 xl:px-7">
          <div key={pathname} className="mx-auto max-w-[1240px] animate-fade-up">
            {children}
          </div>
        </main>
      </div>
      <BuscaGlobal />
    </div>
  );
}
