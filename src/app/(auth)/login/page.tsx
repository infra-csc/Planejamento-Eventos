import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; redefinida?: string }> }) {
  const sp = await searchParams;
  return <LoginForm next={sp.next ?? ""} redefinida={sp.redefinida === "1"} />;
}
