/**
 * Importa o catálogo real (scripts/dados/catalogo.ts) no banco atual.
 *
 * Idempotente:
 * - peça é identificada pelo código: existe → atualiza nome, setor, família e unidade
 *   (o estoque só é preenchido na criação, para não sobrescrever o que a logística ajustou);
 * - projeto é identificado pelo nome (ou por `nomesAnteriores`): já existe ativo → atualiza nome,
 *   categoria e descrição e, se a lista de peças mudou, cria nova versão — mas só quando a versão
 *   atual foi criada pelo próprio importador; lista editada pela cenografia no app é mantida.
 *
 * Uso: `npm run importar:catalogo` (local, PGlite) ou com DATABASE_URL apontando para o Postgres.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { pecas, projetos, usuarios } from "../src/server/db/schema";
import type { UsuarioAtual } from "../src/server/auth/autorizacao";
import { anexarArquivo, criarProjeto, editarProjeto } from "../src/server/services/projetos";
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
      // Por enquanto o estoque não é controlado no app: a importação zera o que veio do seed de demonstração.
      await db.update(pecas).set({ ...base, ativo: true, estoqueProprio: p.estoque ?? 0 }).where(eq(pecas.id, existente.id));
      atualizadas++;
    } else {
      await db.insert(pecas).values({ ...base, codigo: p.codigo, estoqueProprio: p.estoque ?? 0, criadoPorId: usuario.id });
      criadas++;
    }
  }
  console.log(`Peças: ${criadas} criadas, ${atualizadas} atualizadas.`);

  // Sobras do seed de demonstração antigo (peças e projetos fictícios): saem de cena, sem apagar histórico.
  const DEMO_PROJETOS = ["pórtico boca 6,60m", "pórtico boca 4m", "torre de som 4m", "palco 8×6 m com cobertura", "tenda 10×10 m", "balcão de credenciamento 2 m", "camarim 3×3 m"];
  const DEMO_PECAS = ["CONTRAPESO", "TALHA", "TND-CANT", "TND-TRAV", "TND-PE", "TND-MASTRO", "TND-CABO", "TND-CALHA", "TND-LONA10", "TND-LONA5", "TND-FECH", "MDF-15", "MDF-9", "SARRAFO", "PISO-MOD", "PERNA-60", "TAMPO-BAL", "RODAPE", "TINTA-PRETA"];
  let projetosDesativados = 0;
  for (const pr of await db.query.projetos.findMany({ where: eq(projetos.ativo, true), columns: { id: true, nome: true } })) {
    if (DEMO_PROJETOS.includes(pr.nome.toLowerCase())) {
      await db.update(projetos).set({ ativo: false }).where(eq(projetos.id, pr.id));
      projetosDesativados++;
    }
  }
  let pecasDesativadas = 0;
  for (const pc of await db.query.pecas.findMany({ where: eq(pecas.ativo, true), columns: { id: true, codigo: true } })) {
    if (DEMO_PECAS.includes(pc.codigo)) {
      await db.update(pecas).set({ ativo: false, estoqueProprio: 0 }).where(eq(pecas.id, pc.id));
      pecasDesativadas++;
    }
  }
  if (projetosDesativados || pecasDesativadas) console.log(`Demonstração antiga desativada: ${projetosDesativados} projetos, ${pecasDesativadas} peças.`);

  const todas = await db.query.pecas.findMany({ columns: { id: true, codigo: true } });
  const idPorCodigo = new Map(todas.map((p) => [p.codigo, p.id]));

  // Versões assinadas pelo importador: só essas podem ser substituídas numa reimportação.
  const OBS_IMPORTACAO = "Importado do catálogo real (OS de estrutura / detalhamentos TTK).";
  const OBS_ATUALIZACAO = "Atualizado pelo catálogo real (OS de estrutura 2026 — SharePoint).";
  const chaveBom = (itens: Array<{ pecaId: string; quantidade: number }>) => itens.map((i) => `${i.pecaId}:${i.quantidade}`).sort().join("|");

  let projetosCriados = 0;
  let projetosMantidos = 0;
  let projetosAtualizados = 0;
  let projetosNovaVersao = 0;
  const editadosNoApp: string[] = [];
  for (const pr of PROJETOS) {
    const nomes = [pr.nome, ...(pr.nomesAnteriores ?? [])].map((n) => n.toLowerCase());
    const existente = await db.query.projetos.findFirst({
      where: and(inArray(sql`lower(${projetos.nome})`, nomes), eq(projetos.ativo, true)),
      with: { versoes: { with: { itens: { columns: { pecaId: true, quantidade: true } } } } },
    });
    const itens = pr.itens.map(([codigo, quantidade]) => {
      const pecaId = idPorCodigo.get(codigo);
      if (!pecaId) throw new Error(`Projeto "${pr.nome}": peça ${codigo} não existe no catálogo.`);
      return { pecaId, quantidade };
    });
    if (!existente) {
      await criarProjeto(usuario, { nome: pr.nome, categoria: pr.categoria, descricao: pr.descricao, observacaoVersao: OBS_IMPORTACAO, itens });
      projetosCriados++;
      continue;
    }
    const versaoAtual = existente.versoes.find((v) => v.numero === existente.versaoAtual);
    const bomMudou = !versaoAtual || chaveBom(versaoAtual.itens) !== chaveBom(itens);
    const dadosMudaram = existente.nome !== pr.nome || existente.categoria !== pr.categoria || (existente.descricao ?? null) !== (pr.descricao ?? null);
    if (!bomMudou && !dadosMudaram) {
      projetosMantidos++;
      continue;
    }
    // "Versão inicial" e a v2 do seed de demonstração também contam como não editadas pela cenografia.
    const OBS_SEED = ["Versão inicial", "Incluídas 2 sapatas e 4 malotes de contrapeso após revisão de segurança."];
    const versaoDoImportador = !versaoAtual || [OBS_IMPORTACAO, OBS_ATUALIZACAO, ...OBS_SEED].includes(versaoAtual.observacao ?? "");
    if (bomMudou && !versaoDoImportador) {
      // A cenografia mexeu na lista dentro do app: prevalece o app, só os dados cadastrais acompanham o catálogo.
      editadosNoApp.push(pr.nome);
      if (dadosMudaram) await db.update(projetos).set({ nome: pr.nome, categoria: pr.categoria, descricao: pr.descricao }).where(eq(projetos.id, existente.id));
      continue;
    }
    const r = await editarProjeto(usuario, existente.id, {
      nome: pr.nome,
      categoria: pr.categoria,
      descricao: pr.descricao,
      observacaoVersao: OBS_ATUALIZACAO,
      itens: bomMudou ? itens : versaoAtual!.itens,
    });
    if (r.bomMudou) projetosNovaVersao++;
    else projetosAtualizados++;
  }
  console.log(`Projetos padrão: ${projetosCriados} criados, ${projetosNovaVersao} com nova versão da lista, ${projetosAtualizados} com dados atualizados, ${projetosMantidos} sem mudança.`);
  if (editadosNoApp.length) console.log(`  lista mantida como editada no app (${editadosNoApp.length}): ${editadosNoApp.join("; ")}`);

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
