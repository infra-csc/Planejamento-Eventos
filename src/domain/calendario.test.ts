import { describe, expect, it } from "vitest";
import { contarCompromissos, doMes } from "./calendario";

const item = (tipo: string, dia: string, evento: string) => ({ tipo, dia, evento: { id: evento } });

/** Pílulas do calendário mensal (auditoria 30/10, parte D N6). */
describe("calendário · contagens do mês", () => {
  const grade = [
    item("montagem", "2026-10-31", "a"), // dia de outubro que completa a 1ª semana da grade de novembro
    item("evento", "2026-11-02", "a"),
    item("evento", "2026-11-03", "a"), // mesmo evento, 2º dia
    item("reuniao", "2026-11-03", "b"),
    item("evento", "2026-11-03", "b"),
    item("carga", "2026-12-01", "c"), // dia de dezembro no fim da grade
  ];

  it("conta só os dias do mês mostrado", () => {
    expect(doMes(grade, "2026-11").map((i) => i.dia)).toEqual(["2026-11-02", "2026-11-03", "2026-11-03", "2026-11-03"]);
  });

  it("evento de vários dias conta uma vez; os outros tipos, um por item", () => {
    const nov = doMes(grade, "2026-11");
    expect(contarCompromissos(nov)).toBe(3); // eventos a e b + a reunião
    expect(contarCompromissos(nov.filter((i) => i.tipo === "evento"))).toBe(2);
    expect(contarCompromissos(nov.filter((i) => i.tipo === "reuniao"))).toBe(1);
    expect(contarCompromissos(doMes(grade, "2026-10"))).toBe(1);
  });
});
