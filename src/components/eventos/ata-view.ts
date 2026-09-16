import type { LinhaAtaDetalhe } from "@/server/services/eventos";
import type { LinhaAtaView } from "./ata-lista";

export function paraView(l: LinhaAtaDetalhe): LinhaAtaView {
  return {
    id: l.id,
    tipo: l.tipo,
    nome: l.nome,
    codigo: l.tipo === "PROJETO" ? (l.projeto?.codigo ?? null) : l.tipo === "PECA" ? (l.peca?.codigo ?? null) : null,
    quantidade: l.quantidade,
    destino: l.destino,
    areaNome: l.areaNome,
    origemLabel: l.origemLabel,
    origemSolicitacaoId: l.origemSolicitacaoId,
    versao: l.versao,
    versaoAtual: l.versaoAtual,
    versaoDefasada: l.versaoDefasada,
    capaId: l.capaId ?? null,
  };
}
