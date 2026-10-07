"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Field, Input } from "@/components/ui/field";
import { Aviso } from "@/components/ui/layout";
import { excluirArenaAction, importarEntornoArenaAction, removerEntornoArenaAction, removerPlantaArenaAction, trocarPlantaArenaAction } from "./arenas-actions";

type Dialogo = "planta" | "remover-planta" | "entorno" | "remover-entorno" | "excluir" | null;

/** Menu da linha de uma arena de evento no índice: planta (trocar/remover), entorno 3D e exclusão. */
export function ArenaAcoes({ slug, nome, temPlanta, geo = null, prediosEntorno = 0 }: { slug: string; nome: string; temPlanta: boolean; geo?: { lat: number; lon: number; giro: number } | null; prediosEntorno?: number }) {
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
            <Icone nome="reticencias" />
          </IconButton>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => setAberto("planta")}>{temPlanta ? "Trocar planta" : "Enviar planta"}</DropdownItem>
          {temPlanta && <DropdownItem onSelect={() => setAberto("remover-planta")}>Remover planta</DropdownItem>}
          <DropdownSeparator />
          <DropdownItem onSelect={() => setAberto("entorno")}>{prediosEntorno > 0 ? "Atualizar prédios do entorno (3D)" : "Prédios do entorno (3D)"}</DropdownItem>
          {prediosEntorno > 0 && <DropdownItem onSelect={() => setAberto("remover-entorno")}>Remover prédios do entorno</DropdownItem>}
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
      {aberto === "entorno" && (
        <ConfirmDialog
          open
          onOpenChange={fechar}
          title="Prédios do entorno (3D)"
          description={`${nome}: os prédios reais (com altura) e as ruas em volta vêm do OpenStreetMap e aparecem na vista em perspectiva.`}
          confirmLabel={prediosEntorno > 0 ? "Atualizar entorno" : "Importar entorno"}
          action={importarEntornoArenaAction}
          hidden={{ slug }}
        >
          <Field label="Centro da planta" htmlFor="entorno-coordenadas" hint="Latitude e longitude do meio da imagem. No Google Maps: botão direito no lugar → clique nas coordenadas para copiar." obrigatorio>
            <Input id="entorno-coordenadas" name="coordenadas" required autoFocus inputMode="text" placeholder="-20.27648, -40.28402" defaultValue={geo ? `${geo.lat}, ${geo.lon}` : ""} className="numero" />
          </Field>
          <Field label="Giro da planta" htmlFor="entorno-giro" hint="0 se o norte está para cima na imagem. Se a planta está deitada, o ângulo que leva o leste para a direita (ex.: 90 ou -90)." optional>
            <Input id="entorno-giro" name="giro" type="number" step="0.5" min={-180} max={180} defaultValue={geo?.giro ?? 0} className="numero !w-28" />
          </Field>
          <Aviso>Prédios e ruas importados antes são substituídos; os itens do mapa não mudam. Dados © colaboradores do OpenStreetMap.</Aviso>
        </ConfirmDialog>
      )}
      {aberto === "remover-entorno" && (
        <ConfirmDialog open onOpenChange={fechar} title="Remover prédios do entorno" description={`${nome}: os ${prediosEntorno} prédios e as ruas importados do OpenStreetMap saem da vista 3D. A planta e os itens continuam.`} confirmLabel="Remover" cancelLabel="Voltar" danger action={removerEntornoArenaAction} hidden={{ slug }} />
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
