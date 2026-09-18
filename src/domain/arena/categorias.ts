import type { CategoriaPonto, PontoArena, TipoZona } from "./tipos";

/** Camadas que o usuário liga e desliga no mapa. Cada uma responde a uma pergunta de planejamento. */
export type Camada = "percurso" | "estruturas" | "apoio" | "patrocinio" | "zonas" | "publico" | "fluxo" | "rotulos" | "local";

export const CAMADAS: Array<{ id: Camada; rotulo: string; descricao: string; padrao: boolean }> = [
  { id: "percurso", rotulo: "Percurso", descricao: "Traçado, cones e sinalização", padrao: true },
  { id: "estruturas", rotulo: "Estruturas", descricao: "Pórticos, palco, cenografia e operação", padrao: true },
  { id: "apoio", rotulo: "Apoio ao atleta", descricao: "Hidratação, médico, GV e dispersão", padrao: true },
  { id: "patrocinio", rotulo: "Patrocinadores", descricao: "Estandes e tendas de buffet", padrao: true },
  { id: "zonas", rotulo: "Áreas", descricao: "Arena, curral, apoio e acesso restrito", padrao: true },
  { id: "publico", rotulo: "Público", descricao: "Representação do público nas grades", padrao: true },
  { id: "local", rotulo: "Obstáculos do local", descricao: "Árvore, bueiro, poste, desnível: o que atrapalha a montagem", padrao: true },
  { id: "fluxo", rotulo: "Fluxo de corredores", descricao: "Animação ilustrativa do sentido da prova", padrao: false },
  { id: "rotulos", rotulo: "Rótulos", descricao: "Nomes dos pontos principais", padrao: true },
];

/** Camadas agrupadas por pergunta de planejamento: conteúdo do mapa separado de preferência de exibição. */
export const GRUPOS_CAMADAS: Array<{ titulo: string; camadas: Camada[] }> = [
  { titulo: "O que vai ser montado", camadas: ["estruturas", "apoio", "patrocinio"] },
  { titulo: "Como a prova acontece", camadas: ["percurso", "zonas", "publico", "fluxo"] },
  { titulo: "O que já existe no local", camadas: ["local"] },
  { titulo: "Exibição", camadas: ["rotulos"] },
];

export const camadasPadrao = () => Object.fromEntries(CAMADAS.map((c) => [c.id, c.padrao])) as Record<Camada, boolean>;
export const camadasTudo = () => Object.fromEntries(CAMADAS.map((c) => [c.id, true])) as Record<Camada, boolean>;
/** Configuração de quem confere implantação, não apresenta: padrões sem o público. */
export const camadasEssenciais = () => Object.fromEntries(CAMADAS.map((c) => [c.id, c.padrao && c.id !== "publico"])) as Record<Camada, boolean>;

/** Cores sóbrias derivadas da paleta do app; nada de neon. */
export const CATEGORIAS: Record<CategoriaPonto, { rotulo: string; cor: string; camada: Camada }> = {
  largada: { rotulo: "Largada e chegada", cor: "#2a1418", camada: "estruturas" },
  estrutura: { rotulo: "Palco e som", cor: "#4f4849", camada: "estruturas" },
  cenografia: { rotulo: "Cenografia", cor: "#565b7c", camada: "estruturas" },
  operacao: { rotulo: "Operação", cor: "#6d6566", camada: "estruturas" },
  atleta: { rotulo: "Apoio ao atleta", cor: "#136c41", camada: "apoio" },
  medico: { rotulo: "Atendimento médico", cor: "#a8400f", camada: "apoio" },
  hidratacao: { rotulo: "Hidratação", cor: "#2f6680", camada: "apoio" },
  patrocinio: { rotulo: "Patrocinadores", cor: "#7a5f00", camada: "patrocinio" },
  // Marcações do próprio terreno (não entram na OS): árvore, bueiro, poste, desnível.
  obstaculo: { rotulo: "Obstáculo do local", cor: "#5f6b4f", camada: "local" },
};

export const ZONA_VISUAL: Record<TipoZona, { rotulo: string; cor: string }> = {
  arena: { rotulo: "Arena", cor: "#ddd5c8" },
  // Cinza-quente neutro: o rosa da marca em superfície grande sobre o gramado lia como erro de impressão.
  atletas: { rotulo: "Área de atletas", cor: "#dcd2cc" },
  apoio: { rotulo: "Área de apoio", cor: "#e6dfcf" },
  restrita: { rotulo: "Acesso restrito", cor: "#a8400f" },
  parque: { rotulo: "Parque", cor: "#a3ab90" },
  agua: { rotulo: "Lago", cor: "#8da3a6" },
};

export const COR_PERCURSO = "#8e2740";

/**
 * Forma simples com que um item acrescentado no mapa aparece no 3D e na planta, deduzida do nome
 * (a logística escreve "Árvore", "Poste torto", "Grade / barreira"...). "marcador" é o genérico.
 */
export type FormaItem = "arvore" | "bueiro" | "poste" | "rampa" | "grade" | "tenda" | "banheiro" | "energia" | "marcador";

const FORMAS_POR_NOME: Array<[RegExp, FormaItem]> = [
  [/\b(arvore|arbusto|galho|palmeira)/, "arvore"],
  [/\b(bueiro|boca de lobo|grelha|tampa)/, "bueiro"],
  [/\b(poste|luminaria|holofote)/, "poste"],
  [/\b(desnivel|rampa|degrau|buraco|lombada)/, "rampa"],
  [/\b(grade|gradil|barreira|cerca|alambrado)/, "grade"],
  [/\btenda/, "tenda"],
  [/\b(banheiro|sanitario)/, "banheiro"],
  [/\b(energia|tomada|quadro de luz|gerador)/, "energia"],
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function formaPeloNome(nome: string): FormaItem | null {
  const n = semAcento(nome);
  return FORMAS_POR_NOME.find(([re]) => re.test(n))?.[1] ?? null;
}

/**
 * Só pontos acrescentados na edição e sem modelo da planta ganham forma genérica. Item livre ou
 * obstáculo sem nome conhecido vira marcador; item da ata sem forma conhecida continua só com o pino.
 */
export function formaDoPonto(p: Pick<PontoArena, "id" | "nome" | "categoria" | "modelos">): FormaItem | null {
  if (p.modelos.length > 0 || !p.id.startsWith("novo:")) return null;
  return formaPeloNome(p.nome) ?? (p.categoria === "obstaculo" || p.id.startsWith("novo:livre:") ? "marcador" : null);
}

/** Quem ganha o espaço quando dois rótulos disputam o mesmo lugar no mapa. */
export const PRIORIDADE_ROTULO = { selecionado: 4, foco: 3, principal: 2, comum: 1 } as const;

export function prioridadeRotulo(o: { selecionado?: boolean; foco?: boolean; principal?: boolean }): number {
  if (o.selecionado) return PRIORIDADE_ROTULO.selecionado;
  if (o.foco) return PRIORIDADE_ROTULO.foco;
  return o.principal ? PRIORIDADE_ROTULO.principal : PRIORIDADE_ROTULO.comum;
}

/** Retângulo na tela (px no 3D, unidades do SVG na planta). */
export type CaixaTela = { id: string; x0: number; y0: number; x1: number; y1: number };
/** `desempate`: menor ganha (no 3D, a profundidade: o mais perto da câmera). */
export type CaixaRotulo = CaixaTela & { prioridade: number; desempate?: number };

const cruza = (a: CaixaTela, b: CaixaTela, mx: number, my: number) => a.x0 - mx < b.x1 && a.x1 + mx > b.x0 && a.y0 - my < b.y1 && a.y1 + my > b.y0;

/**
 * Escolhe os rótulos que aparecem sem nunca se sobrepor: por prioridade, cada rótulo só entra se
 * tiver folga dos já aceitos e não cobrir o pino de outro ponto. O selecionado entra sempre (os
 * demais é que desviam dele).
 */
export function rotulosSemSobreposicao(rotulos: CaixaRotulo[], pinos: CaixaTela[] = [], margem = 6): Set<string> {
  const ordem = [...rotulos].sort((a, b) => b.prioridade - a.prioridade || (a.desempate ?? 0) - (b.desempate ?? 0));
  const aceitos: CaixaRotulo[] = [];
  for (const r of ordem) {
    const obrigatorio = r.prioridade >= PRIORIDADE_ROTULO.selecionado;
    if (!obrigatorio && (aceitos.some((o) => cruza(r, o, margem, margem / 2)) || pinos.some((p) => p.id !== r.id && cruza(r, p, 0, 0)))) continue;
    aceitos.push(r);
  }
  return new Set(aceitos.map((r) => r.id));
}
