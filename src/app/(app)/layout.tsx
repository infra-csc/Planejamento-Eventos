import { after } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { getUsuarioReal, requireUsuario } from "@/server/auth/session";
import { listarAreas } from "@/server/services/admin";
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
  // Contador de solicitações aguardando resposta (logística e gestão) — derivado, nunca persistido.
  const contarAbertas = async () => {
    if (usuario.perfil !== "LOGISTICA" && usuario.perfil !== "GESTAO" && usuario.perfil !== "ADMIN") return null;
    const db = await getDb();
    const [r] = await db
      .select({ n: count() })
      .from(solicitacoes)
      .where(and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), eq(solicitacoes.tipo, "ALTERACAO")));
    return Number(r.n);
  };
  const real = await getUsuarioReal();
  const ehAdminReal = real?.perfil === "ADMIN";
  const [naoLidas, abertas, areasVerComo] = await Promise.all([contarNaoLidas(usuario), contarAbertas(), ehAdminReal ? listarAreas() : Promise.resolve([])]);

  const nav: NavItem[] = [
    { href: "/", label: "Painel", exato: true },
    { href: "/eventos", label: "Eventos" },
    { href: "/calendario", label: "Calendário" },
    { href: "/solicitacoes", label: "Solicitações", contagem: abertas },
    { href: "/arena", label: "Arena 3D", secao: "Operação" },
    ...(pode(usuario, "consolidacao.ver") ? [{ href: "/consolidacao", label: "Demanda de peças", secao: "Operação" }] : []),
    { href: "/biblioteca", label: "Biblioteca", secao: "Cadastros", ativoEm: ["/projetos", "/catalogo"] },
    ...(pode(usuario, "admin.usuarios") ? [{ href: "/admin", label: "Administração", secao: "Sistema" }] : []),
  ];

  return (
    <AppShell usuario={usuario} nav={nav} naoLidas={naoLidas} verComo={ehAdminReal ? { areas: areasVerComo.map((a) => ({ id: a.id, nome: a.nome })) } : null}>
      {children}
    </AppShell>
  );
}
