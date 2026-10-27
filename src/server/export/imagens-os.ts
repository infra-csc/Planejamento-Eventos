import sharp from "sharp";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { anexos, pecaAnexos, pecas, projetos } from "@/server/db/schema";
import { lerArquivo } from "@/server/armazenamento";
import type { Imagem } from "./os-estrutura-xlsx";

/*
 * Imagens para as planilhas da OS: a primeira foto (capa) de cada projeto ou peça do catálogo, só PNG/JPEG,
 * reduzida para não pesar a pasta. A OS de estrutura põe o desenho do projeto na aba dele; a de marcenaria põe
 * a foto da peça em cada linha (quem carrega reconhece pela imagem quando o nome confunde).
 */

/**
 * Imagens já reduzidas, por id do anexo e largura (null = ilegível). Anexo não é editado, só incluído e removido:
 * o id identifica o conteúdo para sempre. Exportar de novo não relê o original do banco nem refaz o sharp.
 */
const prontas = new Map<string, Imagem | null>();
/** Algumas dezenas de projetos e peças com foto; limita a memória da instância. */
const MAX_IMAGENS = 300;

function guardar(chave: string, imagem: Imagem | null) {
  if (prontas.size >= MAX_IMAGENS) prontas.delete(prontas.keys().next().value as string);
  prontas.set(chave, imagem);
}

/** Capa de cada projeto ou peça (pelo código), na largura pedida. Sem foto legível, o código fica de fora. */
export async function imagensDoCatalogo(origem: "projeto" | "peca", codigos: string[], largura: number): Promise<Map<string, Imagem>> {
  const out = new Map<string, Imagem>();
  if (codigos.length === 0) return out;
  const db = await getDb();
  const donos =
    origem === "projeto"
      ? await db.select({ id: projetos.id, codigo: projetos.codigo }).from(projetos).where(inArray(projetos.codigo, codigos))
      : await db.select({ id: pecas.id, codigo: pecas.codigo }).from(pecas).where(inArray(pecas.codigo, codigos));
  if (donos.length === 0) return out;
  const ids = donos.map((d) => d.id);
  const metas =
    origem === "projeto"
      ? await db.select({ id: anexos.id, dono: anexos.projetoId, mime: anexos.mime }).from(anexos).where(and(inArray(anexos.projetoId, ids), eq(anexos.tipo, "IMAGEM"))).orderBy(asc(anexos.criadoEm))
      : await db.select({ id: pecaAnexos.id, dono: pecaAnexos.pecaId, mime: pecaAnexos.mime }).from(pecaAnexos).where(and(inArray(pecaAnexos.pecaId, ids), eq(pecaAnexos.tipo, "IMAGEM"))).orderBy(asc(pecaAnexos.criadoEm));
  const capa = new Map<string, { id: string; mime: string }>();
  for (const m of metas) if (!capa.has(m.dono)) capa.set(m.dono, m);
  const escolhidas = [...capa.entries()].filter(([, m]) => m.mime === "image/png" || m.mime === "image/jpeg");
  if (escolhidas.length === 0) return out;
  const chave = (id: string) => `${origem}-${id}-${largura}`;
  // Só os originais que ainda não foram reduzidos nesta instância vêm do banco.
  const faltam = escolhidas.map(([, m]) => m.id).filter((id) => !prontas.has(chave(id)));
  const conteudos = faltam.length
    ? origem === "projeto"
      ? await db.select({ id: anexos.id, conteudo: anexos.conteudo }).from(anexos).where(inArray(anexos.id, faltam))
      : await db.select({ id: pecaAnexos.id, conteudo: pecaAnexos.conteudo }).from(pecaAnexos).where(inArray(pecaAnexos.id, faltam))
    : [];
  const conteudoDe = new Map(conteudos.map((c) => [c.id, c.conteudo]));
  for (const [donoId, m] of escolhidas) {
    const codigo = donos.find((d) => d.id === donoId)?.codigo;
    if (!codigo) continue;
    if (prontas.has(chave(m.id))) {
      const pronta = prontas.get(chave(m.id));
      if (pronta) out.set(codigo, pronta);
      continue;
    }
    const valor = conteudoDe.get(m.id);
    if (!valor) continue;
    try {
      // O valor pode ser o arquivo (banco) ou a referência ao Object Storage.
      const bruto = await lerArquivo(valor);
      const base = sharp(new Uint8Array(bruto)).rotate().resize({ width: largura, withoutEnlargement: true });
      const extension = m.mime === "image/png" ? "png" : "jpeg";
      const { data, info } = await (extension === "png" ? base.png() : base.jpeg({ quality: 82 })).toBuffer({ resolveWithObject: true });
      const imagem: Imagem = { buffer: data, extension, largura: info.width, altura: info.height };
      guardar(chave(m.id), imagem);
      out.set(codigo, imagem);
    } catch {
      // Imagem ilegível: a planilha sai sem ela (e não se tenta de novo a cada exportação).
      guardar(chave(m.id), null);
    }
  }
  return out;
}
