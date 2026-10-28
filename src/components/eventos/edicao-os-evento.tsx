import type { OsConteudo, OsLinha } from "@/server/db/schema";
import type { LinhaAtaDetalhe } from "@/server/services/eventos/ata";
import { kitDaTenda, PAPEIS_POR_LOCAL } from "@/domain/tendas";
import { AcoesLinhaEvento } from "./acoes-linha-evento";
import { EditarTendaBotao, OrigensDoTotal, type OrigemEditavel } from "./edicao-leituras";
import type { OpcoesReferencia } from "./linha-ata-form";
import type { EdicaoOs } from "./os-visoes";
import { AjustarPecaBotao, IncluirPecaBotao } from "./pecas-projeto";
import { tendaDoLocal } from "./tenda-do-local";
import { VincularCatalogo } from "./vincular-catalogo";

type Linha = LinhaAtaDetalhe;

/**
 * Liga cada linha das leituras por peça (calculadas com `calcularOS(linhas)`, na mesma ordem) à linha da ata que a
 * gerou e devolve as ações que já existem para ela: quantidade/remover do projeto ou da peça solta, quadro da tenda,
 * ajuste de peça do projeto, vincular o que está fora do catálogo. Nenhuma regra nova: um total por peça que soma
 * várias linhas abre a lista dessas linhas, cada uma com o seu ajuste.
 */
export function montarEdicaoOs({ eventoId, linhas, os, ataFechada, opcoes, podeCadastrar }: { eventoId: string; linhas: Linha[]; os: OsConteudo; ataFechada: boolean; opcoes: OpcoesReferencia | null; podeCadastrar: boolean }): EdicaoOs {
  // Mesmo filtro e mesma ordem de `calcularOS`: linhas zeradas não entram; projeto sem lista e peça sem cadastro vão para "fora do catálogo".
  const ativas = linhas.filter((l) => l.quantidade > 0);
  const ehProjeto = (l: Linha) => l.tipo === "PROJETO" && Boolean(l.projeto);
  const ehPeca = (l: Linha) => l.tipo === "PECA" && Boolean(l.peca);
  const projetos = ativas.filter(ehProjeto);
  const soltas = ativas.filter(ehPeca);
  const fora = ativas.filter((l) => !ehProjeto(l) && !ehPeca(l));

  const nomeDe = (l: Linha) => (l.tipo === "PECA" && l.peca ? l.peca.nome : l.nome);
  const rotulo = (l: Linha) => `${nomeDe(l)}${l.destino ? ` · ${l.destino}` : ""}`;
  const doProjeto = (l: Linha) => linhas.filter((x) => x.tipo === "PROJETO" && x.projeto?.codigo === l.projeto?.codigo);
  const href = (l: Linha) => `/eventos/${eventoId}/itens/${l.id}`;
  const acoesDaLinha = (l: Linha) => (
    <AcoesLinhaEvento eventoId={eventoId} ataFechada={ataFechada} linha={{ id: l.id, nome: rotulo(l), quantidade: l.quantidade, veioDePedido: Boolean(l.origemSolicitacaoId) }} tenda={tendaDoLocal(l, doProjeto(l))} />
  );
  // Peça do projeto: o ajuste é por unidade, na linha. Fechamento e calha de tenda são do local: abrem o quadro.
  const ajustePeca = (l: Linha, codigo: string, porUnidade: number) => {
    const tenda = tendaDoLocal(l, doProjeto(l));
    const kit = tenda ? kitDaTenda((l.projeto?.bom ?? []).map((b) => b.codigo)) : null;
    if (tenda && kit && PAPEIS_POR_LOCAL.some((p) => kit.pecas[p] === codigo)) return <EditarTendaBotao eventoId={eventoId} tenda={tenda} ataFechada={ataFechada} rotulo={rotulo(l)} />;
    const doCodigo = (l.projeto?.bom ?? []).filter((b) => b.codigo === codigo);
    // Peça unificada no catálogo (dois códigos somados numa linha): sem um alvo só, fica o caminho pela página do item.
    if (doCodigo.length !== 1 || doCodigo[0].quantidade !== porUnidade) return null;
    const b = doCodigo[0];
    return <AjustarPecaBotao eventoId={eventoId} linhaId={l.id} quantidadeProjeto={l.quantidade} peca={{ pecaId: b.pecaId, codigo: b.codigo, nome: b.nome, porUnidade: b.quantidade }} depoisDaAta={ataFechada} contexto={`${rotulo(l)} × ${l.quantidade}`} />;
  };

  const confere = (os.projetos ?? []).length === projetos.length && (os.projetos ?? []).every((p, i) => p.codigo === projetos[i].projeto?.codigo && p.quantidade === projetos[i].quantidade);

  return {
    projeto: (i) => {
      const l = projetos[i];
      if (!confere || !l) return null;
      return {
        acoes: acoesDaLinha(l),
        peca: (codigo, porUnidade) => ajustePeca(l, codigo, porUnidade),
        rodape: opcoes ? <IncluirPecaBotao eventoId={eventoId} linhaId={l.id} quantidadeProjeto={l.quantidade} opcoesPecas={opcoes.pecas} naLista={(l.projeto?.bom ?? []).map((b) => b.pecaId)} depoisDaAta={ataFechada} contexto={`${rotulo(l)} × ${l.quantidade}`} /> : undefined,
      };
    },
    total: (t: OsLinha) => {
      const origens: Array<{ l: Linha; n: number; acao: React.ReactNode; detalhe: string; chave?: string }> = [];
      for (const l of projetos) {
        const b = (l.projeto?.bom ?? []).find((x) => x.pecaId === t.pecaId || x.codigo === t.codigo);
        if (!b) continue;
        const n = b.quantidade * l.quantidade;
        // Fechamento/calha de tenda: o que se ajusta é o local (quadro), então as linhas do mesmo local viram uma só.
        const tenda = tendaDoLocal(l, doProjeto(l));
        const kit = tenda ? kitDaTenda((l.projeto?.bom ?? []).map((x) => x.codigo)) : null;
        if (tenda && kit && PAPEIS_POR_LOCAL.some((p) => kit.pecas[p] === b.codigo)) {
          const chave = `${l.projeto?.codigo}|${(l.destino ?? "").trim().toLowerCase()}`;
          const ja = origens.find((o) => o.chave === chave);
          if (ja) {
            ja.n += n;
            ja.detalhe = `${ja.n.toLocaleString("pt-BR")} no local · ${tenda.linhaIds.length} linhas somadas`;
          } else origens.push({ l, n, chave, acao: ajustePeca(l, b.codigo, b.quantidade), detalhe: `${n.toLocaleString("pt-BR")} no local` });
          continue;
        }
        origens.push({ l, n, acao: ajustePeca(l, b.codigo, b.quantidade), detalhe: `${b.quantidade} por un. × ${l.quantidade} = ${n.toLocaleString("pt-BR")}` });
      }
      for (const l of soltas) if (l.peca?.id === t.pecaId || l.peca?.codigo === t.codigo) origens.push({ l, n: l.quantidade, acao: acoesDaLinha(l), detalhe: `peça solta · ${l.quantidade.toLocaleString("pt-BR")}` });
      if (origens.length === 0) return null;
      if (origens.length === 1) return origens[0].acao;
      const lista: OrigemEditavel[] = origens.map((o) => ({ chave: o.l.id, rotulo: `${rotulo(o.l)}${o.l.tipo === "PROJETO" && !o.chave ? ` × ${o.l.quantidade}` : ""}`, detalhe: o.detalhe, href: href(o.l), acao: o.acao }));
      return (
        <OrigensDoTotal
          titulo={`${t.nome} · ${t.total.toLocaleString("pt-BR")} ${t.unidade}`}
          descricao={`O total soma estas ${origens.length} partes do evento. Ajuste a que precisa mudar; o total acompanha.`}
          rotuloBotao={`Ajustar ${t.nome}: ver as ${origens.length} partes que somam o total`}
          origens={lista}
        />
      );
    },
    solta: (codigo) => {
      const ls = soltas.filter((l) => l.peca?.codigo === codigo);
      if (ls.length === 0) return null;
      if (ls.length === 1) return acoesDaLinha(ls[0]);
      const nome = nomeDe(ls[0]);
      return (
        <OrigensDoTotal
          titulo={nome}
          descricao={`Pedida solta em ${ls.length} linhas. Ajuste a que precisa mudar.`}
          rotuloBotao={`Ajustar ${nome}: ver as ${ls.length} linhas`}
          origens={ls.map((l) => ({ chave: l.id, rotulo: rotulo(l), detalhe: `${l.areaNome ?? "Logística"} · ${l.quantidade.toLocaleString("pt-BR")}`, href: href(l), acao: acoesDaLinha(l) }))}
        />
      );
    },
    foraCatalogo: (i) => {
      const l = fora[i];
      if (!l) return null;
      return (
        <>
          {l.tipo === "AVULSO" && opcoes && <VincularCatalogo compacto linha={{ linhaId: l.id, descricao: l.nome, quantidade: l.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />}
          {acoesDaLinha(l)}
        </>
      );
    },
  };
}
