import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { arenas } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { caixaDeBusca, consultaOverpass, entornoDoOsm, type ArenaGeo, type ElementoOsm } from "@/domain/arena/entorno";
import { SLUGS_ARENAS_FIXAS } from "./arenas";
import { registrarHistorico } from "./support";

/** Quanto do entorno vem além da borda da planta (metros): o suficiente para a vista em perspectiva ter cidade em volta. */
const MARGEM_M = 220;
// Principal e espelhos públicos do Overpass. O principal recusa pedido sem identificação (406) e limita pedidos seguidos (504/429).
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const DOC_ENTORNO = "Entorno 3D";

export function validarGeo(geo: { lat: unknown; lon: unknown; giro: unknown }): ArenaGeo {
  const lat = Number(geo.lat);
  const lon = Number(geo.lon);
  const giro = Number(geo.giro ?? 0);
  const campos: Record<string, string> = {};
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) campos.lat = "Latitude entre -90 e 90 (ex.: -20,27648).";
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) campos.lon = "Longitude entre -180 e 180 (ex.: -40,28402).";
  if (!Number.isFinite(giro) || giro < -180 || giro > 180) campos.giro = "Giro entre -180° e 180°.";
  if (Object.keys(campos).length) throw new ValidacaoError("Confira as coordenadas do centro da planta.", campos);
  return { lat, lon, giro };
}

/** Busca no Overpass (OpenStreetMap): principal com nova tentativa após uma pausa, depois os espelhos. */
async function buscarOsm(consulta: string): Promise<ElementoOsm[]> {
  let ultimoErro = "";
  const tentativas = [SERVIDORES[0], SERVIDORES[0], SERVIDORES[1], SERVIDORES[0], SERVIDORES[2]];
  for (let i = 0; i < tentativas.length; i++) {
    try {
      const r = await fetch(tentativas[i], {
        method: "POST",
        body: "data=" + encodeURIComponent(consulta),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "NorteMkt-PlanejamentoEventos/1.0 (+https://planejamento-eventos.replit.app)" },
        signal: AbortSignal.timeout(35_000),
      });
      const texto = await r.text();
      if (r.ok && texto.trimStart().startsWith("{")) return (JSON.parse(texto) as { elements: ElementoOsm[] }).elements ?? [];
      ultimoErro = `HTTP ${r.status}`;
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
    }
    // Pausa crescente: o principal libera de novo em alguns segundos.
    await new Promise((ok) => setTimeout(ok, 3000 * (i + 1)));
  }
  throw new DomainError(`O OpenStreetMap não respondeu agora (${ultimoErro}). Tente de novo em alguns minutos.`);
}

async function arenaEditavel(slug: string) {
  if (SLUGS_ARENAS_FIXAS.includes(slug)) throw new ValidacaoError("A arena da Eco Run é fixa no sistema e já tem o entorno desenhado.");
  const db = await getDb();
  const row = await db.query.arenas.findFirst({ where: eq(arenas.slug, slug), columns: { id: true, nome: true, eventoId: true, base: true } });
  if (!row) throw new NaoEncontradoError("Arena");
  return row;
}

/**
 * Traz o entorno real (prédios com altura e ruas em volta) do OpenStreetMap para a arena, a partir de onde
 * a planta fica no mundo. Substitui só o que veio do OSM antes: o que foi desenhado à mão continua.
 */
export async function importarEntornoArena(usuario: UsuarioAtual, slug: string, geoInformado: { lat: unknown; lon: unknown; giro: unknown }, buscar: (consulta: string) => Promise<ElementoOsm[]> = buscarOsm) {
  exigir(usuario, "arena.editar");
  const geo = validarGeo(geoInformado);
  const row = await arenaEditavel(slug);
  const base = row.base;
  const elementos = await buscar(consultaOverpass(caixaDeBusca(geo, base.area, MARGEM_M)));
  const { edificacoes, vias } = entornoDoOsm(elementos, geo, base.area, MARGEM_M);
  const novaBase = {
    ...base,
    geo,
    edificacoes: [...base.edificacoes.filter((e) => e.origem !== "osm"), ...edificacoes],
    vias: [...base.vias.filter((v) => v.origem !== "osm"), ...vias],
    fonte: {
      ...base.fonte,
      documentos: [...base.fonte.documentos.filter((d) => d.nome !== DOC_ENTORNO), { nome: DOC_ENTORNO, detalhe: `Prédios e ruas do OpenStreetMap (© colaboradores do OpenStreetMap, ODbL): ${edificacoes.length} prédios, ${vias.length} trechos de rua` }],
    },
  };
  const db = await getDb();
  await db.update(arenas).set({ base: novaBase, atualizadoEm: new Date() }).where(eq(arenas.id, row.id));
  await registrarHistorico(db, {
    eventoId: row.eventoId,
    entidade: "arena",
    entidadeId: slug,
    acao: "ARENA_ENTORNO_IMPORTADO",
    descricao: `Entorno 3D da arena ${row.nome} importado do OpenStreetMap: ${edificacoes.length} prédios e ${vias.length} trechos de rua (centro ${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}; giro ${geo.giro}°).`,
    usuarioId: usuario.id,
    dadosDepois: { geo, predios: edificacoes.length, ruas: vias.length },
  });
  return { slug, eventoId: row.eventoId, predios: edificacoes.length, ruas: vias.length };
}

/** Tira o entorno importado (prédios e ruas do OSM); o resto da arena fica como está. */
export async function removerEntornoArena(usuario: UsuarioAtual, slug: string) {
  exigir(usuario, "arena.editar");
  const row = await arenaEditavel(slug);
  const base = row.base;
  const novaBase = {
    ...base,
    edificacoes: base.edificacoes.filter((e) => e.origem !== "osm"),
    vias: base.vias.filter((v) => v.origem !== "osm"),
    fonte: { ...base.fonte, documentos: base.fonte.documentos.filter((d) => d.nome !== DOC_ENTORNO) },
  };
  const db = await getDb();
  await db.update(arenas).set({ base: novaBase, atualizadoEm: new Date() }).where(eq(arenas.id, row.id));
  await registrarHistorico(db, { eventoId: row.eventoId, entidade: "arena", entidadeId: slug, acao: "ARENA_ENTORNO_REMOVIDO", descricao: `Entorno 3D da arena ${row.nome} removido.`, usuarioId: usuario.id });
  return { slug, eventoId: row.eventoId };
}
