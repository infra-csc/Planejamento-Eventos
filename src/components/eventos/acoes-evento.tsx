"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ClipboardList, Pencil, Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/layout";
import { TRANSICOES_EVENTO, type AcaoEvento } from "@/domain/evento";
import { criarRascunhoAction, transicionarEventoAction } from "@/app/(app)/eventos/actions";
import type { EventoStatus } from "@/server/db/schema";

const PRINCIPAL: Partial<Record<EventoStatus, AcaoEvento>> = { PREPARACAO: "INICIAR_REUNIAO", EM_REUNIAO: "FECHAR_ATA", ABERTO: "ENCERRAR", ENCERRADO: "REABRIR" };

export function AcoesEvento({
  evento,
  acoes,
  podeEditar,
  podeSolicitar,
  podeConsolidar,
  pendentes,
}: {
  evento: { id: string; nome: string; status: EventoStatus; codigo: string };
  acoes: AcaoEvento[];
  podeEditar: boolean;
  podeSolicitar: boolean;
  podeConsolidar: boolean;
  pendentes: string[];
}) {
  const [acaoAberta, setAcaoAberta] = useState<AcaoEvento | null>(null);
  const router = useRouter();
  const principal = PRINCIPAL[evento.status];
  const secundarias = acoes.filter((a) => a !== principal);
  const t = acaoAberta ? TRANSICOES_EVENTO[acaoAberta] : null;

  return (
    <>
      {podeSolicitar && (
        <form action={criarRascunhoAction}>
          <input type="hidden" name="eventoId" value={evento.id} />
          <Button type="submit" variant="primary">
            <Plus className="size-4" /> Nova solicitação
          </Button>
        </form>
      )}
      {podeConsolidar && (
        <ButtonLink href={`/eventos/${evento.id}/reuniao`} variant={evento.status === "EM_REUNIAO" ? "primary" : "secondary"}>
          <ClipboardList className="size-4" /> Consolidar ata
        </ButtonLink>
      )}
      {principal && acoes.includes(principal) && (
        <Button variant={podeConsolidar && evento.status === "EM_REUNIAO" ? "secondary" : "primary"} onClick={() => setAcaoAberta(principal)}>
          {TRANSICOES_EVENTO[principal].label}
        </Button>
      )}
      {(podeEditar || secundarias.length > 0) && (
        <Dropdown>
          <DropdownTrigger asChild>
            <Button aria-label="Mais ações">
              Mais <ChevronDown className="size-4" />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            {podeEditar && (
              <DropdownItem onSelect={() => router.push(`/eventos/${evento.id}/editar`)}>
                <Pencil className="size-4" /> Editar dados do evento
              </DropdownItem>
            )}
            {secundarias.map((a) => (
              <DropdownItem key={a} onSelect={() => setAcaoAberta(a)} danger={a === "CANCELAR"}>
                {TRANSICOES_EVENTO[a].label}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      )}

      {acaoAberta && t && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAcaoAberta(null)}
          title={`${t.label} — ${evento.codigo}`}
          description={t.descricao}
          confirmLabel={t.label}
          danger={acaoAberta === "CANCELAR"}
          reasonLabel={t.exigeJustificativa ? "Justificativa" : undefined}
          action={transicionarEventoAction}
          hidden={{ eventoId: evento.id, acao: acaoAberta }}
        >
          {acaoAberta === "ENCERRAR" && pendentes.length > 0 && (
            <Notice tone="warning" title={`${pendentes.length} solicitação(ões) ainda sem resposta`}>
              {pendentes.join(", ")}. Responda ou devolva todas antes de encerrar — a OS final precisa refletir cada decisão.
            </Notice>
          )}
          {acaoAberta === "ENCERRAR" && pendentes.length === 0 && <Notice tone="info">Depois do encerramento, só a Gestão pode reabrir, em caráter de exceção e com justificativa.</Notice>}
          {acaoAberta === "FECHAR_ATA" && <Notice tone="info">A ata será congelada como versão 1 e a OS de cada setor será gerada automaticamente a partir dela.</Notice>}
        </ConfirmDialog>
      )}
    </>
  );
}
