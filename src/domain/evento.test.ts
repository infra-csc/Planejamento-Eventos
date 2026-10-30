import { describe, expect, it } from "vitest";
import { avisoReuniaoAntecipada, diasAte, TRANSICOES_EVENTO } from "./evento";

describe("reunião iniciada antes do dia (auditoria 28/10, nº 31 e 32)", () => {
  it("conta os dias pelo calendário, nos dois sentidos", () => {
    expect(diasAte("2026-10-28", "2026-11-10")).toBe(13);
    expect(diasAte("2026-10-31", "2026-11-01")).toBe(1);
    expect(diasAte("2026-10-30", "2026-10-30")).toBe(0);
    expect(diasAte("2026-10-30", "2026-10-28")).toBe(-2);
  });

  it("avisa a data marcada e quanto falta; no dia ou depois, nada", () => {
    expect(avisoReuniaoAntecipada("2026-10-28", "2026-11-10", "10/11 às 14:00")).toBe(
      "A reunião está marcada para 10/11 às 14:00, daqui a 13 dias. Iniciando agora, as áreas param de enviar necessidades desde já.",
    );
    expect(avisoReuniaoAntecipada("2026-11-09", "2026-11-10", "10/11 às 14:00")).toContain("amanhã");
    expect(avisoReuniaoAntecipada("2026-11-10", "2026-11-10", "10/11 às 14:00")).toBeNull();
    expect(avisoReuniaoAntecipada("2026-11-12", "2026-11-10", "10/11 às 14:00")).toBeNull();
  });

  it("o diálogo fala em conferência, não em consolidação (nº 78)", () => {
    expect(TRANSICOES_EVENTO.INICIAR_REUNIAO.descricao).toContain("conferência da ata");
    expect(TRANSICOES_EVENTO.INICIAR_REUNIAO.descricao).not.toContain("consolida");
  });
});
