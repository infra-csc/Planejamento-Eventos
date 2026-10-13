"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { organizarProjetosEmLoteAction } from "@/app/(app)/biblioteca/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Aviso } from "@/components/ui/layout";
import { Select } from "@/components/ui/select";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { CATEGORIAS_PADRAO } from "@/components/projetos/projeto-form";

export type OpcoesOrganizacao = { grupos: Array<{ id: string; nome: string }>; categorias: string[] };

const MANTER = "manter";
const PADRAO = "padrao";
const NOVO = "novo";
const DEFINIR = "definir";
const LIMPAR = "limpar";

/** Muda grupo e/ou categoria dos projetos selecionados, sem tocar na lista de peças. */
export function OrganizarProjetosDialog({
  aberto,
  onFechar,
  onConcluido,
  itens,
  opcoes,
}: {
  aberto: boolean;
  onFechar: () => void;
  onConcluido: () => void;
  itens: Array<{ id: string; nome: string }>;
  opcoes: OpcoesOrganizacao;
}) {
  const router = useRouter();
  const [grupo, setGrupo] = useState(MANTER);
  const [grupoNome, setGrupoNome] = useState("");
  const [categoriaModo, setCategoriaModo] = useState(MANTER);
  const [categoria, setCategoria] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [ocupado, iniciar] = useTransition();
  const submetendo = useRef(false);

  const limpar = () => {
    setGrupo(MANTER);
    setGrupoNome("");
    setCategoriaModo(MANTER);
    setCategoria("");
    setErro(null);
    setCampos({});
  };
  const fechar = () => {
    if (ocupado) return;
    limpar();
    onFechar();
  };

  const nada = grupo === MANTER && categoriaModo === MANTER;
  const grupoExistente = opcoes.grupos.find((g) => `g:${g.id}` === grupo);
  const resumo = [
    grupo === PADRAO ? "grupo Padrão (sem grupo)" : grupoExistente ? `grupo “${grupoExistente.nome}”` : grupo === NOVO && grupoNome.trim() ? `novo grupo “${grupoNome.trim()}”` : null,
    categoriaModo === LIMPAR ? "sem categoria" : categoriaModo === DEFINIR && categoria.trim() ? `categoria “${categoria.trim()}”` : null,
  ].filter(Boolean);

  const aplicar = () => {
    if (ocupado || submetendo.current || nada || itens.length === 0) return;
    submetendo.current = true;
    setErro(null);
    setCampos({});
    const fd = new FormData();
    for (const item of itens) fd.append("ids", item.id);
    if (grupo === PADRAO) fd.set("grupoModo", "padrao");
    else if (grupoExistente) {
      fd.set("grupoModo", "nome");
      fd.set("grupoNome", grupoExistente.nome);
    } else if (grupo === NOVO) {
      fd.set("grupoModo", "nome");
      fd.set("grupoNome", grupoNome);
    } else fd.set("grupoModo", "manter");
    fd.set("categoriaModo", categoriaModo);
    if (categoriaModo === DEFINIR) fd.set("categoria", categoria);
    iniciar(async () => {
      try {
        const r = await organizarProjetosEmLoteAction(fd);
        if (!r.ok) {
          setErro(r.erro);
          setCampos(r.campos ?? {});
          toastErro(r.erro);
          return;
        }
        const sem = r.dados?.semMudanca ?? 0;
        toastSucesso(`${r.mensagem ?? "Projetos atualizados."}${sem && r.dados?.alterados ? ` ${sem} ${sem === 1 ? "já estava assim" : "já estavam assim"}.` : ""}`);
        limpar();
        onConcluido();
        router.refresh();
      } catch {
        const mensagem = "Não foi possível atualizar os projetos. Verifique sua conexão e tente novamente.";
        setErro(mensagem);
        toastErro(mensagem);
      } finally {
        submetendo.current = false;
      }
    });
  };

  const n = itens.length;
  return (
    <Dialog open={aberto} onOpenChange={(a) => (a ? undefined : fechar())}>
      <DialogContent
        title={`Organizar ${n} ${n === 1 ? "projeto" : "projetos"}`}
        description="Mude o grupo e/ou a categoria de todos os selecionados de uma vez."
        width={560}
        className={ocupado ? "[&>button[aria-label='Fechar']]:pointer-events-none [&>button[aria-label='Fechar']]:opacity-40" : undefined}
      >
        <ul aria-label="Projetos selecionados" className="m-0 max-h-32 list-none space-y-1 overflow-y-auto rounded-controle border border-line-soft bg-subtle px-3 py-2.5">
          {itens.map((item) => (
            <li key={item.id} className="break-words text-pequeno text-ink">{item.nome}</li>
          ))}
        </ul>

        <div className="mt-4 grid gap-4">
          <div>
            <Field label="Grupo da biblioteca" htmlFor="lote-grupo">
              <Select
                id="lote-grupo"
                value={grupo}
                disabled={ocupado}
                ordenarAlfabetico={false}
                onValueChange={(v) => {
                  setGrupo(v);
                  if (v !== NOVO) setGrupoNome("");
                }}
                opcoes={[
                  { value: MANTER, label: "Manter como está", descricao: "Cada projeto continua no grupo atual" },
                  { value: PADRAO, label: "Padrão", descricao: "Tirar do grupo" },
                  ...opcoes.grupos.map((g) => ({ value: `g:${g.id}`, label: g.nome })),
                  { value: NOVO, label: "Criar grupo…", descricao: "Escreva o nome do evento" },
                ]}
              />
            </Field>
            {grupo === NOVO && (
              <div className="mt-3">
                <Field label="Nome do grupo" htmlFor="lote-grupo-nome" error={campos.grupoNome ?? campos.grupoEvento} hint="Se já existir um grupo com esse nome, ele será reutilizado.">
                  <Input id="lote-grupo-nome" value={grupoNome} maxLength={120} autoComplete="off" disabled={ocupado} placeholder="Ex.: Night Run BH" onChange={(e) => setGrupoNome(e.target.value)} />
                </Field>
              </div>
            )}
          </div>

          <div>
            <Field label="Categoria" htmlFor="lote-categoria-modo">
              <Select
                id="lote-categoria-modo"
                value={categoriaModo}
                disabled={ocupado}
                ordenarAlfabetico={false}
                onValueChange={(v) => {
                  setCategoriaModo(v);
                  if (v !== DEFINIR) setCategoria("");
                }}
                opcoes={[
                  { value: MANTER, label: "Manter como está", descricao: "Cada projeto continua com a categoria atual" },
                  { value: DEFINIR, label: "Definir categoria…" },
                  { value: LIMPAR, label: "Remover categoria" },
                ]}
              />
            </Field>
            {categoriaModo === DEFINIR && (
              <div className="mt-3">
                <Field label="Nova categoria" htmlFor="lote-categoria" error={campos.categoria}>
                  <Input id="lote-categoria" list="lote-categorias" value={categoria} maxLength={60} autoComplete="off" disabled={ocupado} placeholder="Ex.: Tenda" onChange={(e) => setCategoria(e.target.value)} />
                </Field>
                <datalist id="lote-categorias">
                  {[...new Set([...CATEGORIAS_PADRAO, ...opcoes.categorias])].sort((x, y) => x.localeCompare(y, "pt-BR")).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
        </div>

        <Aviso tom="neutro" className="mt-4" titulo={resumo.length ? `Vai aplicar: ${resumo.join(" e ")}` : "Escolha o que mudar"}>
          Só muda a organização na biblioteca. A lista de peças, as versões, as solicitações e as OS continuam iguais.
        </Aviso>
        {erro && <Aviso tom="danger" className="mt-3" titulo="Não foi possível concluir">{erro} Sua seleção continua disponível.</Aviso>}

        <DialogFooter>
          <Button variant="primary" size="lg" loading={ocupado} disabled={nada || n === 0} onClick={aplicar}>
            Aplicar aos selecionados
          </Button>
          <Button variant="secondary" size="lg" disabled={ocupado} onClick={fechar}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
