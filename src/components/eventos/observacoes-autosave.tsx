"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Textarea } from "@/components/ui/field";
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

  // Texto ainda não salvo: ao sair da página avisa o navegador; ao desmontar (troca de aba do app),
  // dispara o salvamento pendente em vez de perdê-lo.
  const pendente = useRef<string | null>(null);
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (pendente.current !== null && pendente.current !== ultimoSalvo.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => {
      window.removeEventListener("beforeunload", aviso);
      if (timer.current) clearTimeout(timer.current);
      if (pendente.current !== null && pendente.current !== ultimoSalvo.current) void salvarObservacoesAction(eventoId, pendente.current);
    };
  }, [eventoId]);

  const agendar = (t: string) => {
    pendente.current = t;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvar(t), 900);
  };

  return (
    <div>
      <Textarea
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
        className="min-h-[220px]"
      />
      <p className={cn("mb-0 mt-1.5 text-rotulo", estado === "erro" ? "text-danger" : "text-muted")} aria-live="polite">
        {estado === "salvando" ? "salvando…" : estado === "erro" ? `não foi possível salvar — ${erro}` : estado === "salvo" ? "salvo automaticamente" : "salvo automaticamente ao digitar"}
      </p>
    </div>
  );
}
