"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aplicarPecasPlanilhaAction, criarPecaDoItemAction, previaPecasPlanilhaAction, vincularItemAtivacaoAction } from "@/app/(app)/projecao/actions";
import { Button } from "@/components/ui/button";
import { ComboBox, type OpcaoCombo } from "@/components/ui/combobox";
import { FormError } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { EmptyState, Section } from "@/components/ui/layout";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { TIPO_ITEM_LABEL } from "@/domain/logistica";
import type { LinhaPecaPlanilha } from "@/server/services/planilhas-logistica";

/** Tipo e m³ das peças em lote: baixa o modelo já com as peças, preenche, confere e só então grava. Célula em branco não muda nada. */
export function ImportarPecasPlanilha() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<LinhaPecaPlanilha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, iniciarLeitura] = useTransition();
  const [gravando, iniciarGravacao] = useTransition();
  const ler = (f: File) =>
    iniciarLeitura(async () => {
      setErro(null);
      const fd = new FormData();
      fd.set("arquivo", f);
      const r = await previaPecasPlanilhaAction(fd);
      if (input.current) input.current.value = "";
      if (!r.ok) return setErro(r.erro);
      setPrevia(r.dados ?? []);
    });
  const validas = previa?.filter((l) => !l.erro && (l.tipoItem || l.volumeM3 !== null || l.estoqueMinimo !== null || l.apelidos || l.codigoBarras)) ?? [];
  const comErro = previa?.filter((l) => l.erro) ?? [];
  return (
    <Section
      titulo="Preencher por planilha"
      sub="Retornável ou consumível, m³, estoque mínimo, apelidos e código de barras das peças."
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/pecas/modelo-logistica" className="inline-flex min-h-10 items-center gap-1.5 text-pequeno font-medium text-accent no-underline hover:underline">
            <Icone nome="download" />
            Baixar modelo
          </a>
          <input ref={input} type="file" accept=".xlsx" className="sr-only" aria-label="Planilha de peças" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
          <Button variant="secondary" size="md" loading={lendo} onClick={() => input.current?.click()}>
            <Icone nome="seta-cima" />
            Enviar planilha
          </Button>
        </div>
      }
    >
      {erro && (
        <div className="px-cartao py-3">
          <FormError message={erro} />
        </div>
      )}
      {previa && (
        <div className="flex flex-col gap-2 px-cartao py-3">
          <p className="m-0 text-corpo text-ink">
            <b className="numero font-semibold">{validas.length}</b> {validas.length === 1 ? "peça muda" : "peças mudam"}
            {comErro.length > 0 && <> · <b className="numero font-semibold text-danger">{comErro.length}</b> {comErro.length === 1 ? "linha com erro fica" : "linhas com erro ficam"} de fora</>}
          </p>
          {comErro.length > 0 && (
            <ul className="m-0 max-h-32 list-none overflow-y-auto rounded-controle border border-danger-border bg-danger-bg p-2 text-pequeno text-danger">
              {comErro.map((l) => (
                <li key={l.linha}>Linha {l.linha}: {l.erro}</li>
              ))}
            </ul>
          )}
          {validas.length > 0 && (
            <ul className="m-0 max-h-48 list-none overflow-y-auto p-0 text-pequeno text-ink-2">
              {validas.slice(0, 200).map((l) => (
                <li key={l.linha} className="flex flex-wrap justify-between gap-2 border-t border-line-row py-1 first:border-t-0">
                  <span>{l.nome} <span className="font-mono text-ink-3">{l.codigo}</span></span>
                  <span className="numero">{[l.tipoItem ? TIPO_ITEM_LABEL[l.tipoItem] : null, l.volumeM3 !== null ? `${l.volumeM3} m³` : null, l.estoqueMinimo !== null ? `mín. ${l.estoqueMinimo}` : null].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              loading={gravando}
              disabled={validas.length === 0}
              motivoDesabilitado="Nenhuma linha com o que atualizar."
              onClick={() =>
                iniciarGravacao(async () => {
                  const r = await aplicarPecasPlanilhaAction(validas);
                  if (!r.ok) return setErro(r.erro);
                  toastSucesso(r.mensagem ?? "Peças atualizadas");
                  setPrevia(null);
                  router.refresh();
                })
              }
            >
              Gravar {validas.length} {validas.length === 1 ? "peça" : "peças"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPrevia(null)}>
              Descartar
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

type Item = { id: string; nome: string; categoria: string; quantidade: number };

/** Cada item da Ativação fica ligado a uma peça do catálogo: uma que já existe ou uma nova, com o nome do item. */
export function VincularAtivacao({ itens, pecas }: { itens: Item[]; pecas: OpcaoCombo[] }) {
  if (itens.length === 0) {
    return (
      <Section>
        <EmptyState compact icone="check-circulo" title="Todos os itens da Ativação estão ligados ao catálogo" />
      </Section>
    );
  }
  return (
    <Section titulo={`Itens sem peça · ${itens.length}`} sub="As quantidades em posse viram sugestão na primeira contagem do almoxarifado Ativação.">
      <ul className="m-0 list-none p-0">
        {itens.map((i) => (
          <LinhaItem key={i.id} item={i} pecas={pecas} />
        ))}
      </ul>
    </Section>
  );
}

function LinhaItem({ item, pecas }: { item: Item; pecas: OpcaoCombo[] }) {
  const [pendente, iniciar] = useTransition();
  const [peca, setPeca] = useState<string | null>(null);
  const responder = (r: { ok: boolean; erro?: string; mensagem?: string }) => (r.ok ? toastSucesso(r.mensagem ?? "Pronto") : toastErro(r.erro ?? "Não foi possível salvar."));
  return (
    <li className="grid gap-2 border-t border-line-row px-cartao py-2 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
      <span className="min-w-0">
        <span className="block text-corpo text-ink">{item.nome}</span>
        <span className="text-rotulo text-ink-3">{item.categoria} · em posse <span className="numero">{item.quantidade}</span></span>
      </span>
      <ComboBox aria-label={`Peça para ${item.nome}`} value={peca} onChange={setPeca} opcoes={pecas} placeholder="Buscar peça do catálogo" />
      <span className="flex flex-wrap gap-1.5">
        <Button variant="secondary" size="sm" loading={pendente} disabled={!peca} motivoDesabilitado="Escolha a peça." onClick={() => iniciar(async () => responder(await vincularItemAtivacaoAction(item.id, peca as string)))}>
          Ligar
        </Button>
        <Button variant="ghost" size="sm" loading={pendente} onClick={() => iniciar(async () => responder(await criarPecaDoItemAction(item.id)))}>
          Criar peça
        </Button>
      </span>
    </li>
  );
}
