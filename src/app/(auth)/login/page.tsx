import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/server/auth/session";
import { LoginForm } from "./login-form";
import { destinoInterno } from "@/lib/destino";

export const metadata: Metadata = { title: "Entrar" };

/**
 * O bloco "Demonstração — entrar como" faz login com a senha do seed em um clique.
 * - Local (`npm run dev` fora do Replit): aparece por padrão.
 * - Replit e produção: só com EXIBIR_DEMO=true explícito. Qualquer pessoa com o link entra como
 *   qualquer perfil, inclusive Administrador — use apenas com dados de demonstração.
 */
function exibirDemo() {
  if (process.env.EXIBIR_DEMO === "true") return true;
  if (process.env.EXIBIR_DEMO === "false") return false;
  const exposto = Boolean(process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || process.env.DATABASE_URL);
  return process.env.NODE_ENV !== "production" && !exposto;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; redefinida?: string }> }) {
  const sp = await searchParams;
  // Sessão válida (conferida no banco): não faz sentido mostrar o login.
  if (await getUsuarioAtual()) redirect(destinoInterno(sp.next, "/"));
  return <LoginForm next={destinoInterno(sp.next, "")} redefinida={sp.redefinida === "1"} demo={exibirDemo()} />;
}
