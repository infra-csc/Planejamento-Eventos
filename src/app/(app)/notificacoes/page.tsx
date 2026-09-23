import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { listarNotificacoesComTotal, marcarLida, marcarTodasLidas } from "@/server/services/notificacoes";
import { SubmitButton } from "@/components/ui/button";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Paginacao } from "@/components/ui/tabela";
import { tempoRelativo } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { cn } from "@/lib/cn";
import { destinoInterno } from "@/lib/destino";
import { BotaoNotificacao } from "./botao-notificacao";

export const metadata: Metadata = { title: "Notificações" };

const POR_PAGINA = 25;

/** Ícone e cor do ícone pelo tipo da notificação. Só prazo vencido ganha cor de erro. */
function aparencia(tipo: string): { icone: NomeIcone; cor: string } {
  if (/SLA|VENCID/.test(tipo)) return { icone: "relogio", cor: "text-danger" };
  if (/PRAZO/.test(tipo)) return { icone: "relogio", cor: "text-warning" };
  if (/REUNIAO/.test(tipo)) return { icone: "calendario", cor: "text-info" };
  if (/DEVOLVIDA|CANCELADA/.test(tipo)) return { icone: "alerta", cor: "text-ink-3" };
  if (/RESPONDID|RESOLVIDA/.test(tipo)) return { icone: "check-circulo", cor: "text-success" };
  if (/SOLICITACAO|PRE_REUNIAO|AVULSO/.test(tipo)) return { icone: "solicitacoes", cor: "text-ink-3" };
  if (/EVENTO|ATA/.test(tipo)) return { icone: "eventos", cor: "text-ink-3" };
  if (/PROJETO|PECA|CATALOGO|VINCULADO/.test(tipo)) return { icone: "caixa", cor: "text-ink-3" };
  if (/SENHA/.test(tipo)) return { icone: "escudo", cor: "text-ink-3" };
  return { icone: "sino", cor: "text-ink-3" };
}

async function marcarTodasAction() {
  "use server";
  const u = await requireUsuario();
  await marcarTodasLidas(u);
  revalidatePath("/notificacoes");
}

async function abrirAction(formData: FormData) {
  "use server";
  const u = await requireUsuario();
  await marcarLida(u, String(formData.get("id")));
  revalidatePath("/notificacoes");
  const link = String(formData.get("link") ?? "");
  // Só links internos: a notificação é gerada pelo sistema, mas não seguimos URLs externas.
  redirect(destinoInterno(link, "/notificacoes"));
}

export default async function NotificacoesPage({ searchParams }: { searchParams: Promise<{ filtro?: string; pagina?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const { itens: lista, total: totalGeral, naoLidas, limite, truncada } = await listarNotificacoesComTotal(usuario);
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
                <Icone nome="check" />
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
            <EmptyState
              icone="check-circulo"
              title="Tudo lido"
              description="Nada novo por aqui."
              action={
                lista.length > 0 ? (
                  <Link href={hrefCom("/notificacoes", params, { filtro: null, pagina: null })} className="link text-corpo">
                    Ver todas
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icone="sino"
              title="Nenhuma notificação"
              description="Envios, respostas, prazos e mudanças de fase aparecem aqui."
              action={
                <Link href="/" className="link text-corpo">
                  Ir para o painel
                </Link>
              }
            />
          )
        ) : (
          <>
            <ul className="m-0 list-none p-0">
              {itens.map((n) => {
                const { icone, cor } = aparencia(n.tipo);
                const naoLida = !n.lidaEm;
                const quando = tempoRelativo(n.criadoEm);
                const conteudo = (
                  <>
                    <span aria-hidden className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-neutral-bg">
                      <Icone nome={icone} className={cor} />
                      {naoLida && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-selected bg-accent" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-3">
                        <span className={cn("min-w-0 flex-1 text-corpo text-ink", naoLida && "font-semibold")}>
                          {naoLida && <span className="sr-only">Não lida: </span>}
                          {n.titulo}
                        </span>
                        <span className="numero shrink-0 text-pequeno text-meta">{quando}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-pequeno text-ink-2">{n.mensagem}</span>
                    </span>
                    <span aria-hidden className="grid w-4 shrink-0 place-items-center self-center text-ink-3">
                      {n.link && <Icone nome="chevron-direita" />}
                    </span>
                  </>
                );
                const classe = cn("flex w-full items-start gap-3 border-b border-line-row px-cartao py-3 text-left", naoLida && "bg-selected");
                // A linha inteira abre o destino (e marca como lida); sem destino, é só leitura.
                return (
                  <li key={n.id} className="[&:last-child>*]:border-b-0 [&:last-child_button]:border-b-0">
                    {n.link ? (
                      <form action={abrirAction} className="m-0">
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="link" value={n.link} />
                        <BotaoNotificacao rotulo={`Abrir: ${n.titulo}`} className={cn(classe, "cursor-pointer border-0 border-b bg-transparent transition-colors hover:bg-subtle", naoLida && "bg-selected")}>
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
            {truncada && (
              <p className="m-0 border-t border-line-soft px-cartao py-2.5 text-pequeno text-muted">
                Mostrando as <span className="numero">{limite}</span> mais recentes de <span className="numero">{totalGeral}</span>.
              </p>
            )}
            <Paginacao total={total} pagina={pagina} paginas={paginas} de={de} porPagina={POR_PAGINA} hrefPagina={(p) => hrefCom("/notificacoes", params, { pagina: p === 1 ? null : p })} />
          </>
        )}
      </div>
    </div>
  );
}
