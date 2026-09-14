"use client";

import { useRef, useState } from "react";
import { salvarObservacoesAction } from "@/app/(app)/eventos/actions";

type Estado = "ocioso" | "salvando" | "salvo" | "erro";

/** Observações da reunião com salvamento automático (handoff §6 "Salvando / salvo"). */
export function ObservacoesAutosave({ eventoId, valor }: { eventoId: string; valor: string }) {
  const [texto, setTexto] = useState(valor);
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoSalvo = useRef(valor);

  const salvar = async (t: string) => {
    if (t === ultimoSalvo.current) {
      setEstado("salvo");
      return;
    }
    setEstado("salvando");
    const r = await salvarObservacoesAction(eventoId, t);
    if (r.ok) {
      ultimoSalvo.current = t;
      setEstado("salvo");
      setErro(null);
    } else {
      setEstado("erro");
      setErro(r.erro);
    }
  };

  const agendar = (t: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvar(t), 900);
  };

  return (
    <div>
      <textarea
        aria-label="Observações da reunião"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setEstado("ocioso");
          agendar(e.target.value);
        }}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          void salvar(texto);
        }}
        placeholder="Quem participou, o que foi decidido, combinados com o cliente."
        className="min-h-[112px] w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[13.5px] leading-[1.5] text-ink placeholder:text-meta focus:border-accent focus:outline-none"
      />
      <p className="mb-0 mt-1.5 text-[11.5px]" aria-live="polite" style={{ color: estado === "erro" ? "#a8400f" : "#6f6366" }}>
        {estado === "salvando" ? "salvando…" : estado === "erro" ? `não foi possível salvar — ${erro}` : estado === "salvo" ? "salvo automaticamente" : "salvo automaticamente ao digitar"}
      </p>
    </div>
  );
}
