"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { SinalLink } from "@/components/ui/indicador-link";

export type ItemTrilha = { label: string; href?: string };

let atual: ItemTrilha[] | null = null;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

/** Páginas com contexto (evento, solicitação) informam a trilha; as demais usam a da rota. */
export function DefinirTrilha({ itens }: { itens: ItemTrilha[] }) {
  const chave = JSON.stringify(itens);
  useEffect(() => {
    const valor = JSON.parse(chave) as ItemTrilha[];
    atual = valor;
    emitir();
    return () => {
      if (atual && JSON.stringify(atual) === chave) {
        atual = null;
        emitir();
      }
    };
  }, [chave]);
  return null;
}

const NOMES: Record<string, string> = {
  "": "Painel",
  eventos: "Eventos",
  calendario: "Calendário",
  conferencia: "Eventos",
  solicitacoes: "Solicitações",
  biblioteca: "Biblioteca",
  arena: "Arena 3D",
  projetos: "Biblioteca",
  catalogo: "Biblioteca",
  consolidacao: "Demanda de peças",
  admin: "Administração",
  notificacoes: "Notificações",
  perfil: "Meu perfil",
  "sem-permissao": "Sem acesso",
};

export function Trilha() {
  const pathname = usePathname();
  const definida = useSyncExternalStore(
    assinar,
    () => atual,
    () => null,
  );
  const itens: ItemTrilha[] = definida ?? [{ label: NOMES[pathname.split("/")[1] ?? ""] ?? "Painel" }];
  return (
    <nav aria-label="Trilha" className="min-w-0 flex-1 text-corpo text-ink-3">
      <ol className="m-0 flex min-w-0 list-none items-center gap-[7px] p-0">
        {itens.map((t, i) => {
          const ultimo = i === itens.length - 1;
          // Em telas estreitas só o primeiro e o último aparecem; os do meio encolhem com reticências.
          const meio = i > 0 && !ultimo;
          return (
            <li key={`${t.label}-${i}`} className={cn("flex min-w-0 items-center gap-[7px]", ultimo ? "shrink" : "shrink-[2]", meio && "max-sm:hidden", i === 0 && !ultimo && "max-sm:shrink-0")}>
              {i > 0 && (
                <span aria-hidden className="text-meta">
                  /
                </span>
              )}
              {t.href && !ultimo ? (
                <Link href={t.href} title={t.label} className="flex min-h-6 min-w-6 max-w-[40vw] items-center truncate rounded-chip text-ink-3 no-underline transition-colors duration-150 hover:text-ink max-md:min-h-10">
                  {t.label}
                  <SinalLink />
                </Link>
              ) : (
                <span className={cn("block truncate", ultimo ? "font-medium text-ink" : "max-w-[40vw]")} title={t.label} aria-current={ultimo ? "page" : undefined}>
                  {t.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
