"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Checkbox, Input } from "@/components/ui/field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { diaMesISO } from "@/lib/format";
import { CAMADA_LABEL, CAMADAS, CAMADAS_COM_DADO, eventosDoPeriodo, type Camada, type Celula, type Cobertura, type Demanda, type Semana, type TomCelula } from "@/domain/projecao";

/** Filtros de marcar: cada mudança vai para a URL, como os outros filtros. */
export function FiltrosMarcaveis({ camadas, incluirADefinir, soFaltas }: { camadas: readonly Camada[]; incluirADefinir: boolean; soFaltas: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, iniciar] = useTransition();
  const ir = (mudar: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(mudar)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    iniciar(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {CAMADAS.map((c) => {
        const temDado = CAMADAS_COM_DADO.includes(c);
        return (
          <Checkbox
            key={c}
            id={`camada-${c}`}
            label={temDado ? CAMADA_LABEL[c] : `${CAMADA_LABEL[c]} (Fase 3)`}
            checked={camadas.includes(c)}
            onChange={(v) => ir({ camadas: (v ? [...camadas, c] : camadas.filter((x) => x !== c)).join(",") })}
          />
        );
      })}
      <span aria-hidden className="h-5 w-px bg-line max-sm:hidden" />
      <Checkbox id="filtro-adefinir" label="Incluir a definir" checked={incluirADefinir} onChange={(v) => ir({ adefinir: v ? null : "0" })} />
      <Checkbox id="filtro-faltas" label="Só faltas" checked={soFaltas} onChange={(v) => ir({ faltas: v ? "1" : null })} />
    </div>
  );
}

/** Data de início da Projeção; em branco, hoje. */
export function InicioUrl({ valor }: { valor: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, iniciar] = useTransition();
  return (
    <Input
      type="date"
      aria-label="A partir de"
      title="A partir de (em branco, hoje)"
      className="numero md:w-[160px]"
      defaultValue={valor}
      onChange={(e) => {
        const q = new URLSearchParams(sp.toString());
        if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) q.set("inicio", e.target.value);
        else q.delete("inicio");
        iniciar(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
      }}
    />
  );
}

const COR: Record<TomCelula, string> = {
  ok: "bg-success-bg text-success",
  atencao: "bg-warning-bg text-warning",
  falta: "bg-danger-bg text-danger font-semibold",
};

type PecaLinha = { id: string; codigo: string; nome: string; unidade: string; estoqueMinimo: number | null };
type Linha = { pecaId: string; celulas: Celula[]; naoConferida: boolean; peca: PecaLinha };

/** Matriz semanas × peças. A primeira coluna fica fixa; a cor vem sempre com o número, não sozinha. */
export function MatrizProjecao({ semanas, linhas, demandas, coberturas }: { semanas: Semana[]; linhas: Linha[]; demandas: Demanda[]; coberturas: Cobertura[] }) {
  const [aberta, setAberta] = useState<{ linha: Linha; celula: Celula } | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">Saldo mínimo de cada peça por semana. Negativo é falta.</caption>
          <thead>
            <tr className="bg-subtle text-micro font-semibold uppercase tracking-[0.04em] text-ink-2">
              <th scope="col" className="sticky left-0 z-10 min-w-[220px] bg-subtle px-cartao py-2 text-left">Peça</th>
              {semanas.map((s) => (
                <th key={s.inicio} scope="col" className="numero min-w-[68px] px-1.5 py-2 text-center font-semibold normal-case tracking-normal">
                  {diaMesISO(s.inicio)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.pecaId} className="border-t border-line-row">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-cartao py-1.5 text-left font-normal">
                  <span className="block text-corpo text-ink">{l.peca.nome}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-rotulo text-ink-3">
                    <span className="font-mono">{l.peca.codigo}</span>
                    {l.naoConferida && <Badge tom="warning">não conferida</Badge>}
                  </span>
                </th>
                {l.celulas.map((c) => (
                  <td key={c.inicio} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => setAberta({ linha: l, celula: c })}
                      aria-label={`${l.peca.nome}, semana de ${diaMesISO(c.inicio)}: ${c.minimo < 0 ? `faltam ${-c.minimo}` : `saldo mínimo ${c.minimo}`}. Ver os eventos.`}
                      className={cn("numero block h-9 w-full cursor-pointer rounded-chip px-1 text-center text-pequeno transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent", COR[c.tom])}
                    >
                      {c.minimo.toLocaleString("pt-BR")}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(aberta)} onOpenChange={(o) => !o && setAberta(null)}>
        {aberta && <DetalheCelula linha={aberta.linha} celula={aberta.celula} demandas={demandas} coberturas={coberturas} />}
      </Dialog>
    </>
  );
}

function DetalheCelula({ linha, celula, demandas, coberturas }: { linha: Linha; celula: Celula; demandas: Demanda[]; coberturas: Cobertura[] }) {
  const lista = eventosDoPeriodo(demandas, linha.pecaId, celula.inicio, celula.fim);
  const cob = coberturas.filter((c) => c.pecaId === linha.pecaId && c.dataEntrada <= celula.fim && (!c.dataDevolucao || c.dataDevolucao > celula.inicio));
  return (
    <DialogContent title={linha.peca.nome} description={`Semana de ${diaMesISO(celula.inicio)} a ${diaMesISO(celula.fim)}. ${celula.minimo < 0 ? `Faltam ${-celula.minimo} em ${diaMesISO(celula.dia)}.` : `Menor saldo: ${celula.minimo} em ${diaMesISO(celula.dia)}.`}`} width={620}>
      {lista.length === 0 && cob.length === 0 ? (
        <p className="m-0 text-corpo text-ink-2">Nenhum evento com esta peça fora nesta semana.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-pequeno">
            <caption className="sr-only">O que explica o número desta semana</caption>
            <thead>
              <tr className="text-left text-micro font-semibold uppercase tracking-[0.04em] text-ink-2">
                <th scope="col" className="py-1.5 pr-3">Evento</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Qtd.</th>
                <th scope="col" className="py-1.5 pr-3">Camada</th>
                <th scope="col" className="py-1.5 pr-3">Sai e volta</th>
                <th scope="col" className="py-1.5">Origem</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d, i) => (
                <tr key={i} className="border-t border-line-row align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink">
                    <span className="font-mono">{d.eventoCodigo}</span> {d.eventoNome}
                    {d.tourNome && <span className="block text-rotulo text-ink-3">em tour: {d.tourNome}</span>}
                  </th>
                  <td className="numero py-1.5 pr-3 text-right font-medium">{d.quantidade.toLocaleString("pt-BR")}</td>
                  <td className="py-1.5 pr-3">{CAMADA_LABEL[d.camada]}{d.aDefinir ? " · a definir" : ""}</td>
                  <td className="numero whitespace-nowrap py-1.5 pr-3">{diaMesISO(d.saida)} a {d.tipoItem === "CONSUMIVEL" ? "não volta" : diaMesISO(d.retorno)}</td>
                  <td className="py-1.5 text-ink-2">{d.origem}</td>
                </tr>
              ))}
              {cob.map((c) => (
                <tr key={c.id} className="border-t border-line-row align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-success">{c.rotulo}</th>
                  <td className="numero py-1.5 pr-3 text-right font-medium text-success">+{c.quantidade.toLocaleString("pt-BR")}</td>
                  <td className="py-1.5 pr-3">Prevista</td>
                  <td className="numero whitespace-nowrap py-1.5 pr-3">{diaMesISO(c.dataEntrada)}{c.dataDevolucao ? ` a ${diaMesISO(c.dataDevolucao)}` : ""}</td>
                  <td className="py-1.5 text-ink-2">Cobre a falta</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DialogContent>
  );
}
