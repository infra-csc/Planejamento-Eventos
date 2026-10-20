/**
 * Itens que já aparecem na solicitação de cada área, com quantidade 0, conforme a lista de materiais da
 * ata (planilhas de OS): a área só preenche o número; outros itens ela pede à parte, pela busca.
 * Chave: nome da área (sem acento, minúsculo). Peças pelo código do catálogo; projetos pelo código do projeto
 * (tenda pedida por local, no mesmo quadro de tendas do catálogo; os outros, pela quantidade).
 */
export type ListaDaArea = { titulo: string; codigos: string[]; projetos?: string[] };

/** Tenda 3×3 m e Tenda 5×5 m (projetos padrão). */
const TENDAS: ListaDaArea = { titulo: "Tendas", codigos: [], projetos: ["PRJ-0033", "PRJ-0006"] };

const LISTAS: Record<string, ListaDaArea[]> = {
  producao: [
    { titulo: "Percurso", codigos: ["CAV-TRANSITO", "COCHO", "CAV-COCHO", "CONE-G", "CONE-P", "RAMPA-MAD", "PRISMA"] },
    { titulo: "Arena", codigos: ["PALETEIRA", "GERADOR", "CARRINHO-PLAT", "LIXEIRA-ARAM", "LIXEIRA-BAG", "MESA-1X1", "TINA-500", "CAV-RETO"] },
    TENDAS,
  ],
  // As escadas são da cenografia (montagem de cenário), não da produção.
  cenografia: [{ titulo: "Cenografia", codigos: ["ESCADA-ALU", "ESCADA-MAD"] }],
  ativacao: [
    { titulo: "Ativação", codigos: ["BALCAO-120", "PRANCHÃO-220", "CAV-RETO", "OMBRELONE", "TINA-300", "PUFF"] },
    // Stand 9×6 m e Stand 11×6 m (projetos padrão): pedidos pela quantidade, com a descrição de cada unidade.
    { titulo: "Stands", codigos: [], projetos: ["PRJ-0018", "PRJ-0019"] },
    TENDAS,
  ],
};

const chave = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const listasDaArea = (areaNome: string | null | undefined): ListaDaArea[] => (areaNome ? (LISTAS[chave(areaNome)] ?? []) : []);
