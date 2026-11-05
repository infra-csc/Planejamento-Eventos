/**
 * Armazenamento de arquivos enviados (anexos de projeto, peças, estoque e planta de arena).
 *
 * Os arquivos ficam na própria coluna bytea (driver `banco`). O driver de Object Storage do Replit foi
 * removido na migração para o VPS.
 *
 * Valores que começam com `npe-ref:` são REFERÊNCIAS a um armazenamento externo (formato antigo,
 * `npe-ref:replit:<chave>`). Nenhum arquivo aceito começa com esse prefixo (anexos e plantas são
 * validados pela assinatura PNG/JPEG/WebP/PDF). Se algum aparecer, o arquivo não está no banco e
 * precisa ser reimportado: a leitura falha com uma mensagem clara em vez de entregar lixo.
 * Para conferir antes da migração, veja docs/vps.md (§ Arquivos enviados).
 */

import { sql, type AnyColumn } from "drizzle-orm";

export type NomeDriver = "banco";

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

/** `npe-ref:<driver>:<chave>` → { driver, chave }; arquivo de verdade → null. */
export function lerReferencia(valor: Uint8Array | null | undefined): { driver: string; chave: string } | null {
  if (!valor || valor.length < PREFIXO_REF.length || valor.length > TAMANHO_MAX_REF) return null;
  const texto = Buffer.from(valor).toString("utf8");
  if (!texto.startsWith(PREFIXO_REF)) return null;
  const resto = texto.slice(PREFIXO_REF.length);
  const i = resto.indexOf(":");
  const driver = resto.slice(0, i);
  const chave = resto.slice(i + 1);
  if (i <= 0 || !chave) return null;
  return { driver, chave };
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
/* API usada pelos serviços                                             */
/* ------------------------------------------------------------------ */

/** Driver para GRAVAR arquivos novos. */
export async function driverAtual(): Promise<Armazenamento> {
  return driverBanco;
}

/**
 * Só o começo da coluna bytea, sem trazer o arquivo inteiro (até 8 MB) do banco: basta para saber se o
 * valor é uma referência e qual é a chave, na hora de apagar.
 */
export const inicioDoArquivo = (coluna: AnyColumn) => sql<Uint8Array | null>`substring(${coluna} from 1 for ${sql.raw(String(TAMANHO_MAX_REF))})`;

/** Guarda o arquivo e devolve o valor da coluna bytea. */
export async function gravarArquivo(chave: string, bytes: Buffer): Promise<Buffer> {
  return (await driverAtual()).gravar(chave, bytes);
}

/** Conteúdo do arquivo a partir do valor da coluna. */
export async function lerArquivo(valor: Uint8Array): Promise<Buffer> {
  const buf = Buffer.isBuffer(valor) ? valor : Buffer.from(valor);
  const ref = lerReferencia(buf);
  if (ref) {
    throw new Error(`Armazenamento: o arquivo ${ref.chave} estava no armazenamento externo "${ref.driver}" (Replit), que não existe mais. Reenvie o arquivo.`);
  }
  return buf;
}

/**
 * Antes apagava o arquivo externo apontado por uma referência. Com tudo no banco, quem apaga é o
 * DELETE/UPDATE da linha; a função fica para não mudar os serviços que a chamam.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function apagarArquivo(valor: Uint8Array | null | undefined): Promise<void> {}
