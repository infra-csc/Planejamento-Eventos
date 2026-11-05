"use client";

import { useState, useTransition } from "react";
import { salvarAlmoxarifadoAction, salvarEventoPaiAction, salvarLocadorAction, salvarPerfilAction, salvarTourAction } from "@/app/(app)/projecao/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComboBox, type OpcaoCombo } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone, IconeLapis } from "@/components/ui/icons";
import { EmptyState, Section } from "@/components/ui/layout";
import { toastSucesso } from "@/components/ui/toast";
import { TIPO_VEICULO_LABEL, TIPOS_VEICULO } from "@/domain/carga-descarga";
import { volumePerfil } from "@/domain/logistica";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/cn";

const CELULA = "border-t border-line-row px-3 py-2.5 text-pequeno text-ink-2 first:pl-cartao last:pr-cartao";

/** Diálogo comum dos cadastros: mostra o erro de campo, avisa ao salvar e fecha. */
function useSalvar<T>(salvar: () => Promise<ActionResult<T>>, onFechar: () => void) {
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();
  const enviar = () =>
    iniciar(async () => {
      setErro(null);
      setCampos({});
      const r = await salvar();
      if (!r.ok) {
        setErro(r.erro);
        setCampos((r.campos as Record<string, string>) ?? {});
        return;
      }
      toastSucesso(r.mensagem ?? "Salvo");
      onFechar();
    });
  return { erro, campos, pendente, enviar };
}

function Formulario({ titulo, onFechar, pendente, erro, enviar, children, largura }: { titulo: string; onFechar: () => void; pendente: boolean; erro: string | null; enviar: () => void; children: React.ReactNode; largura?: number }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={titulo} width={largura}>
        <form
          noValidate
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          {children}
          <FormError message={erro} />
          <DialogFooter>
            <Button type="submit" variant="primary" size="lg" loading={pendente}>
              Salvar
            </Button>
            <Button variant="secondary" size="lg" onClick={onFechar}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Tabela<T extends { id: string; nome: string; ativo: boolean }>({ rotulo, novo, lista, colunas, onEditar, onNovo, vazio }: { rotulo: string; novo: string; lista: T[]; colunas: Array<{ titulo: string; valor: (x: T) => React.ReactNode; className?: string }>; onEditar: (x: T) => void; onNovo: () => void; vazio: string }) {
  return (
    <Section
      titulo={rotulo}
      acoes={
        <Button abreDialogo variant="secondary" size="md" onClick={onNovo}>
          <Icone nome="mais" />
          {novo}
        </Button>
      }
    >
      {lista.length === 0 ? (
        <EmptyState compact icone="lista" title={vazio} />
      ) : (
        <div className="relative overflow-x-auto">
          <table data-responsiva className="w-full border-collapse sm:min-w-[480px]">
            <caption className="sr-only">{rotulo}</caption>
            <thead>
              <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                <th scope="col" className="py-2.5 pl-cartao pr-3">Nome</th>
                {colunas.map((c) => (
                  <th key={c.titulo} scope="col" className={cn("px-3 py-2.5", c.className)}>{c.titulo}</th>
                ))}
                <th scope="col" className="py-2.5 pl-3 pr-cartao"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id}>
                  <th scope="row" className={cn(CELULA, "text-left text-corpo font-medium", x.ativo ? "text-ink" : "text-ink-3")}>
                    {x.nome}
                    {!x.ativo && <Badge tom="warning" className="ml-2">Inativo</Badge>}
                  </th>
                  {colunas.map((c) => (
                    <td key={c.titulo} className={cn(CELULA, c.className)}>{c.valor(x)}</td>
                  ))}
                  <td className={cn(CELULA, "w-14 text-right")}>
                    <IconButton abreDialogo label={`Editar ${x.nome}`} onClick={() => onEditar(x)}>
                      <IconeLapis />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* Almoxarifados */
export type AlmoxarifadoCad = { id: string; nome: string; endereco: string | null; areaId: string | null; area: string | null; principal: boolean; ativo: boolean; contadoEm: string | null };

export function AlmoxarifadosPainel({ lista, areas }: { lista: AlmoxarifadoCad[]; areas: Array<{ value: string; label: string }> }) {
  const [modal, setModal] = useState<AlmoxarifadoCad | "novo" | null>(null);
  return (
    <>
      <Tabela
        rotulo="Almoxarifados"
        novo="Novo almoxarifado"
        vazio="Nenhum almoxarifado"
        lista={lista}
        onEditar={setModal}
        onNovo={() => setModal("novo")}
        colunas={[
          { titulo: "Área responsável", valor: (a) => a.area ?? "—" },
          { titulo: "Endereço", valor: (a) => a.endereco ?? "—", className: "hidden md:table-cell" },
          { titulo: "Situação", valor: (a) => <span className="inline-flex flex-wrap gap-1.5">{a.principal && <Badge tom="accent">Principal</Badge>}{a.contadoEm ? <Badge tom="success">contado</Badge> : <Badge tom="warning">não conferido</Badge>}</span> },
        ]}
      />
      {modal && <ModalAlmoxarifado key={modal === "novo" ? "novo" : modal.id} a={modal === "novo" ? null : modal} areas={areas} onFechar={() => setModal(null)} />}
    </>
  );
}

function ModalAlmoxarifado({ a, areas, onFechar }: { a: AlmoxarifadoCad | null; areas: Array<{ value: string; label: string }>; onFechar: () => void }) {
  const [nome, setNome] = useState(a?.nome ?? "");
  const [endereco, setEndereco] = useState(a?.endereco ?? "");
  const [areaId, setAreaId] = useState(a?.areaId ?? "");
  const [principal, setPrincipal] = useState(a?.principal ?? false);
  const [ativo, setAtivo] = useState(a?.ativo ?? true);
  const f = useSalvar(() => salvarAlmoxarifadoAction({ id: a?.id ?? null, nome, endereco: endereco || null, areaId: areaId || null, principal, ativo }), onFechar);
  return (
    <Formulario titulo={a ? `Editar ${a.nome}` : "Novo almoxarifado"} onFechar={onFechar} {...f}>
      <Field label="Nome" htmlFor="a-nome" error={f.campos.nome} obrigatorio>
        <Input id="a-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field label="Área responsável" htmlFor="a-area" optional>
        <Select id="a-area" value={areaId} onValueChange={setAreaId} opcoes={[{ value: "", label: "Sem área" }, ...areas]} />
      </Field>
      <Field label="Endereço" htmlFor="a-end" optional>
        <Input id="a-end" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
      </Field>
      <Checkbox id="a-principal" label="Almoxarifado principal" description="De onde sai a linha que não diz o almoxarifado. Só um." checked={principal} onChange={setPrincipal} />
      <Checkbox id="a-ativo" label="Ativo" checked={ativo} onChange={setAtivo} />
    </Formulario>
  );
}

/* Locadores */
export type LocadorCad = { id: string; nome: string; contato: string | null; cnpj: string | null; ativo: boolean };

export function LocadoresPainel({ lista }: { lista: LocadorCad[] }) {
  const [modal, setModal] = useState<LocadorCad | "novo" | null>(null);
  return (
    <>
      <Tabela rotulo="Locadores" novo="Novo locador" vazio="Nenhum locador cadastrado" lista={lista} onEditar={setModal} onNovo={() => setModal("novo")} colunas={[{ titulo: "Contato", valor: (l) => l.contato ?? "—" }, { titulo: "CNPJ", valor: (l) => l.cnpj ?? "—", className: "numero hidden md:table-cell" }]} />
      {modal && <ModalLocador key={modal === "novo" ? "novo" : modal.id} l={modal === "novo" ? null : modal} onFechar={() => setModal(null)} />}
    </>
  );
}

function ModalLocador({ l, onFechar }: { l: LocadorCad | null; onFechar: () => void }) {
  const [nome, setNome] = useState(l?.nome ?? "");
  const [contato, setContato] = useState(l?.contato ?? "");
  const [cnpj, setCnpj] = useState(l?.cnpj ?? "");
  const [ativo, setAtivo] = useState(l?.ativo ?? true);
  const f = useSalvar(() => salvarLocadorAction({ id: l?.id ?? null, nome, contato: contato || null, cnpj: cnpj || null, ativo }), onFechar);
  return (
    <Formulario titulo={l ? `Editar ${l.nome}` : "Novo locador"} onFechar={onFechar} {...f}>
      <Field label="Nome" htmlFor="l-nome" error={f.campos.nome} obrigatorio>
        <Input id="l-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field label="Contato" htmlFor="l-contato" optional>
        <Input id="l-contato" value={contato} onChange={(e) => setContato(e.target.value)} />
      </Field>
      <Field label="CNPJ" htmlFor="l-cnpj" optional>
        <Input id="l-cnpj" className="numero" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
      </Field>
      <Checkbox id="l-ativo" label="Ativo" checked={ativo} onChange={setAtivo} />
    </Formulario>
  );
}

/* Perfis de veículo */
export type PerfilCad = { id: string; tipo: string; nome: string; comprimentoM: number; larguraM: number; alturaM: number; redutorPct: number; referencia: boolean; ativo: boolean };
const metros = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function PerfisPainel({ lista }: { lista: PerfilCad[] }) {
  const [modal, setModal] = useState<PerfilCad | "novo" | null>(null);
  return (
    <>
      <Tabela
        rotulo="Perfis de veículo"
        novo="Novo perfil"
        vazio="Nenhum perfil cadastrado. Sem um perfil de referência, a estimativa de veículos não aparece."
        lista={lista}
        onEditar={setModal}
        onNovo={() => setModal("novo")}
        colunas={[
          { titulo: "Tipo", valor: (p) => <span className="inline-flex flex-wrap items-center gap-1.5">{TIPO_VEICULO_LABEL[p.tipo as keyof typeof TIPO_VEICULO_LABEL] ?? p.tipo}{p.referencia && <Badge tom="accent">Referência</Badge>}</span> },
          { titulo: "Medidas internas (C × L × A)", valor: (p) => `${metros(p.comprimentoM)} × ${metros(p.larguraM)} × ${metros(p.alturaM)} m`, className: "numero hidden md:table-cell" },
          { titulo: "Volume", valor: (p) => `${metros(volumePerfil(p))} m³`, className: "numero" },
          { titulo: "Redutor", valor: (p) => `${p.redutorPct}%`, className: "numero" },
        ]}
      />
      {modal && <ModalPerfil key={modal === "novo" ? "novo" : modal.id} p={modal === "novo" ? null : modal} onFechar={() => setModal(null)} />}
    </>
  );
}

const paraNumero = (s: string) => Number(s.replace(",", "."));

function ModalPerfil({ p, onFechar }: { p: PerfilCad | null; onFechar: () => void }) {
  const [tipo, setTipo] = useState(p?.tipo ?? "carreta");
  const [nome, setNome] = useState(p?.nome ?? "");
  const [c, setC] = useState(p ? String(p.comprimentoM) : "");
  const [l, setL] = useState(p ? String(p.larguraM) : "");
  const [a, setA] = useState(p ? String(p.alturaM) : "");
  const [redutor, setRedutor] = useState(String(p?.redutorPct ?? 15));
  const [referencia, setReferencia] = useState(p?.referencia ?? false);
  const [ativo, setAtivo] = useState(p?.ativo ?? true);
  const f = useSalvar(() => salvarPerfilAction({ id: p?.id ?? null, tipo, nome, comprimentoM: paraNumero(c), larguraM: paraNumero(l), alturaM: paraNumero(a), redutorPct: paraNumero(redutor), referencia, ativo }), onFechar);
  const vol = paraNumero(c) * paraNumero(l) * paraNumero(a);
  return (
    <Formulario titulo={p ? `Editar ${p.nome}` : "Novo perfil de veículo"} onFechar={onFechar} {...f} largura={520}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Tipo" htmlFor="p-tipo" error={f.campos.tipo} obrigatorio>
          <Select id="p-tipo" value={tipo} onValueChange={setTipo} ordenarAlfabetico={false} opcoes={TIPOS_VEICULO.map((t) => ({ value: t, label: TIPO_VEICULO_LABEL[t] }))} />
        </Field>
        <Field label="Nome" htmlFor="p-nome" error={f.campos.nome} obrigatorio hint="Ex.: Carreta 15,3 m">
          <Input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-4">
        <Field label="Compr. (m)" htmlFor="p-c" error={f.campos.comprimentoM} obrigatorio>
          <Input id="p-c" inputMode="decimal" className="numero" value={c} onChange={(e) => setC(e.target.value)} />
        </Field>
        <Field label="Largura (m)" htmlFor="p-l" error={f.campos.larguraM} obrigatorio>
          <Input id="p-l" inputMode="decimal" className="numero" value={l} onChange={(e) => setL(e.target.value)} />
        </Field>
        <Field label="Altura (m)" htmlFor="p-a" error={f.campos.alturaM} obrigatorio>
          <Input id="p-a" inputMode="decimal" className="numero" value={a} onChange={(e) => setA(e.target.value)} />
        </Field>
        <Field label="Redutor (%)" htmlFor="p-r" error={f.campos.redutorPct} obrigatorio>
          <Input id="p-r" type="number" min={0} max={90} className="numero" value={redutor} onChange={(e) => setRedutor(e.target.value)} />
        </Field>
      </div>
      <p className="m-0 text-pequeno text-ink-3">Volume: <span className="numero font-medium text-ink-2">{Number.isFinite(vol) && vol > 0 ? `${metros(vol)} m³` : "—"}</span></p>
      <Checkbox id="p-ref" label="Referência do tipo" description="Medidas médias, usadas nas estimativas de veículos. Uma por tipo: marcar esta tira a marca da outra." checked={referencia} onChange={setReferencia} />
      <Checkbox id="p-ativo" label="Ativo" checked={ativo} onChange={setAtivo} />
    </Formulario>
  );
}

/* Evento pai */
export type EventoPaiCad = { id: string; nome: string; descricao: string | null; ativo: boolean; eventos: number };

export function EventosPaiPainel({ lista }: { lista: EventoPaiCad[] }) {
  const [modal, setModal] = useState<EventoPaiCad | "novo" | null>(null);
  return (
    <>
      <Tabela rotulo="Eventos pai" novo="Novo evento pai" vazio="Nenhum evento pai. Ele agrupa as etapas de uma prova ou série." lista={lista} onEditar={setModal} onNovo={() => setModal("novo")} colunas={[{ titulo: "Descrição", valor: (p) => p.descricao ?? "—", className: "hidden md:table-cell" }, { titulo: "Eventos", valor: (p) => p.eventos, className: "numero" }]} />
      {modal && <ModalEventoPai key={modal === "novo" ? "novo" : modal.id} p={modal === "novo" ? null : modal} onFechar={() => setModal(null)} />}
    </>
  );
}

function ModalEventoPai({ p, onFechar }: { p: EventoPaiCad | null; onFechar: () => void }) {
  const [nome, setNome] = useState(p?.nome ?? "");
  const [descricao, setDescricao] = useState(p?.descricao ?? "");
  const [ativo, setAtivo] = useState(p?.ativo ?? true);
  const f = useSalvar(() => salvarEventoPaiAction({ id: p?.id ?? null, nome, descricao: descricao || null, ativo }), onFechar);
  return (
    <Formulario titulo={p ? `Editar ${p.nome}` : "Novo evento pai"} onFechar={onFechar} {...f}>
      <Field label="Nome" htmlFor="ep-nome" error={f.campos.nome} obrigatorio hint="Ex.: Circuito das Estações">
        <Input id="ep-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field label="Descrição" htmlFor="ep-desc" optional>
        <Textarea id="ep-desc" className="min-h-14" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Field>
      <Checkbox id="ep-ativo" label="Ativo" checked={ativo} onChange={setAtivo} />
    </Formulario>
  );
}

/* Tour */
type EventoTour = { id: string; codigo: string; nome: string };
export type TourCad = { id: string; nome: string; ativo: boolean; eventos: EventoTour[] };

export function ToursPainel({ lista, eventos }: { lista: TourCad[]; eventos: EventoTour[] }) {
  const [modal, setModal] = useState<TourCad | "novo" | null>(null);
  return (
    <>
      <Tabela rotulo="Tours" novo="Novo tour" vazio="Nenhum tour. Ele liga eventos atendidos pelos mesmos veículos, de uma prova para a outra." lista={lista} onEditar={setModal} onNovo={() => setModal("novo")} colunas={[{ titulo: "Sequência", valor: (t) => (t.eventos.length ? t.eventos.map((e) => e.nome).join(" → ") : "—") }]} />
      {modal && <ModalTour key={modal === "novo" ? "novo" : modal.id} t={modal === "novo" ? null : modal} eventos={eventos} onFechar={() => setModal(null)} />}
    </>
  );
}

function ModalTour({ t, eventos, onFechar }: { t: TourCad | null; eventos: EventoTour[]; onFechar: () => void }) {
  const [nome, setNome] = useState(t?.nome ?? "");
  const [ativo, setAtivo] = useState(t?.ativo ?? true);
  const [seq, setSeq] = useState<EventoTour[]>(t?.eventos ?? []);
  const f = useSalvar(() => salvarTourAction({ id: t?.id ?? null, nome, ativo, eventoIds: seq.map((e) => e.id) }), onFechar);
  const opcoes: OpcaoCombo[] = eventos.filter((e) => !seq.some((s) => s.id === e.id)).map((e) => ({ value: e.id, label: e.nome, descricao: e.codigo }));
  const mover = (i: number, d: number) =>
    setSeq((s) => {
      const n = [...s];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  return (
    <Formulario titulo={t ? `Editar ${t.nome}` : "Novo tour"} onFechar={onFechar} {...f} largura={560}>
      <Field label="Nome" htmlFor="t-nome" error={f.campos.nome} obrigatorio hint="Ex.: CDE Nordeste">
        <Input id="t-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field label="Incluir evento" htmlFor="t-evento" optional hint="O evento só fica em um tour: entrar neste tira do outro.">
        <ComboBox id="t-evento" value={null} onChange={(v) => setSeq((s) => [...s, eventos.find((e) => e.id === v)!])} opcoes={opcoes} placeholder="Buscar evento" />
      </Field>
      {seq.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Eventos do tour, na sequência">
          {seq.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2 rounded-controle border border-line px-2.5 py-1 text-pequeno">
              <span className="numero w-5 text-ink-3">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{e.nome} <span className="font-mono text-ink-3">{e.codigo}</span></span>
              <IconButton label={`Subir ${e.nome}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                <Icone nome="seta-cima" />
              </IconButton>
              <IconButton label={`Descer ${e.nome}`} disabled={i === seq.length - 1} onClick={() => mover(i, 1)}>
                <Icone nome="seta-baixo" />
              </IconButton>
              <IconButton label={`Tirar ${e.nome} do tour`} onClick={() => setSeq((s) => s.filter((x) => x.id !== e.id))} className="hover:text-danger">
                <Icone nome="lixeira" />
              </IconButton>
            </li>
          ))}
        </ol>
      )}
      <Checkbox id="t-ativo" label="Ativo" checked={ativo} onChange={setAtivo} />
    </Formulario>
  );
}
