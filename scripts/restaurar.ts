/**
 * Restaura um backup gerado por `npm run backup`. APAGA os dados atuais do banco de destino.
 *
 *   npm run restaurar -- .data/backups/npe-backup-2026-09-23_03-00-00Z.sql.gz            (só mostra o que faria)
 *   npm run restaurar -- .data/backups/npe-backup-2026-09-23_03-00-00Z.sql.gz --force    (restaura)
 *
 * - Dump completo (pg_dump): precisa de `psql` no PATH e de DATABASE_URL (no Replit, o módulo
 *   postgresql-16 fornece o psql). Recria tabelas e dados.
 * - Dump só de dados (arquivo "-dados"): o banco precisa estar com as mesmas migrações do backup
 *   (rode `npm run db:migrate` antes). Usa `psql` se houver; senão, carrega pelo próprio Node
 *   (funciona também no PGlite local). Tudo numa transação: se algo falhar, nada muda.
 *
 * Pare o app antes (ou restaure fora do horário de uso) e confira em docs/operacao.md.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { sql, type SQL } from "drizzle-orm";
import { getConnection } from "../src/server/db";

type Linha = Record<string, unknown>;
type Executor = { execute: (q: SQL) => Promise<unknown> };
const linhas = (r: unknown): Linha[] => ((r as { rows?: Linha[] }).rows ?? (r as Linha[])) as Linha[];

function temComando(cmd: string): boolean {
  return spawnSync(cmd, ["--version"], { stdio: "ignore", shell: process.platform === "win32" }).status === 0;
}

/** Primeiras linhas do arquivo descomprimido (para descobrir o formato). */
async function cabecalho(arquivo: string, n = 8): Promise<string[]> {
  const rl = readline.createInterface({ input: fs.createReadStream(arquivo).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  const out: string[] = [];
  for await (const l of rl) {
    out.push(l);
    if (out.length >= n) break;
  }
  rl.close();
  return out;
}

/** Desfaz o escape do formato texto do COPY. */
function valorDeCopy(campo: string): string | null {
  if (campo === "\\N") return null;
  return campo.replace(/\\(.)/g, (_, c: string) => ({ t: "\t", n: "\n", r: "\r", b: "\b", f: "\f", v: "\v", "\\": "\\" })[c] ?? c);
}

async function ultimaMigracao(db: Executor): Promise<string | null> {
  try {
    const r = linhas(await db.execute(sql`select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`));
    return (r[0]?.hash as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Roda o arquivo no psql. O dump completo vai numa transação única; o "só dados" já traz BEGIN/COMMIT. */
async function viaPsql(url: string, arquivo: string, transacaoUnica: boolean) {
  const proc = spawn("psql", ["--dbname", url, "-v", "ON_ERROR_STOP=1", ...(transacaoUnica ? ["--single-transaction"] : []), "--quiet", "-f", "-"], { stdio: ["pipe", "inherit", "inherit"] });
  const fim = once(proc, "close") as Promise<[number | null]>;
  await pipeline(fs.createReadStream(arquivo), zlib.createGunzip(), proc.stdin);
  const [codigo] = await fim;
  if (codigo !== 0) throw new Error(`psql terminou com código ${codigo}. Nada foi alterado (a transação foi desfeita).`);
}

/** Carrega um dump "só dados" sem psql: comandos simples com execute, blocos COPY como INSERT em lotes. */
async function viaNode(db: Executor & { transaction: <T>(fn: (tx: Executor) => Promise<T>) => Promise<T> }, arquivo: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(arquivo).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  await db.transaction(async (tx) => {
    let copia: { tabela: string; colunas: string; n: number; lote: (string | null)[][] } | null = null;
    const gravarLote = async () => {
      if (!copia || copia.lote.length === 0) return;
      // Parâmetros sem tipo: o Postgres converte cada texto para o tipo da coluna (como o COPY faz).
      const valores = sql.join(
        copia.lote.map((r) => sql`(${sql.join(r.map((v) => sql`${v}`), sql`, `)})`),
        sql`, `,
      );
      await tx.execute(sql`insert into ${sql.raw(copia.tabela)} (${sql.raw(copia.colunas)}) values ${valores}`);
      copia.lote = [];
    };
    let total = 0;
    for await (const l of rl) {
      if (copia) {
        if (l === "\\.") {
          await gravarLote();
          console.log(`  ${copia.tabela}: ${copia.n} linha(s)`);
          total += copia.n;
          copia = null;
          continue;
        }
        const campos = l.split("\t").map(valorDeCopy);
        copia.lote.push(campos);
        copia.n++;
        // Até ~30 mil parâmetros por comando (o limite do protocolo é 65535).
        if (copia.lote.length * campos.length >= 30_000) await gravarLote();
        continue;
      }
      const t = l.trim();
      if (!t || t.startsWith("--") || /^(BEGIN|COMMIT);$/i.test(t)) continue;
      const m = /^COPY\s+(\S+)\s+\((.*)\)\s+FROM\s+stdin;$/i.exec(t);
      if (m) {
        copia = { tabela: m[1], colunas: m[2], n: 0, lote: [] };
        continue;
      }
      await tx.execute(sql.raw(t));
    }
    console.log(`  ${total} linhas carregadas.`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const ignorarVersao = args.includes("--ignorar-versao");
  const arquivo = args.find((a) => !a.startsWith("--"));
  if (!arquivo) throw new Error("Uso: npm run restaurar -- <arquivo.sql.gz> --force");
  const caminho = path.resolve(arquivo);
  if (!fs.existsSync(caminho)) throw new Error(`Arquivo não encontrado: ${caminho}`);

  const topo = await cabecalho(caminho);
  const soDados = topo[0]?.startsWith("-- npe-backup formato=dados");
  const pgDump = topo.some((l) => l.includes("PostgreSQL database dump"));
  if (!soDados && !pgDump) throw new Error("Formato não reconhecido: use um arquivo gerado por npm run backup.");
  const migracaoBackup = topo.find((l) => l.startsWith("-- migracao: "))?.slice("-- migracao: ".length).trim() ?? null;
  const url = process.env.DATABASE_URL?.trim();
  const destino = url ? `Postgres ${new URL(url).host}${new URL(url).pathname}` : "PGlite local";

  console.log(`Arquivo: ${caminho}`);
  console.log(`Formato: ${soDados ? "só dados (COPY)" : "dump completo (pg_dump)"}`);
  console.log(`Banco de destino: ${destino}`);
  if (!force) {
    console.log("\nIsto APAGA os dados atuais do banco de destino e os substitui pelos do backup.");
    console.log("Pare o app e rode de novo com --force para confirmar.");
    process.exit(1);
  }

  if (pgDump) {
    if (!url) throw new Error("Dump completo (pg_dump) só restaura em Postgres: defina DATABASE_URL.");
    if (!temComando("psql")) throw new Error("psql não encontrado no PATH (no Replit: módulo postgresql-16 no .replit).");
    await viaPsql(url, caminho, true);
    console.log("Restauração concluída.");
    return;
  }

  const conn = await getConnection();
  try {
    const db = conn.db as unknown as Executor & { transaction: <T>(fn: (tx: Executor) => Promise<T>) => Promise<T> };
    const atual = await ultimaMigracao(db);
    if (!ignorarVersao && migracaoBackup && migracaoBackup !== "desconhecida" && atual !== migracaoBackup) {
      throw new Error(
        `O backup foi feito com outra versão das migrações (backup: ${migracaoBackup.slice(0, 12)}…, banco: ${atual?.slice(0, 12) ?? "nenhuma"}…). ` +
          "Restaure num banco com o mesmo código/migrações do backup, ou use --ignorar-versao por sua conta.",
      );
    }
    if (url && temComando("psql")) {
      await conn.close();
      await viaPsql(url, caminho, false);
    } else {
      await viaNode(db, caminho);
      await conn.close();
    }
    console.log("Restauração concluída.");
  } catch (e) {
    await conn.close().catch(() => undefined);
    throw e;
  }
}

main().catch((e) => {
  console.error(`Restauração falhou: ${(e as Error).message ?? e}`);
  process.exit(1);
});
