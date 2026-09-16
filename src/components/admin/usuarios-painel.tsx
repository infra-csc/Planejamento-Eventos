"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { PerfilBadge } from "@/components/ui/badge";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toast, toastErro } from "@/components/ui/toast";
import { alternarAtivoUsuarioAction, gerarLinkAcessoAction, salvarUsuarioAction } from "@/app/(app)/admin/actions";
import { PERFIL_DESCRICAO, PERFIL_LABEL, perfilUsaArea } from "@/domain/permissions";
import { PERFIS } from "@/domain/constantes";
import type { Perfil } from "@/server/db/schema";

type U = { id: string; nome: string; email: string; perfil: Perfil; areaId: string | null; areaNome: string | null; ativo: boolean; ultimoAcesso: string };
type Form = { nome: string; email: string; perfil: Perfil; areaId: string };

const campo = "h-9 w-full rounded-lg border border-line-control bg-surface px-3 text-[13.5px] text-ink focus:border-accent focus:outline-none aria-[invalid=true]:border-danger-input";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function absoluto(link: string) {
  return link.startsWith("/") && typeof window !== "undefined" ? `${window.location.origin}${link}` : link;
}

function LinkAcesso({ nome, link, onClose }: { nome: string; link: string; onClose: () => void }) {
  const url = absoluto(link);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Link de acesso de ${nome.split(" ")[0]}`} description="Este ambiente não envia e-mail. Envie o link por um canal seguro; ele vale por 7 dias e uma única vez.">
        <div className="flex gap-2">
          <input readOnly value={url} aria-label="Link de acesso" onFocus={(e) => e.currentTarget.select()} className={cn(campo, "bg-subtle font-mono text-[12px]")} />
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

function ModalUsuario({ usuario, areas, emails, meuId, onClose, onLink }: { usuario: U | null; areas: Array<{ id: string; nome: string }>; emails: Array<{ id: string; email: string }>; meuId: string; onClose: () => void; onLink: (nome: string, link: string) => void }) {
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
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    setErroGeral(null);
    if (!validar()) return;
    iniciar(async () => {
      const r = await salvarUsuarioAction({ id: usuario?.id ?? null, nome: f.nome.trim(), email: f.email.trim(), perfil: f.perfil, areaId: usaArea ? f.areaId : null, ativo: usuario?.ativo ?? true });
      if (!r.ok) {
        if (r.campos) setErros(r.campos);
        setErroGeral(r.erro);
        return;
      }
      onClose();
      const d = r.dados;
      if (!d) return;
      toast(d.criado ? `${d.nome} criado` : "Alterações salvas");
      if (d.linkAcesso) onLink(d.nome, d.linkAcesso);
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
        onLink(usuario.nome, r.dados);
      } else if (!r.ok) setErroGeral(r.erro);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={usuario ? `Editar ${usuario.nome.split(" ")[0]}` : "Novo usuário"} description={usuario ? "Alterações valem a partir do próximo acesso." : "Sem envio de e-mail neste ambiente: ao criar, você recebe o link para a pessoa definir a senha."}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
          className="flex flex-col gap-3.5"
        >
          <div>
            <label htmlFor="u-nome" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Nome
            </label>
            <input id="u-nome" autoFocus value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} aria-invalid={Boolean(erros.nome)} aria-describedby={erros.nome ? "u-nome-erro" : undefined} className={campo} />
            {erros.nome && (
              <p id="u-nome-erro" className="mb-0 mt-[5px] text-[12px] text-danger">
                {erros.nome}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="u-email" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              E-mail
            </label>
            <input
              id="u-email"
              type="email"
              value={f.email}
              readOnly={Boolean(usuario)}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              aria-invalid={Boolean(erros.email)}
              aria-describedby={erros.email ? "u-email-erro" : undefined}
              className={cn(campo, usuario && "cursor-default bg-subtle text-ink-3")}
            />
            {erros.email && (
              <p id="u-email-erro" className="mb-0 mt-[5px] text-[12px] text-danger">
                {erros.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="u-perfil" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Perfil
            </label>
            <select id="u-perfil" value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value as Perfil })} disabled={usuario?.id === meuId} className={campo}>
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {PERFIL_LABEL[p]}
                </option>
              ))}
            </select>
            <p className="mb-0 mt-[5px] text-[12px] leading-[1.45] text-muted">{PERFIL_DESCRICAO[f.perfil]}</p>
          </div>
          {usaArea && (
            <div>
              <label htmlFor="u-area" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                Área
              </label>
              <select id="u-area" value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })} aria-invalid={Boolean(erros.areaId)} aria-describedby={erros.areaId ? "u-area-erro" : undefined} className={campo}>
                <option value="">Selecione</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
              {erros.areaId && (
                <p id="u-area-erro" className="mb-0 mt-[5px] text-[12px] text-danger">
                  {erros.areaId}
                </p>
              )}
            </div>
          )}
          {usuario && (
            <button type="button" onClick={novoLink} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-accent hover:underline">
              Gerar novo link de acesso
            </button>
          )}
          {erroGeral && <p className="m-0 text-[12.5px] text-danger">{erroGeral}</p>}
          <DialogFooter>
            <Button type="submit" variant="primary" loading={pendente}>
              {usuario ? "Salvar alterações" : "Criar usuário"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
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

export function UsuariosPainel({ usuarios, emails, areas, meuId, abrirNovo, vazio }: { usuarios: U[]; emails: Array<{ id: string; email: string }>; areas: Array<{ id: string; nome: string }>; meuId: string; abrirNovo: boolean; vazio: string }) {
  const [modal, setModal] = useState<U | "novo" | null>(abrirNovo ? "novo" : null);
  const [link, setLink] = useState<{ nome: string; link: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const alternar = (u: U) =>
    iniciar(async () => {
      const r = await alternarAtivoUsuarioAction(u.id, !u.ativo);
      if (!r.ok) toastErro(r.erro);
      else if (u.ativo) avisarDesativado(u);
      else toast(`${u.nome} reativado`);
    });

  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line-soft px-[18px] py-3">
          <span className="text-[12.5px] text-muted">
            {usuarios.length} {usuarios.length === 1 ? "pessoa" : "pessoas"}
          </span>
          <Button variant="primary" size="sm" onClick={() => setModal("novo")}>
            Novo usuário
          </Button>
        </div>
        {usuarios.length === 0 ? (
          <p className="m-0 px-[18px] py-12 text-center text-[13.5px] font-medium">{vazio}</p>
        ) : (
          <table className="w-full border-collapse">
            <CaptionOculta>Usuários</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th>Pessoa</Th>
                <Th largura={130}>Perfil</Th>
                <Th largura={130}>Área</Th>
                <Th largura={120}>Último acesso</Th>
                <Th largura={170} alinhar="right">
                  Status
                </Th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={cn("hover:bg-subtle", !u.ativo && "bg-subtle")}>
                  <th scope="row" className="border-b border-line-row px-[18px] py-3 text-left font-normal">
                    <span className={cn("block text-[13.5px]", u.ativo ? "text-ink" : "text-ink-3")}>
                      {u.nome}
                      {u.id === meuId && <span className="ml-1.5 text-[11.5px] text-muted">você</span>}
                    </span>
                    <span className="block text-[12px] text-muted">{u.email}</span>
                  </th>
                  <td className="border-b border-line-row px-2.5 py-3">
                    <PerfilBadge perfil={u.perfil} />
                  </td>
                  <td className="border-b border-line-row px-2.5 py-3 text-[12.5px] text-ink-2">{u.areaNome ?? "—"}</td>
                  <td className="border-b border-line-row px-2.5 py-3 font-mono text-[12px] text-muted">{u.ultimoAcesso}</td>
                  <td className="border-b border-line-row py-3 pl-2.5 pr-[18px] text-right">
                    <span className="flex items-center justify-end gap-3">
                      <span className={cn("text-[12px]", u.ativo ? "text-success" : "text-muted")}>{u.ativo ? "ativo" : "inativo"}</span>
                      <button type="button" onClick={() => setModal(u)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-accent hover:underline">
                        Editar
                      </button>
                      {u.id !== meuId && (
                        <button type="button" disabled={pendente} onClick={() => alternar(u)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-ink-3 hover:text-ink">
                          {u.ativo ? "Desativar" : "Reativar"}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && <ModalUsuario key={modal === "novo" ? "novo" : modal.id} usuario={modal === "novo" ? null : modal} areas={areas} emails={emails} meuId={meuId} onClose={() => setModal(null)} onLink={(nome, l) => setLink({ nome, link: l })} />}
      {link && <LinkAcesso nome={link.nome} link={link.link} onClose={() => setLink(null)} />}
    </>
  );
}
