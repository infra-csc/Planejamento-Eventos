import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { listarNotificacoes, marcarLida, marcarTodasLidas } from "@/server/services/notificacoes";
import { EmptyState, PageHeader, Panel } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { tempoRelativo } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notificações" };

async function marcarTodasAction() {
  "use server";
  const u = await requireUsuario();
  await marcarTodasLidas(u);
  revalidatePath("/", "layout");
}

async function abrirAction(formData: FormData) {
  "use server";
  const u = await requireUsuario();
  const id = String(formData.get("id"));
  await marcarLida(u, id);
  revalidatePath("/", "layout");
}

export default async function NotificacoesPage() {
  const usuario = await requireUsuario();
  const lista = await listarNotificacoes(usuario);
  const naoLidas = lista.filter((n) => !n.lidaEm).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notificações"
        description="Somente o que exige sua atenção: envios, respostas por item, prazos, ata fechada, encerramento e reaberturas."
        actions={
          naoLidas > 0 && (
            <form action={marcarTodasAction}>
              <Button type="submit" variant="secondary" size="sm">
                Marcar todas como lidas
              </Button>
            </form>
          )
        }
      />
      <Panel padded={false}>
        {lista.length === 0 ? (
          <EmptyState title="Nenhuma notificação" description="Quando algo precisar da sua ação, aparecerá aqui." compact />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.lidaEm && "bg-brand-soft/40")}>
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.lidaEm ? "bg-transparent" : "bg-accent")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", n.lidaEm ? "text-ink-secondary" : "font-medium text-ink")}>{n.titulo}</p>
                  <p className="text-[13px] text-ink-muted">{n.mensagem}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">{tempoRelativo(n.criadoEm)}</p>
                </div>
                {n.link && (
                  <form action={abrirAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <Link href={n.link} className="text-[13px] text-info hover:underline" onClick={undefined}>
                      Abrir
                    </Link>
                    {!n.lidaEm && (
                      <button type="submit" className="ml-3 text-[13px] text-ink-muted hover:text-ink">
                        Lida
                      </button>
                    )}
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
