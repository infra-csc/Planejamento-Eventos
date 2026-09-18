"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { Field } from "@/components/ui/field";
import { excluirArenaAction, removerPlantaArenaAction, trocarPlantaArenaAction } from "./arenas-actions";

type Dialogo = "planta" | "remover-planta" | "excluir" | null;

/** Menu da linha de uma arena de evento no índice: planta (trocar/remover) e exclusão. */
export function ArenaAcoes({ slug, nome, temPlanta }: { slug: string; nome: string; temPlanta: boolean }) {
  const [aberto, setAberto] = useState<Dialogo>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const fechar = (o: boolean) => {
    if (!o) {
      setAberto(null);
      setErroArquivo(null);
    }
  };

  // A linha do índice é clicável (abre a arena). Menu e diálogos vivem em portal, mas o clique
  // sobe pela árvore do React até a linha: para aqui, senão escolher uma ação abriria a arena.
  const isolar = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <span className="contents" onClick={isolar} onAuxClick={isolar}>
      <Dropdown>
        <DropdownTrigger asChild>
          <IconButton label={`Ações de ${nome}`}>
            <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </IconButton>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => setAberto("planta")}>{temPlanta ? "Trocar planta" : "Enviar planta"}</DropdownItem>
          {temPlanta && <DropdownItem onSelect={() => setAberto("remover-planta")}>Remover planta</DropdownItem>}
          <DropdownSeparator />
          <DropdownItem danger onSelect={() => setAberto("excluir")}>
            Excluir arena
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      {aberto === "planta" && (
        <ConfirmDialog
          open
          onOpenChange={fechar}
          title={temPlanta ? "Trocar planta" : "Enviar planta"}
          description={nome}
          confirmLabel="Enviar"
          action={trocarPlantaArenaAction}
          hidden={{ slug }}
        >
          <Field label="Imagem da planta" htmlFor="planta-arquivo" hint="PNG, JPG ou WebP · até 8 MB. Fica como fundo do plano 2D." error={erroArquivo} obrigatorio>
            <input
              id="planta-arquivo"
              type="file"
              name="planta"
              required
              accept="image/png,image/jpeg,image/webp"
              className="block w-full text-pequeno text-ink-2 file:mr-3 file:cursor-pointer file:rounded-controle file:border file:border-line-control file:bg-surface file:px-3 file:py-1.5 file:text-pequeno file:text-ink"
              onChange={(e) => {
                const f = e.target.files?.[0];
                const grande = Boolean(f && f.size > 8 * 1024 * 1024);
                setErroArquivo(grande ? "Arquivo acima de 8 MB." : null);
                if (grande) e.target.value = "";
              }}
            />
          </Field>
        </ConfirmDialog>
      )}
      {aberto === "remover-planta" && (
        <ConfirmDialog open onOpenChange={fechar} title="Remover planta" description={`${nome}: o plano 2D fica sem a imagem de fundo. Pontos e posições continuam.`} confirmLabel="Remover" danger action={removerPlantaArenaAction} hidden={{ slug }} />
      )}
      {aberto === "excluir" && (
        <ConfirmDialog
          open
          onOpenChange={fechar}
          title="Excluir arena"
          description={`${nome}: o mapa, a planta e todas as posições marcadas nele saem de vez. O evento e a ata não mudam.`}
          confirmLabel="Excluir arena"
          danger
          action={excluirArenaAction}
          hidden={{ slug }}
        />
      )}
    </span>
  );
}
