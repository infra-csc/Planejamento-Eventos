"use client";

import { createContext, useContext, useRef, useState, useTransition, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { desabilitarBibliotecaEmLoteAction } from "@/app/(app)/biblioteca/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Aviso } from "@/components/ui/layout";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { OrganizarProjetosDialog, type OpcoesOrganizacao } from "./organizar-projetos-dialog";

type TipoBiblioteca = "projetos" | "pecas";
type ItemVisivel = { id: string; nome: string; ativo: boolean };
type ContextoSelecao = {
  itens: ItemVisivel[];
  selecionados: Set<string>;
  ocupado: boolean;
  alternar: (id: string) => void;
  selecionarPagina: (marcar: boolean) => void;
  abrirConfirmacao: () => void;
  /** Só existe na aba de projetos: mudar grupo/categoria em lote. */
  abrirOrganizacao?: () => void;
};

const SelecaoContext = createContext<ContextoSelecao | null>(null);

function pararNavegacao(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

/** Mantém a seleção confinada aos itens visíveis desta aba, filtro e página. */
export function SelecaoEmLote({
  tipo,
  itens,
  gerencia,
  organizacao,
  children,
}: {
  tipo: TipoBiblioteca;
  itens: ItemVisivel[];
  gerencia: boolean;
  /** Grupos e categorias para "Organizar selecionados" (só projetos). */
  organizacao?: OpcoesOrganizacao;
  children: ReactNode;
}) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [organizar, setOrganizar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const submetendo = useRef(false);
  const ativos = itens.filter((item) => item.ativo);
  const selecionadosVisiveis = new Set([...selecionados].filter((id) => ativos.some((item) => item.id === id)));

  const alternar = (id: string) => {
    if (ocupado || !ativos.some((item) => item.id === id)) return;
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
      for (const item of ativos) {
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
        const resultado = await desabilitarBibliotecaEmLoteAction(formData);
        if (!resultado.ok) {
          setErro(resultado.erro);
          toastErro(resultado.erro);
          return;
        }
        const alterados = resultado.dados?.alterados ?? selecionadosVisiveis.size;
        const jaInativos = resultado.dados?.jaInativos ?? 0;
        const resumo = `${resultado.mensagem ?? `${alterados} ${alterados === 1 ? "item desabilitado" : "itens desabilitados"}.`}${jaInativos ? ` ${jaInativos} ${jaInativos === 1 ? "já estava inativo" : "já estavam inativos"}.` : ""}`;
        toastSucesso(resumo);
        setSelecionados(new Set());
        setConfirmar(false);
        router.refresh();
      } catch {
        const mensagem = "Não foi possível desabilitar os itens. Verifique sua conexão e tente novamente.";
        setErro(mensagem);
        toastErro(mensagem);
      } finally {
        submetendo.current = false;
      }
    });
  };

  const ctx: ContextoSelecao = {
    itens,
    selecionados: selecionadosVisiveis,
    ocupado,
    alternar,
    selecionarPagina,
    abrirConfirmacao: () => {
      setErro(null);
      setConfirmar(true);
    },
    abrirOrganizacao: tipo === "projetos" && organizacao ? () => setOrganizar(true) : undefined,
  };
  const nomesSelecionados = ativos.filter((item) => selecionadosVisiveis.has(item.id));

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
            title={`Desabilitar ${selecionadosVisiveis.size} ${selecionadosVisiveis.size === 1 ? "item" : "itens"}?`}
            description="Confirme os itens selecionados para desabilitá-los."
            width={540}
            className={ocupado ? "[&>button[aria-label='Fechar']]:pointer-events-none [&>button[aria-label='Fechar']]:opacity-40" : undefined}
          >
            <p className="m-0 text-pequeno text-ink-2">
              Confira a seleção antes de continuar. Esta ação não apaga registros nem altera o que já foi solicitado.
            </p>
            <ul aria-label="Itens selecionados para desabilitar" className="m-0 mt-3 max-h-44 list-none space-y-1 overflow-y-auto rounded-controle border border-line-soft bg-subtle px-3 py-2.5">
              {nomesSelecionados.map((item) => (
                <li key={item.id} className="break-words text-pequeno text-ink">{item.nome}</li>
              ))}
            </ul>
            <Aviso tom="warning" titulo="Só vale para novas seleções">
              Os itens deixam de aparecer nas escolhas futuras. Solicitações, ordens de serviço e histórico existentes são preservados.
              {tipo === "pecas" && " Peças usadas na lista de peças de um projeto ativo não podem ser desabilitadas; nesse caso, nenhum item será alterado."}
            </Aviso>
            {erro && <Aviso tom="danger" titulo="Não foi possível concluir">{erro} Sua seleção continua disponível para corrigir ou tentar novamente.</Aviso>}
            <DialogFooter>
              <Button variant="primary" size="lg" loading={ocupado} disabled={nomesSelecionados.length === 0} onClick={finalizar}>
                Desabilitar selecionados
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
  // ocupava duas ou três linhas acima da lista o tempo todo, no celular quase uma tela.
  if (count === 0)
    return (
      <p aria-live="polite" className="m-0 border-b border-line-soft bg-subtle/70 px-cartao py-2 text-pequeno text-muted">
        Marque os itens ativos para organizar ou desabilitar vários de uma vez.
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
        {ctx.abrirOrganizacao && (
          <Button variant="secondary" size="sm" disabled={ctx.ocupado} onClick={ctx.abrirOrganizacao}>
            Organizar selecionados
          </Button>
        )}
        <Button variant="secondary" size="sm" disabled={ctx.ocupado} onClick={ctx.abrirConfirmacao}>
          Desabilitar selecionados
        </Button>
      </div>
    </div>
  );
}

export function CheckboxSelecaoLote({ id, nome, ativo }: ItemVisivel) {
  const ctx = useContext(SelecaoContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      aria-label={`Selecionar ${nome}`}
      checked={ctx.selecionados.has(id)}
      disabled={!ativo || ctx.ocupado}
      onClick={pararNavegacao}
      onAuxClick={pararNavegacao}
      onKeyDown={pararNavegacao}
      onChange={() => ctx.alternar(id)}
      className="size-4 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-45"
    />
  );
}

export function CheckboxSelecionarPagina({ rotulo = "Selecionar todos os itens ativos desta página" }: { rotulo?: string }) {
  const ctx = useContext(SelecaoContext);
  const ativos = ctx?.itens.filter((item) => item.ativo) ?? [];
  const nSelecionados = ativos.filter((item) => ctx?.selecionados.has(item.id)).length;
  const todos = ativos.length > 0 && nSelecionados === ativos.length;
  const parcial = nSelecionados > 0 && !todos;

  if (!ctx) return null;

  return (
    <input
      type="checkbox"
      aria-label={rotulo}
      title={rotulo}
      checked={todos}
      disabled={ctx.ocupado || ativos.length === 0}
      onClick={pararNavegacao}
      onAuxClick={pararNavegacao}
      onKeyDown={pararNavegacao}
      onChange={(e) => ctx.selecionarPagina(e.target.checked)}
      ref={(node) => {
        if (node) node.indeterminate = parcial;
      }}
      className="size-4 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-45"
    />
  );
}
