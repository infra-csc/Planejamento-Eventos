import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { obterConfig } from "@/server/services/admin";
import { ConfigForm } from "@/components/admin/config-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await requirePermissao("admin.configuracoes");
  const cfg = await obterConfig();
  return <ConfigForm valores={cfg} />;
}
