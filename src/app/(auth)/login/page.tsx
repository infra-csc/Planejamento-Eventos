import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

/**
 * O bloco "Demonstração — entrar como" só aparece fora de produção, ou com EXIBIR_DEMO=true
 * (útil para apresentar o sistema no Replit com os dados do seed).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; redefinida?: string }> }) {
  const sp = await searchParams;
  const demo = process.env.NODE_ENV !== "production" || process.env.EXIBIR_DEMO === "true";
  return <LoginForm next={sp.next ?? ""} redefinida={sp.redefinida === "1"} demo={demo} />;
}
