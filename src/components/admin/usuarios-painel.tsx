"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Badge, PerfilBadge } from "@/components/ui/badge";
import { Field, FormError, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { Select } from "@/components/ui/select";
import { toast, toastErro } from "@/components/ui/toast";
import { alternarAtivoUsuarioAction, gerarLinkAcessoAction, salvarUsuarioAction } from "@/app/(app)/admin/actions";
import { PERFIL_DESCRICAO, PERFIL_LABEL, perfilUsaArea } from "@/domain/permissions";
import { PERFIS } from "@/domain/constantes";
import type { Perfil } from "@/server/db/schema";

type U = { id: string; nome: string; email: string; perfil: Perfil; areaId: string | null; areaNome: string | null; ativo: boolean; ultimoAcesso: string };
type Form = { nome: string; email: string; perfil: Perfil; areaId: string };

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
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line-soft px-cartao py-3">
          <span className="text-pequeno text-muted">
            {usuarios.length} {usuarios.length === 1 ? "pessoa" : "pessoas"}
          </span>
          <Button variant="primary" size="sm" onClick={() => setModal("novo")}>
            Novo usuário
          </Button>
        </div>
        {usuarios.length === 0 ? (
          <EmptyState compact title={vazio} />
        ) : (
          <table className="w-full border-collapse">
            <CaptionOculta>Usuários</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th>Pessoa</Th>
                <Th largura={130}>Perfil</Th>
                <Th largura={130}>Área</Th>
                <Th largura={120}>Último acesso</Th>
                <Th largura={90}>Status</Th>
                <Th largura={150} alinhar="right">
                  Ações
                </Th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={cn("hover:bg-subtle", !u.ativo && "bg-subtle")}>
                  <th scope="row" className="border-b border-line-row px-cartao py-3 text-left font-normal">
                    <span className={cn("block text-corpo", u.ativo ? "text-ink" : "text-ink-3")}>
                      {u.nome}
                      {u.id === meuId && <span className="ml-1.5 text-rotulo text-muted">você</span>}
                    </span>
                    <span className="block text-pequeno text-muted">{u.email}</span>
                  </th>
                  <td className="border-b border-line-row px-2.5 py-3">
                    <PerfilBadge perfil={u.perfil} />
                  </td>
                  <td className="border-b border-line-row px-2.5 py-3 text-pequeno text-ink-2">{u.areaNome ?? "—"}</td>
                  <td className="border-b border-line-row px-2.5 py-3 font-mono text-pequeno text-muted">{u.ultimoAcesso}</td>
                  <td className="border-b border-line-row px-2.5 py-3">
                    <Badge tom={u.ativo ? "success" : "muted"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="border-b border-line-row py-3 pl-2.5 pr-cartao text-right">
                    <span className="flex items-center justify-end gap-3">
                      <Button variant="link" size="xs" onClick={() => setModal(u)} aria-label={`Editar ${u.nome}`}>
                        Editar
                      </Button>
                      {u.id !== meuId && (
                        <Button variant="link" size="xs" disabled={pendente} onClick={() => alternar(u)} className="text-ink-3 hover:text-ink" aria-label={`${u.ativo ? "Desativar" : "Reativar"} ${u.nome}`}>
                          {u.ativo ? "Desativar" : "Reativar"}
                        </Button>
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
