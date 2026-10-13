import { describe, expect, it } from "vitest";
import { dentroDoFiltroAlteracao, lerFiltroAlteracao } from "./filtro-alteracao";

const sp = (d: string) => new Date(d);

describe("filtro de data de alteração", () => {
  it("ignora valores desconhecidos e período sem datas válidas", () => {
    expect(lerFiltroAlteracao({}, "2026-10-13")).toBeNull();
    expect(lerFiltroAlteracao({ alterado: "ontem" }, "2026-10-13")).toBeNull();
    expect(lerFiltroAlteracao({ alterado: "periodo", alteradoDe: "2026-02-30" }, "2026-10-13")).toBeNull();
  });

  it("usa o dia de São Paulo para hoje e últimos dias", () => {
    const hoje = lerFiltroAlteracao({ alterado: "hoje" }, "2026-10-13");
    expect(dentroDoFiltroAlteracao(sp("2026-10-13T03:00:00Z"), hoje)).toBe(true);
    expect(dentroDoFiltroAlteracao(sp("2026-10-13T02:59:59Z"), hoje)).toBe(false);
    const sete = lerFiltroAlteracao({ alterado: "7d" }, "2026-10-13");
    expect(dentroDoFiltroAlteracao(sp("2026-10-07T03:00:00Z"), sete)).toBe(true);
    expect(dentroDoFiltroAlteracao(sp("2026-10-07T02:00:00Z"), sete)).toBe(false);
  });

  it("'mais de 90 dias' pega só o que ficou parado", () => {
    const f = lerFiltroAlteracao({ alterado: "mais90" }, "2026-10-13");
    expect(dentroDoFiltroAlteracao(sp("2026-07-01T12:00:00Z"), f)).toBe(true);
    expect(dentroDoFiltroAlteracao(sp("2026-10-01T12:00:00Z"), f)).toBe(false);
  });

  it("período inclui os dois dias e corrige datas invertidas", () => {
    const f = lerFiltroAlteracao({ alterado: "periodo", alteradoDe: "2026-10-10", alteradoAte: "2026-10-01" }, "2026-10-13");
    expect(f?.descricao).toBe("alterados de 01/10/2026 a 10/10/2026");
    expect(dentroDoFiltroAlteracao(sp("2026-10-01T03:00:00Z"), f)).toBe(true);
    expect(dentroDoFiltroAlteracao(sp("2026-10-11T02:59:00Z"), f)).toBe(true);
    expect(dentroDoFiltroAlteracao(sp("2026-10-11T03:00:00Z"), f)).toBe(false);
    const desde = lerFiltroAlteracao({ alterado: "periodo", alteradoDe: "2026-10-05" }, "2026-10-13");
    expect(desde?.descricao).toBe("alterados desde 05/10/2026");
    expect(dentroDoFiltroAlteracao(sp("2025-01-01T00:00:00Z"), desde)).toBe(false);
  });
});
