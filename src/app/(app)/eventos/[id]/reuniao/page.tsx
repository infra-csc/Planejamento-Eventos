import { redirect } from "next/navigation";

/** A conferência da ata ganhou tela própria, fora das abas do evento. */
export default async function ReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/conferencia/${id}`);
}
