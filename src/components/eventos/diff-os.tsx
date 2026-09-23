import { SETOR_LABEL, type DiffLinha } from "@/domain/os";
import { cn } from "@/lib/cn";
import { Tag, type Tom } from "@/components/ui/badge";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Section } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";

type Tipo = "entrou" | "saiu" | "mudou";
const tipoDe = (d: DiffLinha): Tipo => (d.antes === 0 ? "entrou" : d.depois === 0 ? "saiu" : "mudou");
const TOM: Record<Tipo, Tom> = { entrou: "success", saiu: "danger", mudou: "warning" };
const ORDEM: Record<Tipo, number> = { entrou: 0, mudou: 1, saiu: 2 };

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Contagem do resumo ("2 entraram"), com a cor do tipo e ícone — cor nunca sozinha. */
function Contagem({ n, tipo }: { n: number; tipo: Tipo }) {
  if (n === 0) return null;
  const texto = tipo === "entrou" ? (n === 1 ? "entrou" : "entraram") : tipo === "saiu" ? (n === 1 ? "saiu" : "saíram") : n === 1 ? "mudou" : "mudaram";
  return (
    <span className={cn("inline-flex items-center gap-1 text-pequeno font-medium", tipo === "entrou" ? "text-success" : tipo === "saiu" ? "text-danger" : "text-warning")}>
      <Icone nome={tipo === "entrou" ? "mais" : tipo === "saiu" ? "menos" : "lapis"} className="size-3.5" />
      <span className="numero">{n}</span> {texto}
    </span>
  );
}

/**
 * Diferença entre duas versões da OS, peça a peça: o que entrou, saiu ou mudou de quantidade,
 * com antes → depois e a diferença em cor semântica (verde soma, laranja tira). Tabela com rolagem própria.
 */
export function DiffOs({ titulo, sub, diff, vazio, acoes }: { titulo: string; sub?: string; diff: DiffLinha[]; vazio: string; acoes?: React.ReactNode }) {
  const linhas = [...diff].sort((a, b) => ORDEM[tipoDe(a)] - ORDEM[tipoDe(b)] || a.codigo.localeCompare(b.codigo, "pt-BR"));
  const n = (t: Tipo) => diff.filter((d) => tipoDe(d) === t).length;
  return (
    <Section titulo={titulo} sub={sub} acoes={acoes}>
      {diff.length === 0 ? (
        <p className="m-0 flex items-center gap-2 px-cartao py-4 text-pequeno text-muted">
          <Icone nome="check-circulo" className="shrink-0 text-ink-3" />
          {vazio}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft px-cartao py-2.5" aria-label="Resumo da diferença">
            <Contagem n={n("entrou")} tipo="entrou" />
            <Contagem n={n("mudou")} tipo="mudou" />
            <Contagem n={n("saiu")} tipo="saiu" />
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <CaptionOculta>{titulo}</CaptionOculta>
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <Th largura={92}>Situação</Th>
                  <Th largura={120}>Código</Th>
                  <Th>Peça</Th>
                  <Th largura={72} alinhar="right">
                    Antes
                  </Th>
                  <Th largura={72} alinhar="right">
                    Depois
                  </Th>
                  <Th largura={90} alinhar="right">
                    Diferença
                  </Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((d) => {
                  const t = tipoDe(d);
                  const delta = d.depois - d.antes;
                  return (
                    <tr key={d.codigo} className="hover:bg-subtle">
                      <td className="border-b border-line-row py-2 pl-cartao pr-3">
                        <Tag tom={TOM[t]}>{t}</Tag>
                      </td>
                      <td className="border-b border-line-row px-3 py-2 text-pequeno text-ink-2">
                        <Codigo>{d.codigo}</Codigo>
                      </td>
                      <th scope="row" className="border-b border-line-row px-3 py-2 text-left font-normal">
                        <span className="block text-corpo text-ink">{d.nome}</span>
                        <span className="block text-rotulo text-muted">{SETOR_LABEL[d.setor]}</span>
                      </th>
                      <td className={cn("numero border-b border-line-row px-3 py-2 text-right text-corpo", t === "entrou" ? "text-meta" : "text-ink-3")}>{t === "entrou" ? "—" : fmt(d.antes)}</td>
                      <td className="numero border-b border-line-row px-3 py-2 text-right text-corpo font-medium text-ink">{t === "saiu" ? "—" : fmt(d.depois)}</td>
                      <td className={cn("numero border-b border-line-row py-2 pl-3 pr-cartao text-right text-corpo font-semibold", delta > 0 ? "text-success" : "text-danger")}>
                        {delta > 0 ? "+" : "−"}
                        {fmt(Math.abs(delta))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}
