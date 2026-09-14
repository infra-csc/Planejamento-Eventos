import { requireUsuario } from "@/server/auth/session";
import { contarNaoLidas } from "@/server/services/notificacoes";
import { executarVerificacoesSeNecessario } from "@/server/jobs/verificacoes";
import { pode } from "@/domain/permissions";
import { AppShell, type NavItem } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  await executarVerificacoesSeNecessario();
  const naoLidas = await contarNaoLidas(usuario);

  const nav: NavItem[] = [
    { href: "/", label: "Painel", icon: "home", exact: true },
    { href: "/eventos", label: "Eventos", icon: "calendar" },
    { href: "/solicitacoes", label: "Solicitações", icon: "inbox" },
    ...(pode(usuario, "projeto.ver") ? [{ href: "/projetos", label: "Projetos padrão", icon: "layers" } as NavItem] : []),
    ...(pode(usuario, "catalogo.ver") ? [{ href: "/catalogo", label: "Catálogo de peças", icon: "package" } as NavItem] : []),
    ...(pode(usuario, "consolidacao.ver") ? [{ href: "/consolidacao", label: "Consolidação", icon: "chart" } as NavItem] : []),
    ...(pode(usuario, "admin.usuarios") ? [{ href: "/admin/usuarios", label: "Administração", icon: "settings", section: "Sistema" } as NavItem] : []),
  ];

  return (
    <AppShell usuario={usuario} nav={nav} naoLidas={naoLidas}>
      {children}
    </AppShell>
  );
}
