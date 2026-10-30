import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventos } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { registrarHistorico } from "./support";

/**
 * Folha de separação do evento: com a estrutura locada no local, box Q30, tendas e estaiamento não saem na folha
 * (a OS e os Excel continuam com tudo); o box Q15 sai também se `q15Locado`. Guardado em `configuracoes` por evento.
 */
export type Separacao = { locada: boolean; q15Locado: boolean };

const chave = (eventoId: string) => `separacao:${eventoId}`;
const PADRAO: Separacao = { locada: false, q15Locado: false };

export async function obterSeparacao(eventoId: string): Promise<Separacao> {
  const db = await getDb();
  const [c] = await db.select({ valor: configuracoes.valor }).from(configuracoes).where(eq(configuracoes.chave, chave(eventoId)));
  if (!c) return PADRAO;
  try {
    const v = JSON.parse(c.valor) as Partial<Separacao>;
    return { locada: Boolean(v.locada), q15Locado: Boolean(v.locada && v.q15Locado) };
  } catch {
    return PADRAO;
  }
}

export async function salvarSeparacao(usuario: UsuarioAtual, eventoId: string, dados: Separacao) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  const valor: Separacao = { locada: dados.locada, q15Locado: dados.locada && dados.q15Locado };
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    // A tela não mostra o quadro em evento cancelado, mas o servidor gravava (com histórico) quem chamasse a ação
    // direto (auditoria 30/10, B-11). Encerrado segue aceito: decisão do time.
    if (ev.status === "CANCELADO") throw new DomainError("Evento cancelado: a folha de separação não muda mais.");
    await tx
      .insert(configuracoes)
      .values({ chave: chave(eventoId), valor: JSON.stringify(valor) })
      .onConflictDoUpdate({ target: configuracoes.chave, set: { valor: JSON.stringify(valor), atualizadoEm: new Date() } });
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento",
      entidadeId: eventoId,
      acao: "SEPARACAO_LOCADA",
      descricao: valor.locada ? `Folha de separação: estrutura locada (box Q30, tendas e estaio fora${valor.q15Locado ? "; box Q15 também" : ""})` : "Folha de separação: estrutura volta a sair inteira",
      usuarioId: usuario.id,
      dadosDepois: valor,
    });
    return valor;
  });
}
