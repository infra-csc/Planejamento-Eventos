import { describe, expect, it } from "vitest";
import { abreComPecas, listasDaArea, projetosDaLista } from "./itens-por-area";

const proj = (codigo: string, nome: string) => ({ codigo, nome });

describe("lista padrão da área", () => {
  const ativacao = listasDaArea("Ativação");
  const stands = ativacao.find((l) => l.titulo === "Stands")!;
  const tendas = ativacao.find((l) => l.titulo === "Tendas")!;

  it("Ativação: lixeiras e rampa de acessibilidade na lista; só o stand 9×6", () => {
    expect(ativacao.find((l) => l.titulo === "Ativação")?.codigos).toEqual(expect.arrayContaining(["LIXEIRA-ARAM", "LIXEIRA-BAG", "RAMPA-ACESS", "PUFF"]));
    const catalogo = [proj("PRJ-0018", "Stand 9×6 m"), proj("PRJ-0019", "Stand 11×6 m"), proj("PRJ-0200", "Stand 9×6 m — LED")];
    expect(projetosDaLista(stands, catalogo).map((p) => p.nome)).toEqual(["Stand 9×6 m"]);
  });

  it("acha pelo nome, escrito de vários jeitos e com outro código; sem nome que bata, pelo código", () => {
    expect(projetosDaLista(stands, [proj("PRJ-0101", "ESTANDE 9X6"), proj("PRJ-0018", "Palco 8×4 m")]).map((p) => p.codigo)).toEqual(["PRJ-0101"]);
    expect(projetosDaLista(tendas, [proj("PRJ-0500", "Kit Tenda 5x5 m"), proj("PRJ-0501", "TENDA 3 X 3")]).map((p) => p.codigo)).toEqual(["PRJ-0501", "PRJ-0500"]);
    // Nenhum nome bate: o código continua valendo (como antes da trava de nome).
    expect(projetosDaLista(stands, [proj("PRJ-0018", "Estrutura da Ativação")]).map((p) => p.codigo)).toEqual(["PRJ-0018"]);
    // Banco em que o código é de outro projeto mas o projeto certo existe com outro código: vale o nome.
    expect(projetosDaLista(tendas, [proj("PRJ-0033", "Palco 8×4 m"), proj("PRJ-0040", "Tenda 3×3 m")]).map((p) => p.nome)).toEqual(["Tenda 3×3 m"]);
  });
});

describe("Cenografia (31/10): sem escada de alumínio, com kit de montagem e kit ceno abertos", () => {
  const proj = (codigo: string, nome: string) => ({ codigo, nome });
  it("lista padrão sem a escada de alumínio e com os dois kits, achados pelo nome", () => {
    const [ceno] = listasDaArea("Cenografia");
    expect(ceno.codigos).toEqual(["ESCADA-MAD"]);
    const catalogo = [proj("PRJ-0500", "Kit Ceno"), proj("PRJ-0501", "Kit de Montagem"), proj("PRJ-0502", "Kit Aterramento Estruturas Box (marcenaria)")];
    expect(projetosDaLista(ceno, catalogo).map((p) => p.nome)).toEqual(["Kit de Montagem", "Kit Ceno"]);
  });
  it("os kits de montagem e ceno abrem com as peças; os outros projetos, não", () => {
    expect(["Kit de montagem", "KIT MONTAGEM CENO", "Kit ceno", "Kit de cenografia"].every(abreComPecas)).toBe(true);
    expect(["Kit de aterramento", "Stand 9×6 m", "Tenda 5×5 m", "Cenografia geral"].some(abreComPecas)).toBe(false);
  });
});
