import type { Metadata } from "next";
import { redirect } from "next/navigation";

// Título próprio enquanto o redirecionamento acontece: a página intermediária ficava sem nome (auditoria 28/10, nº 143).
export const metadata: Metadata = { title: "Conferência da ata" };

/** A conferência da ata ganhou tela própria, fora das abas do evento. */
export default async function ReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/conferencia/${id}`);
}
