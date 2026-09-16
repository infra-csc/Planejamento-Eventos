/**
 * Catálogo real de peças e projetos padrão, extraído das OS de estrutura, das atas de reunião
 * (planilhas) e dos detalhamentos TTK/Norte (modulação Q30) dos eventos de 2026:
 * Eco Run SP, Circuito das Estações Campinas, Blue Run RJ, Longevidade Bradesco (Campinas e
 * Salvador), Desafio Energia Petrobras Bike SP, Santander Night Run Campo Grande, Bravus Race RJ
 * e Circuito BB Natal.
 *
 * Importado por `npm run importar:catalogo` (idempotente: peças por código, projetos por nome).
 */
import type { Setor } from "../../src/server/db/schema";

export type PecaCatalogo = {
  codigo: string;
  nome: string;
  setor: Setor;
  familia: string;
  unidade?: string;
  estoque?: number;
  permiteEmProjeto?: boolean;
  descricao?: string;
};

export type ProjetoCatalogo = {
  nome: string;
  categoria: string;
  descricao: string | null;
  /** [código da peça, quantidade por projeto] */
  itens: Array<[string, number]>;
  /** Arquivos em scripts/dados/imagens (renders e modulações TTK), anexados ao projeto na importação. */
  imagens?: string[];
};

const E = "ESTRUTURA" as const;
const T = "TENDA" as const;
const M = "MARCENARIA" as const;
const A = "ARENA" as const;

export const PECAS: PecaCatalogo[] = [
  // ---- Box truss Q30 (treliça 30 cm), por comprimento -------------------------------------
  { codigo: "BOX-300", nome: "Box truss Q30 — trecho 300 mm", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-400", nome: "Box truss Q30 — trecho 400 mm", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-500", nome: "Box truss Q30 — trecho 500 mm", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-600", nome: "Box truss Q30 — trecho 600 mm", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-700", nome: "Box truss Q30 — trecho 700 mm", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-1000", nome: "Box truss Q30 — trecho 1 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-1300", nome: "Box truss Q30 — trecho 1,3 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-2000", nome: "Box truss Q30 — trecho 2 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-2500", nome: "Box truss Q30 — trecho 2,5 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-3000", nome: "Box truss Q30 — trecho 3 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-3500", nome: "Box truss Q30 — trecho 3,5 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-4000", nome: "Box truss Q30 — trecho 4 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-5000", nome: "Box truss Q30 — trecho 5 m", setor: E, familia: "Box truss Q30" },
  { codigo: "BOX-6000", nome: "Box truss Q30 — trecho 6 m", setor: E, familia: "Box truss Q30" },
  { codigo: "CUBO", nome: "Cubo de conexão Q30 (4 faces)", setor: E, familia: "Conexão Q30" },
  { codigo: "CUBO-5F", nome: "Cubo de conexão Q30 (5 faces)", setor: E, familia: "Conexão Q30" },
  { codigo: "ANG-15", nome: "Ângulo 15° Q30", setor: E, familia: "Conexão Q30" },
  { codigo: "ANG-45", nome: "Ângulo 45° Q30", setor: E, familia: "Conexão Q30" },
  { codigo: "GRAPPLE", nome: "Grapple (esticador de cabo)", setor: E, familia: "Conexão Q30" },
  { codigo: "SAPATA", nome: "Sapata de base", setor: E, familia: "Base" },
  { codigo: "PARAF", nome: "Parafuso com porca e arruela (box truss)", setor: E, familia: "Fixação" },
  { codigo: "CALCO", nome: "Caixa de calços de estrutura", setor: E, familia: "Fixação", unidade: "caixa" },
  // ---- Box truss Q15 (treliça 15 cm) ----------------------------------------------------------
  { codigo: "Q15-2000", nome: "Box truss Q15 — trecho 2 m", setor: E, familia: "Box truss Q15" },
  { codigo: "Q15-CUBO", nome: "Cubo de conexão Q15", setor: E, familia: "Box truss Q15" },
  // ---- Praticáveis e acessórios de palco -----------------------------------------------------
  { codigo: "PRAT-2X1", nome: "Plataforma telescópica (praticável) 2×1 m", setor: E, familia: "Praticável" },
  { codigo: "PRAT-1X1", nome: "Plataforma telescópica (praticável) 1×1 m", setor: E, familia: "Praticável" },
  { codigo: "PE-100", nome: "Pé de praticável 1 m", setor: E, familia: "Praticável" },
  { codigo: "PE-DUPLO-100", nome: "Pé duplo de rampa 1 m", setor: E, familia: "Praticável" },
  { codigo: "PE-058", nome: "Pé de rampa 0,58 m", setor: E, familia: "Praticável" },
  { codigo: "PE-054", nome: "Pé de rampa 0,54 m", setor: E, familia: "Praticável" },
  { codigo: "GC-2X1", nome: "Guarda-corpo de rampa 2×1 m", setor: E, familia: "Praticável" },
  { codigo: "GC-1X1", nome: "Guarda-corpo de rampa 1×1 m", setor: E, familia: "Praticável" },
  { codigo: "PLACA-LED", nome: "Placa de LED 1,00×0,50 m", setor: E, familia: "LED" },
  { codigo: "GLOBO-1M", nome: "Globo espelhado 1 m", setor: E, familia: "Cenário" },
  { codigo: "TINA-500", nome: "Tina / caixa d'água 500 l (contrapeso)", setor: E, familia: "Base" },
  { codigo: "PALLET-PL", nome: "Pallet plástico", setor: E, familia: "Base" },
  { codigo: "PALLET-FE", nome: "Pallet de ferro", setor: E, familia: "Base" },
  { codigo: "KIT-ATERR", nome: "Kit de aterramento", setor: E, familia: "Elétrica" },
  { codigo: "GARFO", nome: "Garfo de içamento", setor: E, familia: "Içamento" },
  // ---- Estaiamento --------------------------------------------------------------------------
  { codigo: "ESTACA", nome: "Estaca de estaiamento", setor: E, familia: "Estaiamento" },
  { codigo: "CORDA", nome: "Corda de estaiamento", setor: E, familia: "Estaiamento" },
  { codigo: "MALOTE", nome: "Malote de areia (contrapeso)", setor: E, familia: "Estaiamento" },
  { codigo: "GANCHO-MALOTE", nome: "Gancho para malote", setor: E, familia: "Estaiamento" },
  // ---- Tendas 5×5 ---------------------------------------------------------------------------
  { codigo: "TND5-CANT", nome: "Cantoneira de tenda 5×5", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-TRAV", nome: "Travessa de tenda 5 m", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-PE", nome: "Pé de tenda 5×5", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-MASTRO", nome: "Mastro central de tenda 5×5", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-CABO", nome: "Cabo de tenda 5×5", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-LONA", nome: "Lona de cobertura 5×5", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-FECH", nome: "Fechamento lateral de tenda 5 m", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-CALHA", nome: "Calha de lona 5 m (união de tendas)", setor: T, familia: "Tenda 5×5" },
  { codigo: "TND5-TESTEIRA", nome: "Testeira de madeira para tenda 5×5", setor: M, familia: "Tenda 5×5" },
  // ---- Tendas 3×3 ---------------------------------------------------------------------------
  { codigo: "TND3-CANT", nome: "Cantoneira de tenda 3×3", setor: T, familia: "Tenda 3×3" },
  { codigo: "TND3-TRAV", nome: "Travessa de tenda 3 m", setor: T, familia: "Tenda 3×3" },
  { codigo: "TND3-PE", nome: "Pé de tenda 3×3", setor: T, familia: "Tenda 3×3" },
  { codigo: "TND3-MASTRO", nome: "Mastro central de tenda 3×3", setor: T, familia: "Tenda 3×3" },
  { codigo: "TND3-CABO", nome: "Cabo de tenda 3×3", setor: T, familia: "Tenda 3×3" },
  { codigo: "TND3-LONA", nome: "Lona de cobertura 3×3", setor: T, familia: "Tenda 3×3" },
  { codigo: "TND3-FECH", nome: "Fechamento lateral de tenda 3 m", setor: T, familia: "Tenda 3×3" },
  { codigo: "LONA-9X6", nome: "Lona de cobertura de estande 9×6", setor: T, familia: "Estande" },
  // ---- Marcenaria: estandes ------------------------------------------------------------------
  { codigo: "COL-FRONTAL", nome: "Coluna frontal de estande (normal)", setor: M, familia: "Estande" },
  { codigo: "TAMPA-COL", nome: "Tampa de coluna frontal", setor: M, familia: "Estande" },
  { codigo: "COL-TRAS", nome: "Coluna traseira de estande (normal)", setor: M, familia: "Estande" },
  { codigo: "ANJO-TESTEIRA", nome: "Anjo da guarda de testeira", setor: M, familia: "Estande" },
  { codigo: "TESTEIRA-9M", nome: "Testeira de estande 9 m", setor: M, familia: "Estande" },
  { codigo: "SAIA-STAND", nome: "Saia de estande", setor: M, familia: "Estande" },
  { codigo: "BALCAO-120", nome: "Balcão de madeira 1,20×1,00 m", setor: M, familia: "Mobiliário" },
  { codigo: "BANCADA-210", nome: "Bancada de madeira 2,10×1,00 m", setor: M, familia: "Mobiliário" },
  { codigo: "MESA-1X1", nome: "Mesa 1×1 m (medalhas)", setor: M, familia: "Mobiliário" },
  { codigo: "PRANCHAO-210", nome: "Pranchão de madeira 2,10×1,00 m", setor: M, familia: "Mobiliário" },
  // ---- Marcenaria: palco ---------------------------------------------------------------------
  { codigo: "SAIA-PALCO-4M", nome: "Saia de palco 4 m", setor: M, familia: "Palco" },
  { codigo: "SAIA-PALCO-416", nome: "Saia de palco 4,16 m", setor: M, familia: "Palco" },
  { codigo: "SAIA-PALCO-1M", nome: "Saia de palco 1 m", setor: M, familia: "Palco" },
  { codigo: "ESCADA-1M", nome: "Escada de palco 1 m", setor: M, familia: "Palco" },
  { codigo: "ACAB-RAMPA", nome: "Acabamento de madeira de rampa", setor: M, familia: "Palco" },
  { codigo: "PODIO-1A3", nome: "Pódio — conjunto 1º a 3º", setor: M, familia: "Palco" },
  { codigo: "BACKDROP-PALCO", nome: "Backdrop de palco (estrutura de madeira)", setor: M, familia: "Palco" },
  { codigo: "APLIQUE-BACKDROP", nome: "Aplique de backdrop de palco", setor: M, familia: "Palco" },
  { codigo: "RAMPA-ACESS", nome: "Rampa de madeira de acessibilidade", setor: M, familia: "Acessórios" },
  { codigo: "RAMPA-BIKE", nome: "Rampa de madeira para bike", setor: M, familia: "Acessórios" },
  { codigo: "FECH-FACE", nome: "Fechamento de face (mandala)", setor: M, familia: "Cenário" },
  { codigo: "MEDALHA-CEN", nome: "Medalha cenográfica (mandala)", setor: M, familia: "Cenário" },
  // ---- Marcenaria: insumos -------------------------------------------------------------------
  { codigo: "COMP-VIROL-10", nome: "Compensado virolinha 10 mm (chapa)", setor: M, familia: "Insumo", unidade: "chapa" },
  { codigo: "COMP-VIROL-6", nome: "Compensado virolinha 6 mm (chapa)", setor: M, familia: "Insumo", unidade: "chapa" },
  { codigo: "COMP-FLEX", nome: "Compensado flex (chapa)", setor: M, familia: "Insumo", unidade: "chapa" },
  { codigo: "SARRAFO-70", nome: "Sarrafo 70 mm", setor: M, familia: "Insumo", unidade: "m" },
  { codigo: "MACO-SARRAFO", nome: "Maço de sarrafo", setor: M, familia: "Insumo", unidade: "maço" },
  { codigo: "METALON-50X30", nome: "Metalon 50×30 mm", setor: M, familia: "Insumo", unidade: "m" },
  { codigo: "CASE-MARC", nome: "Case de marcenaria (ferramentas)", setor: M, familia: "Apoio", permiteEmProjeto: false },
  // ---- Arena e percurso (itens de logística) ------------------------------------------------
  { codigo: "CONE-G", nome: "Cone grande", setor: A, familia: "Percurso" },
  { codigo: "CONE-P", nome: "Cone pequeno", setor: A, familia: "Percurso" },
  { codigo: "CAV-TRANSITO", nome: "Cavalete de trânsito", setor: A, familia: "Percurso" },
  { codigo: "COCHO", nome: "Cocho para água", setor: A, familia: "Percurso" },
  { codigo: "CAV-COCHO", nome: "Cavalete de ferro para cocho", setor: A, familia: "Percurso" },
  { codigo: "TINA-1000", nome: "Tina 1000 l", setor: A, familia: "Percurso" },
  { codigo: "RAMPA-MAD", nome: "Rampa de madeira (percurso)", setor: A, familia: "Percurso" },
  { codigo: "PRISMA", nome: "Prisma (cavalete grande)", setor: A, familia: "Percurso" },
  { codigo: "PRISMA-AEREO", nome: "Prisma aéreo (duplo)", setor: A, familia: "Percurso" },
  { codigo: "GRADE-2X1", nome: "Grade 2×1 m", setor: A, familia: "Grades" },
  { codigo: "GRADE-MERCH", nome: "Grade de merchandising", setor: A, familia: "Grades" },
  { codigo: "PE-GRADE-MERCH", nome: "Pé de grade de merchandising", setor: A, familia: "Grades" },
  { codigo: "CAV-RETO", nome: "Cavalete reto", setor: A, familia: "Arena" },
  { codigo: "OMBRELONE", nome: "Ombrelone", setor: A, familia: "Ativação" },
  { codigo: "TINA-300", nome: "Tina / caixa d'água 300 l", setor: A, familia: "Ativação" },
  { codigo: "PUFF", nome: "Puff", setor: A, familia: "Ativação" },
  { codigo: "LIXEIRA-ARAM", nome: "Lixeira aramada", setor: A, familia: "Arena" },
  { codigo: "LIXEIRA-BAG", nome: "Lixeira ultra bag", setor: A, familia: "Arena" },
  { codigo: "QUADRO-METAL", nome: "Quadro de metal", setor: A, familia: "Arena" },
  { codigo: "ESCADA-ALU", nome: "Escada de alumínio", setor: A, familia: "Arena" },
  { codigo: "ESCADA-MAD", nome: "Escada de madeira", setor: A, familia: "Arena" },
  { codigo: "PALETEIRA", nome: "Paleteira", setor: A, familia: "Arena" },
  { codigo: "GERADOR", nome: "Gerador", setor: A, familia: "Arena" },
  { codigo: "CARRINHO-PLAT", nome: "Carrinho plataforma", setor: A, familia: "Arena" },
  { codigo: "MARRETA-10", nome: "Marreta 10 kg", setor: A, familia: "Arena", permiteEmProjeto: false },
  { codigo: "WINDBANNER", nome: "Windbanner (haste)", setor: A, familia: "Sinalização" },
];

export const PROJETOS: ProjetoCatalogo[] = [
  // ---- Pórticos (modulação Q30 conforme detalhamento TTK / OS de estrutura) ------------------
  {
    nome: "Pórtico boca de 6 m com orelha",
    imagens: ["portico-boca-6m-com-orelha.jpg"],
    categoria: "Pórtico",
    descricao: "Pórtico Q30 de largada/chegada, vão de 6 m, 4,9 m de altura total (testeira 1,6 m).",
    itens: [["BOX-400", 2], ["BOX-600", 4], ["BOX-1000", 2], ["BOX-3000", 10], ["BOX-3500", 2], ["CUBO", 10], ["PARAF", 120]],
  },
  {
    nome: "Pórtico boca de 4 m com orelha",
    imagens: ["portico-boca-4m-com-orelha.jpg"],
    categoria: "Pórtico",
    descricao: "Pórtico Q30 de largada/chegada com orelhas laterais para lonas.",
    itens: [["BOX-600", 4], ["BOX-1000", 2], ["BOX-2500", 1], ["BOX-3000", 9], ["BOX-4000", 1], ["CUBO", 11], ["PARAF", 120]],
  },
  {
    nome: "Pórtico boca de 4 m sem orelha",
    imagens: ["portico-boca-4m-sem-orelha.jpg"],
    categoria: "Pórtico",
    descricao: "Pórtico Q30 simples (bem-vindos / até logo).",
    itens: [["BOX-1000", 2], ["BOX-3000", 6], ["BOX-4000", 2], ["CUBO", 6], ["PARAF", 64]],
  },
  {
    nome: "Pórtico boca de 3 m sem orelha",
    imagens: ["portico-boca-3m-render.jpg", "portico-boca-3m-sem-orelha.jpg"],
    categoria: "Pórtico",
    descricao: "Pórtico Q30 simples, vão de 3 m.",
    itens: [["BOX-1000", 2], ["BOX-3000", 8], ["CUBO", 6], ["PARAF", 64]],
  },
  {
    nome: "Pórtico boca de 2 m sem orelha",
    imagens: ["portico-boca-2m-sem-orelha.jpg"],
    categoria: "Pórtico",
    descricao: "Pórtico Q30 compacto (espaço kids, pórtico desafio).",
    itens: [["BOX-600", 2], ["BOX-2000", 6], ["BOX-3000", 2], ["CUBO", 6], ["PARAF", 64]],
  },
  // ---- Palcos ---------------------------------------------------------------------------------
  {
    nome: "Palco 8×4 m com escada e rampa",
    imagens: ["palco-8x4-render.jpg", "palco-8x4-escada-rampa.jpg", "palco-8x4-detalhamento.jpg"],
    categoria: "Palco",
    descricao: "Palco em praticável 2×1 a 1 m, rampa em praticável com patamar, fundo em box truss Q30 para backdrop.",
    itens: [
      ["BOX-700", 5], ["BOX-1000", 1], ["BOX-3000", 3], ["BOX-3500", 4], ["BOX-5000", 2], ["CUBO", 8], ["GRAPPLE", 4], ["PARAF", 128],
      ["PRAT-2X1", 18], ["PRAT-1X1", 1], ["PE-100", 68], ["PE-DUPLO-100", 2], ["PE-058", 2], ["PE-054", 2], ["GC-2X1", 2], ["GC-1X1", 2],
      ["SAIA-PALCO-4M", 3], ["SAIA-PALCO-416", 1], ["ESCADA-1M", 1], ["ACAB-RAMPA", 1], ["BACKDROP-PALCO", 1], ["PODIO-1A3", 1],
    ],
  },
  {
    nome: "Palco 8×4 m sem praticável (rebaixado)",
    imagens: ["palco-8x4-rebaixado-esquema.jpg"],
    categoria: "Palco",
    descricao: "Só o fundo em box truss Q30 para backdrop, sem piso elevado.",
    itens: [["BOX-700", 2], ["BOX-3000", 3], ["BOX-3500", 2], ["BOX-5000", 2], ["CUBO", 6], ["GRAPPLE", 2], ["PARAF", 96], ["BACKDROP-PALCO", 1]],
  },
  {
    nome: "Palco show grande 9×6 m com LED",
    imagens: ["palco-show-grande-render.jpg", "palco-show-grande-9x6-modulacao.jpg"],
    categoria: "Palco",
    descricao: "Palco show (Night Run): praticável 2×1 a 1 m, torre Q30 com painel de LED 36 placas.",
    itens: [
      ["ANG-15", 6], ["CUBO", 14], ["BOX-400", 4], ["BOX-500", 2], ["BOX-600", 4], ["BOX-700", 13], ["BOX-1000", 1], ["BOX-2000", 6], ["BOX-3000", 3], ["BOX-4000", 14], ["BOX-5000", 3],
      ["GRAPPLE", 10], ["PRAT-2X1", 22], ["PE-100", 88], ["PLACA-LED", 36], ["SAIA-PALCO-1M", 2], ["SAIA-PALCO-416", 3], ["SAIA-PALCO-4M", 2],
    ],
  },
  {
    nome: "Fundo de palco 8×4 m (moldura)",
    imagens: ["fundo-palco-8x4-moldura.jpg"],
    categoria: "Palco",
    descricao: "Estrutura Q30 de fundo com molduras para lona (Bravus).",
    itens: [["BOX-400", 3], ["BOX-700", 2], ["BOX-3000", 3], ["BOX-4000", 3], ["BOX-5000", 2], ["CUBO", 6], ["GRAPPLE", 2], ["PARAF", 92]],
  },
  // ---- Estandes -------------------------------------------------------------------------------
  {
    nome: "Estande 9×6 m",
    imagens: ["estande-9x6-modulacao.jpg", "estande-9x6-detalhamento.jpg"],
    categoria: "Estande",
    descricao: "Estande Q30 9×6 com lona de cobertura, colunas e testeira de marcenaria.",
    itens: [
      ["BOX-2500", 2], ["BOX-4000", 8], ["BOX-5000", 3], ["ANG-15", 5], ["CUBO", 7], ["GRAPPLE", 2], ["PARAF", 112], ["LONA-9X6", 1],
      ["COL-FRONTAL", 2], ["TAMPA-COL", 2], ["COL-TRAS", 2], ["ANJO-TESTEIRA", 3], ["TESTEIRA-9M", 1], ["SAIA-STAND", 1],
    ],
  },
  {
    nome: "Estande 11×6 m",
    imagens: ["estande-11x6.jpg"],
    categoria: "Estande",
    descricao: "Estande Q30 11×6 (versão ampliada).",
    itens: [["BOX-600", 1], ["BOX-2500", 2], ["BOX-3000", 6], ["BOX-4000", 3], ["BOX-5000", 5], ["ANG-15", 6], ["CUBO", 8], ["GRAPPLE", 2], ["PARAF", 128]],
  },
  // ---- Quadros --------------------------------------------------------------------------------
  {
    nome: "Quadro de fotos 4×3 m",
    imagens: ["quadro-fotos-4x3-modulacao.jpg"],
    categoria: "Quadro",
    descricao: "Quadro Q30 para lona 3,95×2,95 com ilhós.",
    itens: [["BOX-400", 4], ["BOX-2000", 2], ["BOX-2500", 2], ["BOX-3000", 2], ["CUBO", 4], ["PARAF", 56]],
  },
  {
    nome: "Quadro 6×3 m",
    imagens: ["quadro-6x3-detalhamento.jpg", "quadro-6x3-modulacao.jpg"],
    categoria: "Quadro",
    descricao: "Quadro Q30 para lona 5,95×2,95 (assinatura).",
    itens: [["BOX-400", 2], ["BOX-2000", 2], ["BOX-2500", 2], ["BOX-5000", 2], ["CUBO", 4], ["PARAF", 56]],
  },
  {
    nome: "Quadro 6×2,3 m",
    imagens: ["quadro-6x2-3-esquema.jpg"],
    categoria: "Quadro",
    descricao: "Quadro Q30 baixo, 6 m de boca.",
    itens: [["BOX-400", 2], ["BOX-700", 2], ["BOX-1000", 2], ["BOX-2000", 2], ["BOX-2500", 4], ["CUBO", 4], ["PARAF", 64]],
  },
  {
    nome: "Quadro 2,6×2,6 m",
    imagens: ["quadro-2-6x2-6.jpg"],
    categoria: "Quadro",
    descricao: "Quadro Q30 para lona 2,55×2,55.",
    itens: [["BOX-300", 4], ["BOX-2000", 6], ["PARAF", 32]],
  },
  {
    nome: "Quadro Q15 2,30×2,30 m com sapata",
    imagens: ["quadro-q15-2-3x2-3-esquema.jpg"],
    categoria: "Quadro",
    descricao: "Quadro em treliça Q15 (entrega de kit).",
    itens: [["Q15-2000", 4], ["Q15-CUBO", 4], ["SAPATA", 2]],
  },
  {
    nome: "Quadro 3×2 m para video wall",
    imagens: ["quadro-3x2-video-wall.jpg"],
    categoria: "Quadro",
    descricao: "Quadro Q30 com 12 placas de LED, contrapeso em tina 500 l.",
    itens: [["BOX-2000", 2], ["BOX-3000", 4], ["CUBO", 4], ["GRAPPLE", 2], ["TINA-500", 1], ["PALLET-PL", 1], ["PLACA-LED", 12]],
  },
  // ---- Ícones e ativações ---------------------------------------------------------------------
  {
    nome: "Mandala",
    imagens: ["mandala-esquema.jpg"],
    categoria: "Ativação",
    descricao: "Mandala/trimandala em Q30 com fechamento de faces e medalhas cenográficas.",
    itens: [["BOX-400", 4], ["BOX-700", 4], ["BOX-1000", 4], ["BOX-2000", 8], ["BOX-2500", 4], ["CUBO", 13], ["GRAPPLE", 8], ["PARAF", 160], ["FECH-FACE", 4], ["MEDALHA-CEN", 4]],
  },
  {
    nome: "Ícone backlight 2,6 m",
    imagens: ["icone-backlight-render.jpg", "icone-backlight-modulacao.jpg"],
    categoria: "Ativação",
    descricao: "Ícone recortado (Fever) sobre base Q30, lona backlight e compensado.",
    itens: [["BOX-400", 1], ["BOX-1000", 3], ["BOX-2000", 2], ["CUBO", 2], ["GRAPPLE", 2], ["PARAF", 32], ["COMP-VIROL-6", 2], ["COMP-FLEX", 1], ["SARRAFO-70", 20]],
  },
  {
    nome: "Ícone logo 3,95 m",
    imagens: ["icone-logo-render.jpg", "icone-logo-modulacao.jpg"],
    categoria: "Ativação",
    descricao: "Logo recortado (Bravus) sobre base Q30 4,52 m.",
    itens: [["BOX-500", 4], ["BOX-600", 6], ["BOX-1000", 4], ["BOX-2500", 2], ["BOX-3000", 2], ["CUBO", 9], ["GRAPPLE", 12], ["PARAF", 80]],
  },
  {
    nome: "Ativação microfone",
    imagens: ["ativacao-microfone-render.jpg", "ativacao-microfone.jpg"],
    categoria: "Ativação",
    descricao: "Base em cruz Q30 com cubo de 5 faces para painel pentagonal.",
    itens: [["BOX-700", 5], ["CUBO-5F", 1], ["PARAF", 20]],
  },
  {
    nome: "Ativação globos",
    imagens: ["ativacao-globos.jpg"],
    categoria: "Ativação",
    descricao: "Pórtico em arco Q30 com 3 globos espelhados de 1 m.",
    itens: [["BOX-1000", 4], ["BOX-2000", 4], ["BOX-3000", 4], ["CUBO", 1], ["ANG-45", 8], ["SAPATA", 4], ["PARAF", 96], ["GLOBO-1M", 3]],
  },
  {
    nome: "Ativação fone (marcenaria)",
    imagens: ["ativacao-fone-render.jpg", "ativacao-fone.jpg"],
    categoria: "Ativação",
    descricao: "Ícone fone/celular em compensado virolinha sobre base Q30.",
    itens: [["BOX-500", 1], ["BOX-1000", 2], ["BOX-2000", 2], ["CUBO", 2], ["PARAF", 24], ["COMP-VIROL-10", 5], ["COMP-FLEX", 2], ["SARRAFO-70", 77], ["METALON-50X30", 9]],
  },
  {
    nome: "Obstáculo Hércules / Pull up (Q30)",
    imagens: ["obstaculo-hercules.jpg", "obstaculo-pull-up.jpg"],
    categoria: "Ativação",
    descricao: "Pórtico Q30 de obstáculo (desafio) para lona 3,05×1,15.",
    itens: [["BOX-1000", 2], ["BOX-3000", 6], ["BOX-4000", 2], ["CUBO", 6], ["PARAF", 64]],
  },
  // ---- Tendas ---------------------------------------------------------------------------------
  {
    nome: "Tenda 5×5 m",
    imagens: ["tenda-5x5-esquema.jpg"],
    categoria: "Tenda",
    descricao: "Estrutura da tenda 5×5 com lona. Fechamentos laterais e calha de união pedidos por unidade.",
    itens: [["TND5-CANT", 4], ["TND5-TRAV", 4], ["TND5-PE", 4], ["TND5-MASTRO", 1], ["TND5-CABO", 1], ["TND5-LONA", 1]],
  },
  {
    nome: "Tenda 3×3 m",
    imagens: ["tenda-3x3-esquema.jpg"],
    categoria: "Tenda",
    descricao: "Estrutura da tenda 3×3 com lona. Fechamentos laterais pedidos por unidade.",
    itens: [["TND3-CANT", 4], ["TND3-TRAV", 4], ["TND3-PE", 4], ["TND3-MASTRO", 1], ["TND3-CABO", 1], ["TND3-LONA", 1]],
  },
  // ---- Percurso -------------------------------------------------------------------------------
  {
    nome: "Posto de hidratação (cocho)",
    imagens: ["posto-hidratacao-esquema.jpg"],
    categoria: "Percurso",
    descricao: "Um cocho de água sobre dois cavaletes de ferro.",
    itens: [["COCHO", 1], ["CAV-COCHO", 2]],
  },
  {
    nome: "Prisma com grades 2×1",
    imagens: ["prisma-grades-esquema.jpg"],
    categoria: "Percurso",
    descricao: "Prisma (cavalete grande) com duas grades 2×1.",
    itens: [["PRISMA", 1], ["GRADE-2X1", 2]],
  },
  {
    nome: "Grade de merchandising com pés",
    imagens: ["grade-merch-esquema.jpg"],
    categoria: "Percurso",
    descricao: "Uma grade de merchandising com dois pés.",
    itens: [["GRADE-MERCH", 1], ["PE-GRADE-MERCH", 2]],
  },
];
