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
  /** Administrador vendo o app como outro perfil: permissões e área seguem o perfil visto; o id (e o histórico) continuam sendo do administrador. */
  verComo?: { perfilReal: Perfil } | null;
  /** Senha provisória: enquanto true, só a página de perfil (troca de senha) abre. */
  trocarSenha?: boolean;
};

/** Para services e server actions: lança erro de domínio quando o perfil não tem a ação. */
export function exigir(usuario: UsuarioAtual, acao: Acao) {
  if (!pode(usuario, acao)) throw new SemPermissaoError();
}
