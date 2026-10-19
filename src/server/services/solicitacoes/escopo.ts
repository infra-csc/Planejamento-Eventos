import { inArray, ne, or, type SQL } from "drizzle-orm";
import { solicitacoes } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { areasDoUsuario } from "@/domain/permissions";

/**
 * Quem vê todas as áreas (e não é administrador): rascunho só da própria área. Rascunho não enviado é da
 * área; a Cenografia, que vê todas e também pede, continua vendo os rascunhos dela.
 */
export function escopoRascunhos(usuario: UsuarioAtual): SQL {
  const minhas = areasDoUsuario(usuario);
  return minhas.length ? or(ne(solicitacoes.status, "RASCUNHO"), inArray(solicitacoes.areaId, minhas))! : ne(solicitacoes.status, "RASCUNHO");
}
