import type { Perfil } from "@/server/db/schema";
import { pode, type Acao } from "@/domain/permissions";
import { SemPermissaoError } from "@/domain/errors";

export type UsuarioAtual = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  areaId: string | null;
  areaNome: string | null;
};

/** Para services e server actions: lança erro de domínio quando o perfil não tem a ação. */
export function exigir(usuario: UsuarioAtual, acao: Acao) {
  if (!pode(usuario, acao)) throw new SemPermissaoError();
}
