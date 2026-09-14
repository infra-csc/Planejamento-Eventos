"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="no-print sticky top-0 flex h-screen w-[236px] shrink-0 flex-col bg-dark">
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
          <kbd className="rounded-[4px] bg-dark-3 px-[5px] py-px font-mono text-[11px] text-on-dark-2">⌘K</kbd>
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
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3.5 border-b border-line bg-[rgba(241,239,238,0.9)] px-7 backdrop-blur-[8px]">
          <Trilha />
          <Link
            href="/notificacoes"
            className="flex h-[30px] items-center gap-[7px] whitespace-nowrap rounded-lg border border-transparent px-2.5 text-[12.5px] text-ink-2 no-underline hover:bg-black/[0.04]"
          >
            {naoLidas > 0 && <span aria-hidden className="size-[7px] rounded-full bg-danger" />}
            <span>{naoLidas > 0 ? `${naoLidas} ${naoLidas === 1 ? "nova" : "novas"}` : "Notificações"}</span>
          </Link>
          <div aria-hidden className="h-[22px] w-px bg-line" />
          <Dropdown>
            <DropdownTrigger className="flex cursor-pointer items-center gap-[9px] rounded-[9px] border border-transparent bg-transparent py-1 pl-1 pr-2 hover:bg-black/[0.04]" aria-label={`Menu de ${usuario.nome}`}>
              <span className="flex size-7 items-center justify-center rounded-[7px] bg-dark text-[11px] font-semibold text-accent-light">{iniciais(usuario.nome)}</span>
              <span className="text-left">
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

        <main className="flex-1 overflow-x-auto px-7 pb-16 pt-7">
          <div key={pathname} className="mx-auto min-w-[1000px] max-w-[1240px] animate-fade-up">
            {children}
          </div>
        </main>
      </div>
      <BuscaGlobal />
    </div>
  );
}
