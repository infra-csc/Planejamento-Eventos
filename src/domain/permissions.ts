import type { Perfil } from "@/server/db/schema";
import { PERFIS } from "@/domain/constantes";

/**
 * Matriz Perfil × Ação (ver docs/01-analise-e-especificacao.md §4.2).
 * Ações são verificadas no servidor em toda leitura/mutação — a UI só as usa para
 * decidir o que mostrar.
 */
export const ACOES = [
  "evento.ver",
  "evento.criar",
  "evento.editar",
  "evento.transicionar", // iniciar reunião, voltar, fechar ata, encerrar, cancelar
  "evento.reabrir",
  "ata.consolidar",
  "ata.ajustar",
  "solicitacao.criar",
  "solicitacao.ver_todas",
  "solicitacao.responder",
  "os.ver",
  "os.exportar",
  "catalogo.ver",
  "catalogo.gerenciar",
  "projeto.ver",
  "projeto.gerenciar",
  "consolidacao.ver",
  "pendencias.ver",
  "pendencias.resolver", // marcar pendência de compra/locação como resolvida
  "arena.ver",
  "historico.ver_tudo",
  "admin.usuarios",
  "admin.areas",
  "admin.configuracoes",
] as const;

export type Acao = (typeof ACOES)[number];

// Fonte única da lista de perfis: `constantes.ts` (também usada pelo enum do banco). Reexportada aqui
// para quem já importava `PERFIS` de permissions.
export { PERFIS };
const TODOS: Perfil[] = [...PERFIS];
const REQUISITANTES: Perfil[] = ["REQUISITANTE", "CENOGRAFIA"];

/**
 * O Administrador tem acesso total: toda ação da matriz inclui ADMIN. Ele age em nome de qualquer
 * perfil (responde, fecha ata, reabre, cria solicitação escolhendo a área) e fica registrado no
 * histórico com o próprio nome.
 */
const MATRIZ: Record<Acao, readonly Perfil[]> = {
  "evento.ver": TODOS,
  "evento.criar": ["LOGISTICA", "ADMIN"],
  "evento.editar": ["LOGISTICA", "ADMIN"],
  "evento.transicionar": ["LOGISTICA", "ADMIN"],
  "evento.reabrir": ["GESTAO", "ADMIN"],
  "ata.consolidar": ["LOGISTICA", "ADMIN"],
  "ata.ajustar": ["LOGISTICA", "ADMIN"],
  "solicitacao.criar": [...REQUISITANTES, "ADMIN"],
  "solicitacao.ver_todas": ["LOGISTICA", "GESTAO", "ADMIN"],
  "solicitacao.responder": ["LOGISTICA", "ADMIN"],
  // Todo mundo que participa do evento vê e exporta a OS; só a logística ajusta e envia.
  "os.ver": TODOS,
  "os.exportar": TODOS,
  "catalogo.ver": TODOS,
  "catalogo.gerenciar": ["LOGISTICA", "CENOGRAFIA", "ADMIN"],
  "projeto.ver": TODOS,
  "projeto.gerenciar": ["CENOGRAFIA", "ADMIN"],
  // Por enquanto só o administrador: demanda de peças e arena 3D ainda em validação.
  "consolidacao.ver": ["ADMIN"],
  "arena.ver": ["ADMIN"],
  "pendencias.ver": ["LOGISTICA", "GESTAO", "ADMIN"],
  "pendencias.resolver": ["LOGISTICA", "ADMIN"],
  "historico.ver_tudo": ["LOGISTICA", "GESTAO", "ADMIN"],
  "admin.usuarios": ["ADMIN"],
  "admin.areas": ["ADMIN"],
  "admin.configuracoes": ["ADMIN"],
};

export type UsuarioPermissao = { perfil: Perfil; areaId: string | null };

export function pode(usuario: UsuarioPermissao, acao: Acao): boolean {
  return MATRIZ[acao].includes(usuario.perfil);
}

/** Requisitantes e Cenografia só enxergam solicitações da própria área. */
export function podeVerSolicitacao(usuario: UsuarioPermissao, solicitacao: { areaId: string; status?: string }): boolean {
  if (usuario.areaId !== null && usuario.areaId === solicitacao.areaId) return true;
  // Quem vê todas as áreas ainda não vê rascunho não enviado (só o administrador, que edita qualquer um).
  if (pode(usuario, "solicitacao.ver_todas")) return solicitacao.status !== "RASCUNHO" || usuario.perfil === "ADMIN";
  return false;
}

/** Rascunhos pertencem à área (RV-07): qualquer usuário da mesma área pode editar e enviar. O Administrador edita os de qualquer área. */
export function podeEditarSolicitacao(usuario: UsuarioPermissao, solicitacao: { areaId: string }): boolean {
  if (!pode(usuario, "solicitacao.criar")) return false;
  return usuario.perfil === "ADMIN" || usuario.areaId === solicitacao.areaId;
}

export function ehRequisitante(perfil: Perfil): boolean {
  return REQUISITANTES.includes(perfil);
}

export const PERFIL_LABEL: Record<Perfil, string> = {
  REQUISITANTE: "Requisitante",
  CENOGRAFIA: "Cenografia",
  LOGISTICA: "Logística",
  GESTAO: "Gestão",
  ADMIN: "Administrador",
};

/** Perfis que pertencem a uma área (o formulário de usuário exige a área). */
export function perfilUsaArea(perfil: Perfil): boolean {
  return perfil === "REQUISITANTE" || perfil === "CENOGRAFIA" || perfil === "LOGISTICA";
}

export const PERFIL_DESCRICAO: Record<Perfil, string> = {
  REQUISITANTE: "Envia necessidades e alterações da própria área. Vê apenas o que a área enviou.",
  CENOGRAFIA: "Além de solicitar, mantém os projetos padrão e o catálogo de peças.",
  LOGISTICA: "Conduz a reunião, responde item a item, fecha a ata e gera a OS.",
  GESTAO: "Acompanha todos os eventos e é o único perfil que reabre um evento encerrado.",
  ADMIN: "Acesso total: gerencia usuários, áreas e configurações e pode executar qualquer ação dos outros perfis.",
};
