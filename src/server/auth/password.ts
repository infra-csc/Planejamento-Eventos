import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

export async function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(senha: string, hash: string) {
  return bcrypt.compare(senha, hash);
}

export function gerarToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
