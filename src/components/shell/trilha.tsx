"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

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
    <nav aria-label="Trilha" className="flex min-w-0 flex-1 items-center gap-[7px] text-corpo text-ink-3">
      {itens.map((t, i) => {
        const ultimo = i === itens.length - 1;
        return (
          <span key={`${t.label}-${i}`} className="flex min-w-0 items-center gap-[7px]">
            {i > 0 && <span className="text-meta">/</span>}
            {t.href && !ultimo ? (
              <Link href={t.href} className="text-ink-3 no-underline hover:text-ink">
                {t.label}
              </Link>
            ) : (
              <span className={ultimo ? "truncate font-medium text-ink" : ""} aria-current={ultimo ? "page" : undefined}>
                {t.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
