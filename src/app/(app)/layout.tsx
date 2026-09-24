import { after } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { getUsuarioReal, requireUsuario } from "@/server/auth/session";
import { contarNaoLidas } from "@/server/services/notificacoes";
import { executarVerificacoesSeNecessario } from "@/server/jobs/verificacoes";
import { getDb } from "@/server/db";
import { solicitacoes } from "@/server/db/schema";
import { pode } from "@/domain/permissions";
import { TELAS_INATIVAS } from "@/domain/telas";
import { AppShell, type NavItem } from "@/components/shell/app-shell";
import { listarAreasCache } from "@/server/cache";
import { STATUS_ABERTOS } from "@/domain/solicitacao";

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
      .where(and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, STATUS_ABERTOS), eq(solicitacoes.tipo, "ALTERACAO")));
    return Number(r.n);
  };
  // "Ver como" é só do admin real (não do perfil simulado): as áreas vêm em paralelo com os contadores.
  const verComoDoAdmin = async () => {
    const real = await getUsuarioReal();
    return real?.perfil === "ADMIN" ? await listarAreasCache() : null;
  };
  const [naoLidas, abertas, areasAdmin] = await Promise.all([contarNaoLidas(usuario), contarAbertas(), verComoDoAdmin()]);
  const ehAdminReal = areasAdmin !== null;
  const areasVerComo = areasAdmin ?? [];

  const nav: NavItem[] = [
    { href: "/", label: "Painel", exato: true },
    { href: "/eventos", label: "Eventos" },
    { href: "/calendario", label: "Calendário" },
    { href: "/solicitacoes", label: "Solicitações", contagem: abertas },
    ...(pode(usuario, "arena.ver") ? [{ href: "/arena", label: "Arena 3D", secao: "Operação" }] : []),
    ...(!TELAS_INATIVAS.consolidacao && pode(usuario, "consolidacao.ver") ? [{ href: "/consolidacao", label: "Demanda de peças", secao: "Operação" }] : []),
    ...(!TELAS_INATIVAS.pendencias && pode(usuario, "pendencias.ver") ? [{ href: "/pendencias", label: "Pendências de compra", secao: "Operação" }] : []),
    { href: "/biblioteca", label: "Biblioteca", secao: "Cadastros", ativoEm: ["/projetos", "/catalogo"] },
    ...(pode(usuario, "admin.usuarios") ? [{ href: "/admin", label: "Administração", secao: "Sistema" }] : []),
  ];

  return (
    <AppShell usuario={usuario} nav={nav} naoLidas={naoLidas} verComo={ehAdminReal ? { areaSolicitante: areasVerComo.filter((a) => a.nome !== "Logística" && a.nome !== "Cenografia").map((a) => ({ id: a.id, nome: a.nome }))[0] ?? null } : null}>
      {children}
    </AppShell>
  );
}
