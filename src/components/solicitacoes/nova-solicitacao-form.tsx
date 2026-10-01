"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Aviso } from "@/components/ui/layout";
import { toast, toastSucesso } from "@/components/ui/toast";
import { editarPreReuniaoAction, salvarSolicitacaoCompletaAction } from "@/app/(app)/solicitacoes/actions";
import { faltamDescricoes } from "@/domain/descricoes-itens";
import type { PedidosPorEvento } from "@/domain/ja-pedido";
import { BuscaCatalogo } from "./nova/busca-catalogo";
import { DialogoTendas } from "./nova/dialogo-tendas";
import { EscolhaEvento } from "./nova/escolha-evento";
import { ListaItens } from "./nova/lista-itens";
import { BarraEnvioMovel, ResumoEnvio } from "./nova/resumo-envio";
import { useAutosaveSolicitacao } from "./nova/use-autosave-solicitacao";
import { comPontoFinal, confirmarLocal, irPara, sincronizarCavaletesCocho } from "./nova/utilidades";
import type { EventoOpcao, ItemNovo, LinhaAta, Modo, RascunhoSolicitacao, Referencia } from "./nova/tipos";

export type { EventoOpcao, ItemNovo, LinhaBom } from "./nova/tipos";

export function NovaSolicitacaoForm({
  rascunho,
  eventos,
  areas,
  areaInicial,
  comoAdministrador = false,
  eventoInicial,
  itensIniciais,
  projetos,
  pecas,
  linhasPorEvento,
  pedidosPorEvento = {},
  slaHoras,
  edicaoEnviada = false,
}: {
  /** Pré-reunião já enviada, editada antes da reunião: sem autosave; "Salvar alterações" troca itens e ata de uma vez. */
  edicaoEnviada?: boolean;
  rascunho: RascunhoSolicitacao | null;
  eventos: EventoOpcao[];
  /** Áreas para escolher em nome de qual se pede (todo solicitante escolhe). `null` esconde a escolha. */
  areas: Array<{ id: string; nome: string }> | null;
  areaInicial: string | null;
  /** Só muda o texto de ajuda da área ("pedindo como administrador"). */
  comoAdministrador?: boolean;
  eventoInicial: string | null;
  itensIniciais: ItemNovo[];
  projetos: Referencia[];
  pecas: Referencia[];
  linhasPorEvento: Record<string, LinhaAta[]>;
  /** O que já foi pedido de cada projeto/peça, por evento (aviso informativo). */
  pedidosPorEvento?: PedidosPorEvento;
  slaHoras: number;
}) {
  const router = useRouter();
  const [eventoId, setEventoId] = useState<string | null>(eventoInicial);
  const [trocandoEvento, setTrocandoEvento] = useState(false);
  const [areaId, setAreaId] = useState<string | null>(areaInicial);
  const [itensBrutos, setItens] = useState<ItemNovo[]>(itensIniciais);
  // Cocho para água sempre leva 2 cavaletes de ferro: a linha do cavalete é derivada dos cochos da lista.
  const itens = useMemo(() => sincronizarCavaletesCocho(itensBrutos, pecas), [itensBrutos, pecas]);
  // Cópia local das alterações de um pedido já enviado (nada se perde se a aba fechar antes de salvar).
  const chaveCopia = edicaoEnviada && rascunho ? `norte:edicao-solicitacao:${rascunho.id}` : null;
  const [copiaRecuperada, setCopiaRecuperada] = useState(false);
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
  const jaPedidos = useMemo(() => (eventoId ? (pedidosPorEvento[eventoId] ?? {}) : {}), [eventoId, pedidosPorEvento]);

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
    desligado: edicaoEnviada,
  });

  // Pedido já enviado em edição: recupera alterações não salvas (aba fechada, queda de rede) e guarda
  // cada mudança no navegador até "Salvar alterações" dar certo. O pedido original segue na ata.
  useEffect(() => {
    if (!chaveCopia) return;
    try {
      const bruto = window.localStorage.getItem(chaveCopia);
      if (!bruto) return;
      const c = JSON.parse(bruto) as { titulo: string; observacao: string; itens: ItemNovo[] };
      if (Array.isArray(c.itens)) {
        // Leitura do armazenamento do navegador só existe no cliente: por isso num efeito, depois da hidratação.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitulo(c.titulo ?? "");
        setObservacao(c.observacao ?? "");
        setItens(c.itens);
        setCopiaRecuperada(true);
      }
    } catch {
      // Sem armazenamento local (aba privada): segue com o pedido como está.
    }
  }, [chaveCopia]);
  // A primeira passada é o estado de abertura (nada mudou ainda): não vira cópia.
  const primeiraPassadaRef = useRef(true);
  useEffect(() => {
    if (!chaveCopia) return;
    if (primeiraPassadaRef.current) {
      primeiraPassadaRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(chaveCopia, JSON.stringify({ titulo, observacao, itens, em: new Date().toISOString() }));
    } catch {
      // idem
    }
    // A assinatura resume título, observação e itens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, chaveCopia]);
  useEffect(() => {
    if (!chaveCopia) return;
    const avisar = (e: BeforeUnloadEvent) => {
      if (assinatura !== salvoRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [chaveCopia, assinatura, salvoRef]);

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

  // Tira várias linhas de uma vez (ex.: a tenda com todos os locais), com um "desfazer" só.
  const removerItens = (lista: ItemNovo[], rotulo: string) => {
    const antes = itens;
    const chaves = new Set(lista.map((x) => x.chave));
    setItens((l) => l.filter((x) => !chaves.has(x.chave)));
    toast(`${rotulo} removido da solicitação`, { desfazer: () => setItens(antes) });
  };

  const validarTitulo = (v: string) => setErroTitulo(v.trim() ? null : "Dê um título para a logística identificar a solicitação na fila.");

  const semDescricao = itens.filter((i) => faltamDescricoes({ operacao: i.operacao, quantidadeSolicitada: i.quantidade, descricoes: i.descricoes, semDescricao: i.semDescricao }) > 0);
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
    // Pedido já enviado: "Salvar alterações" troca itens e ata de uma vez; a cópia local só sai quando dá certo.
    if (edicaoEnviada && rascunho) {
      iniciar(async () => {
        enviandoRef.current = true;
        let r: Awaited<ReturnType<typeof editarPreReuniaoAction>>;
        try {
          r = await editarPreReuniaoAction(montarPayload(true, eventoId));
        } catch {
          enviandoRef.current = false;
          setErroGeral("Não foi possível falar com o servidor. As alterações continuam aqui (e guardadas neste navegador) — tente de novo.");
          return;
        }
        if (!r.ok) {
          enviandoRef.current = false;
          if (r.campos?.titulo) setErroTitulo(r.campos.titulo);
          setErroGeral(r.campos ? (Object.entries(r.campos).filter(([k]) => k !== "titulo").map(([, v]) => v)[0] ?? (r.campos.titulo ? null : r.erro)) : r.erro);
          return;
        }
        salvoRef.current = assinatura;
        try {
          if (chaveCopia) window.localStorage.removeItem(chaveCopia);
        } catch {
          // sem armazenamento local
        }
        toastSucesso(`${r.dados?.codigo ?? rascunho.codigo} atualizada — a ata já mostra os itens novos`);
        router.push(`/solicitacoes/${rascunho.id}`);
      });
      return;
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
      {edicaoEnviada && (
        <Aviso tom="info" titulo={copiaRecuperada ? "Alterações não salvas recuperadas" : "Editando um pedido já enviado"}>
          {copiaRecuperada ? "Você tinha começado a editar este pedido e não salvou; as alterações foram trazidas de volta. " : ""}
          O pedido como estava continua na ata até você clicar em “Salvar alterações”. Aí os itens e a ata são trocados de uma vez.
        </Aviso>
      )}
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
            comoAdministrador={comoAdministrador}
            areaId={areaId}
            setAreaId={setAreaId}
            trocandoEvento={trocandoEvento}
            setTrocandoEvento={setTrocandoEvento}
            tentouEnviar={tentouEnviar}
            slaHoras={slaHoras}
            escolherEvento={escolherEvento}
          />

          {/* 2 · Adicionar itens */}
          <BuscaCatalogo modo={modo} setModo={setModo} ehAlteracao={ehAlteracao} projetos={projetos} pecas={pecas} linhas={linhas} jaPedidos={jaPedidos} itens={itens} setItens={setItens} setTendaAberta={setTendaAberta} />

          {/* 3 · Detalhar itens */}
          <ListaItens itens={itens} projetos={projetos} jaPedidos={jaPedidos} semDescricao={semDescricao} tentouEnviar={tentouEnviar} mudar={mudar} removerItem={removerItem} removerItens={removerItens} editarTendas={setTendaAberta} />
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
          edicaoEnviada={edicaoEnviada}
          estadoSalvo={estadoSalvo}
          codigoRascunho={codigoRascunho}
        />
      </div>

      {/* Barra de envio fixa no celular e tablet. */}
      <BarraEnvioMovel itens={itens} pendencias={pendencias} tentouEnviar={tentouEnviar} pendente={pendente} bloqueadoEnvio={bloqueadoEnvio} salvar={salvar} edicaoEnviada={edicaoEnviada} />

      <DialogoTendas tendaAberta={tendaAberta} setTendaAberta={setTendaAberta} projetos={projetos} itens={itens} setItens={setItens} />

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
