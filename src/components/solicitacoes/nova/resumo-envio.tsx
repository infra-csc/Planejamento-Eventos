"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/layout";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Numero } from "@/components/ui/numero";
import { hora } from "@/lib/format";
import { Passo } from "./passo";
import { irPara } from "./utilidades";
import type { EstadoSalvo } from "./use-autosave-solicitacao";
import type { EventoOpcao, ItemNovo, Pendencia, Referencia } from "./tipos";

/** Passo 4 · Resumo e envio: acompanha a rolagem no desktop; no celular vem depois dos passos. */
export function ResumoEnvio({
  evento,
  itens,
  pecas,
  semDescricao,
  pendencias,
  titulo,
  setTitulo,
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
  estadoSalvo,
  codigoRascunho,
}: {
  evento: EventoOpcao | null;
  itens: ItemNovo[];
  pecas: Referencia[];
  semDescricao: ItemNovo[];
  pendencias: Pendencia[];
  titulo: string;
  setTitulo: (v: string) => void;
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
  estadoSalvo: EstadoSalvo;
  codigoRascunho: string | null;
}) {
  /** Nome sem o código na frente (peça), para o título sugerido. */
  const nomeCurto = (i: ItemNovo) => (i.pecaId ? (pecas.find((p) => p.id === i.pecaId)?.nome ?? i.rotulo) : i.rotulo);
  // Título sugerido a partir dos itens: só placeholder e um atalho "Usar sugestão"; nunca preenche sozinho.
  const sugestaoTitulo = (() => {
    const nomes = itens.map(nomeCurto);
    if (nomes.length === 0) return null;
    const texto = nomes.length === 1 ? nomes[0] : nomes.length === 2 ? `${nomes[0]} e ${nomes[1]}` : `${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2}`;
    return texto.length > 120 ? `${texto.slice(0, 119)}…` : texto;
  })();
  const textoSalvo =
    estadoSalvo.tipo === "salvando"
      ? "Salvando rascunho…"
      : estadoSalvo.tipo === "salvo"
        ? `Rascunho ${codigoRascunho ?? ""} salvo às ${hora(estadoSalvo.em)}`
        : estadoSalvo.tipo === "erro"
          ? `Rascunho não salvo: ${estadoSalvo.msg}`
          : evento?.aceita
            ? "O rascunho é salvo automaticamente enquanto você preenche."
            : "";

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-topo-fixo">
      <Passo
        n={4}
        titulo="Resumo e envio"
        feito={pendencias.length === 0}
        sub={
          evento ? (
            <>
              <Numero valor={itens.length} /> {itens.length === 1 ? "item" : "itens"} para {evento.nome}
            </>
          ) : (
            "Escolha o evento e adicione itens."
          )
        }
      >
        {itens.length > 0 && (
          <ul className="m-0 max-h-[200px] list-none overflow-y-auto border-b border-line-soft p-0">
            {itens.map((i) => {
              const falta = semDescricao.some((x) => x.chave === i.chave);
              return (
                <li key={i.chave}>
                  <button
                    type="button"
                    onClick={() => irPara(`item-${i.chave}`)}
                    className="flex w-full cursor-pointer items-center gap-2 border-0 border-b border-line-faint bg-transparent px-cartao py-2 text-left text-pequeno transition-colors duration-150 last:border-b-0 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                  >
                    {falta && <Icone nome="alerta" className="size-3.5 text-warning" title="Faltam descrições" />}
                    <span className="line-clamp-2 min-w-0 flex-1 break-words text-ink" title={i.rotulo}>
                      {i.rotulo}
                    </span>
                    <span className="numero shrink-0 text-ink-2">{i.operacao === "REMOVER" ? "remover" : `× ${i.quantidade}`}</span>
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
            hint={
              !titulo.trim() && sugestaoTitulo ? (
                <>
                  É o que a logística vê na fila.{" "}
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => {
                      setTitulo(sugestaoTitulo);
                      setErroTitulo(null);
                    }}
                  >
                    Usar a sugestão
                  </Button>
                </>
              ) : (
                "É o que a logística vê na fila."
              )
            }
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
                if (tentouEnviar) validarTitulo(e.target.value);
              }}
              placeholder={sugestaoTitulo ?? "Ex.: Estrutura do palco principal"}
            />
          </Field>
          <Field label="Observação" htmlFor="observacao" optional>
            <Textarea id="observacao" value={observacao} maxLength={1000} onChange={(e) => setObservacao(e.target.value)} placeholder="Contexto que ajuda a logística a responder." className="min-h-[64px]" />
          </Field>

          {pendencias.length > 0 ? (
            <div>
              <p className="mb-1 mt-0 text-pequeno font-medium text-ink-2">Para enviar, falta:</p>
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
              Pronto para enviar
            </p>
          )}

          {erroGeral && (
            <div id="erro-geral">
              <Aviso tom="danger">{erroGeral}</Aviso>
            </div>
          )}

          <div className="flex flex-col gap-2 max-lg:hidden">
            <Button variant="primary" size="lg" loading={pendente} onClick={() => salvar(true)} disabled={bloqueadoEnvio} motivoDesabilitado="O evento não aceita solicitações agora." className="w-full">
              Enviar solicitação
            </Button>
            <Button variant="secondary" size="lg" disabled={pendente} onClick={() => salvar(false)} className="w-full">
              Salvar rascunho
            </Button>
          </div>
          {textoSalvo && (
            <p className={cn("m-0 flex items-center gap-1.5 text-pequeno", estadoSalvo.tipo === "erro" ? "text-danger" : "text-meta")} aria-live="polite">
              {estadoSalvo.tipo === "salvo" && <Icone nome="check" className="size-3.5" />}
              {textoSalvo}
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
}: {
  itens: ItemNovo[];
  pendencias: Pendencia[];
  tentouEnviar: boolean;
  pendente: boolean;
  bloqueadoEnvio: boolean;
  salvar: (enviar: boolean) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-line bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-popover lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-corpo font-medium text-ink">
            <Numero valor={itens.length} /> {itens.length === 1 ? "item" : "itens"}
          </p>
          <p className={cn("m-0 truncate text-pequeno", pendencias.length && tentouEnviar ? "text-danger" : "text-muted")}>{pendencias.length ? `Falta: ${pendencias[0].texto.toLowerCase()}` : "Pronto para enviar"}</p>
        </div>
        <Button variant="ghost" size="md" disabled={pendente} onClick={() => salvar(false)}>
          Salvar
        </Button>
        <Button variant="primary" size="md" loading={pendente} onClick={() => salvar(true)} disabled={bloqueadoEnvio} motivoDesabilitado="O evento não aceita solicitações agora.">
          Enviar
        </Button>
      </div>
    </div>
  );
}
