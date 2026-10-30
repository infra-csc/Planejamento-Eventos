"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { desabilitarBibliotecaEmLoteAction, disponibilizarBibliotecaEmLoteAction, reativarBibliotecaEmLoteAction } from "@/app/(app)/biblioteca/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Aviso } from "@/components/ui/layout";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { OrganizarProjetosDialog, type OpcoesOrganizacao } from "./organizar-projetos-dialog";

type TipoBiblioteca = "projetos" | "pecas";
type ItemVisivel = { id: string; nome: string; ativo: boolean };
type ErroLote = { mensagem: string; projetos: Array<{ id: string; codigo: string; nome: string }> };
type ContextoSelecao = {
  itens: ItemVisivel[];
  /** Filtro "Só inativos": a seleção é dos inativos e a ação é reativar (auditoria 30/10, parte C N27). */
  modoReativar: boolean;
  selecionados: Set<string>;
  ocupado: boolean;
  alternar: (id: string) => void;
  selecionarPagina: (marcar: boolean) => void;
  abrirConfirmacao: () => void;
  /** Mostrar (true) ou tirar (false) das solicitações os itens marcados: reversível, sem confirmação. */
  mostrarNasSolicitacoes: (disponivel: boolean) => void;
  /** Só existe na aba de projetos: mudar grupo/categoria em lote. */
  abrirOrganizacao?: () => void;
};

const SelecaoContext = createContext<ContextoSelecao | null>(null);

function pararNavegacao(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

/*
 * Foco depois de uma ação que recarrega a lista: a barra de seleção (que abriu o diálogo) some, ou a linha da peça
 * inativada sai do filtro, e o foco caía no <body> (auditoria 30/10, parte C N20). Quem pede diz a linha preferida;
 * quando a lista recarrega com o foco perdido, ele vai para essa linha ou para "selecionar a página".
 */
let focoPendente: { itemId: string | null; ate: number } | null = null;
export function pedirFocoNaLista(itemId: string | null = null) {
  focoPendente = { itemId, ate: Date.now() + 8000 };
}

function aplicarFocoPendente() {
  const pedido = focoPendente;
  if (!pedido || Date.now() > pedido.ate) return;
  const ativo = document.activeElement;
  if (ativo && ativo !== document.body && ativo.isConnected) return;
  focoPendente = null;
  const linha = pedido.itemId ? document.querySelector(`[data-selecao-item="${CSS.escape(pedido.itemId)}"]`)?.closest("tr")?.querySelector<HTMLElement>("[data-linha-link]") : null;
  (linha ?? document.querySelector<HTMLElement>("[data-selecao-pagina]"))?.focus();
}

/** Mantém a seleção confinada aos itens visíveis desta aba, filtro e página. */
export function SelecaoEmLote({
  tipo,
  itens,
  gerencia,
  organizacao,
  modoReativar = false,
  children,
}: {
  tipo: TipoBiblioteca;
  itens: ItemVisivel[];
  gerencia: boolean;
  /** Grupos e categorias para "Organizar selecionados" (só projetos). */
  organizacao?: OpcoesOrganizacao;
  /** Filtro "Só inativos". */
  modoReativar?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [organizar, setOrganizar] = useState(false);
  const [erro, setErro] = useState<ErroLote | null>(null);
  const [ocupado, iniciar] = useTransition();
  const submetendo = useRef(false);
  const elegiveis = itens.filter((item) => item.ativo !== modoReativar);
  const selecionadosVisiveis = new Set([...selecionados].filter((id) => elegiveis.some((item) => item.id === id)));
  // A lista recarregou depois de uma ação: devolve o foco (ver pedirFocoNaLista).
  useEffect(() => aplicarFocoPendente(), [itens]);

  const alternar = (id: string) => {
    if (ocupado || !elegiveis.some((item) => item.id === id)) return;
    setSelecionados((atuais) => {
      const proxima = new Set(atuais);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  };

  const selecionarPagina = (marcar: boolean) => {
    if (ocupado) return;
    setSelecionados((atuais) => {
      const proxima = new Set(atuais);
      for (const item of elegiveis) {
        if (marcar) proxima.add(item.id);
        else proxima.delete(item.id);
      }
      return proxima;
    });
  };

  const finalizar = () => {
    if (ocupado || submetendo.current || selecionadosVisiveis.size === 0) return;
    submetendo.current = true;
    setErro(null);
    const formData = new FormData();
    formData.set("tipo", tipo);
    for (const id of selecionadosVisiveis) formData.append("ids", id);
    iniciar(async () => {
      try {
        const resultado = await (modoReativar ? reativarBibliotecaEmLoteAction(formData) : desabilitarBibliotecaEmLoteAction(formData));
        if (!resultado.ok) {
          // Só no diálogo, com os projetos em lista de links: antes vinha também num toast de 10 linhas por cima do
          // botão, com a lista num parágrafo corrido (auditoria 30/10, parte C N12).
          setErro({ mensagem: resultado.erro, projetos: "projetos" in resultado ? resultado.projetos : [] });
          return;
        }
        const alterados = resultado.dados?.alterados ?? selecionadosVisiveis.size;
        const dados = resultado.dados as { jaInativos?: number; jaAtivos?: number } | undefined;
        const ja = modoReativar ? (dados?.jaAtivos ?? 0) : (dados?.jaInativos ?? 0);
        const padrao = `${alterados} ${alterados === 1 ? (modoReativar ? "item reativado" : "item inativado") : modoReativar ? "itens reativados" : "itens inativados"}.`;
        const resumo = `${resultado.mensagem ?? padrao}${ja ? ` ${ja} ${ja === 1 ? "já estava" : "já estavam"} ${modoReativar ? (ja === 1 ? "ativo" : "ativos") : ja === 1 ? "inativo" : "inativos"}.` : ""}`;
        toastSucesso(resumo);
        setSelecionados(new Set());
        setConfirmar(false);
        pedirFocoNaLista();
        router.refresh();
      } catch {
        const mensagem = `Não foi possível ${modoReativar ? "reativar" : "inativar"} os itens. Verifique sua conexão e tente de novo.`;
        setErro({ mensagem, projetos: [] });
      } finally {
        submetendo.current = false;
      }
    });
  };

  const mostrarNasSolicitacoes = (disponivel: boolean) => {
    if (ocupado || submetendo.current || selecionadosVisiveis.size === 0) return;
    submetendo.current = true;
    const formData = new FormData();
    formData.set("tipo", tipo);
    formData.set("disponivel", disponivel ? "1" : "0");
    for (const id of selecionadosVisiveis) formData.append("ids", id);
    iniciar(async () => {
      try {
        const r = await disponibilizarBibliotecaEmLoteAction(formData);
        if (!r.ok) return toastErro(r.erro);
        // "Itens atualizados" em vez de "Pronto." quando a action não traz mensagem (auditoria 28/10, nº 162).
        toastSucesso(r.mensagem ?? "Itens atualizados");
        setSelecionados(new Set());
        pedirFocoNaLista();
        router.refresh();
      } catch {
        toastErro("Não foi possível alterar os itens. Verifique sua conexão e tente de novo.");
      } finally {
        submetendo.current = false;
      }
    });
  };

  const ctx: ContextoSelecao = {
    itens,
    modoReativar,
    selecionados: selecionadosVisiveis,
    ocupado,
    alternar,
    selecionarPagina,
    abrirConfirmacao: () => {
      setErro(null);
      setConfirmar(true);
    },
    mostrarNasSolicitacoes,
    abrirOrganizacao: tipo === "projetos" && organizacao && !modoReativar ? () => setOrganizar(true) : undefined,
  };
  const nomesSelecionados = elegiveis.filter((item) => selecionadosVisiveis.has(item.id));
  const verbo = modoReativar ? "Reativar" : "Inativar";

  return (
    <SelecaoContext.Provider value={ctx}>
      {children}
      {gerencia && tipo === "projetos" && organizacao && (
        <OrganizarProjetosDialog
          aberto={organizar}
          onFechar={() => setOrganizar(false)}
          onConcluido={() => {
            setOrganizar(false);
            setSelecionados(new Set());
            pedirFocoNaLista();
          }}
          itens={nomesSelecionados}
          opcoes={organizacao}
        />
      )}
      {gerencia && (
        <Dialog
          open={confirmar}
          onOpenChange={(aberta) => {
            if (ocupado) return;
            setConfirmar(aberta);
            if (!aberta) setErro(null);
          }}
        >
          <DialogContent
            title={`${verbo} ${selecionadosVisiveis.size} ${selecionadosVisiveis.size === 1 ? "item" : "itens"}?`}
            description={modoReativar ? "Os itens voltam a aparecer nas seleções." : "Confira os itens selecionados antes de inativá-los."}
            width={540}
            className={ocupado ? "[&>button[aria-label='Fechar']]:pointer-events-none [&>button[aria-label='Fechar']]:opacity-40" : undefined}
          >
            <p className="m-0 text-pequeno text-ink-2">
              Confira a seleção antes de continuar. Esta ação não apaga registros nem altera o que já foi solicitado.
            </p>
            <ul aria-label={`Itens selecionados para ${modoReativar ? "reativar" : "inativar"}`} className="m-0 mt-3 max-h-44 list-none space-y-1 overflow-y-auto rounded-controle border border-line-soft bg-subtle px-3 py-2.5">
              {nomesSelecionados.map((item) => (
                <li key={item.id} className="break-words text-pequeno text-ink">{item.nome}</li>
              ))}
            </ul>
            {modoReativar ? (
              tipo === "projetos" && (
                <Aviso tom="neutro" titulo="Projeto só volta com as peças ativas">
                  Se algum projeto tiver peça inativa no catálogo, nenhum item é reativado e a lista diz quais são.
                </Aviso>
              )
            ) : (
              <Aviso tom="warning" titulo="Só vale para novas seleções">
                Os itens deixam de aparecer nas escolhas futuras. Solicitações, ordens de serviço e histórico existentes são preservados.
                {tipo === "pecas" && " Peças usadas na lista de peças de um projeto ativo não podem ser inativadas; nesse caso, nenhum item é alterado."}
              </Aviso>
            )}
            {erro && (
              <Aviso tom="danger" titulo="Não foi possível concluir">
                <span role="alert">{erro.mensagem}</span>
                {erro.projetos.length > 0 && (
                  <ul className="m-0 mt-2 flex max-h-[180px] list-none flex-col gap-1 overflow-y-auto p-0">
                    {erro.projetos.map((p) => (
                      <li key={p.id} className="text-pequeno">
                        <Link href={`/projetos/${p.id}`} className="link">
                          {p.codigo} · {p.nome}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <span className="mt-1 block">Sua seleção continua disponível para corrigir ou tentar de novo.</span>
              </Aviso>
            )}
            <DialogFooter>
              <Button variant={modoReativar ? "primary" : "danger"} size="lg" loading={ocupado} disabled={nomesSelecionados.length === 0} onClick={finalizar}>
                {verbo} selecionados
              </Button>
              <Button variant="secondary" size="lg" disabled={ocupado} onClick={() => { setConfirmar(false); setErro(null); }}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SelecaoContext.Provider>
  );
}

export function BarraSelecaoLote({ gerencia }: { gerencia: boolean }) {
  const ctx = useContext(SelecaoContext);
  if (!gerencia || !ctx) return null;
  const count = ctx.selecionados.size;
  // Nada marcado: só a dica, numa linha. A barra com "Limpar" e as ações (todas desabilitadas sem seleção)
  // ocupava duas ou três linhas acima da lista o tempo todo, no celular quase uma tela. A dica também era uma faixa
  // fixa entre as abas e a tabela: fica para o leitor de tela (as caixas de seleção já se explicam; a barra aparece ao marcar).
  if (count === 0)
    return (
      <p aria-live="polite" className="sr-only">
        {ctx.modoReativar ? "Marque os itens inativos para reativar vários de uma vez." : "Marque os itens ativos para organizar, mostrar nas solicitações ou inativar vários de uma vez."}
      </p>
    );
  return (
    <div className="flex flex-col gap-2 border-b border-line-soft bg-selected px-cartao py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <span aria-live="polite" className="numero text-pequeno font-medium text-ink">
          {count} {count === 1 ? "item selecionado" : "itens selecionados"}
        </span>
        <button
          type="button"
          disabled={ctx.ocupado}
          onClick={() => ctx.selecionarPagina(false)}
          className="min-h-10 cursor-pointer border-0 bg-transparent px-1 text-pequeno font-medium text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline sm:min-h-0"
        >
          Limpar seleção
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ctx.modoReativar ? (
          <Button variant="secondary" size="sm" disabled={ctx.ocupado} aria-haspopup="dialog" onClick={ctx.abrirConfirmacao}>
            Reativar selecionados
          </Button>
        ) : (
          <>
            {ctx.abrirOrganizacao && (
              <Button variant="secondary" size="sm" disabled={ctx.ocupado} aria-haspopup="dialog" onClick={ctx.abrirOrganizacao}>
                Organizar selecionados
              </Button>
            )}
            <Button variant="secondary" size="sm" disabled={ctx.ocupado} onClick={() => ctx.mostrarNasSolicitacoes(true)}>
              Mostrar nas solicitações
            </Button>
            <Button variant="ghost" size="sm" disabled={ctx.ocupado} onClick={() => ctx.mostrarNasSolicitacoes(false)}>
              Tirar das solicitações
            </Button>
            <Button variant="secondary" size="sm" disabled={ctx.ocupado} aria-haspopup="dialog" onClick={ctx.abrirConfirmacao}>
              Inativar selecionados
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Caixa de 16 px com área de toque de 40 px no celular (auditoria 28/10, nº 59): o rótulo envolve a caixa. */
const toqueCaixa = "inline-grid cursor-pointer place-items-center max-md:size-10 has-[:disabled]:cursor-not-allowed";

export function CheckboxSelecaoLote({ id, nome, ativo }: ItemVisivel) {
  const ctx = useContext(SelecaoContext);
  if (!ctx) return null;
  const elegivel = ativo !== ctx.modoReativar;
  return (
    <label className={toqueCaixa} onClick={pararNavegacao} onAuxClick={pararNavegacao}>
      <input
        type="checkbox"
        data-selecao-item={id}
        aria-label={`Selecionar ${nome}`}
        checked={ctx.selecionados.has(id)}
        disabled={!elegivel || ctx.ocupado}
        onClick={pararNavegacao}
        onAuxClick={pararNavegacao}
        onKeyDown={pararNavegacao}
        onChange={() => ctx.alternar(id)}
        className="size-4 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-45"
      />
    </label>
  );
}

export function CheckboxSelecionarPagina({ rotulo }: { rotulo?: string }) {
  const ctx = useContext(SelecaoContext);
  const elegiveis = ctx?.itens.filter((item) => item.ativo !== ctx.modoReativar) ?? [];
  const nSelecionados = elegiveis.filter((item) => ctx?.selecionados.has(item.id)).length;
  const todos = elegiveis.length > 0 && nSelecionados === elegiveis.length;
  const parcial = nSelecionados > 0 && !todos;

  if (!ctx) return null;
  const texto = rotulo ?? `Selecionar todos os itens ${ctx.modoReativar ? "inativos" : "ativos"} desta página`;

  return (
    <label className={toqueCaixa}>
      <input
        type="checkbox"
        data-selecao-pagina=""
        aria-label={texto}
        title={texto}
        checked={todos}
        disabled={ctx.ocupado || elegiveis.length === 0}
        onClick={pararNavegacao}
        onAuxClick={pararNavegacao}
        onKeyDown={pararNavegacao}
        onChange={(e) => ctx.selecionarPagina(e.target.checked)}
        ref={(node) => {
          if (node) node.indeterminate = parcial;
        }}
        className="size-4 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-45"
      />
    </label>
  );
}
