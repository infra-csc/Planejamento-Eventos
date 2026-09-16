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

function ItemNav({ item, ativo }: { item: NavItem; ativo: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-[13.5px] no-underline",
        ativo ? "bg-dark-2 font-medium text-white" : "text-on-dark-2 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {ativo && <span aria-hidden className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-[3px] bg-accent-light" />}
      <span className="flex-1 text-left">{item.label}</span>
      {item.contagem != null && item.contagem > 0 && (
        <span className={cn("rounded-[5px] px-1.5 py-px font-mono text-[11px]", ativo ? "bg-accent-light text-ink" : "bg-dark-3 text-on-dark-2")}>{item.contagem}</span>
      )}
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
          "no-print flex h-screen w-[236px] shrink-0 flex-col bg-dark transition-transform duration-200 lg:sticky lg:top-0 lg:w-[200px] lg:translate-x-0 xl:w-[236px]",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-[calc(var(--z-busca)+1)] max-lg:shadow-[8px_0_32px_rgba(42,20,24,.35)]",
          !menuAberto && "max-lg:-translate-x-full",
        )}
      >
        <Link href="/" className="flex items-center gap-[9px] px-[18px] pb-[18px] pt-5 no-underline">
          <span aria-hidden className="block size-5 shrink-0 rounded-[5px] bg-accent-light" />
          <span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-on-dark-3">Norte Mkt</span>
            <span className="block text-[13.5px] font-semibold tracking-[-0.01em] text-white">Planejamento</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={abrirBuscaGlobal}
          className="mx-3 mb-3.5 flex cursor-pointer items-center gap-2 rounded-lg border border-dark-3 bg-dark-4 px-2.5 py-2 text-[13px] text-on-dark-3 hover:text-on-dark-2"
        >
          <span className="flex-1 text-left">Buscar ou executar</span>
          <kbd className="rounded-[4px] bg-dark-3 px-[5px] py-px font-mono text-[11px] text-on-dark-2">
            <AtalhoBusca />
          </kbd>
        </button>

        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3">
          {nav.map((item, i) => {
            const mostrarSecao = item.secao && nav.slice(0, i).every((n) => n.secao !== item.secao);
            return (
              <div key={item.href}>
                {mostrarSecao && <p className="mb-1.5 mt-[18px] px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-on-dark-4">{item.secao}</p>}
                <ItemNav item={item} ativo={estaAtivo(item)} />
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-dark-2 px-[18px] py-3">
          <p className="m-0 flex-1 text-[11px] text-on-dark-4">
            <Atualizado key={pathname} /> · v0.2
          </p>
          <form action={logoutAction}>
            <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-on-dark-2 hover:text-white">
              Sair
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
