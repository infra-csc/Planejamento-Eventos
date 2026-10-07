"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Numero } from "@/components/ui/numero";
import { Stepper } from "@/components/ui/stepper";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { itensDoQuadro, PAPEIS_POR_LOCAL, LOCAIS_PADRAO_TENDA, LOCAIS_SUGERIDOS_TENDA, locaisIniciaisTenda, novoLocalTenda, padraoPorTenda, papeisDoKit, previaTendas, totalDoLocal, type KitTenda, type LocalTenda, type PapelTenda } from "@/domain/tendas";

export type ItemTenda = { quantidade: number; destino: string; ajustes: Record<string, number>; descricoes: string[]; locais: string[] };
type Linha = { pecaId: string; codigo: string; quantidade: number };

/**
 * Quadro "Tendas 5×5 por local", no formato da planilha da cenografia: uma linha por local com a
 * quantidade de tendas e o total de cada peça do kit naquele local (fechamentos, cantoneiras,
 * travessas, pés, mastros, cabos, calhas). Abre com os locais que aparecem em quase toda OS já com
 * as quantidades mais comuns; as colunas de peça seguem o padrão × tendas até alguém digitar outro
 * número (a célula fica marcada). Linha com 0 tendas é ignorada. Ao confirmar, vira um item por
 * local (projeto da tenda, destino = local, diferença do padrão como ajuste por unidade). Se o
 * total do local não divide igual entre as tendas, o local vira 2 ou 3 itens com a divisão
 * mais próxima — a soma sempre bate com o que foi digitado.
 * Vive dentro de um DialogContent (o rodapé usa DialogFooter).
 */
export function QuadroTendas({
  kit,
  bom,
  extras,
  iniciais,
  onConfirmar,
  onCancelar,
}: {
  kit: KitTenda;
  bom: ReadonlyArray<Linha>;
  extras: ReadonlyArray<Linha>;
  /** Tendas já na solicitação (editar): o quadro abre com elas em vez dos locais padrão. */
  iniciais?: LocalTenda[];
  onConfirmar: (itens: ItemTenda[]) => void;
  onCancelar: () => void;
}) {
  const [locais, setLocais] = useState<LocalTenda[]>(() => (iniciais?.length ? iniciais : locaisIniciaisTenda(kit.tamanho)));
  const [erro, setErro] = useState<{ linha: number | null; msg: string } | null>(null);
  const sugestoes = [...(LOCAIS_PADRAO_TENDA[kit.tamanho] ?? []).map((l) => l.local), ...(LOCAIS_SUGERIDOS_TENDA[kit.tamanho] ?? [])];
  const idSugestoes = `tenda-locais-${kit.tamanho.replace("×", "x")}`;
  // Só as peças do kit que o catálogo tem (fechamento/calha vêm como extras do projeto).
  const pecaIdDe = new Map([...bom, ...extras].map((b) => [b.codigo, b.pecaId]));
  // No quadro só aparece o que muda por local (fechamentos e, na 5×5, calhas). Cantoneira, travessa,
  // pé, mastro e cabo seguem o padrão do projeto × tendas e não são editáveis aqui.
  const papeis = papeisDoKit(kit).filter((p) => pecaIdDe.has(p.codigo) && PAPEIS_POR_LOCAL.includes(p.papel));
  const mudar = (n: number, patch: Partial<LocalTenda>) => {
    setLocais((l) => l.map((x, i) => (i === n ? { ...x, ...patch } : x)));
    if (erro && (erro.linha === null || erro.linha === n)) setErro(null);
  };
  const mudarTotal = (n: number, papel: PapelTenda, v: number) => setLocais((l) => l.map((x, i) => (i === n ? { ...x, totais: { ...x.totais, [papel]: Math.max(0, Math.floor(Number.isFinite(v) ? v : 0)) } } : x)));
  const previa = previaTendas(kit, bom, locais).filter((p) => papeis.some((x) => x.papel === p.papel));
  const tendas = locais.reduce((a, l) => a + l.quantidade, 0);

  const confirmar = () => {
    const semLocal = locais.findIndex((l) => l.quantidade > 0 && !l.local.trim());
    if (semLocal >= 0) {
      setErro({ linha: semLocal, msg: "Diga o local desta linha (ex.: Depósito, GV, Dispersão)." });
      document.getElementById(`tenda-local-${semLocal}`)?.focus();
      return;
    }
    const itens = itensDoQuadro(kit, bom, locais);
    if (itens.length === 0) {
      setErro({ linha: null, msg: "Informe ao menos uma tenda." });
      return;
    }
    onConfirmar(
      itens.map((it) => ({
        quantidade: it.quantidade,
        destino: it.local,
        ajustes: Object.fromEntries(Object.entries(it.ajustes).flatMap(([codigo, delta]) => (pecaIdDe.has(codigo) ? [[pecaIdDe.get(codigo)!, delta]] : []))),
        descricoes: descricoesIguais(it.quantidade, `Tenda ${kit.tamanho} — ${it.local}`),
        locais: descricoesIguais(it.quantidade, it.local),
      })),
    );
  };

  const th = "px-1.5 pb-1.5 text-left text-micro font-semibold uppercase tracking-[0.06em] text-muted";
  return (
    <>
      <div className="-mx-1 overflow-x-auto px-1">
        <table data-responsiva className="w-full border-collapse max-sm:block sm:min-w-[440px]">
          <thead className="max-sm:hidden">
            <tr className="border-b border-line-soft">
              <th scope="col" className={cn(th, "min-w-[160px]")}>
                Local
              </th>
              <th scope="col" className={cn(th, "w-[136px]")}>
                Tendas
              </th>
              {papeis.map((p) => (
                <th key={p.papel} scope="col" className={cn(th, "w-[104px] min-w-[88px] text-center")}>
                  {p.rotulo}
                </th>
              ))}
              <th scope="col" className="w-9">
                <span className="sr-only">Remover</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {locais.map((l, n) => {
              const nomeLinha = l.local || `linha ${n + 1}`;
              const erroLinha = erro?.linha === n;
              const inativa = l.quantidade === 0;
              return (
                <tr key={n} className={cn("border-b border-line-row last:border-b-0 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-end max-sm:gap-x-3 max-sm:gap-y-2 max-sm:py-3", inativa && "text-meta")}>
                  <td className="py-1.5 pr-1.5 max-sm:order-1 max-sm:min-w-0 max-sm:p-0">
                    <Input
                      id={`tenda-local-${n}`}
                      value={l.local}
                      maxLength={60}
                      onChange={(e) => mudar(n, { local: e.target.value })}
                      placeholder="Ex.: Depósito"
                      list={idSugestoes}
                      aria-label={`Local da linha ${n + 1}`}
                      aria-invalid={erroLinha || undefined}
                      aria-describedby={erroLinha ? "tenda-erro" : undefined}
                    />
                  </td>
                  <td className="px-1.5 py-1.5 max-sm:order-3 max-sm:p-0">
                    <span className="mb-1 block text-rotulo text-muted sm:hidden">Tendas</span>
                    <Stepper tamanho="sm" valor={l.quantidade} min={0} onChange={(v) => mudar(n, { quantidade: v })} label={`Tendas em ${nomeLinha}`} />
                  </td>
                  {papeis.map((p) => {
                    const total = totalDoLocal(kit, bom, l, p.papel);
                    const padrao = padraoPorTenda(kit, bom, p.papel) * l.quantidade;
                    const alterado = l.totais[p.papel] !== undefined && total !== padrao;
                    return (
                      <td key={p.papel} className="px-1.5 py-1.5 text-center max-sm:order-4 max-sm:p-0 max-sm:text-left">
                        <span className="mb-1 block text-rotulo text-muted sm:hidden">{p.rotulo}</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={total}
                          disabled={inativa}
                          onChange={(e) => mudarTotal(n, p.papel, Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          aria-label={`${p.rotulo} em ${nomeLinha}`}
                          title={alterado ? `Padrão: ${padrao}` : undefined}
                          className={cn("numero mx-auto !w-16 text-center max-sm:mx-0 max-sm:!w-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", alterado && "border-accent font-medium text-accent")}
                        />
                      </td>
                    );
                  })}
                  <td className="py-1.5 pl-1.5 text-right max-sm:order-2 max-sm:self-center max-sm:p-0">
                    {locais.length > 1 && (
                      <IconButton label={`Tirar ${nomeLinha}`} onClick={() => setLocais((ls) => ls.filter((_, i) => i !== n))}>
                        <Icone nome="lixeira" />
                      </IconButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" size="sm" className="mt-1 self-start" onClick={() => setLocais((ls) => [...ls, { ...novoLocalTenda(), quantidade: 1 }])}>
        <Icone nome="mais" />
        Outro local
      </Button>
      {/* Sugestões de local ao digitar (os mais comuns nas OS); a lista é a mesma para todas as linhas. */}
      <datalist id={idSugestoes}>
        {sugestoes.map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-controle border border-line-soft bg-subtle px-3 py-2.5 text-pequeno text-ink-2">
        <span>
          Total <Numero valor={tendas} className="font-semibold text-ink" /> {tendas === 1 ? "tenda" : "tendas"}
        </span>
        {previa.map((p) => (
          <span key={p.papel}>
            {p.rotulo} <Numero valor={p.total} className="font-medium text-ink" />
          </span>
        ))}
      </div>
      <p className="mb-0 mt-2 text-rotulo text-muted">A estrutura da tenda (cantoneiras, travessas, pés, mastro e cabo) segue o padrão do projeto. Aqui você ajusta só os fechamentos{papeis.some((p) => p.papel === "calha") ? " e as calhas" : ""} de cada local.</p>
      {erro && (
        <p id="tenda-erro" role="alert" className="mb-0 mt-2 flex items-start gap-1 text-pequeno text-danger">
          <Icone nome="erro" className="mt-px" />
          {erro.msg}
        </p>
      )}

      <DialogFooter>
        <Button variant="primary" size="lg" onClick={confirmar} disabled={tendas === 0} motivoDesabilitado="Informe ao menos uma tenda.">
          {iniciais?.length ? "Salvar tendas" : tendas === 1 ? "Adicionar 1 tenda" : `Adicionar ${tendas} tendas`}
        </Button>
        <Button variant="secondary" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
      </DialogFooter>
    </>
  );
}
