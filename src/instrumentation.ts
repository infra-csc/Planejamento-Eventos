import type { Instrumentation } from "next";

/**
 * Ao subir o servidor: correções de dados idempotentes (rodam uma vez de verdade; depois não acham nada).
 * Em segundo plano, para não atrasar a abertura da porta; falha só vai para o log.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  void (async () => {
    try {
      const { retirarItensPadraoDasAtasAbertas } = await import("@/server/services/eventos/itens-padrao");
      const n = await retirarItensPadraoDasAtasAbertas();
      if (n) console.log(JSON.stringify({ nivel: "info", evento: "itens_padrao_retirados", linhas: n }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "itens_padrao_retirados", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Eventos do Ummense de 28/11 a 31/12/2026 (uma vez só; a marca fica em `configuracoes`).
    try {
      const { importarLoteDoUmmense } = await import("@/server/services/eventos/ummense");
      const r = await importarLoteDoUmmense();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "ummense_importado", criados: r.criados.length, jaExistiam: r.jaExistiam, pulados: r.pulados }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "ummense_importado", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Estoque da Ativação: o inventário de 2025 da planilha (uma vez só; a marca fica em `configuracoes`).
    try {
      const { importarEstoqueInicial } = await import("@/server/services/estoque");
      const r = await importarEstoqueInicial();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "estoque_importado", itens: r.itens, ligados: r.ligados }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "estoque_importado", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Regras passadas nas atas abertas (testeira a definir com tenda; pranchão no cavalete reto), uma vez só.
    try {
      const { ressincronizarAtasAbertas } = await import("@/server/services/eventos/regras-kit");
      const r = await ressincronizarAtasAbertas();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "regras_atas_abertas", eventos: r.eventos, mudancas: r.mudancas }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "regras_atas_abertas", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Eventos que ainda usam versão anterior de algum projeto passam para a atual (uma vez só).
    try {
      const { atualizarProjetosDefasados } = await import("@/server/services/eventos/versoes");
      const r = await atualizarProjetosDefasados();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "projetos_atualizados_nos_eventos", eventos: r.eventos.length, linhas: r.linhas, pendentes: r.pendentes.length }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "projetos_atualizados_nos_eventos", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Atas fechadas antes da regra do prisma: grades do prisma (uma vez só, com nova versão da OS).
    try {
      const { aplicarGradesDoPrismaNasAtasFechadas } = await import("@/server/services/eventos/regras-kit");
      const r = await aplicarGradesDoPrismaNasAtasFechadas();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "grades_prisma_atas_fechadas", eventos: r.eventos }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "grades_prisma_atas_fechadas", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Cantoneira universal (26/10): a da tenda 3×3 entra na da 5×5 em projetos, atas e solicitações (uma vez só).
    try {
      const { unificarCantoneiras } = await import("@/server/services/cantoneira-universal");
      const r = await unificarCantoneiras();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "cantoneira_universal", projetos: r.projetos, linhasAta: r.linhasAta, solicitacoes: r.solicitacoes }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "cantoneira_universal", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Atas fechadas antes de o pranchão voltar ao cavalete reto (20/10): cavaletes dos pranchões (uma vez só, com nova OS).
    try {
      const { aplicarCavaleteRetoNasAtasFechadas } = await import("@/server/services/eventos/regras-kit");
      const r = await aplicarCavaleteRetoNasAtasFechadas();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "cavalete_reto_atas_fechadas", eventos: r.eventos }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "cavalete_reto_atas_fechadas", mensagem: err instanceof Error ? err.message : String(err) }));
    }
    // Eventos de teste fora da produção: EVT-0261 (cópia do NIGHT RUN BH), EVT-0206 e EVT-0207 (uma vez só).
    try {
      const { apagarEventosDeTeste } = await import("@/server/services/eventos/limpeza-testes");
      const r = await apagarEventosDeTeste();
      if (r.feito) console.log(JSON.stringify({ nivel: "info", evento: "eventos_teste_apagados", eventos: r.eventos, solicitacoes: r.solicitacoes }));
    } catch (err) {
      console.error(JSON.stringify({ nivel: "erro", evento: "eventos_teste_apagados", mensagem: err instanceof Error ? err.message : String(err) }));
    }
  })();
}

/**
 * Observabilidade: todo erro de servidor que o Next captura (render, route handler, action, proxy)
 * vira uma linha JSON no log — o mesmo formato de `tratarErro` (src/lib/action.ts). O `ref` é o
 * digest que a tela de erro mostra, então a pessoa pode informar o código e achamos a linha.
 * Nada sensível: sem cabeçalhos, cookies, query string nem corpo da requisição.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const { linhaLogErro } = await import("@/lib/action");
    const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
    // Redirect/notFound também passam por aqui como "erros" de controle de fluxo: não são falhas.
    if (digest && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "DYNAMIC_SERVER_USAGE")) return;
    const usuarioId = await usuarioDaRequisicao(request.headers);
    console.error(
      linhaLogErro(err, {
        ref: digest ?? Math.random().toString(36).slice(2, 8).toUpperCase(),
        rota: context.routePath,
        metodo: request.method,
        origem: context.routeType,
        usuarioId,
      }),
    );
  } catch {
    // O log de erro nunca pode derrubar a resposta.
  }
};

/** Id do usuário da sessão (só o id; nunca o token). Falha em silêncio: o log sai mesmo sem ele. */
async function usuarioDaRequisicao(headers: Record<string, string | string[] | undefined>): Promise<string | null> {
  try {
    const bruto = headers["cookie"];
    const cookie = Array.isArray(bruto) ? bruto.join("; ") : (bruto ?? "");
    const { COOKIE_SESSAO } = await import("@/server/auth/cookies");
    const token = cookie
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${COOKIE_SESSAO}=`))
      ?.slice(COOKIE_SESSAO.length + 1);
    if (!token) return null;
    // Banco só no runtime Node (o bloco some do bundle edge).
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const [{ hashToken }, { getDb }, { sessoes }, { eq }] = await Promise.all([import("@/server/auth/password"), import("@/server/db"), import("@/server/db/schema"), import("drizzle-orm")]);
      const db = await getDb();
      const [s] = await db.select({ usuarioId: sessoes.usuarioId }).from(sessoes).where(eq(sessoes.tokenHash, hashToken(decodeURIComponent(token)))).limit(1);
      return s?.usuarioId ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
