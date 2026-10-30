"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Stepper } from "@/components/ui/stepper";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { ajustarTendasDoLocalAction } from "@/app/(app)/eventos/actions";
import type { LinhaConferencia } from "@/server/services/conferencia";

type Papel = "fechamento" | "calha";
type Coluna = { papel: Papel; rotulo: string };

/** Um local da tenda: as linhas dele e os totais (tendas e, por papel, peças = tendas × peças por tenda). */
type Local = { chave: string; nome: string | null; ls: LinhaConferencia[]; tendas: number; totais: Record<Papel, number>; ok: number };

const norm = (s: string | null) => (s ?? "").trim().toLocaleLowerCase("pt-BR");

/** "1 calha", "2 calhas", "0 fechamentos". */
const PLURAL: Record<Papel, [string, string]> = { fechamento: ["fechamento", "fechamentos"], calha: ["calha", "calhas"] };
const contagem = (papel: Papel, n: number) => `${PLURAL[papel][n === 1 ? 0 : 1]}`;

function locaisDe(ls: readonly LinhaConferencia[], colunas: readonly Coluna[]): Local[] {
  const m = new Map<string, Local>();
  for (const l of ls) {
    const k = norm(l.destino);
    const loc = m.get(k) ?? { chave: k, nome: l.destino, ls: [], tendas: 0, totais: { fechamento: 0, calha: 0 }, ok: 0 };
    loc.ls.push(l);
    loc.tendas += l.quantidade;
    if (l.conferidoEm) loc.ok++;
    for (const c of colunas) loc.totais[c.papel] += l.quantidade * (l.tenda?.pecas.find((p) => p.papel === c.papel)?.porUnidade ?? 0);
    m.set(k, loc);
  }
  return [...m.values()].sort((a, b) => (a.nome ?? "~").localeCompare(b.nome ?? "~", "pt-BR"));
}

/** Quem pediu o local, em uma linha: "SOL-0074 · Produção · Ana Lima" (ou "Incluída pela logística"). */
function Origem({ ls }: { ls: readonly LinhaConferencia[] }) {
  const pedidos = [...new Map(ls.filter((l) => l.origem).map((l) => [l.origem!.solicitacaoId, l])).values()];
  const semPedido = ls.some((l) => !l.origem);
  return (
    // Quebra em vez de cortar: na tela de 1280 (painel da reunião ao lado) a coluna do local tem ~120 px e
    // "Incluída pela logísti…" escondia quem pediu, sem dica.
    <span className="block break-words text-rotulo text-ink-3">
      {pedidos.map((l, i) => (
        <span key={l.origem!.solicitacaoId}>
          {i > 0 && " · "}
          <Link href={`/solicitacoes/${l.origem!.solicitacaoId}`} className="text-ink-3 no-underline hover:text-accent hover:underline">
            <Codigo>{l.origem!.codigo}</Codigo>
          </Link>{" "}
          {l.areaNome ?? "Logística"} · {l.origem!.solicitante}
        </span>
      ))}
      {semPedido && (
        <>
          {pedidos.length > 0 && " · "}
          {ls.find((l) => !l.origem)?.regra ? "Regra da logística" : `Incluída pela logística${ls.find((l) => !l.origem)?.incluidaPor ? ` · ${ls.find((l) => !l.origem)!.incluidaPor}` : ""}`}
        </>
      )}
    </span>
  );
}

/**
 * Tenda na conferência, como no quadro de tendas: uma linha por local com as tendas e o total de
 * fechamentos e calhas, cada número com − e + na própria linha. Mudar um número salva sozinho (um
 * instante depois do último clique) e deixa o local conferido; zerar as tendas pede confirmação, porque
 * tira o local da ata. As linhas do mesmo local (pedidos diferentes) aparecem juntas.
 */
export function BlocoTenda({
  ls,
  eventoId,
  editavel,
  onConferir,
}: {
  ls: readonly LinhaConferencia[];
  eventoId: string;
  editavel: boolean;
  onConferir: (ls: readonly LinhaConferencia[], v: boolean) => void;
}) {
  const p0 = ls[0];
  const colunas: Coluna[] = (p0.tenda?.pecas ?? []).map((p) => ({ papel: p.papel as Papel, rotulo: p.rotulo }));
  const locais = locaisDe(ls, colunas);
  const ok = ls.filter((l) => l.conferidoEm).length;
  const tudoOk = ok === ls.length;
  const totalTendas = locais.reduce((a, l) => a + l.tendas, 0);
  const locaisOk = locais.filter((l) => l.ok === l.ls.length).length;
  // Check | Local | Tendas | (Fechamentos) | (Calhas) | situação do salvamento. Colunas do número na largura
  // exata do stepper pequeno (110 px) e espaço de 8 px: a 1280 px (painel ao lado) sobra mais para o local.
  const grade = cn("md:grid md:items-center md:gap-x-2", colunas.length === 2 ? "md:grid-cols-[40px_minmax(0,1fr)_110px_110px_110px_20px]" : colunas.length === 1 ? "md:grid-cols-[40px_minmax(0,1fr)_110px_110px_20px]" : "md:grid-cols-[40px_minmax(0,1fr)_110px_20px]");

  return (
    <section aria-label={`${p0.nome}: ${locaisOk} de ${locais.length} locais conferidos`} className="border-b border-line-row last:border-b-0">
      <h4 className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-cartao pb-2 pt-3 font-normal">
        {/* Código do projeto no title, como nas outras linhas da conferência. */}
        <span className="text-corpo font-semibold text-ink" title={p0.codigo ?? undefined}>
          {p0.nome}
        </span>
        <span className="numero text-pequeno text-muted">
          <b className="font-semibold text-ink">{totalTendas}</b> {totalTendas === 1 ? "tenda" : "tendas"}
          {colunas.map((c) => {
            const n = locais.reduce((a, l) => a + l.totais[c.papel], 0);
            return (
              <span key={c.papel}>
                {" · "}
                <b className="font-semibold text-ink">{n}</b> {contagem(c.papel, n)}
              </span>
            );
          })}
          {" · "}
          {locais.length} {locais.length === 1 ? "local" : "locais"}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-2">
          <span className={cn("numero inline-flex items-center gap-1 text-pequeno", tudoOk ? "font-medium text-success" : "text-ink-3")}>
            {tudoOk && <Icone nome="check" className="size-3.5" />}
            {locaisOk}/{locais.length} {locais.length === 1 ? "local conferido" : "locais conferidos"}
          </span>
          {/* Com um local só, o check da linha já faz isso: o botão seria a mesma ação duas vezes. */}
          {editavel && !tudoOk && locais.length > 1 && (
            <Button variant="ghost" size="xs" onClick={() => onConferir(ls, true)} aria-label={`${locais.length - locaisOk === 1 ? "Conferir o local restante" : `Conferir os ${locais.length - locaisOk} locais`} de ${p0.nome}`}>
              <Icone nome="check" />
              {/* Mesmo padrão do bloco por item ("Conferir as 3"): diz quantos vão ser marcados. */}
              {locais.length - locaisOk === 1 ? (
                "Conferir o local restante"
              ) : (
                <>
                  Conferir os <span className="numero">{locais.length - locaisOk}</span> locais
                </>
              )}
            </Button>
          )}
        </span>
      </h4>

      <div className="mx-cartao mb-3 rounded-controle border border-line-soft">
        {/* Cabeçalho do quadro (no celular cada número leva o próprio rótulo). */}
        <div className={cn(grade, "hidden border-b border-line-soft bg-subtle px-2.5 py-1.5 text-micro font-semibold uppercase tracking-[0.06em] text-muted md:grid")} aria-hidden>
          <span />
          <span>Local</span>
          <span className="text-center">Tendas</span>
          {colunas.map((c) => (
            <span key={c.papel} className="text-center" title={`Total de ${c.rotulo.toLowerCase()} do local (todas as tendas)`}>
              {c.rotulo}
            </span>
          ))}
          <span />
        </div>
        <ul className="m-0 list-none p-0">
          {locais.map((loc) => (
            <LocalTenda key={loc.chave} loc={loc} nome={p0.nome} eventoId={eventoId} colunas={colunas} grade={grade} editavel={editavel} onConferir={onConferir} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/** "editando": número mudado, esperando o instante antes de gravar. */
type Situacao = "parado" | "editando" | "salvando" | "salvo" | "confirmar-zero";

/** Um local do quadro: check, quem pediu e os números com − e +, salvos sozinhos. */
function LocalTenda({
  loc,
  nome,
  eventoId,
  colunas,
  grade,
  editavel,
  onConferir,
}: {
  loc: Local;
  nome: string;
  eventoId: string;
  colunas: readonly Coluna[];
  grade: string;
  editavel: boolean;
  onConferir: (ls: readonly LinhaConferencia[], v: boolean) => void;
}) {
  const [tendas, setTendas] = useState(loc.tendas);
  const [totais, setTotais] = useState<Record<Papel, number>>({ ...loc.totais });
  const [situacao, setSituacao] = useState<Situacao>("parado");
  /*
   * Números novos do servidor (gravação feita aqui ou por outra pessoa) entram na tela sem remontar a linha:
   * antes a linha era recriada a cada gravação, o foco de quem usava − e + pelo teclado se perdia e o
   * "Salvo" sumia na hora. Enquanto a pessoa mexe (ou confirma o zero), vale o que ela está digitando.
   */
  const assinatura = `${loc.tendas}:${colunas.map((c) => loc.totais[c.papel]).join(",")}`;
  const [assinaturaVista, setAssinaturaVista] = useState(assinatura);
  if (assinaturaVista !== assinatura) {
    setAssinaturaVista(assinatura);
    if (situacao !== "editando" && situacao !== "confirmar-zero") {
      setTendas(loc.tendas);
      setTotais({ ...loc.totais });
    }
  }
  const timer = useRef<number | null>(null);
  const conferido = loc.ok === loc.ls.length;
  const descricoes = [...new Set(loc.ls.flatMap((l) => (l.origem?.descricoes ?? []).map((d) => (d.unidades > 1 ? `${d.unidades}× ${d.texto}` : d.texto))))];
  const pedido = loc.ls.every((l) => l.origem) ? loc.ls.reduce((a, l) => a + (l.origem?.quantidadeSolicitada ?? 0), 0) : null;
  const ajuste = loc.ls.map((l) => l.ultimoAjuste).find(Boolean);
  const local = loc.nome ?? "local não informado";

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const gravar = (t: number, tot: Record<Papel, number>) => {
    setSituacao("salvando");
    void ajustarTendasDoLocalAction(eventoId, { linhaIds: loc.ls.map((l) => l.id), tendas: t, totais: Object.fromEntries(colunas.map((c) => [c.papel, tot[c.papel]])), motivo: "" }).then((r) => {
      if (!r.ok) {
        // Volta aos números de antes: a tela nunca mostra o que não foi gravado.
        setTendas(loc.tendas);
        setTotais({ ...loc.totais });
        setSituacao("parado");
        toastErro(r.erro);
        return;
      }
      setSituacao("salvo");
      if (t === 0) toastSucesso(`${nome} em ${local} saiu da ata`);
    });
  };

  /** Um instante depois do último clique (vários "+" seguidos viram um salvamento só). */
  const mudar = (t: number, tot: Record<Papel, number>) => {
    setTendas(t);
    setTotais(tot);
    if (timer.current) window.clearTimeout(timer.current);
    if (t === 0) return setSituacao("confirmar-zero");
    setSituacao("editando");
    timer.current = window.setTimeout(() => gravar(t, tot), 700);
  };

  const desfazerZero = () => {
    setTendas(loc.tendas);
    setTotais({ ...loc.totais });
    setSituacao("parado");
  };

  return (
    <li data-linha={loc.ls[0].id} className={cn("border-b border-line-row px-2.5 py-2.5 transition-colors duration-200 last:border-b-0", conferido ? "bg-success-bg/40" : "hover:bg-subtle/60")}>
      <div className={cn(grade, "flex flex-col gap-2.5")}>
        <div className="flex items-start gap-3 md:contents">
          {editavel ? (
            <button
              type="button"
              role="checkbox"
              data-check=""
              data-obrigatoria=""
              aria-checked={conferido ? true : loc.ok > 0 ? "mixed" : false}
              aria-label={`${nome}, ${local}: ${conferido ? "conferido, clique para desfazer" : "marcar como conferido"}`}
              onClick={() => onConferir(loc.ls, !conferido)}
              className={cn(
                "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                conferido ? "border-success bg-success text-white" : loc.ok > 0 ? "border-success bg-success-bg text-success" : "border-line-control bg-surface text-line-strong hover:border-success hover:text-success",
              )}
            >
              <Icone nome="check" tamanho={20} />
            </button>
          ) : (
            <span role="img" aria-label={conferido ? "Conferido" : "Não conferido"} className={cn("grid size-10 shrink-0 place-items-center rounded-full border-2", conferido ? "border-success bg-success text-white" : "border-line-strong text-transparent")}>
              <Icone nome="check" tamanho={20} />
            </span>
          )}
          <span className="min-w-0 flex-1 md:pl-1">
            <Link href={`/eventos/${eventoId}/itens/${loc.ls[0].id}`} className="block break-words text-corpo font-medium text-ink no-underline hover:text-accent hover:underline" title="Tendas deste local: descrição, peças e histórico">
              {loc.nome ?? "Sem local informado"}
            </Link>
            <Origem ls={loc.ls} />
            {descricoes.length > 0 && (
              <span className="block truncate text-rotulo text-ink-2" title={descricoes.join(" · ")}>
                {descricoes.join(" · ")}
              </span>
            )}
            {(ajuste || (pedido !== null && pedido !== tendas)) && (
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-rotulo text-warning" title={ajuste ? `Ajustado por ${ajuste.por}: ${ajuste.descricao}` : undefined}>
                <Icone nome="lapis" className="size-3" />
                {pedido !== null && pedido !== tendas && (
                  <span>
                    pedido <b className="numero font-semibold">{pedido}</b> {pedido === 1 ? "tenda" : "tendas"}
                  </span>
                )}
                {/* Sem truncate: "ajustado por Marina Ca…" era cortado até a 1280 px (auditoria 28/10, nº 127). */}
                {ajuste && <span>{pedido !== null && pedido !== tendas ? "· " : ""}ajustado por {ajuste.por}</span>}
              </span>
            )}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 pl-[52px] sm:grid-cols-2 md:contents">
          <CampoNumero rotulo="Tendas" local={local} valor={tendas} editavel={editavel} destaque onChange={(v) => mudar(v, totais)} />
          {colunas.map((c) => (
            <CampoNumero key={c.papel} rotulo={c.rotulo} local={local} valor={totais[c.papel]} editavel={editavel} onChange={(v) => mudar(tendas, { ...totais, [c.papel]: v })} />
          ))}
        </div>
        <span className="hidden justify-end md:flex" aria-live="polite">
          {situacao === "salvando" ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-line-strong border-t-accent" role="status" aria-label="Salvando" />
          ) : situacao === "salvo" ? (
            <span role="status" aria-label="Salvo" title="Salvo e conferido">
              <Icone nome="check-circulo" className="size-4 text-success" />
            </span>
          ) : null}
        </span>
      </div>
      {situacao === "confirmar-zero" && (
        <div role="alertdialog" aria-label="Tirar o local da ata" className="mt-2 flex flex-wrap items-center gap-2 rounded-controle border border-danger-border bg-danger-bg px-3 py-2 md:ml-[52px]">
          <span className="min-w-0 flex-1 text-pequeno text-danger">Com 0 tendas, {local} sai da ata.</span>
          <Button variant="secondary" size="xs" onClick={desfazerZero}>
            Desfazer
          </Button>
          <Button variant="danger" size="xs" onClick={() => gravar(0, totais)}>
            Tirar da ata
          </Button>
        </div>
      )}
    </li>
  );
}

/** Um número do quadro (tendas, fechamentos, calhas): − e + para quem confere; no celular, com o rótulo ao lado. */
function CampoNumero({ rotulo, local, valor, editavel, destaque, onChange }: { rotulo: string; local: string; valor: number; editavel: boolean; destaque?: boolean; onChange: (v: number) => void }) {
  return (
    <span className="flex items-center justify-between gap-2 md:justify-center">
      <span className="text-pequeno text-muted md:hidden">{rotulo}</span>
      {editavel ? (
        <Stepper tamanho="sm" valor={valor} min={0} max={10_000} onChange={onChange} label={`${rotulo} em ${local}`} className={cn(destaque && "border-ink-3")} />
      ) : (
        <span className={cn("numero text-corpo", valor ? "font-semibold text-ink" : "text-meta")}>{valor}</span>
      )}
    </span>
  );
}
