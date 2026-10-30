"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/layout";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Numero } from "@/components/ui/numero";
import { hora } from "@/lib/format";
import { Passo } from "./passo";
import { agruparItensNovos, ehAcompanhante, irPara, sugerirTitulo } from "./utilidades";
import type { EstadoSalvo } from "./use-autosave-solicitacao";
import type { EventoOpcao, ItemNovo, Pendencia, Referencia } from "./tipos";

/** Passo 4 · Resumo e envio: acompanha a rolagem no desktop; no celular vem depois dos passos. */
export function ResumoEnvio({
  n,
  evento,
  itens,
  pecas,
  semDescricao,
  pendencias,
  titulo,
  setTitulo,
  tituloSugerido,
  voltarSugestao,
  observacao,
  setObservacao,
  erroTitulo,
  setErroTitulo,
  validarTitulo,
  tentouEnviar,
  erroGeral,
  pendente,
  bloqueadoEnvio,
  salvar,
  descartar,
  edicaoEnviada = false,
  estadoSalvo,
  codigoRascunho,
}: {
  /** Número do passo. */
  n: number;
  evento: EventoOpcao | null;
  itens: ItemNovo[];
  pecas: Referencia[];
  semDescricao: ItemNovo[];
  pendencias: Pendencia[];
  titulo: string;
  setTitulo: (v: string) => void;
  /** O campo mostra o título sugerido pelos itens (ninguém escreveu outro). */
  tituloSugerido: boolean;
  /** Campo esvaziado: volta a mostrar (e acompanhar) a sugestão. */
  voltarSugestao: () => void;
  observacao: string;
  setObservacao: (v: string) => void;
  erroTitulo: string | null;
  setErroTitulo: (v: string | null) => void;
  validarTitulo: (v: string) => void;
  tentouEnviar: boolean;
  erroGeral: string | null;
  pendente: boolean;
  bloqueadoEnvio: boolean;
  salvar: (enviar: boolean) => void;
  /** Pedido já enviado em edição: sair sem salvar (volta ao pedido). */
  descartar?: () => void;
  /** Pedido já enviado em edição: um botão só, "Salvar alterações". */
  edicaoEnviada?: boolean;
  estadoSalvo: EstadoSalvo;
  codigoRascunho: string | null;
}) {
  // Título sugerido a partir dos itens: aparece no campo e vale no envio se ninguém escrever outro.
  const sugestaoTitulo = sugerirTitulo(itens, pecas);
  const textoSalvo = edicaoEnviada
    ? "As alterações ficam guardadas neste navegador até você salvar; o pedido como estava continua valendo."
    : estadoSalvo.tipo === "salvando"
      ? "Salvando rascunho…"
      : estadoSalvo.tipo === "salvo"
        ? `Rascunho ${codigoRascunho ?? ""} salvo às ${hora(estadoSalvo.em)}`
        : estadoSalvo.tipo === "erro"
          ? `Rascunho não salvo: ${estadoSalvo.msg}`
          : evento?.aceita
            ? "O rascunho é salvo automaticamente enquanto você preenche."
            : "";

  const grupos = agruparItensNovos(itens);
  const algumFalta = semDescricao.length > 0;

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-topo-fixo">
      <Passo
        n={n}
        titulo="Resumo e envio"
        feito={pendencias.length === 0}
        // Sem evento, "Para enviar, falta" logo abaixo já diz o que fazer.
        sub={
          evento ? (
            <>
              <Numero valor={grupos.length} /> {grupos.length === 1 ? "item" : "itens"} para {evento.nome}
            </>
          ) : undefined
        }
      >
        {itens.length > 0 && (
          <ul className="m-0 max-h-[200px] list-none overflow-y-auto border-b border-line-soft p-0">
            {grupos.map(({ chave, itens: doGrupo }) => {
              const i = doGrupo[0];
              const falta = doGrupo.some((x) => semDescricao.some((y) => y.chave === x.chave));
              const total = doGrupo.reduce((a, x) => a + x.quantidade, 0);
              const nLocais = new Set(doGrupo.map((x) => x.destino.trim().toLocaleLowerCase("pt-BR"))).size;
              return (
                <li key={chave}>
                  <button
                    type="button"
                    onClick={() => irPara(`item-${i.chave}`)}
                    className="flex w-full cursor-pointer items-center gap-2 border-0 border-b border-line-faint bg-transparent px-cartao py-2 text-left text-pequeno transition-colors duration-150 last:border-b-0 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                  >
                    {falta ? <Icone nome="alerta" className="size-3.5 shrink-0 text-warning" title="Faltam descrições" /> : algumFalta ? <span aria-hidden className="size-3.5 shrink-0" /> : null}
                    <span className="line-clamp-2 min-w-0 flex-1 break-words text-ink" title={i.rotulo}>
                      {i.rotulo}
                      {nLocais > 1 && <span className="text-muted"> · {nLocais} locais</span>}
                      {/* Cavaletes que vêm junto: o mesmo código pode aparecer duas vezes (automático e extras). */}
                      {ehAcompanhante(i) && <span className="text-muted"> · automático</span>}
                    </span>
                    <span className="numero shrink-0 text-ink-2">{i.operacao === "REMOVER" ? "remover" : `× ${total}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-col gap-3.5 px-cartao py-3.5">
          <Field
            label="Título"
            htmlFor="titulo"
            obrigatorio
            error={erroTitulo}
            hint={tituloSugerido ? "Sugerido pelos itens; mude se quiser. É o que a logística vê na fila." : "É o que a logística vê na fila."}
          >
            <Input
              id="titulo"
              value={titulo}
              maxLength={120}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (erroTitulo && e.target.value.trim()) setErroTitulo(null);
              }}
              onBlur={(e) => {
                if (!e.target.value.trim() && sugestaoTitulo) {
                  voltarSugestao();
                  setErroTitulo(null);
                } else if (tentouEnviar) validarTitulo(e.target.value);
              }}
              placeholder="Ex.: Estrutura do palco principal"
            />
          </Field>
          <Field label="Observação" htmlFor="observacao" optional>
            <Textarea id="observacao" value={observacao} maxLength={1000} onChange={(e) => setObservacao(e.target.value)} placeholder="Contexto que ajuda a logística a responder." className="min-h-[64px]" />
          </Field>

          {pendencias.length > 0 ? (
            <div>
              <p className="mb-1 mt-0 text-pequeno font-medium text-ink-2">{edicaoEnviada ? "Para salvar, falta:" : "Para enviar, falta:"}</p>
              <ul className="m-0 flex list-none flex-col p-0">
                {pendencias.map((p) => (
                  <li key={p.alvo}>
                    <button
                      type="button"
                      onClick={() => irPara(p.alvo)}
                      className={cn(
                        "-mx-1.5 flex w-[calc(100%+12px)] cursor-pointer items-center gap-2 rounded-controle border-0 bg-transparent px-1.5 py-1 text-left text-pequeno transition-colors duration-150 hover:bg-subtle max-md:min-h-10",
                        tentouEnviar ? "text-danger" : "text-ink-2",
                      )}
                    >
                      <span aria-hidden className={cn("block size-1.5 shrink-0 rounded-full", tentouEnviar ? "bg-danger" : "bg-line-strong")} />
                      {p.texto}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="m-0 flex items-center gap-1.5 text-pequeno font-medium text-success">
              <Icone nome="check-circulo" />
              {edicaoEnviada ? "Pronto para salvar" : "Pronto para enviar"}
            </p>
          )}

          {erroGeral && (
            <div id="erro-geral">
              <Aviso tom="danger">{erroGeral}</Aviso>
            </div>
          )}

          <div className="flex flex-col gap-2 max-lg:hidden">
            <Button variant="primary" size="lg" loading={pendente} onClick={() => salvar(true)} disabled={bloqueadoEnvio} motivoDesabilitado="O evento não aceita solicitações agora." className="w-full">
              {edicaoEnviada ? "Salvar alterações" : "Enviar solicitação"}
            </Button>
            {!edicaoEnviada && (
              <Button variant="secondary" size="lg" disabled={pendente} onClick={() => salvar(false)} className="w-full">
                Salvar rascunho
              </Button>
            )}
            {descartar && (
              <Button variant="secondary" size="lg" disabled={pendente} onClick={descartar} className="w-full">
                Descartar alterações
              </Button>
            )}
          </div>
          {textoSalvo && (
            <p className={cn("m-0 flex items-start gap-1.5 text-pequeno", estadoSalvo.tipo === "erro" ? "text-danger" : estadoSalvo.tipo === "salvo" ? "text-ink-2" : "text-meta")} aria-live="polite">
              {estadoSalvo.tipo === "salvando" ? (
                <span aria-hidden className="mt-[7px] block size-1.5 shrink-0 animate-pulse-dot rounded-full bg-current" />
              ) : estadoSalvo.tipo === "salvo" ? (
                <Icone nome="check" className="mt-0.5 size-3.5 shrink-0 text-success" />
              ) : estadoSalvo.tipo === "erro" ? (
                <Icone nome="alerta" className="mt-0.5 size-3.5 shrink-0" />
              ) : null}
              <span>{textoSalvo}</span>
            </p>
          )}
        </div>
      </Passo>
    </aside>
  );
}

/** Barra de envio fixa no celular e tablet: contagem, o que falta e a ação principal sempre à mão. */
export function BarraEnvioMovel({
  itens,
  pendencias,
  tentouEnviar,
  pendente,
  bloqueadoEnvio,
  salvar,
  descartar,
  edicaoEnviada = false,
  estadoSalvo,
}: {
  itens: ItemNovo[];
  pendencias: Pendencia[];
  tentouEnviar: boolean;
  pendente: boolean;
  bloqueadoEnvio: boolean;
  salvar: (enviar: boolean) => void;
  /** Pedido já enviado em edição: sair sem salvar (volta ao pedido). */
  descartar?: () => void;
  edicaoEnviada?: boolean;
  estadoSalvo?: EstadoSalvo;
}) {
  const n = agruparItensNovos(itens).length;
  const estado = edicaoEnviada ? null : estadoSalvo?.tipo === "salvando" ? "Salvando rascunho…" : estadoSalvo?.tipo === "salvo" ? `Rascunho salvo às ${hora(estadoSalvo.em)}` : estadoSalvo?.tipo === "erro" ? "Rascunho não salvo" : null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-line bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-popover lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-corpo font-medium text-ink">
            <Numero valor={n} /> {n === 1 ? "item" : "itens"}
          </p>
          <p className={cn("m-0 line-clamp-2 text-pequeno", pendencias.length && tentouEnviar ? "text-danger" : estadoSalvo?.tipo === "erro" ? "text-danger" : "text-muted")} aria-live="polite">
            {pendencias.length ? `Falta: ${pendencias[0].texto.toLowerCase()}` : edicaoEnviada ? "Pronto para salvar" : estado ? `Pronto para enviar · ${estado.toLowerCase()}` : "Pronto para enviar"}
          </p>
        </div>
        {!edicaoEnviada && (
          <Button variant="ghost" size="md" disabled={pendente} onClick={() => salvar(false)} aria-label="Salvar rascunho">
            Salvar
          </Button>
        )}
        {descartar && (
          <Button variant="ghost" size="md" disabled={pendente} onClick={descartar} aria-label="Descartar alterações">
            Descartar
          </Button>
        )}
        <Button variant="primary" size="md" loading={pendente} onClick={() => salvar(true)} disabled={bloqueadoEnvio} motivoDesabilitado="O evento não aceita solicitações agora.">
          {edicaoEnviada ? "Salvar alterações" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
