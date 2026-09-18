import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { listarNotificacoes, marcarLida, marcarTodasLidas } from "@/server/services/notificacoes";
import { SubmitButton } from "@/components/ui/button";
import { EmptyState, Marcador, PageHeader } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Paginacao } from "@/components/ui/tabela";
import { tempoRelativo } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { cn } from "@/lib/cn";
import { destinoInterno } from "@/lib/destino";
import { BotaoNotificacao } from "./botao-notificacao";

export const metadata: Metadata = { title: "Notificações" };

const POR_PAGINA = 25;

async function marcarTodasAction() {
  "use server";
  const u = await requireUsuario();
  await marcarTodasLidas(u);
  revalidatePath("/", "layout");
}

async function abrirAction(formData: FormData) {
  "use server";
  const u = await requireUsuario();
  await marcarLida(u, String(formData.get("id")));
  revalidatePath("/", "layout");
  const link = String(formData.get("link") ?? "");
  // Só links internos: a notificação é gerada pelo sistema, mas não seguimos URLs externas.
  redirect(destinoInterno(link, "/notificacoes"));
}

export default async function NotificacoesPage({ searchParams }: { searchParams: Promise<{ filtro?: string; pagina?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const lista = await listarNotificacoes(usuario);
  const naoLidas = lista.filter((n) => !n.lidaEm).length;
  const soNaoLidas = sp.filtro === "nao-lidas";
  const visiveis = soNaoLidas ? lista.filter((n) => !n.lidaEm) : lista;

  const total = visiveis.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(paginas, Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1));
  const de = (pagina - 1) * POR_PAGINA;
  const itens = visiveis.slice(de, de + POR_PAGINA);
  const params = { filtro: sp.filtro, pagina: sp.pagina };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Notificações"
        divisor
        actions={
          naoLidas > 0 && (
            <form action={marcarTodasAction}>
              <SubmitButton variant="secondary" size="lg">
                Marcar todas como lidas
              </SubmitButton>
            </form>
          )
        }
      />
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <TabsNav
          rotulo="Filtrar notificações"
          className="mb-0 px-2 pt-1"
          tabs={[
            { href: hrefCom("/notificacoes", params, { filtro: null, pagina: null }), label: "Todas", n: lista.length, ativo: !soNaoLidas },
            { href: hrefCom("/notificacoes", params, { filtro: "nao-lidas", pagina: null }), label: "Não lidas", n: naoLidas, ativo: soNaoLidas },
          ]}
        />
        {itens.length === 0 ? (
          soNaoLidas ? (
            <EmptyState title="Tudo lido" description="Só o que pede sua atenção aparece aqui: envios, respostas, prazos e mudanças de fase." />
          ) : (
            <EmptyState title="Nenhuma notificação" description="Quando algo precisar da sua ação, aparece aqui." />
          )
        ) : (
          <>
            <div aria-hidden className="flex gap-3.5 border-b border-line-soft bg-subtle px-cartao py-2.5 text-micro font-semibold uppercase tracking-[0.06em] text-muted">
              <span className="flex-1 pl-[21px]">Notificação</span>
              <span className="hidden w-28 text-right sm:block">Quando</span>
              <span className="w-7" />
            </div>
            <ul className="m-0 list-none p-0">
              {itens.map((n) => {
                const prazo = /PRAZO|SLA/.test(n.tipo);
                const quando = tempoRelativo(n.criadoEm);
                const conteudo = (
                  <>
                    <Marcador tom={n.lidaEm ? undefined : prazo ? "danger" : "accent"} className={cn(n.lidaEm && "bg-transparent")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-corpo text-ink", !n.lidaEm && "font-medium")}>
                        {!n.lidaEm && <span className="sr-only">Não lida: </span>}
                        {n.titulo}
                      </span>
                      <span className="mt-0.5 block text-pequeno leading-[1.45] text-ink-3">{n.mensagem}</span>
                      <span className="mt-1 block font-mono text-rotulo text-meta sm:hidden">{quando}</span>
                    </span>
                    <span className="hidden w-28 shrink-0 text-right font-mono text-pequeno text-meta sm:block">{quando}</span>
                    <span aria-hidden className="grid w-7 shrink-0 place-items-center self-center text-ink-3">
                      {n.link && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      )}
                    </span>
                  </>
                );
                const classe = cn("flex w-full items-start gap-3.5 border-b border-line-row px-cartao py-3 text-left", !n.lidaEm && "bg-selected");
                // A linha inteira abre o destino (e marca como lida); sem destino, é só leitura.
                return (
                  <li key={n.id} className="[&:last-child>*]:border-b-0 [&:last-child_button]:border-b-0">
                    {n.link ? (
                      <form action={abrirAction} className="m-0">
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="link" value={n.link} />
                        <BotaoNotificacao rotulo={`Abrir: ${n.titulo}`} className={cn(classe, "cursor-pointer border-0 border-b bg-transparent hover:bg-subtle", !n.lidaEm && "bg-selected")}>
                          {conteudo}
                        </BotaoNotificacao>
                      </form>
                    ) : (
                      <div className={classe}>{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Paginacao total={total} pagina={pagina} paginas={paginas} de={de} porPagina={POR_PAGINA} hrefPagina={(p) => hrefCom("/notificacoes", params, { pagina: p === 1 ? null : p })} />
          </>
        )}
      </div>
    </div>
  );
}
