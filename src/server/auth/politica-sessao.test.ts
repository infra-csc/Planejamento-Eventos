import { describe, expect, it } from "vitest";
import { caminhoLiberadoComTrocaPendente, DURACAO_MAXIMA_MS, expiracaoInicial, INATIVIDADE_MS, novaExpiracao, RENOVAR_A_CADA_MS, sessaoValida } from "./politica-sessao";

const H = 60 * 60 * 1000;
const D = 24 * H;
const t0 = new Date("2026-09-01T12:00:00Z");
const mais = (ms: number) => new Date(t0.getTime() + ms);

describe("política de sessão: 14 dias sem uso ou 30 dias no total", () => {
  it("sessão nova expira em 14 dias", () => {
    expect(expiracaoInicial(t0).getTime() - t0.getTime()).toBe(INATIVIDADE_MS);
    expect(INATIVIDADE_MS).toBe(14 * D);
    expect(DURACAO_MAXIMA_MS).toBe(30 * D);
  });

  it("expira por inatividade: sem uso por 14 dias, deixa de valer", () => {
    const s = { criadoEm: t0, expiraEm: expiracaoInicial(t0) };
    expect(sessaoValida(s, mais(14 * D - 1))).toBe(true);
    expect(sessaoValida(s, mais(14 * D + 1))).toBe(false);
  });

  it("o uso empurra a expiração, no máximo uma gravação por hora", () => {
    const s = { criadoEm: t0, expiraEm: expiracaoInicial(t0) };
    expect(novaExpiracao(s, mais(10 * 60_000))).toBeNull(); // 10 min depois: não grava
    const renovada = novaExpiracao(s, mais(RENOVAR_A_CADA_MS + 1000));
    expect(renovada?.getTime()).toBe(mais(RENOVAR_A_CADA_MS + 1000).getTime() + INATIVIDADE_MS);
    // Usada todo dia, a sessão continua valendo depois dos 14 dias iniciais.
    let atual = { ...s };
    for (let dia = 1; dia <= 20; dia++) {
      const agora = mais(dia * D);
      expect(sessaoValida(atual, agora)).toBe(true);
      atual = { ...atual, expiraEm: novaExpiracao(atual, agora) ?? atual.expiraEm };
    }
  });

  it("teto absoluto de 30 dias desde o login, mesmo com uso contínuo", () => {
    let s = { criadoEm: t0, expiraEm: expiracaoInicial(t0) };
    for (let h = 1; h < 30 * 24; h += 5) s = { ...s, expiraEm: novaExpiracao(s, mais(h * H)) ?? s.expiraEm };
    expect(s.expiraEm.getTime()).toBeLessThanOrEqual(mais(30 * D).getTime());
    expect(sessaoValida(s, mais(30 * D - 1000))).toBe(true);
    expect(sessaoValida(s, mais(30 * D + 1000))).toBe(false);
    // Já encostada no teto: não há o que renovar.
    expect(novaExpiracao({ criadoEm: t0, expiraEm: mais(30 * D) }, mais(29 * D))).toBeNull();
  });

  it("com troca de senha pendente só o perfil abre", () => {
    expect(caminhoLiberadoComTrocaPendente("/perfil")).toBe(true);
    expect(caminhoLiberadoComTrocaPendente("/perfil/qualquer")).toBe(true);
    expect(caminhoLiberadoComTrocaPendente("/")).toBe(false);
    expect(caminhoLiberadoComTrocaPendente("/perfilx")).toBe(false);
    expect(caminhoLiberadoComTrocaPendente("/eventos")).toBe(false);
  });
});
