"use client";

import { useEffect, useRef, useState } from "react";
import { salvarSolicitacaoCompletaAction } from "@/app/(app)/solicitacoes/actions";
import { agruparPorLocal } from "@/domain/descricoes-itens";
import type { EventoOpcao, ItemNovo, RascunhoSolicitacao } from "./tipos";

export type EstadoSalvo = { tipo: "ocioso" } | { tipo: "salvando" } | { tipo: "salvo"; em: Date } | { tipo: "erro"; msg: string };

/*
 * Rascunho salvo automaticamente (briefing, slide 7: "a área digita aos poucos, sem perder o que já
 * preencheu"). Todos os salvamentos passam por uma fila para que o primeiro crie o rascunho e os
 * seguintes (automáticos ou pelo botão) reutilizem o mesmo id, sem duplicar.
 */
export function useAutosaveSolicitacao({
  rascunho,
  areas,
  areaId,
  eventoId,
  evento,
  titulo,
  observacao,
  itens,
}: {
  rascunho: RascunhoSolicitacao | null;
  areas: Array<{ id: string; nome: string }> | null;
  areaId: string | null;
  eventoId: string | null;
  evento: EventoOpcao | null;
  titulo: string;
  observacao: string;
  itens: ItemNovo[];
}) {
  const rascunhoIdRef = useRef<string | null>(rascunho?.id ?? null);
  const [codigoRascunho, setCodigoRascunho] = useState<string | null>(rascunho?.codigo ?? null);
  const [estadoSalvo, setEstadoSalvo] = useState<EstadoSalvo>({ tipo: "ocioso" });
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const enviandoRef = useRef(false);
  const pendenteSalvarRef = useRef(false);
  const emFila = <T,>(fn: () => Promise<T>): Promise<T> => {
    const promessa = fila.current.then(fn, fn);
    fila.current = promessa.catch(() => undefined);
    return promessa;
  };
  const montarPayload = (enviar: boolean, evId: string) => ({
    id: rascunhoIdRef.current,
    eventoId: evId,
    areaId: areas ? areaId : null,
    titulo,
    observacao,
    enviar,
    // "Onde vai ficar" é por unidade: unidades no mesmo local viram um item (destino = local).
    itens: itens.flatMap((i) =>
      agruparPorLocal(i.operacao, i.quantidade, i.descricoes, i.operacao === "ADICIONAR" ? i.locais : [i.destino]).map((g) => ({
        operacao: i.operacao,
        projetoId: i.projetoId,
        pecaId: i.pecaId,
        eventoItemId: i.eventoItemId,
        descricaoLivre: i.descricaoLivre,
        quantidadeSolicitada: g.quantidade,
        destino: g.destino,
        justificativa: i.justificativa,
        descricoes: g.descricoes,
        ajustesBom: Object.entries(i.ajustes)
          .filter(([, d]) => d !== 0)
          .map(([pecaId, quantidade]) => ({ pecaId, quantidade })),
      })),
    ),
  });
  const lembrarRascunho = (id: string, codigo: string) => {
    if (rascunhoIdRef.current) return;
    rascunhoIdRef.current = id;
    setCodigoRascunho(codigo);
    window.history.replaceState(null, "", `/solicitacoes/nova?rascunho=${id}`);
  };
  const assinatura = JSON.stringify([eventoId, titulo, observacao, itens.map((i) => [i.operacao, i.projetoId, i.pecaId, i.eventoItemId, i.descricaoLivre, i.quantidade, i.destino, i.justificativa, i.descricoes, i.locais, i.ajustes])]);
  const salvoRef = useRef(rascunho ? assinatura : "");
  const podeAutosalvar = Boolean(evento?.aceita) && (!areas || Boolean(areaId)) && (titulo.trim() !== "" || itens.length > 0);

  const autosalvar = async (assin: string, evId: string) => {
    if (enviandoRef.current || assin === salvoRef.current) return;
    setEstadoSalvo({ tipo: "salvando" });
    try {
      const r = await emFila(() => salvarSolicitacaoCompletaAction(montarPayload(false, evId)));
      if (r.ok && r.dados) {
        salvoRef.current = assin;
        pendenteSalvarRef.current = false;
        lembrarRascunho(r.dados.id, r.dados.codigo);
        setEstadoSalvo({ tipo: "salvo", em: new Date() });
      } else if (!r.ok) {
        setEstadoSalvo({ tipo: "erro", msg: r.campos ? (Object.values(r.campos)[0] ?? r.erro) : r.erro });
      }
    } catch {
      setEstadoSalvo({ tipo: "erro", msg: "sem conexão com o servidor. Tentaremos de novo na próxima alteração." });
    }
  };
  /* Guarda a versão mais recente para salvar ao sair da página (link da sidebar cancela o debounce). */
  const flushRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    flushRef.current = podeAutosalvar && eventoId ? () => void autosalvar(assinatura, eventoId) : null;
  });

  useEffect(() => {
    if (!podeAutosalvar || !eventoId || assinatura === salvoRef.current || enviandoRef.current) return;
    pendenteSalvarRef.current = true;
    const t = setTimeout(() => void autosalvar(assinatura, eventoId), 1500);
    return () => clearTimeout(t);
    // autosalvar/montarPayload mudam a cada render; a assinatura já representa o conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, podeAutosalvar, eventoId]);

  useEffect(() => {
    const aoOcultar = () => {
      if (document.visibilityState === "hidden") flushRef.current?.();
    };
    document.addEventListener("visibilitychange", aoOcultar);
    return () => {
      document.removeEventListener("visibilitychange", aoOcultar);
      // Navegação interna (sidebar, busca): salva o que ainda não foi salvo antes de desmontar.
      // enviandoRef é uma flag escrita pelo formulário (envio): aqui vale o valor mais recente, de propósito.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (!enviandoRef.current) flushRef.current?.();
    };
  }, []);

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (pendenteSalvarRef.current && !enviandoRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

  return { rascunhoIdRef, codigoRascunho, estadoSalvo, setEstadoSalvo, enviandoRef, pendenteSalvarRef, salvoRef, assinatura, emFila, montarPayload, lembrarRascunho };
}
