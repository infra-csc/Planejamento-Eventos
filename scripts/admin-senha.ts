/**
 * Redefine (ou cria) o administrador no banco atual. Para produção, rode no Shell do Replit:
 *
 *   npm run admin:senha -- admin@nortemkt.com.br SuaSenhaNova
 *
 * Usa DATABASE_URL quando existir (Postgres); sem ela, o PGlite local.
 * Se o e-mail não existir, cria um usuário ADMIN ativo com esse e-mail.
 * Sessões abertas desse usuário são encerradas. A senha definida aqui não é provisória
 * (desmarca a troca obrigatória no próximo acesso).
 */
import { eq, sql } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { sessoes, usuarios } from "../src/server/db/schema";
import { hashSenha } from "../src/server/auth/password";

async function main() {
  const [email, senha] = process.argv.slice(2);
  if (!email || !senha) throw new Error("Uso: npm run admin:senha -- <email> <senha>");
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const { db, kind, close } = await getConnection();
  const senhaHash = await hashSenha(senha);
  const [u] = await db.select({ id: usuarios.id, nome: usuarios.nome, perfil: usuarios.perfil }).from(usuarios).where(sql`lower(${usuarios.email}) = ${email.trim().toLowerCase()}`);
  if (u) {
    await db.update(usuarios).set({ senhaHash, ativo: true, perfil: "ADMIN", areaId: null, trocarSenha: false }).where(eq(usuarios.id, u.id));
    await db.delete(sessoes).where(eq(sessoes.usuarioId, u.id));
    console.log(`Senha redefinida para ${u.nome} (${email}) — perfil ADMIN, ativo. Banco: ${kind}.`);
  } else {
    await db.insert(usuarios).values({ nome: "Administrador do Sistema", email: email.trim(), senhaHash, perfil: "ADMIN", ativo: true, trocarSenha: false });
    console.log(`Administrador criado: ${email}. Banco: ${kind}.`);
  }
  await close();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
