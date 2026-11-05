import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/layout";
import { TIPO_VEICULO_LABEL } from "@/domain/carga-descarga";
import { diaMesISO } from "@/lib/format";
import type { EstimativaVeiculos as Estimativa } from "@/domain/logistica";

/** Estimativa simples, pelo volume do que sai do galpão. Diz quando está incompleta, em vez de parecer exata. */
export function EstimativaVeiculos({ estimativa }: { estimativa: Estimativa & { temPerfil: boolean; tour: boolean } }) {
  const { volumeTotal, pecasSemVolume, porPerfil, temPerfil, tour } = estimativa;
  return (
    <Section titulo="Estimativa de veículos" sub={tour ? "Pelo tour inteiro: maior valor nos retornáveis, soma nos consumíveis." : "Pelo que sai do galpão neste evento."} padded>
      {!temPerfil ? (
        <p className="m-0 text-pequeno text-ink-3">Falta marcar um perfil de referência em Cadastros logísticos.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-corpo text-ink">
            <span className="numero font-semibold">{volumeTotal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m³</span>
            {volumeTotal === 0 && pecasSemVolume > 0 && " · sem como estimar ainda"}
            {volumeTotal > 0 && porPerfil.length > 0 && <> · {porPerfil.map((p) => `${p.veiculos} ${TIPO_VEICULO_LABEL[p.tipo].toLocaleLowerCase("pt-BR")}${p.veiculos === 1 ? "" : "s"} (${p.perfil})`).join(" ou ")}</>}
          </p>
          {pecasSemVolume > 0 && (
            <span>
              <Badge tom="warning">estimativa incompleta: {pecasSemVolume} {pecasSemVolume === 1 ? "peça" : "peças"} sem m³</Badge>
            </span>
          )}
        </div>
      )}
    </Section>
  );
}

type Proxima = { id: string; codigo: string; nome: string; saida: string; estimativa: Estimativa & { temPerfil: boolean; tour: boolean } };

/** No calendário de Carga e descarga: quantos veículos cada evento que sai em breve deve precisar. */
export function EstimativasProximas({ lista }: { lista: Proxima[] }) {
  return (
    <Section titulo="Estimativa de veículos" sub="Eventos que saem nos próximos 30 dias, pelo volume do que sai do galpão.">
      <ul className="m-0 list-none p-0">
        {lista.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line-row px-cartao py-2 first:border-t-0">
            <span className="min-w-0 text-corpo text-ink">
              <span className="numero text-pequeno text-ink-3">{diaMesISO(e.saida)}</span> {e.nome} <span className="font-mono text-pequeno text-ink-3">{e.codigo}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2 text-pequeno text-ink-2">
              {!e.estimativa.temPerfil
                ? "falta perfil de referência"
                : e.estimativa.volumeTotal > 0
                  ? e.estimativa.porPerfil.map((p) => `${p.veiculos} ${TIPO_VEICULO_LABEL[p.tipo].toLocaleLowerCase("pt-BR")}${p.veiculos === 1 ? "" : "s"}`).join(" ou ")
                  : "sem como estimar ainda"}
              {e.estimativa.pecasSemVolume > 0 && <Badge tom="warning">estimativa incompleta: {e.estimativa.pecasSemVolume} {e.estimativa.pecasSemVolume === 1 ? "peça" : "peças"} sem m³</Badge>}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
