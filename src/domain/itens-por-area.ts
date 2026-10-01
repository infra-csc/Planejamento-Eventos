/**
 * Itens que já aparecem na solicitação de cada área, com quantidade 0, conforme a lista de materiais da
 * ata (planilhas de OS): a área só preenche o número; outros itens ela pede à parte, pela busca.
 * Chave: nome da área (sem acento, minúsculo). Peças pelo código do catálogo.
 */
export type ListaDaArea = { titulo: string; codigos: string[] };

const LISTAS: Record<string, ListaDaArea[]> = {
  producao: [
    { titulo: "Percurso", codigos: ["CAV-TRANSITO", "COCHO", "CAV-COCHO", "CONE-G", "CONE-P", "RAMPA-MAD", "PRISMA"] },
    { titulo: "Arena", codigos: ["ESCADA-ALU", "ESCADA-MAD", "GRADE-2X1", "PALETEIRA", "GERADOR", "CARRINHO-PLAT", "LIXEIRA-ARAM", "LIXEIRA-BAG"] },
  ],
  ativacao: [{ titulo: "Ativação", codigos: ["BALCAO-120", "BANCADA-210", "CAV-RETO", "OMBRELONE", "TINA-300", "PUFF"] }],
};

const chave = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const listasDaArea = (areaNome: string | null | undefined): ListaDaArea[] => (areaNome ? (LISTAS[chave(areaNome)] ?? []) : []);
