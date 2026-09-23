"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Aviso } from "@/components/ui/layout";
import { toast, toastSucesso } from "@/components/ui/toast";
import { salvarSolicitacaoCompletaAction } from "@/app/(app)/solicitacoes/actions";
import { faltamDescricoes } from "@/domain/descricoes-itens";
import { BuscaCatalogo } from "./nova/busca-catalogo";
import { DialogoTendas } from "./nova/dialogo-tendas";
import { EscolhaEvento } from "./nova/escolha-evento";
import { ListaItens } from "./nova/lista-itens";
import { BarraEnvioMovel, ResumoEnvio } from "./nova/resumo-envio";
import { useAutosaveSolicitacao } from "./nova/use-autosave-solicitacao";
import { comPontoFinal, confirmarLocal, irPara } from "./nova/utilidades";
import type { EventoOpcao, ItemNovo, LinhaAta, Modo, RascunhoSolicitacao, Referencia } from "./nova/tipos";

export type { EventoOpcao, ItemNovo, LinhaBom } from "./nova/tipos";

export function NovaSolicitacaoForm({
  rascunho,
  eventos,
  areas,
  areaInicial,
  eventoInicial,
  itensIniciais,
  projetos,
  pecas,
  linhasPorEvento,
  slaHoras,
}: {
  rascunho: RascunhoSolicitacao | null;
  eventos: EventoOpcao[];
  /** Só para o Administrador, que pede em nome de uma área. `null` para os demais perfis. */
  areas: Array<{ id: string; nome: string }> | null;
  areaInicial: string | null;
  eventoInicial: string | null;
  itensIniciais: ItemNovo[];
  projetos: Referencia[];
  pecas: Referencia[];
  linhasPorEvento: Record<string, LinhaAta[]>;
  slaHoras: number;
}) {
  const router = useRouter();
  const [eventoId, setEventoId] = useState<string | null>(eventoInicial);
  const [trocandoEvento, setTrocandoEvento] = useState(false);
  const [areaId, setAreaId] = useState<string | null>(areaInicial);
  const [itens, setItens] = useState<ItemNovo[]>(itensIniciais);
  const [modo, setModo] = useState<Modo>("projeto");
  const [titulo, setTitulo] = useState(rascunho?.titulo ?? "");
  const [observacao, setObservacao] = useState(rascunho?.observacao ?? "");
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const evento = eventos.find((e) => e.id === eventoId) ?? null;
  const ehAlteracao = evento?.tipo === "ALTERACAO";
  const linhas = useMemo(() => (eventoId ? (linhasPorEvento[eventoId] ?? []) : []), [eventoId, linhasPorEvento]);

  // Rascunho salvo automaticamente, numa fila única com o "Salvar rascunho" e o envio.
  const { rascunhoIdRef, codigoRascunho, estadoSalvo, setEstadoSalvo, enviandoRef, pendenteSalvarRef, salvoRef, assinatura, emFila, montarPayload, lembrarRascunho } = useAutosaveSolicitacao({
    rascunho,
    areas,
    areaId,
    eventoId,
    evento,
    titulo,
    observacao,
    itens,
  });

  // Erro vindo do servidor: no celular o resumo fica abaixo dos passos, então rola até a mensagem.
  useEffect(() => {
    if (erroGeral) document.getElementById("erro-geral")?.scrollIntoView({ block: "nearest" });
  }, [erroGeral]);

  const escolherEvento = (e: EventoOpcao) => {
    if (rascunhoIdRef.current && e.id !== eventoId) {
      toast("Para trocar de evento, exclua este rascunho e crie outro");
      return;
    }
    const mantidos = itens.filter((i) => i.operacao === "ADICIONAR" || (e.tipo === "ALTERACAO" && (linhasPorEvento[e.id] ?? []).some((x) => x.id === i.eventoItemId)));
    const descartados = itens.length - mantidos.length;
    if (descartados > 0) {
      setTroca({ evento: e, mantidos, descartados });
      return;
    }
    aplicarTroca(e, mantidos);
  };
  const aplicarTroca = (e: EventoOpcao, mantidos: ItemNovo[]) => {
    setEventoId(e.id);
    setItens(mantidos);
    setTrocandoEvento(false);
    if (e.tipo === "PRE_REUNIAO" && modo === "ata") setModo("projeto");
  };
  // Troca de evento que descartaria itens da ata anterior: aguarda confirmação no diálogo.
  const [troca, setTroca] = useState<{ evento: EventoOpcao; mantidos: ItemNovo[]; descartados: number } | null>(null);

  // Projeto de tenda com o quadro por local aberto (ver DialogoTendas).
  const [tendaAberta, setTendaAberta] = useState<string | null>(null);

  const mudar = (chave: string, patch: Partial<ItemNovo>) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...patch } : i)));
  /** Remove na hora e oferece desfazer (Ctrl+Z), no mesmo padrão de "Desativar" em Usuários. */
  const removerItem = (item: ItemNovo) => {
    const posicao = itens.findIndex((x) => x.chave === item.chave);
    setItens((l) => l.filter((x) => x.chave !== item.chave));
    toast(`${item.rotulo} removido da solicitação`, {
      desfazer: () => setItens((l) => (l.some((x) => x.chave === item.chave) ? l : [...l.slice(0, posicao), item, ...l.slice(posicao)])),
    });
  };

  const validarTitulo = (v: string) => setErroTitulo(v.trim() ? null : "Dê um título para a logística identificar a solicitação na fila.");

  const semDescricao = itens.filter((i) => faltamDescricoes({ operacao: i.operacao, quantidadeSolicitada: i.quantidade, descricoes: i.descricoes }) > 0);
  // O que ainda falta para enviar, na ordem da tela. Cada linha leva ao campo.
  const pendencias = [
    areas && !areaId ? { alvo: "area-solicitante", texto: "Escolher a área solicitante" } : null,
    !evento ? { alvo: "evento", texto: "Escolher o evento" } : null,
    itens.length === 0 ? { alvo: "busca-itens", texto: "Adicionar ao menos um item" } : null,
    semDescricao.length > 0 ? { alvo: `descricoes-${semDescricao[0].chave}`, texto: semDescricao.length === 1 ? "Descrever as unidades de 1 item" : `Descrever as unidades de ${semDescricao.length} itens` } : null,
    !titulo.trim() ? { alvo: "titulo", texto: "Dar um título" } : null,
  ].filter((p) => p !== null);

  const salvar = (enviar: boolean) => {
    setErroGeral(null);
    if (areas && !areaId) {
      setTentouEnviar(true);
      irPara("area-solicitante");
      return;
    }
    if (!eventoId) {
      setTentouEnviar(true);
      setTrocandoEvento(true);
      irPara("evento");
      return;
    }
    if (enviar) {
      setTentouEnviar(true);
      validarTitulo(titulo);
      if (itens.length === 0) {
        irPara("busca-itens");
        return;
      }
      if (semDescricao.length) {
        irPara(`descricoes-${semDescricao[0].chave}`);
        return;
      }
      if (!titulo.trim()) {
        irPara("titulo");
        return;
      }
    }
    iniciar(async () => {
      if (enviar) enviandoRef.current = true;
      let r: Awaited<ReturnType<typeof salvarSolicitacaoCompletaAction>>;
      try {
        r = await emFila(() => salvarSolicitacaoCompletaAction(montarPayload(enviar, eventoId)));
      } catch {
        enviandoRef.current = false;
        setErroGeral("Não foi possível falar com o servidor. O que você preencheu continua aqui — tente de novo.");
        return;
      }
      if (!r.ok || !r.dados?.enviada) enviandoRef.current = false;
      if (!r.ok) {
        if (r.campos?.titulo) setErroTitulo(r.campos.titulo);
        setErroGeral(r.campos ? (Object.entries(r.campos).filter(([k]) => k !== "titulo").map(([, v]) => v)[0] ?? (r.campos.titulo ? null : r.erro)) : r.erro);
        if (r.campos?.titulo) irPara("titulo");
        return;
      }
      const d = r.dados;
      if (!d) return;
      salvoRef.current = assinatura;
      pendenteSalvarRef.current = false;
      lembrarRascunho(d.id, d.codigo);
      if (d.enviada) {
        toastSucesso(`${d.codigo} enviada para a logística`);
        router.push(`/solicitacoes/${d.id}`);
      } else if (d.erroEnvio) {
        toast(`${d.codigo} salva como rascunho — ${d.erroEnvio}`);
        router.push(`/solicitacoes/${d.id}`);
      } else {
        toastSucesso(`Rascunho ${d.codigo} salvo`);
        setEstadoSalvo({ tipo: "salvo", em: new Date() });
      }
    });
  };

  const bloqueadoEnvio = Boolean(evento) && !evento?.aceita;

  return (
    // No celular a barra de envio fica fixa no rodapé: o respiro embaixo evita que ela cubra o fim do formulário.
    <div className="flex flex-col gap-4 max-lg:pb-24">
      {rascunho?.devolvidaMotivo && (
        <Aviso tom="warning" titulo="Devolvida pela logística">
          {comPontoFinal(rascunho.devolvidaMotivo)} Corrija e reenvie.
        </Aviso>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* 1 · Evento */}
          <EscolhaEvento
            temRascunho={Boolean(rascunho)}
            eventos={eventos}
            evento={evento}
            eventoId={eventoId}
            ehAlteracao={ehAlteracao}
            areas={areas}
            areaId={areaId}
            setAreaId={setAreaId}
            trocandoEvento={trocandoEvento}
            setTrocandoEvento={setTrocandoEvento}
            tentouEnviar={tentouEnviar}
            slaHoras={slaHoras}
            escolherEvento={escolherEvento}
          />

          {/* 2 · Adicionar itens */}
          <BuscaCatalogo modo={modo} setModo={setModo} ehAlteracao={ehAlteracao} projetos={projetos} pecas={pecas} linhas={linhas} itens={itens} setItens={setItens} setTendaAberta={setTendaAberta} />

          {/* 3 · Detalhar itens */}
          <ListaItens itens={itens} projetos={projetos} semDescricao={semDescricao} tentouEnviar={tentouEnviar} mudar={mudar} removerItem={removerItem} />
        </div>

        {/* 4 · Resumo e envio: acompanha a rolagem no desktop; no celular vem depois dos passos. */}
        <ResumoEnvio
          evento={evento}
          itens={itens}
          pecas={pecas}
          semDescricao={semDescricao}
          pendencias={pendencias}
          titulo={titulo}
          setTitulo={setTitulo}
          observacao={observacao}
          setObservacao={setObservacao}
          erroTitulo={erroTitulo}
          setErroTitulo={setErroTitulo}
          validarTitulo={validarTitulo}
          tentouEnviar={tentouEnviar}
          erroGeral={erroGeral}
          pendente={pendente}
          bloqueadoEnvio={bloqueadoEnvio}
          salvar={salvar}
          estadoSalvo={estadoSalvo}
          codigoRascunho={codigoRascunho}
        />
      </div>

      {/* Barra de envio fixa no celular e tablet. */}
      <BarraEnvioMovel itens={itens} pendencias={pendencias} tentouEnviar={tentouEnviar} pendente={pendente} bloqueadoEnvio={bloqueadoEnvio} salvar={salvar} />

      <DialogoTendas tendaAberta={tendaAberta} setTendaAberta={setTendaAberta} projetos={projetos} setItens={setItens} />

      <ConfirmDialog
        open={troca !== null}
        onOpenChange={(o) => !o && setTroca(null)}
        title="Trocar de evento?"
        description={
          troca
            ? `${troca.descartados} ${troca.descartados === 1 ? "item referencia" : "itens referenciam"} a ata do evento anterior e ${troca.descartados === 1 ? "será removido" : "serão removidos"} da solicitação.`
            : undefined
        }
        confirmLabel="Trocar de evento"
        danger
        action={confirmarLocal}
        onSuccess={() => {
          if (troca) aplicarTroca(troca.evento, troca.mantidos);
          setTroca(null);
        }}
      />
    </div>
  );
}
