"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icone } from "@/components/ui/icons";
import { Aviso } from "@/components/ui/layout";
import { acoesDisponiveis, avisoReuniaoAntecipada, diasAte, motivoBloqueioEncerramento, TRANSICOES_EVENTO, type AcaoEvento } from "@/domain/evento";
import { transicionarEventoAction } from "@/app/(app)/eventos/actions";
import type { EventoStatus, Perfil } from "@/server/db/schema";

type Botao = { chave: string; principal: boolean; render: (variante: "primary" | "secondary") => React.ReactNode };

/**
 * Botões do cabeçalho do evento conforme perfil e fase (handoff §5.4). As ações vêm de
 * `acoesDisponiveis()` do domínio — a mesma regra que o servidor aplica —, sem regra de perfil própria.
 * Um só `primary`: a primeira ação principal da fase; as demais saem como secundárias, antes dela.
 * Ação bloqueada fica desabilitada com o motivo no `title` e no leitor de tela (`motivoDesabilitado`).
 */
export function AcoesEvento({
  evento,
  perfil,
  podeSolicitar,
  solicitacoesAbertas,
  bloquearEncerramentoComPendentes = true,
  corrigeDireto = false,
  datas,
}: {
  evento: { id: string; codigo: string; nome: string; status: EventoStatus };
  perfil: Perfil;
  podeSolicitar: boolean;
  /** Não usado aqui (fechar a ata é na conferência); mantido para a página que monta o cabeçalho. */
  pendentesPreReuniao?: number;
  solicitacoesAbertas: string[];
  /** Configuração `bloquear_encerramento_com_pendentes`. Sem o valor, assume o padrão (bloqueia). */
  bloquearEncerramentoComPendentes?: boolean;
  /** Admin e logística corrigem os itens direto (visão geral): pedir alteração é caminho de apoio, não a ação da tela. */
  corrigeDireto?: boolean;
  /**
   * Datas que decidem o botão principal (auditoria 28/10, nº 31 e 32): `hoje`, o dia da reunião e o do evento em
   * "YYYY-MM-DD" (fuso de São Paulo), e a reunião por extenso ("10/11 às 14:00") para o diálogo.
   */
  datas?: { hoje: string; diaReuniao: string; quandoReuniao: string; diaEvento: string };
}) {
  const router = useRouter();
  const [acao, setAcao] = useState<AcaoEvento | null>(null);
  const t = acao ? TRANSICOES_EVENTO[acao] : null;
  const base = `/eventos/${evento.id}`;
  const editando = usePathname() === `${base}/editar`;
  const disponiveis = acoesDisponiveis(evento.status, perfil);
  const tem = (a: AcaoEvento) => disponiveis.includes(a);

  const botoes: Botao[] = [];
  // Antes do dia da reunião, "Iniciar reunião" não é o próximo passo: fica secundário (auditoria 28/10, nº 32).
  const reuniaoAntecipada = datas ? avisoReuniaoAntecipada(datas.hoje, datas.diaReuniao, datas.quandoReuniao) : null;
  if (tem("INICIAR_REUNIAO")) {
    botoes.push({
      chave: "iniciar",
      principal: !reuniaoAntecipada,
      render: (v) => (
        <Button key="iniciar" variant={v} size="lg" onClick={() => setAcao("INICIAR_REUNIAO")}>
          {TRANSICOES_EVENTO.INICIAR_REUNIAO.label}
        </Button>
      ),
    });
  }
  // Fechar a ata (e voltar para preparação) acontece na tela de conferência: aqui só o caminho até ela.
  if (tem("FECHAR_ATA")) {
    botoes.push({
      chave: "consolidar",
      principal: true,
      render: (v) => (
        <ButtonLink key="consolidar" href={`/conferencia/${evento.id}`} variant={v} size="lg" className="no-underline">
          Abrir conferência
        </ButtonLink>
      ),
    });
  }
  if (tem("ENCERRAR")) {
    const bloqueio = motivoBloqueioEncerramento(solicitacoesAbertas, bloquearEncerramentoComPendentes);
    // Logo depois da ata o próximo passo é mandar a OS (aba OS), não encerrar: até o dia do evento, secundário (nº 32).
    const antesDoEvento = datas ? diasAte(datas.hoje, datas.diaEvento) > 0 : false;
    botoes.push({
      chave: "encerrar",
      principal: !bloqueio && !antesDoEvento,
      render: (v) => (
        <Button key="encerrar" variant={bloqueio ? "secondary" : v} size="lg" disabled={Boolean(bloqueio)} motivoDesabilitado={bloqueio ?? undefined} onClick={() => setAcao("ENCERRAR")}>
          {TRANSICOES_EVENTO.ENCERRAR.label}
        </Button>
      ),
    });
  }
  if (podeSolicitar && (evento.status === "PREPARACAO" || evento.status === "ABERTO")) {
    botoes.push({
      chave: "solicitar",
      principal: !corrigeDireto,
      render: (v) => (
        <ButtonLink key="solicitar" href={`/solicitacoes/nova?evento=${evento.id}`} variant={v} size="lg" className="no-underline">
          {evento.status === "PREPARACAO" ? "Enviar necessidades" : "Solicitar alteração"}
        </ButtonLink>
      ),
    });
  }
  if (tem("REABRIR")) {
    botoes.push({
      chave: "reabrir",
      principal: false,
      render: () => (
        <Button key="reabrir" variant="secondary" size="lg" onClick={() => setAcao("REABRIR")}>
          {TRANSICOES_EVENTO.REABRIR.label}
        </Button>
      ),
    });
  }

  // Um primário por área: a primeira ação principal da lista; as outras viram secundárias e vêm antes dela.
  const iPrincipal = botoes.findIndex((b) => b.principal);
  const secundarios = botoes.filter((_, i) => i !== iPrincipal);
  const principal = iPrincipal >= 0 ? botoes[iPrincipal] : null;

  const abertasNoEncerramento = acao === "ENCERRAR" && solicitacoesAbertas.length > 0;

  return (
    <>
      {/* Cancelar fica junto da edição do evento (mesmos perfis e fases): ação terciária, discreta. */}
      {tem("CANCELAR") && (
        // Na própria edição nenhuma aba fica marcada: o "Editar" é que diz onde se está (auditoria 28/10, nº 124).
        <ButtonLink href={`${base}/editar`} variant="ghost" size="lg" aria-current={editando ? "page" : undefined} className={cn("no-underline", editando && "bg-accent-bg text-accent")}>
          <Icone nome="lapis" />
          Editar
        </ButtonLink>
      )}
      {secundarios.map((b) => b.render("secondary"))}
      {principal?.render("primary")}
      {acao && t && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAcao(null)}
          title={`${t.label} · ${evento.codigo}`}
          description={t.descricao}
          confirmLabel={acao === "FECHAR_ATA" ? "Fechar ata e gerar OS" : t.label}
          danger={acao === "CANCELAR"}
          cancelLabel={acao === "CANCELAR" ? "Voltar" : undefined}
          reasonLabel={t.exigeJustificativa ? (acao === "REABRIR" ? "Justificativa da exceção" : "Justificativa") : undefined}
          action={transicionarEventoAction}
          hidden={{ eventoId: evento.id, acao }}
          onSuccess={() => {
            // Reunião iniciada: a próxima tarefa é conferir a ata, como "Fechar ata" já leva à OS (auditoria 28/10, nº 33).
            if (acao === "INICIAR_REUNIAO") router.push(`/conferencia/${evento.id}`);
          }}
        >
          {/* Um aviso só, em tópicos: antes eram dois quadros iguais empilhados. */}
          {acao === "ENCERRAR" && (
            <Aviso titulo="O que acontece ao encerrar">
              <ul className="m-0 mt-0.5 list-disc space-y-0.5 pl-4">
                <li>Nenhuma alteração entra e a OS final fica fixada.</li>
                <li>Rascunhos e solicitações devolvidas que não foram reenviadas são cancelados.</li>
                <li>Só a Gestão reabre, em exceção e com justificativa.</li>
              </ul>
            </Aviso>
          )}
          {abertasNoEncerramento && (
            <Aviso tom="warning" titulo={`${solicitacoesAbertas.length} ${solicitacoesAbertas.length === 1 ? "solicitação sem resposta" : "solicitações sem resposta"}`}>
              {solicitacoesAbertas.join(", ")}: as que não tiveram nenhuma resposta são canceladas; nas respondidas em parte, o que falta fica como não atendido. As áreas são avisadas.
            </Aviso>
          )}
          {acao === "FECHAR_ATA" && <Aviso>A ata é congelada e a OS de cada setor é gerada a partir dela. As áreas são notificadas.</Aviso>}
          {/* A descrição já diz o que acontece; o aviso só acrescenta (antes repetia a mesma frase: auditoria 28/10, nº 169, e 30/10, B-14). */}
          {acao === "INICIAR_REUNIAO" && reuniaoAntecipada && <Aviso tom="warning">{reuniaoAntecipada}</Aviso>}
          {acao === "INICIAR_REUNIAO" && <Aviso>Rascunhos das áreas continuam salvos.</Aviso>}
          {acao === "REABRIR" && <Aviso tom="warning">A reabertura fica marcada no evento e no histórico.</Aviso>}
        </ConfirmDialog>
      )}
    </>
  );
}
