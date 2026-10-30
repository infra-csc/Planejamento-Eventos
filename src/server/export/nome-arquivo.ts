/**
 * Nomes dos arquivos exportados do evento (auditoria 28/10, nº 180): um padrão só, "TIPO CÓDIGO NOME vN.ext"
 * (ex.: "OS EVT-0001 Night Run v3.xlsx"), no lugar de "OS-EVT-0001-v3", "ATA-…", "complemento-os-evt-…".
 * As planilhas no modelo da cenografia (OS de estrutura, de marcenaria e a lista da ata) mantêm o nome que a equipe espera.
 */
export function nomeArquivo(partes: ReadonlyArray<string | null | undefined | false>, extensao: "xlsx" | "csv") {
  const nome = partes
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" ")
    // Caracteres que o Windows não aceita em nome de arquivo; quebras e espaços repetidos viram um espaço.
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${nome}.${extensao}`;
}

/**
 * Cabeçalho de download com o nome em UTF-8 (`filename*`) e uma versão sem acento em `filename` para clientes antigos.
 * Antes ia só o UTF-8 cru em `filename`, que alguns clientes leem como "CONVENÃÃO" (auditoria 30/10, seção 5).
 */
export function contentDisposition(nome: string) {
  const ascii = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}
