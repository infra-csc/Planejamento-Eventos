/**
 * Importa o catálogo real (scripts/dados/catalogo.ts) no banco atual.
 *
 * Idempotente:
 * - peça é identificada pelo código: existe → atualiza nome, setor, família e unidade
 *   (o estoque só é preenchido na criação, para não sobrescrever o que a logística ajustou);
 * - projeto é identificado pelo nome: já existe ativo → não mexe (a lista de peças é versionada
 *   pela cenografia dentro do app).
 *
 * Uso: `npm run importar:catalogo` (local, PGlite) ou com DATABASE_URL apontando para o Postgres.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { pecas, projetos, usuarios } from "../src/server/db/schema";
import type { UsuarioAtual } from "../src/server/auth/autorizacao";
import { anexarArquivo, criarProjeto } from "../src/server/services/projetos";
import { PECAS, PROJETOS } from "./dados/catalogo";

async function main() {
  const { db, close } = await getConnection();

  // Quem assina o histórico: o primeiro administrador ativo (ou cenografia, se não houver).
  const autor =
    (await db.query.usuarios.findFirst({ where: and(eq(usuarios.perfil, "ADMIN"), eq(usuarios.ativo, true)), with: { area: true } })) ??
    (await db.query.usuarios.findFirst({ where: and(eq(usuarios.perfil, "CENOGRAFIA"), eq(usuarios.ativo, true)), with: { area: true } }));
  if (!autor) throw new Error("Nenhum administrador ou cenografia ativo para assinar a importação. Rode o seed ou crie um usuário antes.");
  const usuario: UsuarioAtual = { id: autor.id, nome: autor.nome, email: autor.email, perfil: autor.perfil, areaId: autor.areaId, areaNome: autor.area?.nome ?? null };

  let criadas = 0;
  let atualizadas = 0;
  for (const p of PECAS) {
    const existente = await db.query.pecas.findFirst({ where: eq(pecas.codigo, p.codigo) });
    const base = { nome: p.nome, setor: p.setor, familia: p.familia, unidade: p.unidade ?? "un", permiteEmProjeto: p.permiteEmProjeto ?? true, descricao: p.descricao ?? null };
    if (existente) {
      await db.update(pecas).set({ ...base, ativo: true }).where(eq(pecas.id, existente.id));
      atualizadas++;
    } else {
      await db.insert(pecas).values({ ...base, codigo: p.codigo, estoqueProprio: p.estoque ?? 0, criadoPorId: usuario.id });
      criadas++;
    }
  }
  console.log(`Peças: ${criadas} criadas, ${atualizadas} atualizadas.`);

  const todas = await db.query.pecas.findMany({ columns: { id: true, codigo: true } });
  const idPorCodigo = new Map(todas.map((p) => [p.codigo, p.id]));

  let projetosCriados = 0;
  let projetosMantidos = 0;
  for (const pr of PROJETOS) {
    const existente = await db.query.projetos.findFirst({ where: and(sql`lower(${projetos.nome}) = ${pr.nome.toLowerCase()}`, eq(projetos.ativo, true)), columns: { id: true } });
    if (existente) {
      projetosMantidos++;
      continue;
    }
    const itens = pr.itens.map(([codigo, quantidade]) => {
      const pecaId = idPorCodigo.get(codigo);
      if (!pecaId) throw new Error(`Projeto "${pr.nome}": peça ${codigo} não existe no catálogo.`);
      return { pecaId, quantidade };
    });
    await criarProjeto(usuario, { nome: pr.nome, categoria: pr.categoria, descricao: pr.descricao, observacaoVersao: "Importado do catálogo real (OS de estrutura / detalhamentos TTK).", itens });
    projetosCriados++;
  }
  console.log(`Projetos padrão: ${projetosCriados} criados, ${projetosMantidos} já existiam.`);

  // Imagens (renders e modulações TTK): anexa o que ainda não está no projeto, pelo nome do arquivo.
  const pastaImagens = path.join(process.cwd(), "scripts", "dados", "imagens");
  let anexadas = 0;
  for (const pr of PROJETOS) {
    if (!pr.imagens?.length) continue;
    const projeto = await db.query.projetos.findFirst({
      where: and(sql`lower(${projetos.nome}) = ${pr.nome.toLowerCase()}`, eq(projetos.ativo, true)),
      columns: { id: true },
      with: { anexos: { columns: { nomeArquivo: true } } },
    });
    if (!projeto) continue;
    const existentes = new Set(projeto.anexos.map((a) => a.nomeArquivo));
    for (const nome of pr.imagens) {
      if (existentes.has(nome)) continue;
      const caminho = path.join(pastaImagens, nome);
      if (!fs.existsSync(caminho)) {
        console.warn(`  aviso: imagem não encontrada: ${nome}`);
        continue;
      }
      const conteudo = fs.readFileSync(caminho);
      await anexarArquivo(usuario, projeto.id, new File([new Uint8Array(conteudo)], nome, { type: nome.endsWith(".png") ? "image/png" : "image/jpeg" }));
      anexadas++;
    }
  }
  console.log(`Imagens de projeto: ${anexadas} anexadas.`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
