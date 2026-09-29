import { Tag } from "@/components/ui/badge";
import { Numero } from "@/components/ui/numero";

/** Quantidade de uma linha da ata; 0 numa linha ativa = "a definir" (ex.: estaiamento, a projetista coloca o número). */
export function QuantidadeAta({ valor, className }: { valor: number; className?: string }) {
  if (valor === 0)
    return (
      <span title="Quantidade a definir: a projetista coloca o número. Enquanto isso, não entra na OS.">
        <Tag tom="warning">a definir</Tag>
      </span>
    );
  return <Numero valor={valor} className={className} />;
}
