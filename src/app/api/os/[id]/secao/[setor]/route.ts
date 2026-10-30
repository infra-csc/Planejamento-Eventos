import { GET as csvDaSecao } from "../../[setor]/route";

/**
 * CSV de uma seção dos totais da OS (botão "CSV" de cada material). Caminho próprio: em `/api/os/[id]/estrutura` a rota
 * fixa da OS de estrutura (.xlsx) ganhava do `[setor]`, e o "CSV" da Estrutura baixava um Excel (auditoria 28/10, nº 34).
 * O conteúdo é o mesmo de `/api/os/[id]/[setor]`, que continua valendo para links antigos.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string; setor: string }> }) {
  return csvDaSecao(request, ctx);
}
