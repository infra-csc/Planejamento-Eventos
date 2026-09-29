import { Tag } from "@/components/ui/badge";
import { Numero } from "@/components/ui/numero";

/** Quantidade de uma linha da ata; 0 numa linha ativa = "a definir" (item padrão da ata cujo número entra depois). */
export function QuantidadeAta({ valor, className }: { valor: number; className?: string }) {
  if (valor === 0)
    return (
      <span title="Quantidade a definir: ajuste com o lápis quando souber o número. Enquanto isso, não entra na OS.">
        <Tag tom="warning">a definir</Tag>
      </span>
    );
  return <Numero valor={valor} className={className} />;
}
