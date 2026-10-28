import type { LinhaAtaDetalhe } from "@/server/services/eventos/ata";
import { kitDaTenda, PAPEIS_POR_LOCAL } from "@/domain/tendas";
import { cn } from "@/lib/cn";
import { Tag } from "@/components/ui/badge";
import { Numero } from "@/components/ui/numero";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { QuantidadeAta } from "./quantidade-ata";
import { AcoesLinhaEvento, EditarTendasDoItem } from "./acoes-linha-evento";
import { BadgeVersao } from "./ata-lista";
import { VincularCatalogo } from "./vincular-catalogo";
import type { OpcoesReferencia } from "./linha-ata-form";
import { tendaDoLocal } from "./tenda-do-local";
import { ItemComLocais, SemCliqueDaLinha } from "./item-com-locais";

type Linha = LinhaAtaDetalhe;

const GRUPOS_TIPO = [
  { tipo: "PROJETO", rotulo: "Projetos" },
  { tipo: "PECA", rotulo: "Peças do catálogo" },
  { tipo: "AVULSO", rotulo: "Fora do catálogo" },
] as const;

/** Até 3 locais a linha do item já abre mostrando cada um; com mais, começa fechada. */
const ABERTO_ATE = 3;

const chaveLocal = (destino: string | null) => (destino ?? "").trim().toLowerCase();
const area = (l: Linha) => l.areaNome ?? "Logística";
// Peça: só o nome (o código fica na página do item e nas leituras por peça).
const nomeExibido = (l: Linha) => (l.tipo === "PECA" && l.peca ? l.peca.nome : l.nome);

/** "7 fechamentos · 1 calha": o que varia por local numa tenda, somado nas linhas dadas. Sem kit de tenda, null. */
function textoTenda(ls: readonly Linha[], noTotal: boolean): string | null {
  if (ls[0]?.tipo !== "PROJETO") return null;
  const kit = kitDaTenda((ls[0].registro.bomSnapshot ?? []).map((b) => b.codigo));
  if (!kit) return null;
  const rotulos: Record<string, [string, string]> = { fechamento: ["fechamento", "fechamentos"], calha: ["calha", "calhas"] };
  const partes: string[] = [];
  for (const papel of PAPEIS_POR_LOCAL) {
    const codigo = kit.pecas[papel];
    if (!codigo) continue;
    const n = ls.reduce((a, l) => a + ((l.registro.bomSnapshot ?? []).find((b) => b.codigo === codigo)?.quantidade ?? 0) * l.quantidade, 0);
    // No total, "0 calhas" também é resposta; num local, só o que ele tem.
    if (n > 0 || noTotal) partes.push(`${n} ${rotulos[papel]?.[n === 1 ? 0 : 1] ?? papel}`);
  }
  return partes.length ? partes.join(" · ") : "sem fechamentos";
}

/** Um selo por linha, no máximo: entrou depois da ata pesa mais que "ajustado". */
function selo(ls: readonly Linha[]) {
  if (ls.some((l) => l.posAta)) return <Tag tom="info">depois da ata</Tag>;
  if (ls.some((l) => l.registro.justificativaAjuste)) return <Tag tom="warning">ajustado</Tag>;
  return null;
}

const unicos = (xs: string[]) => [...new Set(xs)].join(", ");

/**
 * Lista dos itens do evento, uma linha por item lida num relance: Item | Qtd. | Local | Área | ações. A origem
 * (SOL-…, quem pediu, incluída na reunião) não pesa na linha: fica no `title` da área e na página do item, que a
 * linha inteira abre. Item em vários locais (ex.: tendas) vira a linha do total, que abre a de cada local.
 * Tenda: uma linha por local (as linhas do mesmo local somadas), com o lápis do quadro do local.
 */
export function ListaItensEvento({
  eventoId,
  linhas,
  editavel,
  ataFechada,
  opcoes,
  podeCadastrar,
  origem,
}: {
  eventoId: string;
  linhas: Linha[];
  editavel: boolean;
  ataFechada: boolean;
  opcoes: OpcoesReferencia | null;
  podeCadastrar: boolean;
  /** "SOL-0001 · Paulo Ribeiro" (ou "Pedido de área" fora da área de quem vê): vai no `title` da coluna Área. */
  origem: (l: Linha) => string;
}) {
  const porTipo = GRUPOS_TIPO.map((g) => ({ ...g, linhas: linhas.filter((l) => l.tipo === g.tipo).sort((a, b) => nomeExibido(a).localeCompare(nomeExibido(b), "pt-BR")) })).filter((g) => g.linhas.length > 0);
  const agrupar = (ls: Linha[]) => {
    const m = new Map<string, Linha[]>();
    for (const l of ls) {
      const k = `${l.tipo}|${l.projeto?.codigo ?? l.peca?.codigo ?? l.nome}`;
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.values()];
  };
  const colunas = editavel ? 5 : 4;
  // Células com uma linha de texto: a lista cabe o dobro de itens por tela. O que não cabe corta com `title`.
  const celula = "border-b border-line-row py-2 align-middle";
  const tdLocal = (texto: React.ReactNode, title?: string) => (
    <td className={cn(celula, "hidden max-w-0 px-3 text-corpo text-ink-2 @lg:table-cell")}>
      <span className="block truncate" title={title}>
        {texto}
      </span>
    </td>
  );
  const tdArea = (texto: string, title?: string) => (
    <td className={cn(celula, "hidden max-w-0 px-3 text-pequeno text-ink-2 @2xl:table-cell")}>
      <span className="block truncate" title={title ?? texto}>
        {texto}
      </span>
    </td>
  );
  const tdQtd = (valor: number, forte = true) => (
    <td className={cn(celula, "px-3 text-right text-corpo text-ink", forte ? "font-semibold" : "font-normal")}>
      <QuantidadeAta valor={valor} />
    </td>
  );
  const tdAcoes = (conteudo: React.ReactNode) => (editavel ? <td className={cn(celula, "whitespace-nowrap pl-2 pr-cartao text-right")}>{conteudo}</td> : null);
  /**
   * Célula do item. Largo (a partir de 512 px de lista): uma linha só — texto, detalhe da tenda, selo, versão e
   * "Vincular" — e Local/Área nas suas colunas. Estreito (celular): o texto inteiro na 1ª linha e, na 2ª, selo,
   * "Vincular" e o resumo ("Área VIP · Produção"), para o nome não ser espremido pelos selos.
   */
  const celulaItem = ({ texto, title, so, recuo, tenda, ls, resumo, resumoMedio }: { texto: React.ReactNode; title: string; so?: "celular"; recuo?: boolean; tenda: string | null; ls: Linha[]; resumo: string; resumoMedio?: string }) => {
    const x = ls[0];
    const versao = editavel && x.versaoDefasada ? <BadgeVersao l={{ id: x.id, nome: nomeExibido(x), versao: x.versao, versaoAtual: x.versaoAtual }} eventoId={eventoId} podeAtualizar /> : null;
    // Fora do catálogo: "Vincular" junto do texto (é sobre o que o item é); a coluna de ações não alarga.
    const vincular = (onde: string) =>
      editavel && x.tipo === "AVULSO" && opcoes ? (
        <SemCliqueDaLinha className={cn("shrink-0", onde)}>
          <VincularCatalogo compacto linha={{ linhaId: x.id, descricao: x.nome, quantidade: x.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />
        </SemCliqueDaLinha>
      ) : null;
    const s = selo(ls);
    return (
      <th scope="row" className={cn(celula, "max-w-0 pr-3 text-left font-normal", recuo ? "pl-9 @lg:pl-12" : "pl-cartao")}>
        <span className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className={cn("truncate text-corpo text-ink", !recuo && "font-medium", so === "celular" && "@lg:hidden")} title={title}>
            {texto}
          </span>
          {tenda && <span className="hidden min-w-0 shrink-[3] truncate text-pequeno text-ink-3 @lg:inline" title={tenda}>{tenda}</span>}
          {s && <span className="hidden shrink-0 @lg:inline-flex">{s}</span>}
          {versao && <span className="hidden shrink-0 @lg:inline-flex">{versao}</span>}
          {vincular("hidden @lg:inline-flex")}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden @lg:hidden">
          {s && <span className="shrink-0">{s}</span>}
          {versao && <span className="shrink-0">{versao}</span>}
          {vincular("")}
          <span className="truncate text-pequeno text-ink-2">{[tenda, resumo].filter(Boolean).join(" · ")}</span>
        </span>
        {resumoMedio && <span className="hidden truncate text-pequeno text-ink-2 @lg:block @2xl:hidden">{resumoMedio}</span>}
      </th>
    );
  };

  const linhaUnica = (l: Linha) => {
    const tenda = textoTenda([l], false);
    return (
      <LinhaLink key={l.id} href={`/eventos/${eventoId}/itens/${l.id}`} rotulo={`Abrir ${nomeExibido(l)}${l.destino ? ` · ${l.destino}` : ""}`}>
        {celulaItem({ texto: nomeExibido(l), title: nomeExibido(l), tenda, ls: [l], resumo: [l.destino, area(l)].filter(Boolean).join(" · "), resumoMedio: area(l) })}
        {tdQtd(l.quantidade)}
        {tdLocal(l.destino ?? <span className="text-muted">—</span>, l.destino ?? undefined)}
        {tdArea(area(l), `${area(l)} · ${origem(l)}`)}
        {tdAcoes(acoesDaLinha(l, [l]))}
      </LinhaLink>
    );
  };

  function acoesDaLinha(l: Linha, doItem: readonly Linha[], semRemover = false) {
    if (!editavel) return null;
    return (
      <AcoesLinhaEvento
        eventoId={eventoId}
        ataFechada={ataFechada}
        linha={{ id: l.id, nome: `${nomeExibido(l)}${l.destino ? ` · ${l.destino}` : ""}`, quantidade: l.quantidade, veioDePedido: Boolean(l.origemSolicitacaoId) }}
        tenda={tendaDoLocal(l, doItem)}
        semRemover={semRemover}
      />
    );
  }

  /** Item em vários locais: a linha do total e, embaixo, um local por linha (tenda: linhas do mesmo local somadas). */
  const itemComLocais = (ls: Linha[]) => {
    const l = ls[0];
    const ehTenda = Boolean(tendaDoLocal(l, ls));
    // Tenda: um grupo por local. Outros itens: uma linha por linha da ata (cada uma tem a sua quantidade).
    const grupos: Linha[][] = [];
    if (ehTenda) {
      const m = new Map<string, Linha[]>();
      for (const x of ls) m.set(chaveLocal(x.destino), [...(m.get(chaveLocal(x.destino)) ?? []), x]);
      grupos.push(...m.values());
    } else grupos.push(...ls.map((x) => [x]));
    const nLocais = new Set(ls.map((x) => chaveLocal(x.destino))).size;
    const semLocal = ls.every((x) => !x.destino?.trim());
    const rotuloLocais = semLocal ? `${ls.length} linhas` : `${nLocais} ${nLocais === 1 ? "local" : "locais"}`;
    const quadros = ehTenda ? grupos.map((g) => tendaDoLocal(g[0], ls)).filter((q) => q !== undefined) : [];
    const total = ls.reduce((a, x) => a + x.quantidade, 0);
    return (
      <ItemComLocais
        key={`${l.id}-total`}
        nome={nomeExibido(l)}
        nLocais={grupos.length}
        inicialAberto={grupos.length <= ABERTO_ATE}
        detalhe={textoTenda(ls, true)}
        resumoCelular={[rotuloLocais, textoTenda(ls, true)].filter(Boolean).join(" · ")}
        celulas={
          <>
            {tdQtd(total)}
            {tdLocal(rotuloLocais)}
            {tdArea(unicos(ls.map(area)))}
            {tdAcoes(quadros.length > 0 ? <EditarTendasDoItem eventoId={eventoId} nome={nomeExibido(l)} locais={quadros} ataFechada={ataFechada} /> : null)}
          </>
        }
      >
        {grupos.map((g) => {
          const x = g[0];
          const qtd = g.reduce((a, y) => a + y.quantidade, 0);
          const tenda = ehTenda ? textoTenda(g, false) : null;
          // Sem local: a linha se identifica pela área que pediu.
          const local = x.destino ?? area(x);
          return (
            <LinhaLink key={x.id} href={`/eventos/${eventoId}/itens/${x.id}`} rotulo={`Abrir ${nomeExibido(x)} · ${local}`}>
              {/* No celular a coluna Local some: o local vem na célula do item, no lugar do nome (que está no total). */}
              {celulaItem({ texto: local, title: local, so: "celular", recuo: true, tenda, ls: g, resumo: "" })}
              {tdQtd(qtd, false)}
              {tdLocal(local, local)}
              {tdArea(unicos(g.map(area)), g.map((y) => `${area(y)} · ${origem(y)}`).join("\n"))}
              {/* Local com várias linhas somadas: o lápis abre o quadro do local, que também tira o local (0 tendas). */}
              {tdAcoes(acoesDaLinha(x, ls, g.length > 1))}
            </LinhaLink>
          );
        })}
      </ItemComLocais>
    );
  };

  return (
    // As colunas seguem a largura da lista, não da tela (@container): Local a partir de 512 px, Área a partir de 672.
    <div className="@container">
      <table data-responsiva className="w-full border-collapse">
        <CaptionOculta>Itens do evento por tipo</CaptionOculta>
        {/* As larguras vêm destes cabeçalhos; a coluna Item, sem largura própria, fica com o resto e corta o nome com `title` (max-w-0
            nas células, sem largura própria). Sem table-fixed: o cabeçalho de grupo ocupa as 5 colunas e, com elas escondidas, a grade fixa
            dividia a sobra em colunas vazias. */}
        <thead>
          <tr>
            <Th>Item</Th>
            <Th alinhar="right" className="w-16 min-w-16 @lg:w-[88px]">
              Qtd.
            </Th>
            <Th className="hidden @lg:table-cell @lg:w-[28%] @2xl:w-[24%]">Local</Th>
            <Th className="hidden @2xl:table-cell @2xl:w-[16%]">Área</Th>
            {editavel && (
              <Th className="w-[84px] max-md:w-[110px]">
                <span className="sr-only">Ações</span>
              </Th>
            )}
          </tr>
        </thead>
        {porTipo.map((g) => {
          const itens = agrupar(g.linhas);
          return (
            <tbody key={g.tipo}>
              <tr>
                <th colSpan={colunas} scope="colgroup" className="border-b border-line-soft bg-subtle px-cartao py-1.5 text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                  {g.rotulo}
                  <Numero valor={itens.length} className="ml-2 font-normal tracking-normal text-muted" />
                </th>
              </tr>
              {itens.map((ls) => (ls.length > 1 ? itemComLocais(ls) : linhaUnica(ls[0])))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
