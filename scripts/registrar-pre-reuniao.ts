/**
 * Correção de dados (idempotente): necessidades pré-reunião enviadas antes da regra
 * "entra na ata sem avaliação" e ainda aguardando resposta passam a estar na ata.
 * Roda no setup e no deploy; sem pendências, não faz nada.
 */
import { getConnection } from "../src/server/db";
import { registrarPreReunioesPendentes } from "../src/server/services/solicitacoes";

async function main() {
  const r = await registrarPreReunioesPendentes();
  console.log(r.solicitacoes ? `Pré-reunião: ${r.solicitacoes} solicitação(ões) antigas registradas na ata (${r.itens} itens).` : "Pré-reunião: nenhuma pendência antiga.");
  await (await getConnection()).close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
