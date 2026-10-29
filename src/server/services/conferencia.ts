import { grupoDaLinha } from "@/domain/grupos-material";
import { descricaoDaRegra, necessidadesAcompanhantes } from "@/domain/regras-kit";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, historico, pecas, solicitacaoItens, solicitacoes, usuarios, type BomSnapshotLinha } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { descricaoLinha, resumirAjustes } from "@/domain/os";
import { obterLinhasAta } from "./eventos";
import { gerarOsVersao, montarLinhasAta } from "./os";
import { responderNaTransacao } from "./solicitacoes";
import { bloquearEvento, notificar, notificarAjusteLinha, registrarHistorico, usuariosComPedidoNoEvento, usuariosDaArea, type Executor } from "./support";

/** Descrições das unidades agrupadas por texto; uma descrição só num pedido de várias vale para todas. */
function gruposDescricao(lista: readonly string[] | null | undefined, quantidade: number) {
  const itens = (lista ?? []).map((d) => d.trim());
  if (!itens.some(Boolean)) return [];
  if (itens.length === 1) return [{ texto: itens[0], unidades: quantidade }];
  return agruparDescricoes(itens);
}
import { agruparDescricoes, textoDescricoes } from "@/domain/descricoes-itens";
import { sincronizarRegrasAta } from "@/server/services/eventos/regras-kit";
import { distribuirTendasDoLocal, kitDaTenda, KITS_TENDA, PAPEIS_POR_LOCAL, padraoPorTenda, papeisDoKit, type PapelTenda } from "@/domain/tendas";
import { incluirLinhaAta, incluirLinhaNaTransacao, snapshotBom, type DadosLinhaAta } from "./eventos";

/** Ações do histórico que contam como "ajuste de quantidade" de uma linha, para o log da conferência. */
const ACOES_AJUSTE = ["CONFERENCIA_AJUSTE", "ATA_QUANTIDADE"];

type Registro = { acao: string; dadosAntes: unknown; dadosDepois: unknown; descricao: string; criadoEm: Date; por: string | null };

/** Texto curto do ajuste ("3 → 2 · motivo"), sem repetir o nome do item que já está na linha. */
function textoAjuste(r: Registro): string {
  const a = (r.dadosAntes ?? {}) as Record<string, unknown>;
  const d = (r.dadosDepois ?? {}) as Record<string, unknown>;
  if (r.acao === "CONFERENCIA_AJUSTE") return `${a.quantidade} → ${Number(d.quantidade) === 0 ? "retirado da ata" : d.quantidade}${d.motivo ? ` · ${d.motivo}` : ""}`;
  if (r.acao === "RESPOSTA_CORRIGIDA") return `${a.quantidadeAtendida ?? "?"} → ${Number(d.quantidadeAtendida) === 0 ? "retirado da ata" : d.quantidadeAtendida}${d.observacaoLogistica ? ` · ${d.observacaoLogistica}` : ""}`;
  if (r.acao === "ATA_QUANTIDADE") return `${a.quantidade} → ${d.quantidade}`;
  return r.descricao;
}

/**
 * Tudo que a tela de conferência da reunião mostra: cada linha da ata com quem pediu
 * (solicitação, pessoa, data, observação e peças ajustadas), situação da conferência
 * e o último ajuste de quantidade (quem, quando, de quanto para quanto e o motivo).
 */
export async function obterConferencia(eventoId: string) {
  const db = await getDb();
  const linhas = await obterLinhasAta(eventoId);
  const itemIds = linhas.map((l) => l.registro.solicitacaoItemId).filter((x): x is string => Boolean(x));
  const linhaIds = linhas.map((l) => l.id);

  const [origens, ajustes, correcoes, criadores] = await Promise.all([
    itemIds.length
      ? db
          .select({
            itemId: solicitacaoItens.id,
            quantidadeSolicitada: solicitacaoItens.quantidadeSolicitada,
            justificativa: solicitacaoItens.justificativa,
            descricoes: solicitacaoItens.descricoes,
            ajustesBom: solicitacaoItens.ajustesBom,
            solicitacaoId: solicitacoes.id,
            codigo: solicitacoes.codigo,
            titulo: solicitacoes.titulo,
            enviadaEm: solicitacoes.enviadaEm,
            solicitante: usuarios.nome,
          })
          .from(solicitacaoItens)
          .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
          .innerJoin(usuarios, eq(solicitacoes.criadoPorId, usuarios.id))
          .where(inArray(solicitacaoItens.id, itemIds))
      : Promise.resolve([]),
    linhaIds.length
      ? db
          .select({ entidadeId: historico.entidadeId, acao: historico.acao, dadosAntes: historico.dadosAntes, dadosDepois: historico.dadosDepois, descricao: historico.descricao, criadoEm: historico.criadoEm, por: usuarios.nome })
          .from(historico)
          .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
          .where(and(eq(historico.entidade, "evento_item"), inArray(historico.entidadeId, linhaIds), inArray(historico.acao, ACOES_AJUSTE)))
          .orderBy(desc(historico.criadoEm))
      : Promise.resolve([]),
    // Correções feitas pela tela da solicitação também mudam a linha: entram no mesmo log.
    itemIds.length
      ? db
          .select({ entidadeId: historico.entidadeId, acao: historico.acao, dadosAntes: historico.dadosAntes, dadosDepois: historico.dadosDepois, descricao: historico.descricao, criadoEm: historico.criadoEm, por: usuarios.nome })
          .from(historico)
          .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
          .where(and(eq(historico.entidade, "solicitacao_item"), inArray(historico.entidadeId, itemIds), eq(historico.acao, "RESPOSTA_CORRIGIDA")))
          .orderBy(desc(historico.criadoEm))
      : Promise.resolve([]),
    linhaIds.length
      ? db.select({ id: eventoItens.id, por: usuarios.nome }).from(eventoItens).leftJoin(usuarios, eq(eventoItens.criadoPorId, usuarios.id)).where(inArray(eventoItens.id, linhaIds))
      : Promise.resolve([]),
  ]);

  // Peças do kit de tenda que variam por local (fechamento, calha), para a tenda mostrar e ajustar os totais.
  const codigosKit = [...new Set(KITS_TENDA.flatMap((k) => PAPEIS_POR_LOCAL.map((papel) => k.pecas[papel]).filter((c): c is string => Boolean(c))))];
  const pecasKit = codigosKit.length ? await db.select({ id: pecas.id, codigo: pecas.codigo }).from(pecas).where(inArray(pecas.codigo, codigosKit)) : [];
  const idDoCodigo = new Map(pecasKit.map((x) => [x.codigo, x.id]));
  const tendaDe = (l: (typeof linhas)[number]) => {
    if (l.tipo !== "PROJETO" || !l.registro.projetoId) return null;
    const bom = l.registro.bomSnapshot ?? [];
    const kit = kitDaTenda(bom.map((b) => b.codigo));
    if (!kit) return null;
    return {
      tamanho: kit.tamanho,
      projetoId: l.registro.projetoId,
      pecas: papeisDoKit(kit)
        .filter((x) => PAPEIS_POR_LOCAL.includes(x.papel))
        .map((x) => ({ papel: x.papel, rotulo: x.rotulo, codigo: x.codigo, pecaId: bom.find((b) => b.codigo === x.codigo)?.pecaId ?? idDoCodigo.get(x.codigo) ?? null, porUnidade: bom.find((b) => b.codigo === x.codigo)?.quantidade ?? 0 })),
    };
  };

  const origemDe = new Map(origens.map((o) => [o.itemId, o]));
  const ultimoAjuste = new Map<string, Registro>();
  for (const a of ajustes) if (!ultimoAjuste.has(a.entidadeId)) ultimoAjuste.set(a.entidadeId, a);
  const ultimaCorrecao = new Map<string, Registro>();
  for (const c of correcoes) if (!ultimaCorrecao.has(c.entidadeId)) ultimaCorrecao.set(c.entidadeId, c);
  const criadorDe = new Map(criadores.map((c) => [c.id, c.por]));

  return linhas.map((l) => {
    const o = l.registro.solicitacaoItemId ? origemDe.get(l.registro.solicitacaoItemId) : undefined;
    // O ajuste da conferência grava os dois registros juntos; a correção só vale se for mais recente.
    const daLinha = ultimoAjuste.get(l.id);
    const doItem = l.registro.solicitacaoItemId ? ultimaCorrecao.get(l.registro.solicitacaoItemId) : undefined;
    const aj = doItem && (!daLinha || doItem.criadoEm.getTime() - daLinha.criadoEm.getTime() > 2000) ? doItem : daLinha;
    return {
      id: l.id,
      tipo: l.tipo,
      // Peça: só o nome (o código já vai à parte, no selo).
      nome: l.tipo === "PECA" && l.peca ? l.peca.nome : l.nome,
      codigo: l.tipo === "PROJETO" ? (l.projeto?.codigo ?? null) : l.tipo === "PECA" ? (l.peca?.codigo ?? null) : null,
      versao: l.versao,
      quantidade: l.quantidade,
      destino: l.destino,
      areaNome: l.areaNome,
      areaId: l.registro.areaId ?? null,
      capaId: l.capaId ?? null,
      conferidoEm: l.conferidoEm ? l.conferidoEm.toISOString() : null,
      conferidoPor: l.conferidoPor ?? null,
      origem: o
        ? {
            solicitacaoId: o.solicitacaoId,
            codigo: o.codigo,
            titulo: o.titulo,
            solicitante: o.solicitante,
            enviadaEm: o.enviadaEm ? o.enviadaEm.toISOString() : null,
            quantidadeSolicitada: o.quantidadeSolicitada,
            /** Descrição das unidades, como quem pediu escreveu (texto, arte, medida). */
            descricao: textoDescricoes(o.descricoes, o.quantidadeSolicitada),
            /** Ordem original para a visualização individual, sem juntar textos iguais. */
            descricoesPorUnidade: o.descricoes ?? [],
            /** As mesmas descrições em lista: quantas unidades levam cada texto. */
            descricoes: gruposDescricao(o.descricoes, o.quantidadeSolicitada),
            /** Observação do solicitante sobre o item. */
            observacao: o.justificativa?.trim() || null,
            ajustes: resumirAjustes(o.ajustesBom),
          }
        : null,
      incluidaPor: o ? null : (criadorDe.get(l.id) ?? null),
      /** Grupo de material, como na lista de materiais da ata (Estrutura, Tendas, Ativação, Percurso, Arena). */
      grupo: grupoDaLinha({ tipo: l.tipo, projeto: l.registro.projeto, peca: l.registro.peca }),
      /** Linha criada por regra da logística (ex.: "2 por stand + 6 por palco show"). */
      regra: descricaoDaRegra(l.registro.regra),
      /** Chave da regra (ex.: "grade-prisma"): a tela decide se a linha aceita "a mais na reunião". */
      regraChave: l.registro.regra ?? null,
      /** Tenda: tamanho e, por tenda, as peças que mudam por local (a conferência mostra o total do local). */
      tenda: tendaDe(l),
      ultimoAjuste: aj ? { por: aj.por ?? "—", em: aj.criadoEm.toISOString(), descricao: textoAjuste(aj) } : null,
    };
  });
}

export type LinhaConferencia = Awaited<ReturnType<typeof obterConferencia>>[number];

/** Cavaletes e pés da ata: quanto a regra pede pelas peças de origem e quanto a ata tem (com o nome da peça). */
export async function acompanhantesDaAta(eventoId: string, ex?: Executor) {
  const db = ex ?? (await getDb());
  const linhas = await db.query.eventoItens.findMany({
    where: and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)),
    with: { projeto: { columns: { nome: true, categoria: true } }, peca: { columns: { codigo: true } } },
  });
  const nec = necessidadesAcompanhantes(linhas.map((l) => ({ tipo: l.tipo, quantidade: l.quantidade, projeto: l.projeto, pecaCodigo: l.peca?.codigo ?? null, bom: l.bomSnapshot, regra: l.regra })));
  const nomes = nec.length ? await db.select({ codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(inArray(pecas.codigo, nec.map((n) => n.codigo))) : [];
  // Peça que o catálogo não tem: a regra não consegue incluir; a tela avisa em vez de oferecer "Incluir".
  return nec.map((n) => {
    const p = nomes.find((x) => x.codigo === n.codigo);
    return { ...n, nome: p?.nome ?? n.codigo, cadastrada: Boolean(p) };
  });
}

export type AcompanhanteDaAta = Awaited<ReturnType<typeof acompanhantesDaAta>>[number];

/**
 * Completa o que vem junto (cavalete, pé) até o que a regra pede: inclui uma linha da logística com o que falta.
 * A falta é contada dentro da transação, com o evento travado: dois cliques (ou duas pessoas) não incluem duas vezes.
 */
export async function completarAcompanhante(usuario: UsuarioAtual, eventoId: string, codigo: string) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const n = (await acompanhantesDaAta(eventoId, tx)).find((x) => x.codigo === codigo);
    const falta = n ? n.precisa - n.naAta : 0;
    if (!n || falta <= 0) throw new DomainError("Nada a completar: a ata já tem o que a regra pede.");
    const peca = await tx.query.pecas.findFirst({ where: eq(pecas.codigo, codigo), columns: { id: true } });
    if (!peca) throw new NaoEncontradoError("Peça");
    const dados = { referenciaTipo: "PECA" as const, projetoId: null, pecaId: peca.id, descricaoLivre: null, quantidade: falta, destino: null, areaId: null, justificativa: `Completa a regra (${n.texto})` };
    const { linha, geraOs, desc, ev } = await incluirLinhaNaTransacao(tx, usuario, eventoId, dados);
    if (geraOs) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, `${desc} × ${falta} incluído — ${dados.justificativa}`);
      await notificarAjusteLinha(tx, { eventoId, areaId: null, tipo: "ATA_AJUSTE", titulo: `Item novo na OS: ${ev.nome}`, mensagem: `A logística incluiu ${desc} × ${falta}. Motivo: ${dados.justificativa}`, mensagemSemMotivo: `A logística incluiu ${desc} × ${falta}.`, link: `/eventos/${eventoId}/itens/${linha.id}`, excetoUsuarioId: usuario.id });
    }
    await sincronizarRegrasAta(tx, eventoId, null);
    return linha;
  });
}

/** De onde veio o ajuste: canetinha da conferência (antes da ata) ou ajuste pela aba Ata/OS. */
export type ContextoAjuste = "conferencia" | "ata";

/**
 * Caminho único para mudar a quantidade de uma linha da ata — canetinha da conferência e ajuste
 * da aba Ata/OS —, sempre com motivo e log.
 *
 * - Linha que veio de um pedido da área (item "adicionar" já respondido): a mudança vira a resposta
 *   ou a correção do item por `responderNaTransacao` (mesmas regras da tela da solicitação: status
 *   atendido/parcial/não atendido, histórico RESPONDIDO/RESPOSTA_CORRIGIDA, aviso à área, pendência de
 *   compra zerada quando atendido integralmente, status da solicitação recalculado). Acima do pedido,
 *   o pedido conta como atendido e o excedente fica só na linha.
 * - Linha sem origem (incluída pela logística): ajusta direto.
 *
 * `quantidadeEsperada` é a quantidade que a tela mostrava: se outra pessoa mudou (ou removeu) a linha
 * enquanto esta editava, o ajuste é recusado em vez de sobrescrever.
 * Na conferência a linha ajustada fica conferida (a decisão foi tomada na reunião). Com a ata fechada,
 * sai nova versão da OS e quem tem pedido no evento é avisado.
 */
export async function ajustarQuantidadeLinha(
  usuario: UsuarioAtual,
  eventoId: string,
  linhaId: string,
  quantidade: number,
  motivo: string,
  opcoes: { contexto: ContextoAjuste; quantidadeEsperada?: number | null },
) {
  exigir(usuario, "ata.consolidar");
  const conferencia = opcoes.contexto === "conferencia";
  // Motivo opcional na conferência e antes de fechar a ata; com a ata fechada, a justificativa é obrigatória.
  const razao = motivo?.trim() || null;
  const sufixo = razao ? ` — ${razao}` : "";
  if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > 1_000_000) {
    throw new ValidacaoError("Quantidade deve ser um inteiro entre 0 e 1.000.000.", { quantidade: "Use um número inteiro." });
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, nome: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    const antesDaAta = ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO";
    if (conferencia && !antesDaAta) throw new DomainError("A conferência acontece antes de fechar a ata. Depois disso, use o ajuste com justificativa na aba Ata.");
    if (!antesDaAta && ev.status !== "ABERTO") throw new DomainError("O evento não aceita ajustes na ata neste estado.");
    const posAta = ev.status === "ABERTO";
    if (posAta) exigir(usuario, "ata.ajustar");
    if (posAta && !razao) throw new ValidacaoError("Informe o motivo (justificativa) do ajuste.", { justificativa: "Obrigatória com a ata fechada: fica no histórico e vai para quem pediu." });

    const [linha] = await montarLinhasAta(tx, eventoId, { linhaId, incluirInativas: true });
    if (!linha) throw new NaoEncontradoError("Linha da ata");
    const esperada = opcoes.quantidadeEsperada;
    if (!linha.registro.ativo) {
      if (esperada != null) throw new DomainError("Outra pessoa removeu esta linha da ata enquanto você editava. Confira e tente de novo.");
      throw new NaoEncontradoError("Linha da ata");
    }
    const antes = linha.quantidade;
    if (esperada != null && esperada !== antes) throw new DomainError(`Outra pessoa mudou esta linha para ${antes} enquanto você editava. Confira e tente de novo.`);
    if (quantidade === antes) throw new ValidacaoError("A quantidade informada é a mesma que já está na ata.", { quantidade: "Informe outro valor." });
    const desc = descricaoLinha(linha);
    const remover = quantidade === 0;
    const agora = new Date();

    // Linha de um pedido já respondido (e solicitação ainda corrigível): a mudança passa pela resposta do item.
    const respondeu = linha.registro.solicitacaoItemId ? await responderPelaQuantidade(tx, usuario, linha.registro.solicitacaoItemId, quantidade, razao) : null;

    // A resposta aplica só a diferença em relação à resposta anterior; o ajuste define o valor absoluto
    // da linha. Por isso a linha é gravada aqui de qualquer jeito (também no caminho da resposta).
    // Quantidade mudou antes da ata: na conferência a linha fica conferida; pela aba Ata, volta a conferir.
    // Linha de regra (tina, pallet, ráfia) ajustada à mão: a regra deixa de mexer nela.
    const manual = linha.registro.regra ? { regraManual: true } : {};
    const conferenciaCampos = conferencia ? { conferidoEm: agora, conferidoPorId: usuario.id } : antesDaAta ? { conferidoEm: null, conferidoPorId: null } : {};
    await tx
      .update(eventoItens)
      .set(
        remover
          ? { ativo: false, removidoEm: agora, removidoPorId: usuario.id, justificativaAjuste: razao, conferidoEm: null, conferidoPorId: null, ...manual }
          : { ativo: true, quantidade, removidoEm: null, removidoPorId: null, justificativaAjuste: razao, ...conferenciaCampos, ...manual },
      )
      .where(eq(eventoItens.id, linhaId));

    await registrarHistorico(
      tx,
      conferencia
        ? {
            eventoId,
            entidade: "evento_item",
            entidadeId: linhaId,
            acao: "CONFERENCIA_AJUSTE",
            descricao: remover ? `${desc}: retirado da ata na reunião (era ${antes})${sufixo}` : `${desc}: ${antes} → ${quantidade} na reunião${sufixo}`,
            usuarioId: usuario.id,
            dadosAntes: { quantidade: antes },
            dadosDepois: { quantidade, motivo: razao },
          }
        : {
            eventoId,
            entidade: "evento_item",
            entidadeId: linhaId,
            acao: remover ? "ATA_REMOCAO" : "ATA_QUANTIDADE",
            descricao: `${remover ? `${desc}: removido da ata (era ${antes})` : `${desc}: quantidade alterada de ${antes} para ${quantidade}`}${sufixo}`,
            usuarioId: usuario.id,
            dadosAntes: { quantidade: antes, ativo: true },
            dadosDepois: { quantidade, ativo: !remover, motivo: razao },
          },
    );

    await sincronizarRegrasAta(tx, eventoId, null);
    if (posAta) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, `${desc} ${remover ? "removido" : `${antes} → ${quantidade}`}${sufixo}`);
      const texto = `A logística ${remover ? "removeu" : "alterou"} ${desc}${remover ? "" : ` para ${quantidade}`}`;
      const base = {
        tipo: "ATA_AJUSTE",
        titulo: `Ajuste na OS: ${ev.nome}`,
        // Linha removida deixa de ter página própria: nesse caso o histórico é o registro.
        link: remover ? `/eventos/${eventoId}/historico` : `/eventos/${eventoId}/itens/${linhaId}`,
        excetoUsuarioId: usuario.id,
      };
      if (respondeu) {
        // A área dona já recebeu a resposta do item, com o motivo; quem mais tem pedido no evento recebe sem ele.
        const jaAvisados = new Set([respondeu.criadoPorId, ...(await usuariosDaArea(tx, respondeu.areaId))]);
        const outros = (await usuariosComPedidoNoEvento(tx, eventoId)).filter((u) => !jaAvisados.has(u));
        await notificar(tx, { ...base, usuarioIds: outros, mensagem: `${texto}.` });
      } else {
        await notificarAjusteLinha(tx, { ...base, eventoId, areaId: linha.registro.areaId ?? null, mensagem: `${texto}. Motivo: ${razao}`, mensagemSemMotivo: `${texto}.` });
      }
    }
    return { removida: remover, respondeuItem: Boolean(respondeu) };
  });
}

/**
 * A quantidade da linha de um pedido mudou: o item responde de acordo (atendido, parcial, não atendido), com histórico e
 * aviso à área, se a resposta mudou e a solicitação ainda aceita correção. Devolve quem foi avisado (ou null).
 */
async function responderPelaQuantidade(tx: Executor, usuario: UsuarioAtual, solicitacaoItemId: string, quantidade: number, razao: string | null) {
  const item = await tx.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, solicitacaoItemId), with: { solicitacao: { columns: { status: true, excluida: true } } } });
  const corrigivel = item && item.operacao === "ADICIONAR" && item.status !== "EM_ANALISE" && !item.solicitacao.excluida && (item.solicitacao.status === "RESPONDIDA" || item.solicitacao.status === "EM_ANALISE");
  if (!item || !corrigivel) return null;
  const status = quantidade === 0 ? "NAO_ATENDIDO" : quantidade < item.quantidadeSolicitada ? "PARCIAL" : "ATENDIDO";
  const atendida = Math.min(quantidade, item.quantidadeSolicitada);
  if (status === item.status && atendida === item.quantidadeAtendida) return null;
  const r = await responderNaTransacao(
    tx,
    usuario,
    item.id,
    // A pendência de compra marcada antes continua (atendido integralmente a zera).
    // Parcial/não atendido pedem observação: sem motivo, fica registrado que foi ajuste da reunião.
    { status, quantidadeAtendida: atendida, observacaoLogistica: razao ?? "Ajustado na reunião de OS", pendenciaCompra: item.pendenciaCompra },
    razao ?? "Ajustado na reunião de OS",
    // A fase já foi conferida por quem chama (a pré-reunião também é corrigida pela aba Ata depois do fechamento); a OS sai uma vez só, lá.
    { gerarOs: false, notificar: true, ignorarFase: true },
  );
  return { areaId: r.areaId, criadoPorId: r.criadoPorId };
}

/**
 * Canetinha da conferência: muda a quantidade de uma linha na reunião, com log (motivo opcional).
 * Mesmo caminho do ajuste pela aba Ata (`ajustarQuantidadeLinha`).
 */
/**
 * Grades 2×1 do prisma: o que vem pelos prismas continua na linha da regra (acompanha os prismas); o que a
 * reunião decide a mais fica numa linha própria da logística (mesma peça, sem pedido), e o bloco soma as duas.
 * `extra` 0 tira a linha a mais. Ajuste e inclusão seguem o caminho de sempre (histórico, OS depois da ata).
 */
export async function definirExtraDaRegra(usuario: UsuarioAtual, eventoId: string, linhaRegraId: string, extra: number, motivo: string) {
  exigir(usuario, "ata.consolidar");
  if (!Number.isInteger(extra) || extra < 0 || extra > 1_000_000) throw new ValidacaoError("Quantidade deve ser um inteiro entre 0 e 1.000.000.");
  const db = await getDb();
  // É decisão da conferência: depois da ata, a inclusão sairia com uma justificativa que ninguém escreveu.
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
  if (!ev) throw new NaoEncontradoError("Evento");
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("As grades a mais do prisma são decididas na conferência. Depois da ata, inclua a peça pelo ajuste com justificativa.");
  const regra = await db.query.eventoItens.findFirst({ where: and(eq(eventoItens.id, linhaRegraId), eq(eventoItens.eventoId, eventoId)) });
  if (!regra?.regra || !regra.pecaId) throw new NaoEncontradoError("Linha da regra");
  // "A mais" = linha da logística sem pedido e sem local (é assim que este ajuste cria). Grade incluída à mão com
  // local (ex.: "Chegada 6") é outra coisa e não é mexida aqui.
  const linhasAMais = await db.query.eventoItens.findMany({
    where: and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.pecaId, regra.pecaId), eq(eventoItens.ativo, true), isNull(eventoItens.regra), isNull(eventoItens.solicitacaoItemId), isNull(eventoItens.destino)),
    orderBy: (t, { asc }) => [asc(t.criadoEm)],
  });
  const razao = motivo.trim() || "Decidido na reunião (além das do prisma)";
  const [aMais, ...sobra] = linhasAMais;
  if (aMais) {
    // A tela mostra a soma das linhas a mais; com mais de uma (incluídas à mão), o número vale para todas juntas:
    // a primeira fica com ele e as outras saem (antes só a primeira mudava e o total não batia).
    for (const l of sobra) await ajustarQuantidadeLinha(usuario, eventoId, l.id, 0, razao, { contexto: "conferencia", quantidadeEsperada: l.quantidade });
    if (aMais.quantidade === extra) return null;
    return ajustarQuantidadeLinha(usuario, eventoId, aMais.id, extra, razao, { contexto: "conferencia", quantidadeEsperada: aMais.quantidade });
  }
  if (extra === 0) return null;
  return incluirLinhaAta(usuario, eventoId, { referenciaTipo: "PECA", projetoId: null, pecaId: regra.pecaId, descricaoLivre: null, quantidade: extra, destino: null, areaId: null, justificativa: razao });
}

export async function ajustarLinhaNaConferencia(usuario: UsuarioAtual, eventoId: string, linhaId: string, quantidade: number, motivo: string, opcoes: { quantidadeEsperada?: number | null } = {}) {
  return ajustarQuantidadeLinha(usuario, eventoId, linhaId, quantidade, motivo, { contexto: "conferencia", quantidadeEsperada: opcoes.quantidadeEsperada });
}

/**
 * Edita uma peça dentro de um projeto já na ata/OS (por unidade do projeto): muda a quantidade,
 * tira a peça (0) ou inclui uma peça do catálogo que o projeto não tinha. Sempre com log; motivo obrigatório só com a ata fechada.
 * Antes do fechamento é ajuste da reunião; com a ata fechada gera nova versão da OS e avisa a área.
 */
export async function ajustarPecaDoProjeto(usuario: UsuarioAtual, eventoId: string, linhaId: string, pecaId: string, quantidadePorUnidade: number, motivo: string) {
  exigir(usuario, "ata.consolidar");
  const razao = motivo?.trim() || null;
  if (!Number.isInteger(quantidadePorUnidade) || quantidadePorUnidade < 0 || quantidadePorUnidade > 100_000) {
    throw new ValidacaoError("Quantidade por unidade deve ser um inteiro entre 0 e 100.000.", { quantidade: "Use um número inteiro." });
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, nome: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    const aberto = ev.status === "ABERTO";
    if (!aberto && ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("O evento não aceita ajustes neste estado.");
    if (aberto) exigir(usuario, "ata.ajustar");
    // Motivo opcional antes de fechar a ata; depois, obrigatório (nova versão da OS e aviso à área).
    if (aberto && !razao) throw new ValidacaoError("Informe o motivo do ajuste.", { motivo: "Obrigatório com a ata fechada: fica no histórico e vai para a área." });

    const linha = await tx.query.eventoItens.findFirst({ where: and(eq(eventoItens.id, linhaId), eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)), with: { projeto: { columns: { nome: true, codigo: true } } } });
    if (!linha || linha.tipo !== "PROJETO") throw new NaoEncontradoError("Projeto na ata");
    const bom = [...(linha.bomSnapshot ?? [])];
    const idx = bom.findIndex((b) => b.pecaId === pecaId);
    const antes = idx >= 0 ? bom[idx].quantidade : 0;
    if (antes === quantidadePorUnidade) throw new ValidacaoError("A quantidade informada é a mesma do projeto.", { quantidade: "Informe outro valor." });

    let peca: { codigo: string; nome: string };
    if (idx >= 0) {
      peca = bom[idx];
      if (quantidadePorUnidade === 0) bom.splice(idx, 1);
      else bom[idx] = { ...bom[idx], quantidade: quantidadePorUnidade };
    } else {
      const p = await tx.query.pecas.findFirst({ where: and(eq(pecas.id, pecaId), eq(pecas.ativo, true)) });
      if (!p) throw new NaoEncontradoError("Peça");
      if (quantidadePorUnidade === 0) throw new ValidacaoError("Para incluir uma peça, informe a quantidade por unidade.", { quantidade: "Maior que zero." });
      peca = p;
      bom.push({ pecaId: p.id, codigo: p.codigo, nome: p.nome, setor: p.setor, unidade: p.unidade, quantidade: quantidadePorUnidade });
    }
    // Composição mudou antes da ata: a conferência da linha é refeita na reunião.
    await tx.update(eventoItens).set(aberto ? { bomSnapshot: bom } : { bomSnapshot: bom, conferidoEm: null, conferidoPorId: null }).where(eq(eventoItens.id, linhaId));
    await sincronizarRegrasAta(tx, eventoId, null);

    const projeto = linha.projeto?.nome ?? "Projeto";
    const acaoTexto = antes === 0 ? `incluída com ${quantidadePorUnidade} por unidade` : quantidadePorUnidade === 0 ? `retirada (eram ${antes} por unidade)` : `${antes} → ${quantidadePorUnidade} por unidade`;
    const texto = `${projeto}: ${peca.codigo} · ${peca.nome} ${acaoTexto} (× ${linha.quantidade} = ${quantidadePorUnidade * linha.quantidade})${razao ? ` — ${razao}` : ""}`;
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: "PECA_PROJETO_AJUSTADA",
      descricao: texto,
      usuarioId: usuario.id,
      dadosAntes: { pecaId, quantidade: antes },
      dadosDepois: { pecaId, quantidade: quantidadePorUnidade, motivo: razao },
    });
    if (aberto) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, texto);
      // Peça trocada dentro de um projeto muda o que vai ser montado: quem pediu algo no evento fica sabendo.
      await notificarAjusteLinha(tx, {
        eventoId,
        areaId: linha.areaId ?? null,
        tipo: "ATA_AJUSTE",
        titulo: `Ajuste na OS: ${ev.nome}`,
        mensagem: texto,
        mensagemSemMotivo: `${projeto}: ${peca.codigo} · ${peca.nome} ${acaoTexto} (× ${linha.quantidade} = ${quantidadePorUnidade * linha.quantidade})`,
        link: `/eventos/${eventoId}/itens/${linhaId}`,
        excetoUsuarioId: usuario.id,
      });
    }
    return { texto };
  });
}

/**
 * O administrador corrige, na conferência, a descrição das unidades que veio do pedido (texto, arte,
 * medida). Grava no item da solicitação: é a mesma descrição que quem pediu vê. O texto anterior fica
 * no histórico da linha. `grupos`: cada texto com quantas unidades levam ele; um grupo só vale para todas.
 */
export async function editarDescricoesLinha(usuario: UsuarioAtual, eventoId: string, linhaId: string, grupos: ReadonlyArray<{ texto: string; unidades: number }>) {
  exigir(usuario, "conferencia.editar_descricao");
  const limpos = grupos.map((g) => ({ texto: g.texto.trim(), unidades: g.unidades })).filter((g) => g.texto);
  if (limpos.some((g) => !Number.isInteger(g.unidades) || g.unidades < 1)) throw new ValidacaoError("Cada descrição precisa de ao menos 1 unidade.");
  if (limpos.some((g) => g.texto.length > 300)) throw new ValidacaoError("Cada descrição tem até 300 caracteres.");
  const total = limpos.reduce((a, g) => a + g.unidades, 0);
  if (total > 1000) throw new ValidacaoError("Descreva no máximo 1.000 unidades.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status === "ENCERRADO" || ev.status === "CANCELADO") throw new DomainError("Evento encerrado ou cancelado: a descrição não muda mais.");
    const linha = await tx.query.eventoItens.findFirst({ where: and(eq(eventoItens.id, linhaId), eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)), columns: { id: true, solicitacaoItemId: true } });
    if (!linha) throw new NaoEncontradoError("Linha da ata");
    if (!linha.solicitacaoItemId) throw new DomainError("Esta linha não veio de um pedido, então não tem descrição de unidades para editar.");
    const item = await tx.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, linha.solicitacaoItemId), columns: { id: true, descricoes: true, quantidadeSolicitada: true, semDescricao: true } });
    if (!item) throw new NaoEncontradoError("Item do pedido");
    // Um texto só = vale para todas as unidades; vários = um por unidade, na ordem.
    const novas = limpos.length === 0 ? null : limpos.length === 1 ? [limpos[0].texto] : limpos.flatMap((g) => Array.from({ length: g.unidades }, () => g.texto));
    const antes = textoDescricoes(item.descricoes, item.quantidadeSolicitada);
    const depois = textoDescricoes(novas, item.quantidadeSolicitada);
    if ((antes ?? "") === (depois ?? "")) return { mudou: false as const };
    await tx
      .update(solicitacaoItens)
      .set({ descricoes: novas, semDescricao: novas ? false : item.semDescricao, atualizadoEm: new Date() })
      .where(eq(solicitacaoItens.id, item.id));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linha.id,
      acao: "DESCRICAO_EDITADA",
      descricao: `Descrição alterada na conferência: ${depois ?? "sem descrição"}${antes ? ` (antes: ${antes})` : ""}`,
      usuarioId: usuario.id,
      dadosAntes: { descricoes: item.descricoes },
      dadosDepois: { descricoes: novas },
    });
    return { mudou: true as const };
  });
}

/** Um local do quadro de tendas: as linhas da tenda nele, quantas tendas e o total de fechamentos e calhas. */
export type QuadroDoLocal = { linhaIds: string[]; tendas: number; totais: Partial<Record<PapelTenda, number>> };

/**
 * Tendas de um local, como no quadro de tendas: quantas tendas e o total de fechamentos e calhas do local, aplicados
 * às linhas que já existem sem trocar o dono de nenhuma tenda (`distribuirTendasDoLocal`). Tudo numa transação:
 * ou o local fica como pedido, ou nada muda. Antes da ata o local fica conferido (a decisão é da reunião); com a ata
 * fechada sai uma versão da OS e um aviso por salvamento, com a justificativa.
 */
export async function ajustarTendasDoLocal(usuario: UsuarioAtual, eventoId: string, dados: QuadroDoLocal & { motivo: string | null }) {
  return ajustarTendasDosLocais(usuario, eventoId, { locais: [dados], motivo: dados.motivo });
}

/** Vários locais de uma vez ("Editar todos os locais"): uma transação, uma versão da OS e um aviso para tudo. */
export async function ajustarTendasDosLocais(usuario: UsuarioAtual, eventoId: string, dados: { locais: QuadroDoLocal[]; motivo: string | null }) {
  exigir(usuario, "ata.consolidar");
  if (!dados.locais.length || dados.locais.some((l) => !l.linhaIds.length)) throw new ValidacaoError("Nenhuma linha informada.");
  const motivo = dados.motivo?.trim() || "";
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, nome: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    const posAta = ev.status === "ABERTO";
    if (!posAta && ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("O evento não aceita ajustes neste estado.");
    if (posAta) {
      exigir(usuario, "ata.ajustar");
      if (!motivo) throw new ValidacaoError("Informe a justificativa do ajuste.", { motivo: "Obrigatória com a ata fechada: fica no histórico e vai para quem pediu." });
    }
    const r = await aplicarQuadros(tx, usuario, eventoId, dados.locais, motivo, { posAta, conferir: !posAta, localInteiro: true });
    if (r.resumos.length) {
      await sincronizarRegrasAta(tx, eventoId, null);
      if (posAta) await fecharAjustePosAta(tx, usuario, ev, r, motivo, { titulo: `Ajuste na OS: ${ev.nome}`, texto: `A logística ajustou as tendas: ${r.resumos.join("; ")}` });
    }
    return { linhas: r.finais.length, mudou: r.resumos.length > 0 };
  });
}

/**
 * "Incluir item" de tenda já com fechamentos e calhas: a linha entra com as peças certas na mesma transação, com uma
 * versão da OS e um aviso (antes eram duas versões, a primeira sem os fechamentos, e um erro no meio deixava a tenda
 * incluída sem eles).
 */
export async function incluirTendaNaAta(usuario: UsuarioAtual, eventoId: string, dados: DadosLinhaAta, totais: Partial<Record<PapelTenda, number>>) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const { linha, geraOs, desc, ev } = await incluirLinhaNaTransacao(tx, usuario, eventoId, dados);
    const motivo = dados.justificativa?.trim() || "";
    const r = await aplicarQuadros(tx, usuario, eventoId, [{ linhaIds: [linha.id], tendas: dados.quantidade, totais }], motivo, { posAta: geraOs, conferir: ev.status === "EM_REUNIAO", localInteiro: false });
    await sincronizarRegrasAta(tx, eventoId, null);
    if (geraOs) {
      const pecasTexto = r.resumos.length ? ` (${r.resumos.join("; ")})` : "";
      await fecharAjustePosAta(tx, usuario, ev, { ...r, areas: [dados.areaId ?? null], link: `/eventos/${eventoId}/itens/${linha.id}` }, motivo, {
        titulo: `Item novo na OS: ${ev.nome}`,
        texto: `A logística incluiu ${desc} × ${dados.quantidade}${pecasTexto}`,
      });
    }
    return linha;
  });
}

type ResultadoQuadros = { finais: string[]; resumos: string[]; areas: Array<string | null>; avisados: Set<string>; link: string | null };

/** Aplica os quadros dos locais dentro da transação (evento já travado). Não gera OS nem aviso de ajuste. */
async function aplicarQuadros(
  tx: Executor,
  usuario: UsuarioAtual,
  eventoId: string,
  locais: readonly QuadroDoLocal[],
  motivo: string,
  opcoes: { posAta: boolean; conferir: boolean; localInteiro: boolean },
): Promise<ResultadoQuadros> {
  const inteiro = (n: number) => Number.isInteger(n) && n >= 0 && n <= 10_000;
  const r: ResultadoQuadros = { finais: [], resumos: [], areas: [], avisados: new Set(), link: null };
  const agora = new Date();
  const razao = motivo || null;
  const conferido = opcoes.conferir ? { conferidoEm: agora, conferidoPorId: usuario.id } : {};
  for (const local of locais) {
    if (!inteiro(local.tendas) || Object.values(local.totais).some((n) => n !== undefined && !inteiro(n))) {
      throw new ValidacaoError("Use números inteiros entre 0 e 10.000.", { quantidade: "Número inteiro." });
    }
    const lidas = await tx.query.eventoItens.findMany({ where: and(inArray(eventoItens.id, local.linhaIds), eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)) });
    if (lidas.length !== local.linhaIds.length) throw new DomainError("Alguma linha deste local mudou enquanto você editava. Confira e tente de novo.");
    const linhas = local.linhaIds.map((id) => lidas.find((l) => l.id === id)!);
    const l0 = linhas[0];
    // Mesmo local como a tela agrupa: sem diferença de maiúsculas e espaços nas pontas.
    const mesmoLocal = (a: string | null, b: string | null) => (a ?? "").trim().toLocaleLowerCase("pt-BR") === (b ?? "").trim().toLocaleLowerCase("pt-BR");
    if (!l0.projetoId || linhas.some((l) => l.tipo !== "PROJETO" || l.projetoId !== l0.projetoId || !mesmoLocal(l.destino, l0.destino))) {
      throw new DomainError("As linhas informadas não são da mesma tenda no mesmo local.");
    }
    if (opcoes.localInteiro) {
      // O quadro vale para o local inteiro: se outra linha da mesma tenda entrou nele depois que a tela abriu (outro
      // salvamento dividiu uma linha, alguém incluiu), os números da tela já não são os do local.
      const doProjeto = await tx.query.eventoItens.findMany({ where: and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.projetoId, l0.projetoId), eq(eventoItens.ativo, true)), columns: { id: true, destino: true } });
      if (doProjeto.some((x) => mesmoLocal(x.destino, l0.destino) && !local.linhaIds.includes(x.id))) throw new DomainError("Este local mudou enquanto você editava. Confira e tente de novo.");
    }
    const kit = kitDaTenda((l0.bomSnapshot ?? []).map((b) => b.codigo));
    if (!kit) throw new DomainError("Esta linha não é de tenda.");
    // Padrão por tenda da versão que está na ata (vale também para projeto inativado depois do pedido).
    const padrao = (await snapshotBom(tx, l0.projetoId, l0.projetoVersaoId)).bom;
    const papeis = papeisDoKit(kit).filter((x) => PAPEIS_POR_LOCAL.includes(x.papel));
    // Total que não veio = padrão × tendas (antes virava 0 e zerava as calhas).
    const totais = Object.fromEntries(papeis.map((x) => [x.papel, local.totais[x.papel] ?? padraoPorTenda(kit, padrao, x.papel) * local.tendas]));
    const porTendaDe = (bom: ReadonlyArray<{ codigo: string; quantidade: number }> | null, codigo: string) => bom?.find((b) => b.codigo === codigo)?.quantidade ?? 0;
    const distribuido = distribuirTendasDoLocal(
      linhas.map((l) => ({ id: l.id, quantidade: l.quantidade, doPedido: Boolean(l.solicitacaoItemId), porUnidade: Object.fromEntries(papeis.map((x) => [x.papel, porTendaDe(l.bomSnapshot, x.codigo)])) })),
      local.tendas,
      totais,
      papeis.map((x) => x.papel),
    );
    const pecasKit = await tx.select().from(pecas).where(inArray(pecas.codigo, papeis.map((x) => x.codigo)));
    const bomCom = (bom: readonly BomSnapshotLinha[], porUnidade: Partial<Record<PapelTenda, number>>) => {
      const novo = [...bom];
      for (const x of papeis) {
        const n = porUnidade[x.papel] ?? 0;
        const i = novo.findIndex((b) => b.codigo === x.codigo);
        if (i >= 0) {
          if (n === 0) novo.splice(i, 1);
          else novo[i] = { ...novo[i], quantidade: n };
        } else if (n > 0) {
          const p = pecasKit.find((y) => y.codigo === x.codigo);
          if (!p) throw new NaoEncontradoError(`Peça ${x.codigo}`);
          novo.push({ pecaId: p.id, codigo: p.codigo, nome: p.nome, setor: p.setor, unidade: p.unidade, quantidade: n });
        }
      }
      return novo;
    };
    type Estado = { quantidade: number; bom: ReadonlyArray<{ codigo: string; quantidade: number }> | null };
    const total = (ls: readonly Estado[], codigo: string) => ls.reduce((a, l) => a + l.quantidade * porTendaDe(l.bom, codigo), 0);
    const antes: Estado[] = linhas.map((l) => ({ quantidade: l.quantidade, bom: l.bomSnapshot }));
    const depois: Estado[] = [];
    const onde = l0.destino ?? "local não informado";
    let mudou = false;

    for (const [i, l] of linhas.entries()) {
      const partes = distribuido[i].partes;
      const quantidade = partes.reduce((a, p) => a + p.quantidade, 0);
      // Pedido da área: só a quantidade de tendas da linha (somando as partes) mexe na resposta; fechamentos não.
      if (l.solicitacaoItemId && quantidade !== l.quantidade) {
        const resp = await responderPelaQuantidade(tx, usuario, l.solicitacaoItemId, quantidade, razao);
        if (resp) {
          r.avisados.add(resp.criadoPorId);
          for (const u of await usuariosDaArea(tx, resp.areaId)) r.avisados.add(u);
        }
      }
      const bomBase = l.bomSnapshot ?? [];
      if (!partes.length) {
        mudou = true;
        await tx.update(eventoItens).set({ ativo: false, removidoEm: agora, removidoPorId: usuario.id, justificativaAjuste: razao, conferidoEm: null, conferidoPorId: null }).where(eq(eventoItens.id, l.id));
        await registrarHistorico(tx, {
          eventoId,
          entidade: "evento_item",
          entidadeId: l.id,
          acao: opcoes.posAta ? "ATA_REMOCAO" : "CONFERENCIA_AJUSTE",
          descricao: `Tendas de ${onde}: linha retirada (era ${l.quantidade})${razao ? ` — ${razao}` : ""}`,
          usuarioId: usuario.id,
          dadosAntes: { quantidade: l.quantidade },
          dadosDepois: { quantidade: 0, motivo: razao },
        });
        r.areas.push(l.areaId ?? null);
        continue;
      }
      const [primeira, ...outras] = partes;
      const bom = bomCom(bomBase, primeira.porUnidade);
      if (primeira.quantidade !== l.quantidade || JSON.stringify(bom) !== JSON.stringify(bomBase)) {
        mudou = true;
        await tx.update(eventoItens).set({ quantidade: primeira.quantidade, bomSnapshot: bom, justificativaAjuste: razao, ...conferido }).where(eq(eventoItens.id, l.id));
        await registrarHistorico(tx, {
          eventoId,
          entidade: "evento_item",
          entidadeId: l.id,
          acao: opcoes.posAta ? "ATA_QUANTIDADE" : "CONFERENCIA_AJUSTE",
          descricao: `Tendas de ${onde}: ${l.quantidade} → ${qtdTendas(primeira.quantidade)}${resumoPorTenda(papeis, primeira.porUnidade)}${razao ? ` — ${razao}` : ""}`,
          usuarioId: usuario.id,
          dadosAntes: { quantidade: l.quantidade },
          dadosDepois: { quantidade: primeira.quantidade, motivo: razao },
        });
        r.areas.push(l.areaId ?? null);
      } else if (opcoes.conferir && !l.conferidoEm) {
        await tx.update(eventoItens).set(conferido).where(eq(eventoItens.id, l.id));
      }
      r.finais.push(l.id);
      depois.push({ quantidade: primeira.quantidade, bom });
      // Parte com outra composição: linha nova da mesma área e da mesma versão do projeto (sem o pedido, que é único por linha).
      for (const p of outras) {
        mudou = true;
        const bomParte = bomCom(bomBase, p.porUnidade);
        const [nova] = await tx
          .insert(eventoItens)
          .values({ eventoId, tipo: "PROJETO", projetoId: l.projetoId, projetoVersaoId: l.projetoVersaoId, bomSnapshot: bomParte, quantidade: p.quantidade, destino: l.destino, areaId: l.areaId, origem: "AJUSTE_LOGISTICA", justificativaAjuste: razao, criadoPorId: usuario.id, ...conferido })
          .returning({ id: eventoItens.id });
        await registrarHistorico(tx, {
          eventoId,
          entidade: "evento_item",
          entidadeId: nova.id,
          acao: opcoes.posAta ? "AJUSTE_INCLUSAO" : "ATA_INCLUSAO",
          descricao: `Tendas de ${onde}: ${qtdTendas(p.quantidade)}${resumoPorTenda(papeis, p.porUnidade)} (parte da mesma linha)${razao ? ` — ${razao}` : ""}`,
          usuarioId: usuario.id,
        });
        r.finais.push(nova.id);
        depois.push({ quantidade: p.quantidade, bom: bomParte });
      }
    }
    if (!mudou) continue;
    r.link ??= r.finais[0] ? `/eventos/${eventoId}/itens/${r.finais[0]}` : null;
    const contar = (ls: readonly Estado[]) => ls.reduce((a, l) => a + l.quantidade, 0);
    const mudancas = [`${contar(antes)} → ${qtdTendas(contar(depois))}`, ...papeis.map((x) => `${total(antes, x.codigo)} → ${qtdPapel(x.papel, total(depois, x.codigo))}`)];
    r.resumos.push(`${onde}: ${mudancas.join(", ")}`);
  }
  return r;
}

/** " tendas · 2 fechamentos e 1 calhas por tenda" (só os papéis do quadro). */
function resumoPorTenda(papeis: ReadonlyArray<{ papel: PapelTenda }>, porUnidade: Partial<Record<PapelTenda, number>>) {
  const t = papeis.map((x) => qtdPapel(x.papel, porUnidade[x.papel] ?? 0)).join(" e ");
  return t ? ` · ${t} por tenda` : "";
}

const qtdTendas = (n: number) => `${n} ${n === 1 ? "tenda" : "tendas"}`;
/** "1 fechamento", "2 calhas": o rótulo da coluna é plural ("Fechamentos"), a frase não. */
const qtdPapel = (papel: PapelTenda, n: number) => `${n} ${n === 1 ? papel : `${papel}s`}`;

/** Com a ata fechada: uma versão da OS e um aviso para o salvamento inteiro (quem já foi avisado pela resposta do item não recebe de novo). */
async function fecharAjustePosAta(tx: Executor, usuario: UsuarioAtual, ev: { id: string; nome: string }, r: ResultadoQuadros, motivo: string, aviso: { titulo: string; texto: string }) {
  await gerarOsVersao(tx, ev.id, "AJUSTE_LOGISTICA", usuario.id, `${aviso.texto} — ${motivo}`);
  const base = { tipo: "ATA_AJUSTE", titulo: aviso.titulo, link: r.link ?? `/eventos/${ev.id}`, excetoUsuarioId: usuario.id };
  if (r.avisados.size) {
    const outros = (await usuariosComPedidoNoEvento(tx, ev.id)).filter((u) => !r.avisados.has(u));
    await notificar(tx, { ...base, usuarioIds: outros, mensagem: `${aviso.texto}.` });
  } else {
    await notificarAjusteLinha(tx, { ...base, eventoId: ev.id, areaId: r.areas.find(Boolean) ?? null, mensagem: `${aviso.texto}. Motivo: ${motivo}`, mensagemSemMotivo: `${aviso.texto}.` });
  }
}
