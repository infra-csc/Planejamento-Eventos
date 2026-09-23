import { cn } from "@/lib/cn";
import { Icone } from "@/components/ui/icons";

/** Cartão de um passo: número (ou check quando concluído), título, uma linha de apoio e ações à direita. */
export function Passo({ n, titulo, sub, feito, acoes, children, className }: { n: number; titulo: string; sub?: React.ReactNode; feito?: boolean; acoes?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const idTitulo = `passo-${n}`;
  return (
    <section aria-labelledby={idTitulo} className={cn("rounded-cartao border border-line bg-surface", className)}>
      <header className="flex items-start gap-3 rounded-t-cartao border-b border-line-soft px-cartao py-3.5">
        <span
          aria-hidden
          className={cn("mt-px grid size-6 shrink-0 place-items-center rounded-full text-rotulo font-semibold transition-colors duration-150", feito ? "bg-success-bg text-success" : "bg-control text-ink-2")}
        >
          {feito ? <Icone nome="check" className="size-3.5" /> : <span className="numero">{n}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="m-0 text-secao font-semibold tracking-[-0.01em]">
            {titulo}
            {feito && <span className="sr-only"> (concluído)</span>}
          </h2>
          {sub && <p className="mb-0 mt-0.5 text-pequeno text-muted">{sub}</p>}
        </div>
        {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}

/** Mensagem de erro no padrão do Field (ícone + texto), para blocos que não são um campo só. */
export function ErroCampo({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("m-0 flex items-start gap-1 text-pequeno text-danger", className)}>
      <Icone nome="erro" className="mt-px size-4" />
      <span>{children}</span>
    </p>
  );
}
