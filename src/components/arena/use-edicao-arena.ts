import { useEffect, useMemo, useRef, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { Arena, PontoArena } from "@/domain/arena/tipos";
import { chaveItemAta, normalizarAngulo } from "@/domain/arena/posicoes";
import { removerPosicaoArenaAction, salvarPosicaoArenaAction } from "@/app/(app)/arena/actions";
import { toast, toastErro } from "@/components/ui/toast";
import type { PosicionarItem } from "./painel-ponto";

/** Ajuste salvo agora e ainda não refletido pelo servidor. */
type Ajuste = { posicao?: [number, number]; rotacao?: number };
/** Registro de arena_posicoes como a interface consegue recriá-lo (inclusive de um ponto excluído). */
type Registro = { tipo: "MOVER" | "NOVO"; x: number; z: number; nome: string; categoria: string; itemAta: string | null; rotacao: number | null };
/** Ação desta sessão de edição. Desfazer = devolver o registro do ponto ao que era antes (ou apagá-lo, se não havia). */
export type AcaoEdicao = { rotulo: string; chave: string; antes: Registro | null };
/** Formulário do banner de edição: item novo (fora da planta) ou nome/categoria do ponto selecionado. */
export type FormEdicao = { modo: "novo" | "info"; nome: string; categoria: string };

const LIMITE_DESFAZER = 30;
export const PASSO_GIRO = Math.PI / 12;
const tipoRegistro = (chave: string) => (chave.startsWith("novo:") ? "NOVO" : "MOVER");
const itemAtaDe = (p: PontoArena) => (p.itensAta[0] ? chaveItemAta(p.itensAta[0]) : null);

/**
 * Estado da edição de posições (logística): posições salvas localmente, prévia de arraste,
 * pilha do "Desfazer" e as ações que gravam no servidor.
 */
export function useEdicaoArena({
  arenaServidor,
  editadas,
  selecionado,
  setSelecionado,
  setPainelEsquerdo,
  medindo,
}: {
  arenaServidor: Arena;
  editadas: string[];
  selecionado: string | null;
  setSelecionado: Dispatch<SetStateAction<string | null>>;
  setPainelEsquerdo: (painel: null) => void;
  medindo: boolean;
}) {
  const router = useRouter();
  const [salvando, iniciarSalvar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);
  const [menuItens, setMenuItens] = useState(false);
  /** Ações desta sessão de edição, da mais antiga à mais recente, para o "Desfazer". */
  const [pilha, setPilha] = useState<AcaoEdicao[]>([]);
  const [colocando, setColocando] = useState<PosicionarItem | null>(null);
  // Formulário do banner de edição: item novo (fora da planta) ou nome/categoria do ponto selecionado.
  const [formEdicao, setFormEdicao] = useState<FormEdicao | null>(null);
  // Posições e giros salvos agora e ainda não refletidos pelo servidor: o ponto não "pula de volta" enquanto recarrega.
  const [locais, setLocais] = useState<Record<string, Ajuste>>({});
  // Registros criados (true) ou apagados (false) nesta sessão e ainda não refletidos em `editadas`.
  const [registrosLocais, setRegistrosLocais] = useState<Record<string, boolean>>({});
  // Arraste em andamento no 3D: só desenho, nada salvo ainda.
  const [previa, setPrevia] = useState<{ id: string; posicao: [number, number] } | null>(null);
  const [baseServidor, setBaseServidor] = useState(arenaServidor);
  if (baseServidor !== arenaServidor) {
    setBaseServidor(arenaServidor);
    setLocais({});
    setRegistrosLocais({});
  }
  const arenaSalva = useMemo(() => {
    if (Object.keys(locais).length === 0) return arenaServidor;
    return {
      ...arenaServidor,
      pontos: arenaServidor.pontos.map((p) => {
        const l = locais[p.id];
        return l ? { ...p, posicao: l.posicao ?? p.posicao, rotacao: l.rotacao ?? p.rotacao } : p;
      }),
    };
  }, [arenaServidor, locais]);
  const arena = useMemo(
    () => (previa ? { ...arenaSalva, pontos: arenaSalva.pontos.map((p) => (p.id === previa.id ? { ...p, posicao: previa.posicao } : p)) } : arenaSalva),
    [arenaSalva, previa],
  );
  const idsEditados = useMemo(() => new Set(editadas), [editadas]);
  const temRegistro = (chave: string) => (chave in registrosLocais ? registrosLocais[chave] : idsEditados.has(chave));

  const salvarPosicao = (dados: Parameters<typeof salvarPosicaoArenaAction>[1], rotulo: string, silencioso = false) => {
    const tinha = temRegistro(dados.chave);
    setRegistrosLocais((r) => ({ ...r, [dados.chave]: true }));
    iniciarSalvar(async () => {
      const r = await salvarPosicaoArenaAction(arena.slug, dados);
      if (!r.ok) {
        toastErro(r.erro);
        setLocais((l) => {
          const n = { ...l };
          delete n[dados.chave];
          return n;
        });
        setRegistrosLocais((x) => ({ ...x, [dados.chave]: tinha }));
        return;
      }
      // Arrastar salva a cada solta: um aviso por arrasto viraria ruído. O estado aparece na barra.
      // Sem router.refresh(): a action revalida a página e a resposta já traz a arena atualizada.
      if (!silencioso) toast(rotulo);
    });
  };

  /** Registro do ponto como está salvo agora (sem a prévia de arraste); null se ele segue a planta. */
  const registroDe = (chave: string): Registro | null => {
    if (!temRegistro(chave)) return null;
    const p = arenaSalva.pontos.find((q) => q.id === chave);
    if (!p) return null;
    return { tipo: tipoRegistro(chave), x: p.posicao[0], z: p.posicao[1], nome: p.nome, categoria: p.categoria, itemAta: itemAtaDe(p), rotacao: p.rotacao ?? null };
  };
  /** Guarda o estado anterior do ponto antes de cada mudança, para o "Desfazer" em vários passos. */
  const empilhar = (rotulo: string, chave: string) => setPilha((p) => [...p, { rotulo, chave, antes: registroDe(chave) }].slice(-LIMITE_DESFAZER));

  // Esc sai do modo "clique no mapa" sem ter de achar o botão Cancelar.
  // (Só registra o ouvinte quando há item escolhido ou menu aberto: fica sempre depois dos atalhos gerais.)
  useEffect(() => {
    if (!colocando && !menuItens) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setColocando(null);
      setMenuItens(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [colocando, menuItens]);

  const alternarEdicao = () => {
    if (editando) {
      setEditando(false);
      setColocando(null);
      setMenuItens(false);
      setFormEdicao(null);
      setPilha([]);
      return;
    }
    // Edita na vista em que a pessoa está (planta, de cima ou perspectiva), sem painel aberto por cima.
    setEditando(true);
    setPainelEsquerdo(null);
    setSelecionado(null);
  };

  const edicaoPlano = editando
    ? {
        colocando: colocando?.chave ?? null,
        editadas: idsEditados,
        onMover: (id: string, x: number, z: number) => {
          const p = arenaSalva.pontos.find((q) => q.id === id);
          setPrevia(null);
          if (!p) return;
          empilhar(`mover ${p.nome}`, id);
          setLocais((l) => ({ ...l, [id]: { ...l[id], posicao: [x, z] } }));
          salvarPosicao({ chave: id, tipo: tipoRegistro(id), x, z, nome: p.nome, itemAta: itemAtaDe(p) }, "", true);
        },
        onColocar: (x: number, z: number) => {
          if (!colocando) return;
          const item = colocando;
          setColocando(null);
          empilhar(`posicionar ${item.nome}`, item.chave);
          setSelecionado(item.chave);
          salvarPosicao({ chave: item.chave, tipo: "NOVO", x, z, nome: item.nome, itemAta: item.itemAta, categoria: item.categoria ?? null }, `${item.nome} entrou no mapa — arraste para acertar o lugar`);
        },
      }
    : null;

  const pontoEditado = editando && selecionado && temRegistro(selecionado) ? arena.pontos.find((p) => p.id === selecionado) : null;
  const pontoSelecionadoEdicao = editando && selecionado ? arena.pontos.find((p) => p.id === selecionado) ?? null : null;

  const confirmarFormEdicao = () => {
    if (!formEdicao) return;
    const nome = formEdicao.nome.trim();
    if (!nome) return toastErro("Informe o nome do item.");
    if (formEdicao.modo === "novo") {
      setColocando({ chave: `novo:livre:${Date.now().toString(36)}`, nome, itemAta: null, categoria: formEdicao.categoria });
      setFormEdicao(null);
      return;
    }
    const p = pontoSelecionadoEdicao;
    if (!p) return setFormEdicao(null);
    empilhar(`renomear ${p.nome}`, p.id);
    salvarPosicao({ chave: p.id, tipo: tipoRegistro(p.id), x: p.posicao[0], z: p.posicao[1], nome, categoria: formEdicao.categoria, itemAta: itemAtaDe(p) }, `${nome}: dados salvos`);
    setFormEdicao(null);
  };

  /** Giro do ponto selecionado em torno dele mesmo; positivo é anti-horário visto de cima. */
  const girar = (delta: number) => {
    const p = pontoSelecionadoEdicao;
    if (!p || medindo) return;
    const rotacao = normalizarAngulo((p.rotacao ?? 0) + delta);
    empilhar(`girar ${p.nome}`, p.id);
    setLocais((l) => ({ ...l, [p.id]: { ...l[p.id], rotacao } }));
    salvarPosicao({ chave: p.id, tipo: tipoRegistro(p.id), x: p.posicao[0], z: p.posicao[1], nome: p.nome, itemAta: itemAtaDe(p), rotacao }, "", true);
  };

  /** Apaga o registro: ponto movido volta à planta, item novo sai do mapa (o da ata volta para "sem posição"). */
  const removerRegistro = (id: string, aviso: string, limparSelecao = true) => {
    const tinha = temRegistro(id);
    setRegistrosLocais((r) => ({ ...r, [id]: false }));
    iniciarSalvar(async () => {
      const r = await removerPosicaoArenaAction(arena.slug, id);
      if (!r.ok) {
        setRegistrosLocais((x) => ({ ...x, [id]: tinha }));
        return toastErro(r.erro);
      }
      toast(aviso);
      if (limparSelecao) setSelecionado(null);
      else if (id.startsWith("novo:")) setSelecionado((sel) => (sel === id ? null : sel));
      router.refresh();
    });
  };

  const excluirDoMapa = (p: PontoArena) => {
    const livre = p.id.startsWith("novo:livre:");
    const novo = p.id.startsWith("novo:");
    empilhar(livre ? `excluir ${p.nome}` : novo ? `tirar ${p.nome} do mapa` : `voltar ${p.nome} ao lugar original`, p.id);
    removerRegistro(p.id, livre ? `${p.nome} excluído do mapa` : novo ? `${p.nome} voltou para "sem posição"` : `${p.nome} voltou ao lugar da planta`);
  };

  const desfazer = () => {
    const acao = pilha[pilha.length - 1];
    if (!acao || salvando) return;
    setPilha((p) => p.slice(0, -1));
    const aviso = `Desfeito: ${acao.rotulo}`;
    if (!acao.antes) return removerRegistro(acao.chave, aviso, false);
    const a = acao.antes;
    setLocais((l) => ({ ...l, [acao.chave]: { posicao: [a.x, a.z], rotacao: a.rotacao ?? 0 } }));
    salvarPosicao({ chave: acao.chave, tipo: a.tipo, x: a.x, z: a.z, nome: a.nome, categoria: a.categoria, itemAta: a.itemAta, rotacao: a.rotacao }, aviso);
  };

  // Mapa inteiro de volta à planta do evento: usado quando a edição saiu do controle.
  const aposRestaurar = () => {
    setConfirmarRestaurar(false);
    setPilha([]);
    // A cena 3D guarda as posições que já desenhou: só recarregando ela volta limpa, igual à planta.
    window.location.reload();
  };

  return {
    arena,
    idsEditados,
    salvando,
    editando,
    confirmarRestaurar,
    setConfirmarRestaurar,
    menuItens,
    setMenuItens,
    pilha,
    colocando,
    setColocando,
    formEdicao,
    setFormEdicao,
    setPrevia,
    edicaoPlano,
    pontoEditado,
    pontoSelecionadoEdicao,
    alternarEdicao,
    confirmarFormEdicao,
    girar,
    excluirDoMapa,
    desfazer,
    aposRestaurar,
  };
}

export type EdicaoArena = ReturnType<typeof useEdicaoArena>;

/**
 * Teclado da edição: Ctrl+Z desfaz, Q/E giram o selecionado.
 * Chamado na mesma posição em que esses efeitos ficavam no componente (depois dos atalhos gerais).
 */
export function useAtalhosEdicao({
  wrapperRef,
  edicao,
  medindo,
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  edicao: EdicaoArena;
  medindo: boolean;
}) {
  const { editando, colocando, pontoSelecionadoEdicao, desfazer, girar } = edicao;

  // Atalhos da edição: Ctrl+Z desfaz, Q/E giram o selecionado. Fora de campos de texto.
  const atalhosEdicaoRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    atalhosEdicaoRef.current = (e: KeyboardEvent) => {
      if (!editando || !wrapperRef.current?.isConnected) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable)) return;
      const tecla = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && tecla === "z") {
        e.preventDefault();
        desfazer();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || !pontoSelecionadoEdicao || colocando || medindo) return;
      if (tecla === "q" || tecla === "e") {
        e.preventDefault();
        girar(tecla === "q" ? PASSO_GIRO : -PASSO_GIRO);
      }
    };
  });
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => atalhosEdicaoRef.current(e);
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);
}
