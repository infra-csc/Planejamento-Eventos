import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { existeUsuarioAtivo, getUsuarioAtual } from "@/server/auth/session";
import { exibirDemo, SENHA_DEMO } from "@/server/auth/demo";
import { LoginForm } from "./login-form";
import { destinoInterno } from "@/lib/destino";

export const metadata: Metadata = { title: "Entrar" };

/**
 * O bloco "Demonstração — entrar como" faz login com a senha do seed em um clique (ver
 * src/server/auth/demo.ts: local por padrão; Replit e produção só com EXIBIR_DEMO=true).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; redefinida?: string }> }) {
  const sp = await searchParams;
  // Sessão válida (conferida no banco): não faz sentido mostrar o login.
  if (await getUsuarioAtual()) redirect(destinoInterno(sp.next, "/"));
  // Banco novo, sem nenhum usuário: a tela explica como criar o administrador.
  const primeiroAcesso = !(await existeUsuarioAtivo().catch(() => true));
  return <LoginForm next={destinoInterno(sp.next, "")} redefinida={sp.redefinida === "1"} senhaDemo={exibirDemo() ? SENHA_DEMO : null} primeiroAcesso={primeiroAcesso} />;
}
