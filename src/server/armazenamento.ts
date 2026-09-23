/**
 * Armazenamento de arquivos enviados (anexos de projeto e planta de arena).
 *
 * Drivers:
 * - `banco` (padrão): o arquivo fica na própria coluna bytea, como sempre foi.
 * - `replit`: Object Storage do Replit. Liga com `ARMAZENAMENTO=replit` E o pacote
 *   `@replit/object-storage` instalado (import dinâmico; o pacote não é dependência do projeto).
 *   Sem o pacote, avisa no log e segue no banco.
 *
 * Sem migração: com o driver externo, a coluna bytea guarda uma REFERÊNCIA curta
 * (`npe-ref:replit:<chave>`) em vez do arquivo. Nenhum arquivo aceito começa com esse prefixo
 * (anexos e plantas são validados pela assinatura PNG/JPEG/WebP/PDF), então o próprio valor diz onde
 * o arquivo está: dá para ligar ou desligar o driver externo sem perder os arquivos antigos.
 * Passo a passo em docs/operacao.md (§ Armazenamento de arquivos).
 */

import { sql, type AnyColumn } from "drizzle-orm";

export type NomeDriver = "banco" | "replit";

/** Um lugar onde os bytes moram. `gravar` devolve o valor a guardar na coluna bytea. */
export interface Armazenamento {
  readonly nome: NomeDriver;
  gravar(chave: string, bytes: Buffer): Promise<Buffer>;
  /** Conteúdo a partir do valor da coluna. */
  ler(valor: Buffer): Promise<Buffer>;
  /** Apaga o arquivo apontado pelo valor da coluna (no banco, quem apaga é o DELETE/UPDATE da linha). */
  apagar(valor: Buffer): Promise<void>;
}

const PREFIXO_REF = "npe-ref:";
/** Bytes iniciais que bastam para reconhecer (e ler inteira) uma referência. */
export const TAMANHO_MAX_REF = 512;

/** `npe-ref:replit:anexos/…` → { driver: "replit", chave: "anexos/…" }; arquivo de verdade → null. */
export function lerReferencia(valor: Uint8Array | null | undefined): { driver: NomeDriver; chave: string } | null {
  if (!valor || valor.length < PREFIXO_REF.length || valor.length > TAMANHO_MAX_REF) return null;
  const texto = Buffer.from(valor).toString("utf8");
  if (!texto.startsWith(PREFIXO_REF)) return null;
  const resto = texto.slice(PREFIXO_REF.length);
  const i = resto.indexOf(":");
  const driver = resto.slice(0, i);
  const chave = resto.slice(i + 1);
  if (i <= 0 || driver !== "replit" || !chave) return null;
  return { driver, chave };
}

export function montarReferencia(driver: Exclude<NomeDriver, "banco">, chave: string): Buffer {
  return Buffer.from(`${PREFIXO_REF}${driver}:${chave}`, "utf8");
}

/* ------------------------------------------------------------------ */
/* Driver banco                                                         */
/* ------------------------------------------------------------------ */

export const driverBanco: Armazenamento = {
  nome: "banco",
  async gravar(_chave, bytes) {
    return bytes;
  },
  async ler(valor) {
    return valor;
  },
  async apagar() {},
};

/* ------------------------------------------------------------------ */
/* Driver Object Storage do Replit                                      */
/* ------------------------------------------------------------------ */

type ResultadoOS<T = unknown> = { ok: boolean; value?: T; error?: unknown };
type ClienteOS = {
  uploadFromBytes(nome: string, bytes: Buffer): Promise<ResultadoOS>;
  downloadAsBytes(nome: string): Promise<ResultadoOS<[Buffer]>>;
  delete(nome: string, opcoes?: { ignoreNotFound?: boolean }): Promise<ResultadoOS>;
};

let clienteReplit: Promise<ClienteOS | null> | null = null;

/**
 * Cliente do Object Storage, ou null sem o pacote. O `import()` passa por `new Function` para o
 * bundler do Next não tentar resolver um pacote que não está no package.json (em tempo de execução é
 * o import nativo do Node).
 */
function obterClienteReplit(): Promise<ClienteOS | null> {
  clienteReplit ??= (async () => {
    try {
      const importar = new Function("m", "return import(m)") as (m: string) => Promise<{ Client: new () => ClienteOS }>;
      const modulo = await importar("@replit/object-storage");
      return new modulo.Client();
    } catch {
      return null;
    }
  })();
  return clienteReplit;
}

function falhaOS(acao: string, chave: string, r: ResultadoOS): Error {
  return new Error(`Object Storage: falha ao ${acao} ${chave} (${String((r.error as { message?: string })?.message ?? r.error)})`);
}

async function clienteObrigatorio(): Promise<ClienteOS> {
  const cliente = await obterClienteReplit();
  if (!cliente) throw new Error("Arquivo guardado no Object Storage do Replit, mas o pacote @replit/object-storage não está instalado (npm i @replit/object-storage).");
  return cliente;
}

export const driverReplit: Armazenamento = {
  nome: "replit",
  async gravar(chave, bytes) {
    const cliente = await clienteObrigatorio();
    const r = await cliente.uploadFromBytes(chave, bytes);
    if (!r.ok) throw falhaOS("gravar", chave, r);
    return montarReferencia("replit", chave);
  },
  async ler(valor) {
    const ref = lerReferencia(valor);
    if (!ref) return valor;
    const cliente = await clienteObrigatorio();
    const r = await cliente.downloadAsBytes(ref.chave);
    if (!r.ok || !r.value) throw falhaOS("ler", ref.chave, r);
    return Buffer.from(r.value[0]);
  },
  async apagar(valor) {
    const ref = lerReferencia(valor);
    if (!ref) return;
    const cliente = await clienteObrigatorio();
    const r = await cliente.delete(ref.chave, { ignoreNotFound: true });
    if (!r.ok) throw falhaOS("apagar", ref.chave, r);
  },
};

/* ------------------------------------------------------------------ */
/* API usada pelos serviços                                             */
/* ------------------------------------------------------------------ */

let avisouSemPacote = false;

/** Driver para GRAVAR arquivos novos (a leitura segue o que cada valor diz). */
export async function driverAtual(): Promise<Armazenamento> {
  if (process.env.ARMAZENAMENTO?.trim().toLowerCase() !== "replit") return driverBanco;
  if (await obterClienteReplit()) return driverReplit;
  if (!avisouSemPacote) {
    avisouSemPacote = true;
    console.warn("ARMAZENAMENTO=replit, mas o pacote @replit/object-storage não está instalado: arquivos novos vão para o banco.");
  }
  return driverBanco;
}

/**
 * Só o começo da coluna bytea, sem trazer o arquivo inteiro (até 8 MB) do banco: basta para saber se o
 * valor é uma referência e qual é a chave, na hora de apagar.
 */
export const inicioDoArquivo = (coluna: AnyColumn) => sql<Uint8Array | null>`substring(${coluna} from 1 for ${sql.raw(String(TAMANHO_MAX_REF))})`;

/** Guarda o arquivo e devolve o valor da coluna bytea (o arquivo, ou a referência ao Object Storage). */
export async function gravarArquivo(chave: string, bytes: Buffer): Promise<Buffer> {
  return (await driverAtual()).gravar(chave, bytes);
}

/** Conteúdo do arquivo a partir do valor da coluna, esteja ele no banco ou fora. */
export async function lerArquivo(valor: Uint8Array): Promise<Buffer> {
  const buf = Buffer.isBuffer(valor) ? valor : Buffer.from(valor);
  return lerReferencia(buf) ? driverReplit.ler(buf) : buf;
}

/**
 * Apaga o arquivo externo apontado pelo valor (no banco não há o que apagar além da linha). Basta
 * passar o começo do valor (`TAMANHO_MAX_REF` bytes): ver `inicioDoArquivo` nos serviços.
 * Falha ao apagar fica no log — o registro no banco já saiu e um arquivo órfão não quebra nada.
 */
export async function apagarArquivo(valor: Uint8Array | null | undefined): Promise<void> {
  if (!valor || !lerReferencia(valor)) return;
  try {
    await driverReplit.apagar(Buffer.from(valor));
  } catch (e) {
    console.error(`Armazenamento: ${(e as Error).message}`);
  }
}
