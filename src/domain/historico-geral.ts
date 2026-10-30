/**
 * Regras da tela de histórico geral (log do sistema): categorias por entidade, rótulo legível da
 * ação, link para onde o registro aponta e diferença entre "antes" e "depois".
 */

export const CATEGORIAS_HISTORICO = {
  eventos: { rotulo: "Eventos e ata", entidades: ["evento", "evento_item"] },
  solicitacoes: { rotulo: "Solicitações", entidades: ["solicitacao", "solicitacao_item"] },
  biblioteca: { rotulo: "Biblioteca", entidades: ["projeto", "peca"] },
  arena: { rotulo: "Arena", entidades: ["arena"] },
  carga: { rotulo: "Carga e descarga", entidades: ["veiculo_carga"] },
  admin: { rotulo: "Administração", entidades: ["usuario", "area", "configuracao"] },
  acesso: { rotulo: "Acessos", entidades: ["acesso"] },
} as const;

export type CategoriaHistorico = keyof typeof CATEGORIAS_HISTORICO;
export const CATEGORIAS = Object.keys(CATEGORIAS_HISTORICO) as CategoriaHistorico[];

export function categoriaDe(entidade: string): CategoriaHistorico | null {
  for (const c of CATEGORIAS) if ((CATEGORIAS_HISTORICO[c].entidades as readonly string[]).includes(entidade)) return c;
  return null;
}

export function ehCategoria(v: string | undefined): v is CategoriaHistorico {
  return Boolean(v) && (CATEGORIAS as string[]).includes(v!);
}

export const PERIODOS_HISTORICO = { hoje: { rotulo: "Hoje", dias: 0 }, "7": { rotulo: "7 dias", dias: 6 }, "30": { rotulo: "30 dias", dias: 29 }, tudo: { rotulo: "Tudo", dias: null } } as const;
export type PeriodoHistorico = keyof typeof PERIODOS_HISTORICO;
/** Ordem das pílulas: `Object.keys` põe as chaves numéricas ("7", "30") antes de "hoje" (auditoria 30/10, parte D N17). */
export const ORDEM_PERIODOS: readonly PeriodoHistorico[] = ["hoje", "7", "30", "tudo"];
export function ehPeriodo(v: string | undefined): v is PeriodoHistorico {
  return Boolean(v) && v! in PERIODOS_HISTORICO;
}

const ROTULO_ACAO: Record<string, string> = {
  CRIADO: "Criado",
  CRIADA: "Criada",
  EDITADO: "Editado",
  EDITADA: "Editada",
  ALTERADA: "Alterada",
  INICIAR_REUNIAO: "Reunião iniciada",
  FECHAR_ATA: "Ata fechada",
  ENCERRAR: "Encerrado",
  CANCELAR: "Cancelado",
  CANCELADA: "Cancelada",
  REABRIR: "Reaberto",
  VOLTAR_PREPARACAO: "Voltou à preparação",
  REUNIAO_REMARCADA: "Reunião remarcada",
  OS_ENVIADA: "OS enviada",
  RASCUNHO_CRIADO: "Rascunho criado",
  ENVIADA: "Enviada",
  DEVOLVIDA: "Devolvida",
  RESPONDIDO: "Respondido",
  RESPOSTA_CORRIGIDA: "Resposta corrigida",
  RESPOSTA_DESFEITA: "Resposta desfeita",
  REGISTRADO_NA_ATA: "Registrado na ata",
  ENTROU_NA_OS: "Entrou direto na OS",
  CONFERIDO: "Conferido",
  CONFERENCIA_DESFEITA: "Conferência desfeita",
  CONFERENCIA_AJUSTE: "Ajuste na reunião",
  ATA_INCLUSAO: "Incluído na ata",
  AJUSTE_INCLUSAO: "Incluído na OS",
  ATA_QUANTIDADE: "Quantidade ajustada",
  ATA_REMOCAO: "Retirado da ata",
  PECA_PROJETO_AJUSTADA: "Peça do projeto ajustada",
  ITEM_VINCULADO: "Vinculado ao catálogo",
  ATUALIZACAO_VERSAO: "Versão atualizada",
  ADICIONAR: "Adicionado",
  REMOVER: "Removido",
  ALTERAR_QUANTIDADE: "Quantidade alterada",
  ANEXO_ADICIONADO: "Anexo adicionado",
  ANEXO_REMOVIDO: "Anexo removido",
  LINK_ACESSO_GERADO: "Link de acesso gerado",
  SENHA_DEFINIDA: "Senha definida",
  SENHA_ALTERADA: "Senha alterada",
  PENDENCIA_RESOLVIDA: "Pendência resolvida",
  LOGIN: "Entrou no sistema",
  LOGIN_FALHA: "Falha de login",
  ARENA_CRIADA: "Arena criada",
  ARENA_EXCLUIDA: "Arena excluída",
  ARENA_PLANTA_TROCADA: "Planta trocada",
  ARENA_ENTORNO_IMPORTADO: "Entorno 3D importado",
  CARGA_VEICULO_CRIADO: "Veículo de carga cadastrado",
  CARGA_VEICULO_EDITADO: "Veículo de carga editado",
  CARGA_VEICULO_DUPLICADO: "Veículo de carga duplicado",
  CARGA_VEICULO_EXCLUIDO: "Veículo de carga excluído",
  ARENA_ENTORNO_REMOVIDO: "Entorno 3D removido",
  ARENA_PLANTA_REMOVIDA: "Planta removida",
  ARENA_PLANTA_RESTAURADA: "Planta restaurada",
  ARENA_POSICAO_DESFEITA: "Posição desfeita",
  DESCRICAO_EDITADA: "Descrição alterada",
  REGRA_KIT: "Regra da logística",
  DESATIVADO: "Desativado",
};

/** "ATA_QUANTIDADE" → "Quantidade ajustada"; ação desconhecida vira texto legível. */
export function rotuloAcao(acao: string): string {
  if (ROTULO_ACAO[acao]) return ROTULO_ACAO[acao];
  const t = acao.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Para onde o registro aponta no app (null quando não há página). */
export function hrefHistorico(h: { entidade: string; entidadeId: string; eventoId: string | null; solicitacaoId?: string | null }): string | null {
  switch (h.entidade) {
    case "evento":
      return `/eventos/${h.entidadeId}`;
    case "evento_item":
      return h.eventoId ? `/eventos/${h.eventoId}/itens/${h.entidadeId}` : null;
    case "solicitacao":
      return `/solicitacoes/${h.entidadeId}`;
    case "solicitacao_item":
      return h.solicitacaoId ? `/solicitacoes/${h.solicitacaoId}` : null;
    case "projeto":
      return `/projetos/${h.entidadeId}`;
    case "peca":
      return `/catalogo/${h.entidadeId}`;
    case "usuario":
      return "/admin";
    case "area":
      return "/admin?aba=areas";
    case "configuracao":
      return "/admin?aba=config";
    case "arena":
      return "/arena";
    case "veiculo_carga":
      return h.eventoId ? `/eventos/${h.eventoId}/carga` : "/carga-descarga";
    default:
      return null;
  }
}

export type Diferenca = { campo: string; antes: string | null; depois: string | null };

const cortar = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s);

/** Valor simples em texto; objeto e lista viram "campo: valor · …" em vez de JSON cru. */
const simples = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) {
    const partes = v.map(simples).filter((x): x is string => x !== null);
    return partes.length ? partes.join(", ") : null;
  }
  if (typeof v === "object") {
    // Ida/volta do veículo de carga e afins: só os campos preenchidos (auditoria 30/10, parte D N18).
    const partes = Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => [k, simples(x)] as const)
      .filter(([, x]) => x !== null)
      .map(([k, x]) => `${k}: ${x}`);
    return partes.length ? partes.join(" · ") : null;
  }
  return String(v);
};

const texto = (v: unknown): string | null => {
  const s = simples(v);
  return s === null ? null : cortar(s);
};

/**
 * Campos que mudaram entre "antes" e "depois" (só os diferentes). Sem "antes", lista o que foi
 * gravado; limita a 12 campos para a tabela não virar um despejo de JSON.
 */
export function diferencas(antes: unknown, depois: unknown): Diferenca[] {
  const a = antes && typeof antes === "object" && !Array.isArray(antes) ? (antes as Record<string, unknown>) : null;
  const d = depois && typeof depois === "object" && !Array.isArray(depois) ? (depois as Record<string, unknown>) : null;
  if (!a && !d) return [];
  const campos = [...new Set([...Object.keys(a ?? {}), ...Object.keys(d ?? {})])];
  const out: Diferenca[] = [];
  for (const campo of campos) {
    const va = texto(a?.[campo]);
    const vd = texto(d?.[campo]);
    if (va === vd) continue;
    out.push({ campo, antes: va, depois: vd });
    if (out.length >= 12) break;
  }
  return out;
}
