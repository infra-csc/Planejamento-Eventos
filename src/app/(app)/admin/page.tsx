import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarAreas, listarAreasComContagem, listarUsuarios, obterConfig } from "@/server/services/admin";
import { ultimoAcesso } from "@/lib/format";
import { TabsNav } from "@/components/ui/tabs-nav";
import { hrefCom } from "@/lib/url";
import { PageHeader } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { BuscaUrl } from "@/components/ui/busca-url";
import { UsuariosPainel } from "@/components/admin/usuarios-painel";
import { AreasPainel } from "@/components/admin/areas-painel";
import { ConfigPainel } from "@/components/admin/config-painel";
import { combinaBusca } from "@/lib/busca";

export const metadata: Metadata = { title: "Administração" };

type SP = { aba?: string; filtro?: string; q?: string; novo?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<SP> }) {
  const usuario = await requirePermissao("admin.usuarios");
  const sp = await searchParams;
  const aba = sp.aba === "areas" || sp.aba === "config" ? sp.aba : "usuarios";

  const abas = [
    { chave: "usuarios", label: "Usuários", href: "/admin" },
    { chave: "areas", label: "Áreas", href: "/admin?aba=areas" },
    { chave: "config", label: "Configurações", href: "/admin?aba=config" },
  ];

  let conteudo: React.ReactNode;
  if (aba === "usuarios") {
    const [todos, areas] = await Promise.all([listarUsuarios(usuario), listarAreas()]);
    const agora = new Date();
    const termo = (sp.q ?? "").trim().toLowerCase();
    const filtro = sp.filtro === "ATIVOS" || sp.filtro === "INATIVOS" ? sp.filtro : "TODOS";
    const buscados = termo ? todos.filter((u) => combinaBusca(`${u.nome} ${u.email} ${u.area?.nome ?? ""}`, termo)) : todos;
    const lista = buscados.filter((u) => filtro === "TODOS" || (filtro === "ATIVOS" ? u.ativo : !u.ativo));
    const params = { filtro: sp.filtro, q: sp.q };
    conteudo = (
      <>
        <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
          <BuscaUrl placeholder="Buscar por nome, e-mail ou área" />
          <Pills
            rotulo="Filtrar usuários"
            itens={[
              { label: "Todos", n: buscados.length, href: hrefCom("/admin", params, { filtro: null }), ativo: filtro === "TODOS" },
              { label: "Ativos", n: buscados.filter((u) => u.ativo).length, href: hrefCom("/admin", params, { filtro: "ATIVOS" }), ativo: filtro === "ATIVOS" },
              { label: "Inativos", n: buscados.filter((u) => !u.ativo).length, href: hrefCom("/admin", params, { filtro: "INATIVOS" }), ativo: filtro === "INATIVOS" },
            ]}
          />
        </div>
        <UsuariosPainel
          usuarios={lista.map((u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.area?.nome ?? null, ativo: u.ativo, ultimoAcesso: ultimoAcesso(u.ultimoAcessoEm, agora) }))}
          emails={todos.map((u) => ({ id: u.id, email: u.email.toLowerCase() }))}
          areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
          meuId={usuario.id}
          abrirNovo={sp.novo === "1"}
          vazio={todos.length === 0 ? "Nenhum usuário cadastrado" : "Nenhum usuário corresponde aos filtros"}
        />
      </>
    );
  } else if (aba === "areas") {
    const areas = await listarAreasComContagem(usuario);
    conteudo = <AreasPainel areas={areas} />;
  } else {
    const cfg = await obterConfig();
    conteudo = <ConfigPainel valores={cfg} />;
  }

  return (
    <>
      <PageHeader title="Administração" description="Usuários e perfis, áreas requisitantes e parâmetros do processo." />
      <TabsNav rotulo="Seções da administração" tabs={abas.map((t) => ({ href: t.href, label: t.label, ativo: aba === t.chave }))} />
      {conteudo}
    </>
  );
}
