"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Arena, Divergencia, PontoArena } from "@/domain/arena/tipos";
import { CATEGORIAS, type Camada } from "@/domain/arena/categorias";
import type { MotorArena } from "./cena/motor";
import { PainelAta, PainelPonto, PainelSemPosicao, type PosicionarItem } from "./painel-ponto";
import { PainelConferencia } from "./painel-conferencia";
import { IndicePontos } from "./indice-pontos";

export type PainelEsquerdo = "indice" | "conferencia" | null;
export type PainelDireito = "ficha" | "sem-posicao" | "ata" | null;

/** Painéis laterais: um de cada lado (índice ou conferência à esquerda; ficha, ata ou sem posição à direita). */
export function PaineisLaterais({
  arena,
  camadas,
  setCamadas,
  selecionado,
  modo,
  estreito,
  usar3D,
  motorRef,
  painelEsquerdo,
  setPainelEsquerdo,
  painelDireito,
  setPainelDireito,
  conferenciaAtiva,
  divergencias,
  idsDivergentes,
  focoConferencia,
  setFocoConferencia,
  focarDivergencia,
  ponto,
  fichaAberta,
  abrirPonto,
  abrirConferencia,
  fecharDireito,
  devolverFoco,
  editando,
  colocando,
  setColocando,
  medindo,
  pararMedicao,
}: {
  arena: Arena;
  camadas: Record<Camada, boolean>;
  setCamadas: Dispatch<SetStateAction<Record<Camada, boolean>>>;
  selecionado: string | null;
  modo: "2d" | "3d";
  estreito: boolean;
  usar3D: boolean;
  motorRef: React.RefObject<MotorArena | null>;
  painelEsquerdo: PainelEsquerdo;
  setPainelEsquerdo: (painel: PainelEsquerdo) => void;
  painelDireito: PainelDireito;
  setPainelDireito: (painel: PainelDireito) => void;
  conferenciaAtiva: boolean;
  divergencias: Divergencia[];
  idsDivergentes: Set<string>;
  focoConferencia: string | null;
  setFocoConferencia: (id: string | null) => void;
  focarDivergencia: (id: string) => void;
  ponto: PontoArena | null;
  fichaAberta: boolean;
  abrirPonto: (id: string, aproximar?: boolean) => void;
  abrirConferencia: (focoId?: string | null) => void;
  fecharDireito: () => void;
  devolverFoco: () => void;
  editando: boolean;
  colocando: PosicionarItem | null;
  setColocando: Dispatch<SetStateAction<PosicionarItem | null>>;
  medindo: boolean;
  pararMedicao: () => void;
}) {
  return (
    <>
      {painelEsquerdo === "indice" && (
        <IndicePontos
          arena={arena}
          camadas={camadas}
          selecionado={selecionado}
          onEscolher={(id) => {
            const cat = CATEGORIAS[arena.pontos.find((p) => p.id === id)?.categoria ?? "estrutura"];
            if (!camadas[cat.camada]) setCamadas((v) => ({ ...v, [cat.camada]: true }));
            abrirPonto(id, modo === "3d");
          }}
          onFechar={() => {
            setPainelEsquerdo(null);
            devolverFoco();
          }}
        />
      )}
      {conferenciaAtiva && (
        <PainelConferencia
          arena={arena}
          divergencias={divergencias}
          camadas={camadas}
          foco={focoConferencia}
          onFocar={focarDivergencia}
          onVerFicha={(id) => abrirPonto(id, modo === "3d")}
          onFechar={() => {
            setPainelEsquerdo(null);
            setFocoConferencia(null);
            devolverFoco();
          }}
        />
      )}
      {fichaAberta && ponto && (
        <PainelPonto
          arena={arena}
          ponto={ponto}
          estreito={estreito}
          divergente={idsDivergentes.has(ponto.id)}
          onFechar={fecharDireito}
          onAproximar={usar3D ? () => motorRef.current?.focar(ponto.id) : undefined}
          onConferir={() => abrirConferencia(divergencias.find((d) => d.pontoIds.includes(ponto.id))?.id ?? null)}
          onAbrirAta={() => setPainelDireito("ata")}
        />
      )}
      {painelDireito === "ata" && <PainelAta arena={arena} ponto={ponto} estreito={estreito} onFechar={fecharDireito} />}
      {painelDireito === "sem-posicao" && (
        <PainelSemPosicao
          arena={arena}
          estreito={estreito}
          onFechar={fecharDireito}
          edicao={
            editando
              ? {
                  colocando: colocando?.chave ?? null,
                  onPosicionar: (item) => {
                    if (medindo) pararMedicao();
                    setColocando((c) => (c?.chave === item.chave ? null : item));
                  },
                }
              : null
          }
        />
      )}
    </>
  );
}
