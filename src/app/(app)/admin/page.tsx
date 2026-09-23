import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { listarAreasComContagem, listarUsuarios, obterConfig } from "@/server/services/admin";
import { ultimoAcesso } from "@/lib/format";
import { TabsNav } from "@/components/ui/tabs-nav";
import { hrefCom } from "@/lib/url";
import { PageHeader } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { BuscaUrl } from "@/components/ui/busca-url";
import { Paginacao } from "@/components/ui/tabela";
import { UsuariosPainel } from "@/components/admin/usuarios-painel";
import { AreasPainel } from "@/components/admin/areas-painel";
import { ConfigPainel } from "@/components/admin/config-painel";
import { BotaoNovo } from "@/components/admin/novo-via-url";
import { combinaBusca } from "@/lib/busca";
import { listarAreasCache } from "@/server/cache";

export const metadata: Metadata = { title: "Administração" };

type SP = { aba?: string; filtro?: string; q?: string; pagina?: string };

const POR_PAGINA = 25;

/** Situação como aba: "Todos" é a porta de entrada, ativos/inativos são recortes dela. */
type Situacao = "ATIVOS" | "INATIVOS" | "TODOS";
const SITUACOES: Situacao[] = ["ATIVOS", "INATIVOS", "TODOS"];

function situacaoDe(filtro: string | undefined): Situacao {
  return filtro === "ATIVOS" || filtro === "INATIVOS" ? filtro : "TODOS";
}

function naSituacao(ativo: boolean, s: Situacao) {
  return s === "TODOS" || (s === "ATIVOS" ? ativo : !ativo);
}

/** Lista inteira já veio do banco (cadastros pequenos): pagina na memória. */
function paginar<T>(lista: T[], paginaTxt: string | undefined) {
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(paginas, Math.max(1, Number.parseInt(paginaTxt ?? "1", 10) || 1));
  const de = (pagina - 1) * POR_PAGINA;
  return { itens: lista.slice(de, de + POR_PAGINA), total, pagina, paginas, de, porPagina: POR_PAGINA };
}

const CARTAO = "overflow-hidden rounded-cartao border border-line bg-surface";

export default async function AdminPage({ searchParams }: { searchParams: Promise<SP> }) {
  const usuario = await requirePermissao("admin.usuarios");
  const sp = await searchParams;
  const aba = sp.aba === "areas" || sp.aba === "config" ? sp.aba : "usuarios";

  const secoes = [
    { chave: "usuarios", label: "Usuários", href: "/admin" },
    { chave: "areas", label: "Áreas", href: "/admin?aba=areas" },
    { chave: "config", label: "Configurações", href: "/admin?aba=config" },
  ];

  const termo = (sp.q ?? "").trim().slice(0, 80);
  const situacao = situacaoDe(sp.filtro);
  const params = { aba: aba === "usuarios" ? undefined : aba, filtro: sp.filtro, q: sp.q, pagina: sp.pagina };
  const abaSituacao = (s: Situacao, rotulos: Record<Situacao, string>, n: number) => ({ href: hrefCom("/admin", params, { filtro: s === "TODOS" ? null : s, pagina: null }), label: rotulos[s], n, ativo: situacao === s });
  const hrefPagina = (p: number) => hrefCom("/admin", params, { pagina: p === 1 ? null : p });

  let conteudo: React.ReactNode;
  let acao: React.ReactNode = null;
  let busca: React.ReactNode = null;
  if (aba === "usuarios") {
    const [todos, areas] = await Promise.all([listarUsuarios(usuario), listarAreasCache()]);
    const agora = new Date();
    const buscados = termo ? todos.filter((u) => combinaBusca(`${u.nome} ${u.email} ${u.area?.nome ?? ""}`, termo)) : todos;
    const pag = paginar(
      buscados.filter((u) => naSituacao(u.ativo, situacao)),
      sp.pagina,
    );
    const rotulos = { ATIVOS: "Ativos", INATIVOS: "Inativos", TODOS: "Todos" };
    acao = <BotaoNovo>Novo usuário</BotaoNovo>;
    busca = <BuscaUrl key="usuarios" placeholder="Buscar por nome, e-mail ou área" ariaLabel="Buscar usuário por nome, e-mail ou área" />;
    conteudo = (
      <div className={CARTAO}>
        <TabsNav rotulo="Situação dos usuários" className="mb-0 px-2 pt-1" tabs={SITUACOES.map((s) => abaSituacao(s, rotulos, buscados.filter((u) => naSituacao(u.ativo, s)).length))} />
        <UsuariosPainel
          usuarios={pag.itens.map((u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.area?.nome ?? null, ativo: u.ativo, ultimoAcesso: ultimoAcesso(u.ultimoAcessoEm, agora) }))}
          emails={todos.map((u) => ({ id: u.id, email: u.email.toLowerCase() }))}
          areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
          meuId={usuario.id}
          vazio={
            todos.length === 0
              ? { titulo: "Nenhum usuário cadastrado", descricao: "Crie o primeiro acesso em “Novo usuário”." }
              : termo
                ? { titulo: `Nada encontrado para “${termo}”`, descricao: "Confira a grafia ou busque pelo e-mail." }
                : { titulo: situacao === "INATIVOS" ? "Nenhum usuário inativo" : "Nenhum usuário ativo" }
          }
        />
        <Paginacao {...pag} hrefPagina={hrefPagina} />
      </div>
    );
  } else if (aba === "areas") {
    const areas = await listarAreasComContagem(usuario);
    const buscadas = termo ? areas.filter((a) => combinaBusca(a.nome, termo)) : areas;
    const pag = paginar(
      buscadas.filter((a) => naSituacao(a.ativo, situacao)),
      sp.pagina,
    );
    const rotulos = { ATIVOS: "Ativas", INATIVOS: "Inativas", TODOS: "Todas" };
    acao = <BotaoNovo>Nova área</BotaoNovo>;
    busca = (
      <>
        <BuscaUrl key="areas" placeholder="Buscar área" ariaLabel="Buscar área pelo nome" />
        <span className="text-pequeno text-muted sm:ml-auto">Cadastro fixo: todas as áreas ativas participam de qualquer evento.</span>
      </>
    );
    conteudo = (
      <div className={CARTAO}>
        <TabsNav rotulo="Situação das áreas" className="mb-0 px-2 pt-1" tabs={SITUACOES.map((s) => abaSituacao(s, rotulos, buscadas.filter((a) => naSituacao(a.ativo, s)).length))} />
        <AreasPainel
          areas={pag.itens}
          vazio={
            areas.length === 0
              ? { titulo: "Nenhuma área cadastrada", descricao: "Todas as áreas ativas participam de qualquer evento." }
              : termo
                ? { titulo: `Nada encontrado para “${termo}”`, descricao: "Confira a grafia do nome da área." }
                : { titulo: situacao === "INATIVOS" ? "Nenhuma área inativa" : "Nenhuma área ativa" }
          }
        />
        <Paginacao {...pag} hrefPagina={hrefPagina} />
      </div>
    );
  } else {
    const cfg = await obterConfig();
    conteudo = <ConfigPainel valores={cfg} />;
  }

  return (
    <>
      <PageHeader title="Administração" divisor actions={acao} />

      {/* Barra compacta (template de pedidos): seção da administração e busca na mesma linha. */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <Pills rotulo="Seções da administração" itens={secoes.map((t) => ({ href: t.href, label: t.label, ativo: aba === t.chave }))} />
        {busca}
      </div>

      {conteudo}
    </>
  );
}
