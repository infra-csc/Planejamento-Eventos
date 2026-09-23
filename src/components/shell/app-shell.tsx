"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { iniciais } from "@/lib/format";
import { PERFIL_LABEL } from "@/domain/permissions";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { ChipMono } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/layout";
import { Icone, Spinner, type NomeIcone } from "@/components/ui/icons";
import { useSinalizarNavegacao } from "@/components/ui/navegacao";
import { logoutAction } from "@/app/(auth)/actions";
import { sairVerComoAction, verComoAction } from "@/app/(app)/ver-como/actions";
import { SinoNotificacoes } from "./sino-notificacoes";
import { Trilha } from "./trilha";
import { BuscaGlobal, abrirBuscaGlobal } from "./busca-global";
import { BarraNavegacao } from "./barra-navegacao";

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

/** Ícone de cada item do menu (20 px) — usado também no modo recolhido, onde só ele aparece. */
const ICONE_NAV: Array<[string, NomeIcone]> = [
  ["/eventos", "eventos"],
  ["/calendario", "calendario"],
  ["/solicitacoes", "solicitacoes"],
  ["/arena", "arena"],
  ["/consolidacao", "grafico"],
  ["/biblioteca", "livro"],
  ["/admin", "escudo"],
];

/** Dentro do <Link>: enquanto a página do item carrega, o ícone vira um spinner (mesmo tamanho). */
function IconeNav({ href }: { href: string }) {
  const { pending } = useLinkStatus();
  useSinalizarNavegacao(pending);
  const nome: NomeIcone = href === "/" ? "casa" : (ICONE_NAV.find(([k]) => href.startsWith(k))?.[1] ?? "eventos");
  return (
    <span className="grid size-5 shrink-0 place-items-center">
      {pending ? <Spinner tamanho={16} /> : <Icone nome={nome} tamanho={20} />}
    </span>
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
        "relative flex w-full items-center gap-2.5 rounded-controle border border-transparent py-2 text-corpo no-underline transition-colors duration-150 max-lg:min-h-10",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        compacto ? "justify-center px-0" : "px-2.5",
        ativo ? "bg-control font-medium text-ink [&_svg]:text-accent" : "text-ink-2 hover:bg-subtle hover:text-ink [&_svg]:text-ink-3 hover:[&_svg]:text-ink-2",
      )}
    >
      <IconeNav href={item.href} />
      <span className={cn("flex-1 text-left", compacto && "sr-only")}>{item.label}</span>
      {temContagem && !compacto && <ChipMono tom="accent">{item.contagem}</ChipMono>}
      {temContagem && compacto && <span aria-hidden className="absolute right-2.5 top-2 size-[7px] rounded-full bg-accent" />}
    </Link>
  );
}

export function AppShell({ usuario, nav, naoLidas, children, verComo = null }: { usuario: UsuarioAtual; nav: NavItem[]; naoLidas: number; children: React.ReactNode; verComo?: { areaSolicitante: { id: string; nome: string } | null } | null }) {
  const vendoComo = Boolean(usuario.verComo);
  const escolherVerComo = (perfil: string, areaId: string | null) => {
    void verComoAction(perfil, areaId).then(() => router.refresh());
  };
  const pathname = usePathname();
  const router = useRouter();
  const estaAtivo = (item: NavItem) =>
    item.exato ? pathname === item.href : [item.href, ...(item.ativoEm ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));
  const perfilTexto = PERFIL_LABEL[usuario.perfil] + (usuario.areaNome && usuario.areaNome !== PERFIL_LABEL[usuario.perfil] ? ` · ${usuario.areaNome}` : "");
  // Abaixo de 1024 px a sidebar vira uma gaveta aberta pelo botão de menu; fecha ao navegar ou com Esc.
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoMenuRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  // Fechar pelo Esc ou pelo fundo devolve o foco ao botão de menu; ao seguir um link, o foco segue a navegação.
  const fecharMenu = (devolverFoco: boolean) => {
    setMenuAberto(false);
    if (devolverFoco) botaoMenuRef.current?.focus();
  };
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
    // Gaveta aberta: o foco entra nela, no primeiro link.
    menuRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuAberto(false);
      botaoMenuRef.current?.focus();
    };
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
      {/* Barra fina de progresso das navegações (lê a URL: precisa de Suspense). */}
      <Suspense fallback={null}>
        <BarraNavegacao />
      </Suspense>
      <a href="#conteudo" className="no-print sr-only rounded-controle bg-dark px-3 py-2 text-corpo text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[var(--z-toast)]">
        Pular para o conteúdo
      </a>
      {menuAberto && <button type="button" aria-label="Fechar menu" onClick={() => fecharMenu(true)} className="fixed inset-0 z-[var(--z-busca)] cursor-default border-0 bg-scrim lg:hidden" />}
      {/* Fixa no desktop (200 px até 1280, 236 px acima); gaveta deslizante abaixo de 1024 px. */}
      <aside
        ref={menuRef}
        id="menu-principal"
        aria-label="Menu principal"
        onClick={(e) => {
          // Clicou num link da gaveta: fecha ao navegar.
          if ((e.target as HTMLElement).closest("a")) fecharMenu(false);
        }}
        className={cn(
          "no-print flex h-screen w-[236px] shrink-0 flex-col border-r border-line bg-surface transition-[transform,width,visibility] duration-200 lg:sticky lg:top-0 lg:translate-x-0",
          recolhido ? "lg:w-[64px]" : "lg:w-[200px] xl:w-[236px]",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-[calc(var(--z-busca)+1)] max-lg:shadow-popover",
          // Fechada no mobile: fora da tela e fora do Tab/leitor de tela (invisible some depois da transição).
          !menuAberto && "max-lg:invisible max-lg:-translate-x-full",
        )}
      >
        <div className={cn("flex items-center pb-[18px] pt-5", recolhido ? "lg:flex-col lg:gap-3 lg:px-0" : "gap-2 pl-cartao pr-3")}>
          <Link href="/" title="Planejamento · Norte Mkt" className="flex min-w-0 flex-1 items-center gap-[9px] no-underline">
            {/* Mesma marca do favicon (src/app/icon.svg). */}
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-[6px] bg-accent">
              <span className="block size-2.5 rounded-[3px] bg-accent-bg" />
            </span>
            <span className={cn("min-w-0", recolhido && "lg:sr-only")}>
              <span className="block text-micro font-semibold uppercase tracking-[0.16em] text-meta">Norte Mkt</span>
              <span className="block text-corpo font-semibold tracking-[-0.01em] text-ink">Planejamento</span>
            </span>
          </Link>
          {/* Recolher/expandir: só no desktop (abaixo de lg a sidebar é gaveta). */}
          <button
            type="button"
            onClick={alternarRecolhido}
            aria-pressed={recolhido}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            className="hidden size-7 shrink-0 cursor-pointer place-items-center rounded-controle border-0 bg-transparent text-ink-3 transition-colors duration-150 hover:bg-subtle hover:text-ink lg:grid"
          >
            <Icone nome={recolhido ? "expandir" : "recolher"} />
          </button>
        </div>

        <button
          type="button"
          onClick={abrirBuscaGlobal}
          title={recolhido ? "Buscar ou executar (Ctrl K)" : undefined}
          aria-label={recolhido ? "Buscar ou executar" : undefined}
          className={cn(
            "mb-3.5 flex cursor-pointer items-center gap-2 rounded-controle border border-line bg-subtle py-2 text-corpo text-ink-3 transition-colors duration-150 hover:border-line-strong hover:text-ink-2 max-lg:min-h-10",
            recolhido ? "mx-2.5 justify-center px-0" : "mx-3 px-2.5",
          )}
        >
          <Icone nome="busca" />
          <span className={cn("flex-1 text-left", recolhido && "lg:sr-only")}>Buscar ou executar</span>
          <span className={cn(recolhido && "lg:hidden")}>
            <Kbd>
              <AtalhoBusca />
            </Kbd>
          </span>
        </button>

        <nav aria-label="Principal" className={cn("flex-1 overflow-y-auto", recolhido ? "px-2.5" : "px-3")}>
          {nav.map((item, i) => {
            const mostrarSecao = item.secao && nav.slice(0, i).every((n) => n.secao !== item.secao);
            return (
              <div key={item.href}>
                {mostrarSecao &&
                  (recolhido ? (
                    <hr className="mx-2 my-2.5 border-0 border-t border-line" />
                  ) : (
                    <p className="mb-1.5 mt-[18px] px-2.5 text-micro font-semibold uppercase tracking-[0.14em] text-meta">{item.secao}</p>
                  ))}
                <ItemNav item={item} ativo={estaAtivo(item)} compacto={recolhido} />
              </div>
            );
          })}
        </nav>

        <div className={cn("flex items-center gap-2.5 border-t border-line py-3", recolhido ? "flex-col px-2" : "px-cartao")}>
          <p className={cn("m-0 flex-1 text-rotulo text-meta", recolhido && "lg:sr-only")}>
            <Atualizado key={pathname} /> · v0.2
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sair"
              className="flex cursor-pointer items-center gap-1.5 rounded-controle border-0 bg-transparent px-1.5 py-1 text-rotulo text-ink-3 transition-colors duration-150 hover:bg-subtle hover:text-ink max-lg:min-h-10"
            >
              <Icone nome="sair" />
              <span className={cn(recolhido && "sr-only")}>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-[var(--z-header)] flex h-14 items-center gap-2 border-b border-line bg-page/90 px-4 backdrop-blur-sm sm:gap-3.5 lg:px-5 xl:px-7">
          <button
            ref={botaoMenuRef}
            type="button"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            aria-controls="menu-principal"
            onClick={() => setMenuAberto(true)}
            className="-ml-1 grid size-10 shrink-0 cursor-pointer place-items-center rounded-controle border-0 bg-transparent text-ink-2 transition-colors duration-150 hover:bg-black/[0.04] lg:hidden"
          >
            <Icone nome="menu" tamanho={20} />
          </button>
          <Trilha />
          {/* Painel no próprio cabeçalho: ver as notificações sem sair da página. */}
          <SinoNotificacoes naoLidas={naoLidas} />
          <div aria-hidden className="h-[22px] w-px bg-line max-sm:hidden" />
          <Dropdown>
            <DropdownTrigger className="flex cursor-pointer items-center gap-[9px] rounded-cartao border border-transparent bg-transparent py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-black/[0.04] data-[state=open]:bg-black/[0.04] max-md:min-h-10" aria-label={`Menu de ${usuario.nome}`}>
              <span className="flex size-7 items-center justify-center rounded-full bg-accent-bg text-rotulo font-semibold text-accent">{iniciais(usuario.nome)}</span>
              <span className="text-left max-sm:hidden">
                <span className="block text-pequeno font-medium leading-[1.25] text-ink">{usuario.nome}</span>
                <span className="block text-rotulo leading-[1.25] text-muted">{perfilTexto}</span>
              </span>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>{usuario.email}</DropdownLabel>
              <DropdownSeparator />
              <DropdownItem onSelect={() => router.push("/perfil")}>
                <Icone nome="usuario" className="text-ink-3" />
                Meu perfil
              </DropdownItem>
              {verComo && (
                <>
                  <DropdownSeparator />
                  <DropdownLabel>Ver o app como…</DropdownLabel>
                  <DropdownItem onSelect={() => escolherVerComo("LOGISTICA", null)}>Logística</DropdownItem>
                  {/* Solicitante é um só: a área vem de um exemplo (a primeira área requisitante ativa). */}
                  {verComo.areaSolicitante && <DropdownItem onSelect={() => escolherVerComo("REQUISITANTE", verComo.areaSolicitante!.id)}>Solicitante · {verComo.areaSolicitante.nome}</DropdownItem>}
                  {vendoComo && <DropdownItem onSelect={() => void sairVerComoAction().then(() => router.refresh())}>Voltar a administrador</DropdownItem>}
                </>
              )}
              <DropdownSeparator />
              <DropdownItem onSelect={() => logoutAction()} danger>
                <Icone nome="sair" />
                Sair
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </header>

        {vendoComo && (
          <div role="status" className="no-print flex items-center justify-between gap-3 border-b border-warning-border bg-warning-bg px-4 py-1.5 text-pequeno text-warning sm:px-5 xl:px-7">
            <span>
              Você está vendo o app como <span className="font-semibold">{perfilTexto}</span>. O que fizer aqui vale como esse perfil e fica registrado no seu nome.
            </span>
            <Button variant="parcial" size="xs" className="shrink-0" onClick={() => void sairVerComoAction().then(() => router.refresh())}>
              Voltar a administrador
            </Button>
          </div>
        )}
        {/* Sem overflow no <main>: um contêiner de rolagem aqui quebra o `sticky` das colunas laterais (ata, OS, biblioteca). */}
        <main id="conteudo" tabIndex={-1} className="flex-1 px-4 pb-16 pt-5 focus:outline-none sm:px-5 sm:pt-7 xl:px-7">
          {/* Sem `key={pathname}`: remontar a cada navegação zerava o estado da página (abas do evento). A entrada animada fica no template.tsx. */}
          <div className="mx-auto max-w-[1240px]">
            {children}
          </div>
        </main>
      </div>
      <BuscaGlobal />
    </div>
  );
}
