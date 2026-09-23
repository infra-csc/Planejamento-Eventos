// Sem "server-only": o proxy e o histórico (support.ts, usado também pelos scripts) leem estes nomes.

export const COOKIE_SESSAO = "npe_sessao";
/** Administrador vendo o app como outro perfil: JSON { perfil, areaId } só neste navegador. */
export const COOKIE_VER_COMO = "npe_ver_como";
/** Cabeçalho que o proxy grava com o caminho pedido: o servidor sabe em que página está (troca de senha obrigatória). */
export const HEADER_CAMINHO = "x-npe-caminho";
