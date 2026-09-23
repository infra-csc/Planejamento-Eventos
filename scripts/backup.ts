/**
 * Backup do banco em SQL comprimido (gzip), com data e hora no nome:
 *
 *   npm run backup
 *
 * - Com `pg_dump` no PATH (no Replit, o módulo postgresql-16 do .replit fornece) e DATABASE_URL:
 *   dump completo (estrutura + dados), restaurável com `psql`.
 * - Sem pg_dump, sem DATABASE_URL (PGlite local) ou se o pg_dump falhar (versão do servidor mais
 *   nova, por exemplo): exporta só os DADOS, tabela a tabela em ordem de dependência, no formato
 *   COPY … FROM stdin. Para restaurar esse formato, o banco precisa estar com as mesmas migrações
 *   (o arquivo guarda qual foi a última e `npm run restaurar` confere).
 *
 * Variáveis:
 *   BACKUP_DIR     pasta dos arquivos (padrão: ./.data/backups, fora do Git)
 *   BACKUP_MANTER  quantos backups manter na pasta (padrão: 14; os mais antigos são apagados)
 *   BACKUP_MODO    auto (padrão) | pg_dump | dados
 *   BACKUP_OBJECT_STORAGE  "true" exige o envio ao Object Storage do Replit (falha se não der);
 *                  sem a variável, envia só se o pacote @replit/object-storage estiver instalado.
 *
 * Detalhes, agendamento e teste de restauração: docs/operacao.md.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { sql } from "drizzle-orm";
import { getConnection } from "../src/server/db";

const PREFIXO = "npe-backup-";
const DIR = path.resolve(process.env.BACKUP_DIR?.trim() || path.join(".data", "backups"));
const MANTER = Math.max(1, Number(process.env.BACKUP_MANTER) || 14);
const MODO = (process.env.BACKUP_MODO?.trim() || "auto") as "auto" | "pg_dump" | "dados";

type Linha = Record<string, unknown>;
type Executor = { execute: (q: ReturnType<typeof sql>) => Promise<unknown> };

const linhas = (r: unknown): Linha[] => ((r as { rows?: Linha[] }).rows ?? (r as Linha[])) as Linha[];
const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

function carimbo(d = new Date()) {
  // 2026-09-23_03-00-00Z: ordena por nome = ordena por data.
  return d.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-") + "Z";
}

function temComando(cmd: string): boolean {
  const r = spawnSync(cmd, ["--version"], { stdio: "ignore", shell: process.platform === "win32" });
  return r.status === 0;
}

/* ------------------------------------------------------------------ */
/* pg_dump                                                              */
/* ------------------------------------------------------------------ */

async function viaPgDump(url: string, destino: string) {
  const proc = spawn("pg_dump", ["--no-owner", "--no-privileges", "--clean", "--if-exists", "--format=plain", "--dbname", url], { stdio: ["ignore", "pipe", "pipe"] });
  let erro = "";
  proc.stderr.on("data", (c: Buffer) => (erro += c.toString()));
  const fim = once(proc, "close") as Promise<[number | null]>;
  await pipeline(proc.stdout, zlib.createGzip({ level: 9 }), fs.createWriteStream(destino));
  const [codigo] = await fim;
  if (codigo !== 0) throw new Error(`pg_dump terminou com código ${codigo}: ${erro.trim().slice(0, 500)}`);
}

/* ------------------------------------------------------------------ */
/* Exportação só dos dados (COPY … FROM stdin)                          */
/* ------------------------------------------------------------------ */

/** Escapa um valor no formato texto do COPY (\N = nulo). */
function valorCopy(v: unknown): string {
  if (v === null || v === undefined) return "\\N";
  return String(v).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

type Fk = { filho: string; pai: string; colunas: string[]; anulavel: boolean };

/**
 * Ordena as tabelas para que cada uma venha depois das que ela referencia (auto-referência ignorada).
 * Ciclos (ex.: evento_itens ↔ solicitacao_itens) são quebrados numa tabela cujas colunas do ciclo
 * aceitam nulo: essas colunas entram vazias e são preenchidas no fim (`adiadas`).
 */
function ordenarPorDependencia(tabelas: string[], fks: Fk[]): { ordem: string[]; adiadas: Map<string, string[]> } {
  const pendentes = new Set(tabelas);
  const ordem: string[] = [];
  const adiadas = new Map<string, string[]>();
  const refsPendentes = (t: string) => fks.filter((f) => f.filho === t && f.pai !== t && pendentes.has(f.pai));
  while (pendentes.size > 0) {
    const prontas = [...pendentes].filter((t) => refsPendentes(t).length === 0).sort();
    if (prontas.length > 0) {
      for (const t of prontas) {
        ordem.push(t);
        pendentes.delete(t);
      }
      continue;
    }
    const candidatas = [...pendentes].sort();
    const t = candidatas.find((c) => refsPendentes(c).every((f) => f.anulavel)) ?? candidatas[0];
    adiadas.set(t, [...new Set(refsPendentes(t).flatMap((f) => f.colunas))]);
    ordem.push(t);
    pendentes.delete(t);
  }
  return { ordem, adiadas };
}

async function ultimaMigracao(db: Executor): Promise<string | null> {
  try {
    const r = linhas(await db.execute(sql`select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`));
    return (r[0]?.hash as string | undefined) ?? null;
  } catch {
    return null;
  }
}

async function viaDados(destino: string) {
  const conn = await getConnection();
  const db = conn.db as unknown as Executor;
  try {
    const tabelas = linhas(await db.execute(sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`)).map((r) => String(r.table_name));
    // Chaves estrangeiras entre tabelas do schema public, com as colunas e se todas aceitam nulo.
    const fks: Fk[] = linhas(
      await db.execute(sql`
        select cf.relname as filho, cp.relname as pai,
               array_to_string(array(select a.attname from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey) order by a.attnum), ',') as colunas,
               not exists (select 1 from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey) and a.attnotnull) as anulavel
        from pg_constraint c
        join pg_class cf on cf.oid = c.conrelid join pg_namespace nf on nf.oid = cf.relnamespace
        join pg_class cp on cp.oid = c.confrelid join pg_namespace np on np.oid = cp.relnamespace
        where c.contype = 'f' and nf.nspname = 'public' and np.nspname = 'public'`),
    ).map((r) => ({ filho: String(r.filho), pai: String(r.pai), colunas: String(r.colunas).split(",").filter(Boolean), anulavel: r.anulavel === true || r.anulavel === "t" }));
    const { ordem, adiadas } = ordenarPorDependencia(tabelas, fks);
    const migracao = await ultimaMigracao(db);

    const gz = zlib.createGzip({ level: 9 });
    const arquivo = fs.createWriteStream(destino);
    const gravacao = pipeline(gz, arquivo);
    const escrever = async (s: string) => {
      if (!gz.write(s)) await once(gz, "drain");
    };
    // Um comando SQL por linha: `npm run restaurar` sem psql lê o arquivo linha a linha.
    await escrever(`-- npe-backup formato=dados versao=1\n-- gerado-em: ${new Date().toISOString()}\n-- migracao: ${migracao ?? "desconhecida"}\n-- banco: ${conn.kind}\n`);
    await escrever(`-- Só dados. Restaure num banco com as mesmas migrações: npm run restaurar -- <arquivo> --force\n`);
    await escrever(`SET client_encoding = 'UTF8';\nBEGIN;\n`);
    if (ordem.length > 0) await escrever(`TRUNCATE TABLE ${ordem.map((t) => `public.${ident(t)}`).join(", ")} CASCADE;\n`);
    const sequencias: string[] = [];
    const complementos: { tabela: string; chave: string[]; colunas: string[]; linhas: string[] }[] = [];
    let total = 0;
    for (const t of ordem) {
      const cols = linhas(
        await db.execute(sql`select column_name, column_default from information_schema.columns where table_schema = 'public' and table_name = ${t} and is_generated = 'NEVER' order by ordinal_position`),
      );
      const nomes = cols.map((c) => String(c.column_name));
      for (const c of cols) {
        if (String(c.column_default ?? "").startsWith("nextval(")) {
          const col = String(c.column_name);
          sequencias.push(`SELECT setval(pg_get_serial_sequence('public.${ident(t)}', '${col}'), coalesce(max(${ident(col)}), 0) + 1, false) FROM public.${ident(t)};`);
        }
      }
      const adiar = adiadas.get(t) ?? [];
      const chave = adiar.length
        ? linhas(
            await db.execute(
              sql`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = ${`public.${ident(t)}`}::regclass and i.indisprimary order by a.attnum`,
            ),
          ).map((r) => String(r.attname))
        : [];
      if (adiar.length && chave.length === 0) throw new Error(`Tabela ${t} sem chave primária num ciclo de chaves estrangeiras.`);
      // Cada coluna em texto (a forma que o próprio Postgres imprime e o COPY aceita de volta).
      const select = sql.raw(`select ${nomes.map((n) => `${ident(n)}::text as ${ident(n)}`).join(", ")} from public.${ident(t)}`);
      const rows = linhas(await db.execute(select));
      await escrever(`\nCOPY public.${ident(t)} (${nomes.map(ident).join(", ")}) FROM stdin;\n`);
      for (const r of rows) await escrever(nomes.map((n) => (adiar.includes(n) ? "\\N" : valorCopy(r[n]))).join("\t") + "\n");
      await escrever("\\.\n");
      if (adiar.length) {
        complementos.push({
          tabela: t,
          chave,
          colunas: adiar,
          linhas: rows.filter((r) => adiar.some((c) => r[c] != null)).map((r) => [...chave, ...adiar].map((c) => valorCopy(r[c])).join("\t")),
        });
      }
      total += rows.length;
      console.log(`  ${t}: ${rows.length} linha(s)${adiar.length ? ` (${adiar.join(", ")} preenchida(s) no fim: ciclo de chaves)` : ""}`);
    }
    // Colunas adiadas: tabela temporária com chave + valores, depois um UPDATE só.
    for (const c of complementos) {
      if (c.linhas.length === 0) continue;
      const tmp = ident(`npe_adiado_${c.tabela}`);
      const todas = [...c.chave, ...c.colunas];
      await escrever(`\nCREATE TEMP TABLE ${tmp} AS SELECT ${todas.map(ident).join(", ")} FROM public.${ident(c.tabela)} WITH NO DATA;\n`);
      await escrever(`COPY ${tmp} (${todas.map(ident).join(", ")}) FROM stdin;\n${c.linhas.join("\n")}\n\\.\n`);
      await escrever(
        `UPDATE public.${ident(c.tabela)} AS t SET ${c.colunas.map((col) => `${ident(col)} = a.${ident(col)}`).join(", ")} FROM ${tmp} AS a WHERE ${c.chave.map((k) => `t.${ident(k)} = a.${ident(k)}`).join(" AND ")};\n`,
      );
      await escrever(`DROP TABLE ${tmp};\n`);
    }
    if (sequencias.length > 0) await escrever(`\n${sequencias.join("\n")}\n`);
    await escrever(`COMMIT;\n`);
    gz.end();
    await gravacao;
    console.log(`  ${ordem.length} tabelas, ${total} linhas.`);
  } finally {
    await conn.close();
  }
}

/* ------------------------------------------------------------------ */
/* Object Storage do Replit (opcional, sem dependência no package.json) */
/* ------------------------------------------------------------------ */

type ResultadoOS<T = unknown> = { ok: boolean; value?: T; error?: unknown };
type ClienteOS = {
  uploadFromFilename(nome: string, arquivo: string): Promise<ResultadoOS>;
  list(opcoes?: { prefix?: string }): Promise<ResultadoOS<{ name: string }[]>>;
  delete(nome: string): Promise<ResultadoOS>;
};

async function enviarObjectStorage(arquivo: string) {
  const exigido = process.env.BACKUP_OBJECT_STORAGE === "true";
  if (process.env.BACKUP_OBJECT_STORAGE === "false") return;
  let modulo: { Client: new () => ClienteOS };
  try {
    // Nome em variável: o pacote não é dependência do projeto (instale com npm i @replit/object-storage).
    const nomePacote = "@replit/object-storage";
    modulo = (await import(nomePacote)) as { Client: new () => ClienteOS };
  } catch {
    if (exigido) throw new Error("BACKUP_OBJECT_STORAGE=true, mas o pacote @replit/object-storage não está instalado.");
    console.log("Object Storage: pacote @replit/object-storage não instalado — backup só na pasta local.");
    return;
  }
  try {
    const cliente = new modulo.Client();
    const nome = `backups/${path.basename(arquivo)}`;
    const up = await cliente.uploadFromFilename(nome, arquivo);
    if (!up.ok) throw new Error(`falha no envio: ${String(up.error)}`);
    console.log(`Object Storage: enviado ${nome}`);
    const lista = await cliente.list({ prefix: `backups/${PREFIXO}` });
    const antigos = (lista.value ?? [])
      .map((o) => o.name)
      .sort()
      .reverse()
      .slice(MANTER);
    for (const n of antigos) await cliente.delete(n);
    if (antigos.length) console.log(`Object Storage: ${antigos.length} backup(s) antigo(s) removido(s).`);
  } catch (e) {
    if (exigido) throw e;
    console.warn(`Object Storage: não foi possível enviar (${(e as Error).message}). O backup ficou só na pasta local.`);
  }
}

/* ------------------------------------------------------------------ */

function aplicarRetencao() {
  const arquivos = fs
    .readdirSync(DIR)
    .filter((f) => f.startsWith(PREFIXO) && f.endsWith(".sql.gz"))
    .sort()
    .reverse();
  for (const f of arquivos.slice(MANTER)) fs.rmSync(path.join(DIR, f));
  if (arquivos.length > MANTER) console.log(`Retenção: ${arquivos.length - MANTER} backup(s) antigo(s) removido(s) (mantendo ${MANTER}).`);
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const url = process.env.DATABASE_URL?.trim();
  const usarPgDump = MODO === "pg_dump" || (MODO === "auto" && Boolean(url) && temComando("pg_dump"));
  if (MODO === "pg_dump" && !url) throw new Error("BACKUP_MODO=pg_dump exige DATABASE_URL.");
  const base = `${PREFIXO}${carimbo()}`;
  let destino = path.join(DIR, `${base}.sql.gz`);
  const parcial = `${destino}.parcial`;
  try {
    if (usarPgDump) {
      console.log("Backup completo com pg_dump…");
      try {
        await viaPgDump(url!, parcial);
      } catch (e) {
        if (MODO === "pg_dump") throw e;
        console.warn(`pg_dump falhou (${(e as Error).message}). Exportando só os dados…`);
        fs.rmSync(parcial, { force: true });
        destino = path.join(DIR, `${base}-dados.sql.gz`);
        await viaDados(parcial);
      }
    } else {
      console.log(url ? "pg_dump não encontrado: exportando só os dados…" : "Banco local (PGlite): exportando só os dados…");
      destino = path.join(DIR, `${base}-dados.sql.gz`);
      await viaDados(parcial);
    }
    fs.renameSync(parcial, destino);
  } catch (e) {
    fs.rmSync(parcial, { force: true });
    throw e;
  }
  const kb = Math.round(fs.statSync(destino).size / 1024);
  console.log(`Backup gravado: ${destino} (${kb} KB)`);
  aplicarRetencao();
  await enviarObjectStorage(destino);
}

main().catch((e) => {
  console.error(`Backup falhou: ${(e as Error).message ?? e}`);
  process.exit(1);
});
