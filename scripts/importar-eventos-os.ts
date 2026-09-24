/**
 * Importa os eventos reais de 2026 (scripts/dados/eventos-os-2026.ts, um por OS de estrutura do
 * SharePoint) no banco atual, passando pelo fluxo normal do app: evento criado → reunião de OS →
 * linhas da ata (projetos do catálogo com a quantidade da OS, tendas por local e fechamentos) →
 * ata fechada (OS v1) → encerrado quando a data já passou.
 *
 * Idempotente: um evento é identificado pelo arquivo da OS (gravado nas observações da reunião);
 * já importado → pulado. Não mexe em eventos criados no app.
 *
 * Uso: `npm run importar:eventos` (local, PGlite) ou com DATABASE_URL apontando para o Postgres.
 *      `npm run importar:eventos -- --desfazer` remove tudo que este importador criou.
 */
import { and, eq, like, sql } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { eventos, pecas, projetos, usuarios } from "../src/server/db/schema";
import type { UsuarioAtual } from "../src/server/auth/autorizacao";
import { criarEvento, incluirLinhaAta, salvarDadosReuniao, salvarObservacoesReuniao, transicionarEvento } from "../src/server/services/eventos";
import { hojeISO } from "../src/lib/format";
import { EVENTOS_OS, type EventoOs } from "./dados/eventos-os-2026";
import { PROJETOS } from "./dados/catalogo";

// Importação em massa não avisa ninguém: 190 eventos × 3 fases encheriam o sino de todo mundo.
process.env.NOTIFICACOES_DESLIGADAS = "1";

const MARCA = "Importado da OS de estrutura";
const dataOsBr = (iso: string) => iso.split("-").reverse().join("/");

async function main() {
  const desfazer = process.argv.includes("--desfazer");
  const { db, close } = await getConnection();

  if (desfazer) {
    const alvo = await db.select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome }).from(eventos).where(like(eventos.observacoesReuniao, `${MARCA}%`));
    if (alvo.length === 0) {
      console.log("Nada a desfazer: nenhum evento importado pela OS.");
      await close();
      return;
    }
    const ids = alvo.map((e) => e.id);
    // Tudo que aponta para o evento sai junto (o histórico fica, sem o vínculo).
    const consulta = (await db.execute(sql`select table_name from information_schema.columns where table_schema = 'public' and column_name = 'evento_id' and table_name not in ('eventos', 'historico')`)) as unknown as { rows: Array<{ table_name: string }> };
    const tabelas = consulta.rows;
    for (const t of tabelas) await db.execute(sql`delete from ${sql.identifier(t.table_name)} where evento_id in ${ids}`);
    await db.execute(sql`update historico set evento_id = null where evento_id in ${ids}`);
    await db.execute(sql`delete from eventos where id in ${ids}`);
    console.log(`Removidos ${alvo.length} eventos importados (${alvo[0].codigo} … ${alvo[alvo.length - 1].codigo}).`);
    await close();
    return;
  }

  const autor = await db.query.usuarios.findFirst({ where: and(eq(usuarios.perfil, "ADMIN"), eq(usuarios.ativo, true)), with: { area: true } });
  if (!autor) throw new Error("Nenhum administrador ativo para assinar a importação. Rode o seed ou crie um usuário antes.");
  const usuario: UsuarioAtual = { id: autor.id, nome: autor.nome, email: autor.email, perfil: autor.perfil, areaId: autor.areaId, areaNome: autor.area?.nome ?? null };

  // Projetos por nome (e por nomes anteriores do catálogo, caso algum tenha sido renomeado).
  const ativos = await db.select({ id: projetos.id, nome: projetos.nome }).from(projetos).where(eq(projetos.ativo, true));
  const porNome = new Map(ativos.map((p) => [p.nome, p.id]));
  for (const p of PROJETOS) for (const antigo of p.nomesAnteriores ?? []) if (porNome.has(p.nome) && !porNome.has(antigo)) porNome.set(antigo, porNome.get(p.nome)!);
  const idProjeto = (nome: string) => porNome.get(nome) ?? null;
  const tendaProjeto = { "5x5": idProjeto("Tenda 5×5 m"), "3x3": idProjeto("Tenda 3×3 m") } as Record<string, string | null>;
  const pecasFech = Object.fromEntries((await db.select({ id: pecas.id, codigo: pecas.codigo }).from(pecas).where(and(eq(pecas.ativo, true), sql`${pecas.codigo} in ('TND5-FECH', 'TND3-FECH')`))).map((p) => [p.codigo, p.id]));
  const pecaFech = { "5x5": pecasFech["TND5-FECH"] ?? null, "3x3": pecasFech["TND3-FECH"] ?? null } as Record<string, string | null>;

  const hoje = hojeISO();
  const jaImportados = new Set((await db.select({ obs: eventos.observacoesReuniao }).from(eventos).where(like(eventos.observacoesReuniao, `${MARCA}%`))).map((e) => e.obs?.match(/"([^"]+)"/)?.[1] ?? ""));
  let criados = 0;
  let pulados = 0;
  const semProjeto = new Map<string, number>();
  const falhas: string[] = [];

  for (const e of EVENTOS_OS) {
    if (jaImportados.has(e.arquivo)) {
      pulados++;
      continue;
    }
    try {
      const codigo = await importar(usuario, e, { idProjeto, tendaProjeto, pecaFech, hoje, semProjeto });
      criados++;
      console.log(`${codigo}  ${e.dataInicio}  ${e.nome}`);
    } catch (err) {
      falhas.push(`${e.nome} (${e.arquivo}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nEventos criados: ${criados} · já existiam: ${pulados} · falhas: ${falhas.length}`);
  if (semProjeto.size) console.log("Projetos da OS sem correspondente no catálogo (entraram como item avulso):", [...semProjeto].map(([n, k]) => `${n} (${k}×)`).join("; "));
  for (const f of falhas) console.log("FALHA:", f);
  await close();
  if (falhas.length) process.exitCode = 1;
}

type Apoio = { idProjeto: (nome: string) => string | null; tendaProjeto: Record<string, string | null>; pecaFech: Record<string, string | null>; hoje: string; semProjeto: Map<string, number> };

async function importar(usuario: UsuarioAtual, e: EventoOs, a: Apoio) {
  const ev = await criarEvento(usuario, {
    nome: e.nome,
    cliente: null,
    local: e.local,
    dataInicio: e.dataInicio,
    dataFim: e.dataFim,
    dataReuniao: new Date(`${e.dataOs}T17:00:00Z`), // 14:00 em Brasília
    responsavelId: usuario.id,
  });
  const obs = [`${MARCA} "${e.arquivo}" (SharePoint 2026, OS de ${dataOsBr(e.dataOs)}).`, e.diretor ? `Diretor de prova: ${e.diretor}.` : null, e.responsavel ? `Responsável pela OS: ${e.responsavel}.` : null, e.dataEstimada ? "A OS não trazia a data da prova: data estimada pela data da OS." : null]
    .filter(Boolean)
    .join(" ");
  await salvarObservacoesReuniao(usuario, ev.id, obs);
  await transicionarEvento(usuario, ev.id, "INICIAR_REUNIAO");

  const linha = (dados: Parameters<typeof incluirLinhaAta>[2]) => incluirLinhaAta(usuario, ev.id, dados);
  const base = { areaId: null, justificativa: null, destino: null as string | null, descricaoLivre: null as string | null, pecaId: null as string | null, projetoId: null as string | null };
  for (const [nome, quantidade] of e.projetos) {
    const projetoId = a.idProjeto(nome);
    if (projetoId) await linha({ ...base, referenciaTipo: "PROJETO", projetoId, quantidade });
    else {
      a.semProjeto.set(nome, (a.semProjeto.get(nome) ?? 0) + 1);
      await linha({ ...base, referenciaTipo: "AVULSO", descricaoLivre: nome.slice(0, 200), quantidade });
    }
  }
  for (const t of e.tendas) {
    const projetoId = a.tendaProjeto[t.kit];
    if (projetoId) await linha({ ...base, referenciaTipo: "PROJETO", projetoId, quantidade: t.quantidade, destino: t.local });
    else await linha({ ...base, referenciaTipo: "AVULSO", descricaoLivre: `Tenda ${t.kit.replace("x", "×")}`, quantidade: t.quantidade, destino: t.local });
    const fechId = a.pecaFech[t.kit];
    if (t.fechamentos > 0) {
      if (fechId) await linha({ ...base, referenciaTipo: "PECA", pecaId: fechId, quantidade: t.fechamentos, destino: t.local });
      else await linha({ ...base, referenciaTipo: "AVULSO", descricaoLivre: `Fechamento de tenda ${t.kit.replace("x", "×")}`, quantidade: t.fechamentos, destino: t.local });
    }
  }
  if (e.projetos.length === 0 && e.tendas.length === 0) await linha({ ...base, referenciaTipo: "AVULSO", descricaoLivre: "OS de estrutura sem itens legíveis (ver planilha original)", quantidade: 1 });

  await salvarDadosReuniao(usuario, ev.id, { reuniaoPresentes: [e.diretor, e.responsavel].filter(Boolean).join(", ") || "Conforme OS", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null });
  await transicionarEvento(usuario, ev.id, "FECHAR_ATA");
  if (e.dataFim < a.hoje) await transicionarEvento(usuario, ev.id, "ENCERRAR");
  return ev.codigo;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
