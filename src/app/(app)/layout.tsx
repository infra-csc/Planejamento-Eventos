import { after } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { requireUsuario } from "@/server/auth/session";
import { contarNaoLidas } from "@/server/services/notificacoes";
import { executarVerificacoesSeNecessario } from "@/server/jobs/verificacoes";
import { getDb } from "@/server/db";
import { solicitacoes } from "@/server/db/schema";
import { pode } from "@/domain/permissions";
import { AppShell, type NavItem } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  // Depois da resposta: nenhum usuário espera prazos e lembretes serem verificados.
  after(executarVerificacoesSeNecessario);
  const naoLidas = await contarNaoLidas(usuario);

  // Contador de solicitações aguardando resposta (logística e gestão) — derivado, nunca persistido.
  let abertas: number | null = null;
  if (usuario.perfil === "LOGISTICA" || usuario.perfil === "GESTAO") {
    const db = await getDb();
    const [r] = await db
      .select({ n: count() })
      .from(solicitacoes)
      .where(and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"])));
    abertas = Number(r.n);
  }

  const nav: NavItem[] = [
    { href: "/", label: "Painel", exato: true },
    { href: "/eventos", label: "Eventos" },
    { href: "/solicitacoes", label: "Solicitações", contagem: abertas },
    { href: "/arena", label: "Arena 3D", secao: "Operação" },
    ...(pode(usuario, "consolidacao.ver") ? [{ href: "/consolidacao", label: "Consolidação", secao: "Operação" }] : []),
    { href: "/biblioteca", label: "Biblioteca", secao: "Cadastros", ativoEm: ["/projetos", "/catalogo"] },
    ...(pode(usuario, "admin.usuarios") ? [{ href: "/admin", label: "Administração", secao: "Sistema" }] : []),
  ];

  return (
    <AppShell usuario={usuario} nav={nav} naoLidas={naoLidas}>
      {children}
    </AppShell>
  );
}
