"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Bell, CalendarDays, ChartNoAxesColumn, Home, Inbox, Layers, LogOut, Menu, Package, Settings, UserRound, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { PERFIL_LABEL } from "@/domain/permissions";
import type { UsuarioAtual } from "@/server/auth/session";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/layout";
import { logoutAction } from "@/app/(auth)/actions";

export type NavItem = { href: string; label: string; icon: "home" | "calendar" | "inbox" | "layers" | "package" | "chart" | "settings"; exact?: boolean; section?: string };

const ICONS = { home: Home, calendar: CalendarDays, inbox: Inbox, layers: Layers, package: Package, chart: ChartNoAxesColumn, settings: Settings };

function NavLinks({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {nav.map((item, idx) => {
        const Icon = ICONS[item.icon];
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/") || (item.href === "/admin/usuarios" && pathname.startsWith("/admin"));
        const mostrarSecao = Boolean(item.section) && nav.slice(0, idx).every((n) => n.section !== item.section);
        return (
          <li key={item.href}>
            {mostrarSecao && <p className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{item.section}</p>}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-colors",
                active ? "bg-white/12 text-white font-medium" : "text-white/70 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <Link href="/" className="block px-3">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Norte Mkt</span>
      <span className="block text-[15px] font-semibold text-white">Planejamento de Eventos</span>
    </Link>
  );
}

export function AppShell({ usuario, nav, naoLidas, children }: { usuario: UsuarioAtual; nav: NavItem[]; naoLidas: number; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="no-print hidden w-60 shrink-0 flex-col bg-brand py-5 lg:flex">
        <Brand />
        <nav className="mt-6 px-2 grow" aria-label="Principal">
          <NavLinks nav={nav} />
        </nav>
        <div className="px-4 text-[11px] text-white/40">MVP · v0.1</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <DialogPrimitive.Root open={aberto} onOpenChange={setAberto}>
            <DialogPrimitive.Trigger className="rounded-md p-1.5 text-ink-secondary hover:bg-black/5 lg:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
              <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-brand py-5 lg:hidden focus:outline-none">
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                <div className="flex items-start justify-between pr-3">
                  <Brand />
                  <DialogPrimitive.Close className="rounded-md p-1 text-white/70 hover:bg-white/10" aria-label="Fechar menu">
                    <X className="size-5" />
                  </DialogPrimitive.Close>
                </div>
                <nav className="mt-6 px-2" aria-label="Principal">
                  <NavLinks nav={nav} onNavigate={() => setAberto(false)} />
                </nav>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          <div className="min-w-0 flex-1 lg:hidden">
            <span className="text-sm font-semibold text-ink">Planejamento de Eventos</span>
          </div>
          <div className="hidden flex-1 lg:block" />

          <Link href="/notificacoes" className="relative rounded-md p-1.5 text-ink-secondary hover:bg-black/5" aria-label={`Notificações${naoLidas ? `, ${naoLidas} não lidas` : ""}`}>
            <Bell className="size-5" />
            {naoLidas > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">{naoLidas > 99 ? "99+" : naoLidas}</span>
            )}
          </Link>

          <Dropdown>
            <DropdownTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-black/5" aria-label="Menu do usuário">
              <Avatar nome={usuario.nome} />
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-medium leading-tight text-ink">{usuario.nome}</span>
                <span className="block text-[11px] leading-tight text-ink-muted">
                  {PERFIL_LABEL[usuario.perfil]}
                  {usuario.areaNome ? ` · ${usuario.areaNome}` : ""}
                </span>
              </span>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>{usuario.email}</DropdownLabel>
              <DropdownSeparator />
              <DropdownItem onSelect={() => router.push("/perfil")}>
                <UserRound className="size-4" /> Meu perfil
              </DropdownItem>
              <DropdownItem onSelect={() => logoutAction()} danger>
                <LogOut className="size-4" /> Sair
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
