"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addDiasISO, hojeISO } from "@/lib/format";

export function PeriodoForm({ inicio, fim }: { inicio: string; fim: string }) {
  const router = useRouter();
  const [i, setI] = useState(inicio);
  const [f, setF] = useState(fim);
  const [pending, start] = useTransition();
  const aplicar = (ni = i, nf = f) => start(() => router.replace(`/consolidacao?inicio=${ni}&fim=${nf}`));
  const atalho = (dias: number) => {
    const h = hojeISO();
    setI(h);
    setF(addDiasISO(h, dias));
    aplicar(h, addDiasISO(h, dias));
  };
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar();
      }}
      aria-busy={pending}
    >
      <Field label="De" htmlFor="inicio" className="w-40">
        <Input id="inicio" type="date" value={i} onChange={(e) => setI(e.target.value)} />
      </Field>
      <Field label="Até" htmlFor="fim" className="w-40">
        <Input id="fim" type="date" value={f} min={i} onChange={(e) => setF(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>
        Aplicar
      </Button>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => atalho(7)}>
          7 dias
        </Button>
        <Button size="sm" variant="ghost" onClick={() => atalho(30)}>
          30 dias
        </Button>
        <Button size="sm" variant="ghost" onClick={() => atalho(90)}>
          90 dias
        </Button>
      </div>
    </form>
  );
}
