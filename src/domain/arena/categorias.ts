import type { CategoriaPonto, TipoZona } from "./tipos";

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
