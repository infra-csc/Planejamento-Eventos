import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { existeUsuarioAtivo, getUsuarioAtual } from "@/server/auth/session";
import { exibirDemo, SENHA_DEMO } from "@/server/auth/demo";
import { LoginForm } from "./login-form";
import { destinoInterno } from "@/lib/destino";
import { segredoPortal } from "@/server/auth/portal-entrada";

/** Mensagens da entrada pelo Portal NORTE (/api/auth/portal manda o motivo em ?erro=). */
const ERROS_PORTAL: Record<string, string> = {
  "portal-expirado": "O link do portal venceu ou já foi usado. Volte ao Portal NORTE e abra o app de novo.",
  "portal-invalido": "Não foi possível confirmar seu acesso pelo Portal NORTE. Abra o app de novo pelo portal; se continuar, avise o administrador.",
  "portal-desativado": "A entrada pelo Portal NORTE não está configurada neste servidor (PORTAL_SSO_SECRET).",
  "portal-inativo": "Sua conta está inativa neste app. Fale com o administrador.",
};

export const metadata: Metadata = { title: "Entrar" };

/**
 * O bloco "Demonstração — entrar como" faz login com a senha do seed em um clique (ver
 * src/server/auth/demo.ts: local por padrão; Replit e produção só com EXIBIR_DEMO=true).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; redefinida?: string; erro?: string }> }) {
  const sp = await searchParams;
  // Sessão válida (conferida no banco): não faz sentido mostrar o login.
  if (await getUsuarioAtual()) redirect(destinoInterno(sp.next, "/"));
  // Banco novo, sem nenhum usuário: a tela explica como criar o administrador.
  const primeiroAcesso = !(await existeUsuarioAtivo().catch(() => true));
  const portalUrl = process.env.PORTAL_URL?.trim() || null;
  return <LoginForm next={destinoInterno(sp.next, "")} redefinida={sp.redefinida === "1"} senhaDemo={exibirDemo() ? SENHA_DEMO : null} primeiroAcesso={primeiroAcesso} erroPortal={sp.erro ? (ERROS_PORTAL[sp.erro] ?? null) : null} portalUrl={segredoPortal() ? portalUrl : null} />;
}
