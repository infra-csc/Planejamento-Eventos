"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { Select } from "@/components/ui/select";
import { toast, toastErro } from "@/components/ui/toast";
import { usePedidoNovo } from "./novo-via-url";
import { alternarAtivoUsuarioAction, gerarLinkAcessoAction, salvarUsuarioAction } from "@/app/(app)/admin/actions";
import { verComoAction } from "@/app/(app)/ver-como/actions";
import { PERFIL_DESCRICAO, PERFIL_LABEL, perfilUsaArea } from "@/domain/permissions";
import { PERFIS } from "@/domain/constantes";
import type { Perfil } from "@/server/db/schema";

type U = { id: string; nome: string; email: string; perfil: Perfil; areaId: string | null; areaNome: string | null; ativo: boolean; ultimoAcesso: string };
type Form = { nome: string; email: string; perfil: Perfil; areaId: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Botão "⋯" da linha: é para ele que o foco volta depois de editar ou de fechar o link de acesso. */
const idAcoes = (id: string) => `acoes-usuario-${id}`;
/**
 * O diálogo seguinte (link de acesso) e a revalidação da lista deixavam o foco no <body> (auditoria 30/10,
 * parte D N20): devolve ao "⋯" da pessoa, depois que o Radix termina de fechar.
 */
function focarAcoes(id: string | null | undefined) {
  if (!id) return;
  requestAnimationFrame(() => document.getElementById(idAcoes(id))?.focus());
}
/** Ordem dos campos no formulário: o foco vai ao primeiro com erro, em vez de ficar no botão (N20). */
const ORDEM_CAMPOS = [
  ["nome", "u-nome"],
  ["email", "u-email"],
  ["areaId", "u-area"],
] as const;
function focarPrimeiroErro(e: Record<string, string>) {
  const alvo = ORDEM_CAMPOS.find(([campo]) => e[campo]);
  if (alvo) requestAnimationFrame(() => document.getElementById(alvo[1])?.focus());
}

function absoluto(link: string) {
  return link.startsWith("/") && typeof window !== "undefined" ? `${window.location.origin}${link}` : link;
}

function LinkAcesso({ nome, link, onClose }: { nome: string; link: string; onClose: () => void }) {
  const url = absoluto(link);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Link de acesso de ${nome.split(" ")[0]}`} description="Este ambiente não envia e-mail. Envie o link por um canal seguro; ele vale por 7 dias e uma única vez.">
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label="Link de acesso" onFocus={(e) => e.currentTarget.select()} className="font-mono text-pequeno" />
          <Button
            variant="secondary"
            size="md"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast("Link copiado");
              } catch {
                toast("Não foi possível copiar — selecione e copie manualmente");
              }
            }}
          >
            Copiar
          </Button>
        </div>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Desativar corta o acesso na hora: o toast oferece desfazer (Ctrl+Z) em vez de pedir confirmação antes. */
function avisarDesativado(u: { id: string; nome: string }) {
  toast(`Acesso de ${u.nome} desativado`, {
    desfazer: async () => {
      const r = await alternarAtivoUsuarioAction(u.id, true);
      if (r.ok) toast(`${u.nome} reativado`);
      else toastErro(r.erro);
    },
  });
}

function ModalUsuario({ usuario, areas, emails, meuId, onClose, onLink }: { usuario: U | null; areas: Array<{ id: string; nome: string }>; emails: Array<{ id: string; email: string }>; meuId: string; onClose: (focarId?: string) => void; onLink: (nome: string, link: string, id: string) => void }) {
  const [f, setF] = useState<Form>({ nome: usuario?.nome ?? "", email: usuario?.email ?? "", perfil: usuario?.perfil ?? "REQUISITANTE", areaId: usuario?.areaId ?? "" });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const usaArea = perfilUsaArea(f.perfil);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!f.nome.trim()) e.nome = "Informe o nome.";
    if (!usuario) {
      if (!f.email.trim()) e.email = "Informe o e-mail.";
      else if (!EMAIL.test(f.email.trim())) e.email = "E-mail em formato inválido.";
      else if (emails.some((x) => x.email === f.email.trim().toLowerCase())) e.email = "Já existe um usuário com este e-mail.";
    }
    if (usaArea && !f.areaId) e.areaId = "Escolha a área.";
    setErros(e);
    focarPrimeiroErro(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    setErroGeral(null);
    if (!validar()) return;
    iniciar(async () => {
      const r = await salvarUsuarioAction({ id: usuario?.id ?? null, nome: f.nome.trim(), email: f.email.trim(), perfil: f.perfil, areaId: usaArea ? f.areaId : null, ativo: usuario?.ativo ?? true });
      if (!r.ok) {
        if (r.campos) {
          setErros(r.campos);
          focarPrimeiroErro(r.campos);
        }
        setErroGeral(r.erro);
        return;
      }
      const d = r.dados;
      onClose(d?.linkAcesso ? undefined : d?.id);
      if (!d) return;
      toast(d.criado ? `${d.nome} criado` : "Alterações salvas");
      if (d.linkAcesso) onLink(d.nome, d.linkAcesso, d.id);
    });
  };

  const desativar = () => {
    if (!usuario) return;
    iniciar(async () => {
      const r = await alternarAtivoUsuarioAction(usuario.id, false);
      if (r.ok) {
        onClose();
        avisarDesativado(usuario);
      } else setErroGeral(r.erro);
    });
  };

  const novoLink = () => {
    if (!usuario) return;
    iniciar(async () => {
      const r = await gerarLinkAcessoAction(usuario.id);
      if (r.ok && r.dados) {
        onClose();
        onLink(usuario.nome, r.dados, usuario.id);
      } else if (!r.ok) setErroGeral(r.erro);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(usuario?.id)}>
      {/* A sessão lê perfil e área do cadastro a cada pedido desde 2a58e97: dizer "próximo acesso" fazia o admin
          achar que a pessoa mantinha o acesso até sair (auditoria 30/10, parte D N12). */}
      <DialogContent title={usuario ? `Editar ${usuario.nome.split(" ")[0]}` : "Novo usuário"} description={usuario ? "Perfil e área valem na hora: a pessoa passa a ver só o que o novo perfil permite." : "Sem envio de e-mail neste ambiente: ao criar, você recebe o link para a pessoa definir a senha."}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
          className="flex flex-col gap-3.5"
        >
          <Field label="Nome" htmlFor="u-nome" error={erros.nome}>
            <Input id="u-nome" autoFocus value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </Field>
          <Field label="E-mail" htmlFor="u-email" error={erros.email}>
            <Input id="u-email" type="email" value={f.email} readOnly={Boolean(usuario)} onChange={(e) => setF({ ...f, email: e.target.value })} className={cn(usuario && "cursor-default text-ink-3")} />
          </Field>
          <Field label="Perfil" htmlFor="u-perfil" hint={PERFIL_DESCRICAO[f.perfil]}>
            <Select id="u-perfil" value={f.perfil} onValueChange={(v) => setF({ ...f, perfil: v as Perfil })} disabled={usuario?.id === meuId} ordenarAlfabetico={false} opcoes={PERFIS.map((p) => ({ value: p, label: PERFIL_LABEL[p], descricao: PERFIL_DESCRICAO[p] }))} />
          </Field>
          {usaArea && (
            <Field label="Área" htmlFor="u-area" error={erros.areaId}>
              <Select id="u-area" value={f.areaId} onValueChange={(v) => setF({ ...f, areaId: v })} invalid={Boolean(erros.areaId)} placeholder="Selecione a área" opcoes={areas.map((a) => ({ value: a.id, label: a.nome }))} />
            </Field>
          )}
          {usuario && (
            <Button variant="link" size="sm" onClick={novoLink} className="w-fit">
              Gerar novo link de acesso
            </Button>
          )}
          <FormError message={erroGeral} />
          <DialogFooter>
            <Button type="submit" variant="primary" loading={pendente}>
              {usuario ? "Salvar alterações" : "Criar usuário"}
            </Button>
            <Button variant="secondary" onClick={() => onClose(usuario?.id)}>
              Cancelar
            </Button>
            <span className="flex-1" />
            {usuario && usuario.ativo && usuario.id !== meuId && (
              <Button variant="dangerOutline" onClick={desativar} disabled={pendente}>
                Desativar acesso
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Menu "⋯" da linha (template de pedidos): editar e, para outros usuários, desativar/reativar. */
function AcoesUsuario({ u, meuId, pendente, onEditar, onAlternar, onVerComo }: { u: U; meuId: string; pendente: boolean; onEditar: () => void; onAlternar: () => void; onVerComo: () => void }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton id={idAcoes(u.id)} label={`Ações de ${u.nome}`}>
          <Icone nome="reticencias" />
        </IconButton>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={onEditar}>Editar</DropdownItem>
        {/* "Ver o app como…" ficava só no menu da conta (auditoria 28/10, nº 110): daqui, com o perfil e a área da pessoa. */}
        {u.ativo && u.perfil !== "ADMIN" && (
          <DropdownItem disabled={pendente} onSelect={onVerComo}>
            Ver o app como {u.nome.split(" ")[0]}
          </DropdownItem>
        )}
        {u.id !== meuId && (
          <>
            <DropdownSeparator />
            <DropdownItem danger={u.ativo} disabled={pendente} onSelect={onAlternar}>
              {u.ativo ? "Desativar acesso" : "Reativar acesso"}
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </Dropdown>
  );
}

const CELULA = "border-b border-line-row px-3 py-3";

export function UsuariosPainel({ usuarios, emails, areas, meuId, vazio }: { usuarios: U[]; emails: Array<{ id: string; email: string }>; areas: Array<{ id: string; nome: string }>; meuId: string; vazio: { titulo: string; descricao?: string; acao?: React.ReactNode } }) {
  const [modal, setModal] = useState<U | "novo" | null>(null);
  const [link, setLink] = useState<{ nome: string; link: string; id: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  // "Novo usuário" do cabeçalho (e o link direto /admin?novo=1) abre o modal de criação.
  const limparPedido = usePedidoNovo(() => setModal("novo"));
  const fechar = (focarId?: string) => {
    setModal(null);
    limparPedido();
    focarAcoes(focarId);
  };

  const verComo = (u: U) =>
    iniciar(async () => {
      try {
        const r = await verComoAction(u.perfil, u.areaId);
        if (!r.ok) {
          toastErro(r.erro ?? "Não foi possível trocar de perfil.");
          return;
        }
        // O painel vale para todos os perfis; a administração não vale para nenhum dos perfis vistos.
        router.push("/");
      } catch {
        toastErro("Não foi possível falar com o servidor. Tente de novo.");
      }
    });

  const alternar = (u: U) =>
    iniciar(async () => {
      const r = await alternarAtivoUsuarioAction(u.id, !u.ativo);
      if (!r.ok) toastErro(r.erro);
      else if (u.ativo) avisarDesativado(u);
      else toast(`${u.nome} reativado`);
    });

  return (
    <>
      {usuarios.length === 0 ? (
        <EmptyState title={vazio.titulo} description={vazio.descricao} action={vazio.acao} />
      ) : (
        <div className="overflow-x-auto">
          <table data-responsiva className="w-full border-collapse max-sm:[overflow-wrap:anywhere] sm:min-w-[560px]">
            <CaptionOculta>Usuários</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th>Nome</Th>
                <Th className="hidden sm:table-cell" largura={140}>
                  Perfil
                </Th>
                <Th className="hidden lg:table-cell" largura={150}>
                  Área
                </Th>
                <Th className="hidden lg:table-cell" largura={130}>
                  Último acesso
                </Th>
                <Th largura={56}>
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-subtle">
                  <th scope="row" className={cn(CELULA, "text-left font-normal")}>
                    <span className={cn("block text-corpo font-medium", u.ativo ? "text-ink" : "text-ink-3")}>
                      {u.nome}
                      {u.id === meuId && <span className="ml-1.5 text-rotulo font-normal text-muted">você</span>}
                      {/* A coluna "Situação" dizia "Ativo" em todas as linhas da aba Ativos: o aviso fica só no inativo. */}
                      {!u.ativo && <span className="ml-1.5 text-rotulo font-medium text-warning">inativo</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-pequeno text-muted">{u.email}</span>
                    {/* Tela estreita: perfil, área e último acesso numa linha embaixo do e-mail. */}
                    <span className="mt-0.5 block text-pequeno text-muted lg:hidden">
                      <span className="sm:hidden">{PERFIL_LABEL[u.perfil]} · </span>
                      {/* "Cenografia · Cenografia": no celular a área some quando repete o perfil. */}
                      {u.areaNome ? <span className={u.areaNome === PERFIL_LABEL[u.perfil] ? "max-sm:hidden" : undefined}>{u.areaNome} · </span> : ""}
                      <span className="numero">{u.ultimoAcesso}</span>
                    </span>
                  </th>
                  {/* Perfil é categoria, não estado: texto na coluna, sem selo colorido (eram 4 cores numa lista de 12). */}
                  <td className={cn(CELULA, "hidden text-pequeno text-ink-2 sm:table-cell")}>{PERFIL_LABEL[u.perfil]}</td>
                  <td className={cn(CELULA, "hidden text-pequeno text-ink-2 lg:table-cell")}>{u.areaNome ?? "—"}</td>
                  <td className={cn(CELULA, "numero hidden text-pequeno text-muted lg:table-cell")}>{u.ultimoAcesso}</td>
                  <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right">
                    <AcoesUsuario u={u} meuId={meuId} pendente={pendente} onEditar={() => setModal(u)} onAlternar={() => alternar(u)} onVerComo={() => verComo(u)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ModalUsuario key={modal === "novo" ? "novo" : modal.id} usuario={modal === "novo" ? null : modal} areas={areas} emails={emails} meuId={meuId} onClose={fechar} onLink={(nome, l, id) => setLink({ nome, link: l, id })} />}
      {link && (
        <LinkAcesso
          nome={link.nome}
          link={link.link}
          onClose={() => {
            setLink(null);
            focarAcoes(link.id);
          }}
        />
      )}
    </>
  );
}
