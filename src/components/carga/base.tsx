import { cn } from "@/lib/cn";
import { TAG_CARGA_DICA, TAG_CARGA_LABEL, TIPO_VEICULO_LABEL, type TagCarga, type TipoVeiculo } from "@/domain/carga-descarga";

/** Veículo de lado, cabine à direita (desenho do protótipo validado): carreta, truck e toco. */
export function IconeVeiculo({ tipo, className }: { tipo: TipoVeiculo; className?: string }) {
  const roda = (cx: number) => <circle key={cx} cx={cx} cy={20} r={3} />;
  return (
    <svg viewBox="0 0 48 24" fill="currentColor" role="img" aria-label={TIPO_VEICULO_LABEL[tipo]} className={cn("h-3.5 w-7 shrink-0", className)}>
      <title>{TIPO_VEICULO_LABEL[tipo]}</title>
      {tipo === "carreta" ? (
        <>
          <rect x={1} y={4} width={33} height={12} rx={1} />
          <path d="M35 9h7l4 4v3h-11z" />
          <rect x={33} y={15} width={13} height={2} />
          {[6, 13, 28, 42].map(roda)}
        </>
      ) : tipo === "truck" ? (
        <>
          <rect x={6} y={4} width={26} height={12} rx={1} />
          <path d="M33 8h7l5 5v3H33z" />
          {[12, 19, 40].map(roda)}
        </>
      ) : (
        <>
          <rect x={12} y={6} width={20} height={10} rx={1} />
          <path d="M33 8h6l5 5v3H33z" />
          {[18, 39].map(roda)}
        </>
      )}
    </svg>
  );
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Qui 22 out" a partir de "AAAA-MM-DD". */
export const diaCurto = (d: string) => `${DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;

/** Cor de cada tag de carga (a mesma no filtro, no card e no formulário). */
export const COR_TAG: Record<TagCarga, string> = { kit: "#9b2c4f", ceno: "#6b4fa3", estrutura: "#4f5b6b", ativacao: "#1f7a6e" };

export function TagCargaChip({ tag, className }: { tag: TagCarga; className?: string }) {
  return (
    <span title={TAG_CARGA_DICA[tag]} className={cn("inline-flex items-center gap-1 rounded-chip border border-line-soft bg-surface px-1.5 py-px text-rotulo font-medium text-ink-2", className)}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: COR_TAG[tag] }} />
      {TAG_CARGA_LABEL[tag]}
    </span>
  );
}

/** "carreta ×2 · toco ×1" com os ícones. */
export function ContagemVeiculos({ tipos, className }: { tipos: readonly TipoVeiculo[]; className?: string }) {
  const n = (t: TipoVeiculo) => tipos.filter((x) => x === t).length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      {(["carreta", "truck", "toco"] as const)
        .filter((t) => n(t))
        .map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-rotulo text-ink-2">
            <IconeVeiculo tipo={t} className="text-ink-3" />
            <span className="numero font-medium">×{n(t)}</span>
          </span>
        ))}
    </span>
  );
}
