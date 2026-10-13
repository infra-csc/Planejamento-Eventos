import { ValidacaoError } from "./errors";

export function normalizarGrupoProjeto(valor: unknown): { nome: string; nomeNormalizado: string } | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "string") throw new ValidacaoError("Informe o nome do grupo.", { grupoEvento: "Informe um nome válido." });
  const nome = valor.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!nome) return null;
  if (nome.length > 120) throw new ValidacaoError("O nome do grupo deve ter até 120 caracteres.", { grupoEvento: "Use até 120 caracteres." });
  const nomeNormalizado = nome.toLocaleLowerCase("pt-BR");
  if (nomeNormalizado === "padrão" || nomeNormalizado === "padrao") {
    throw new ValidacaoError("Para um projeto geral, selecione Padrão.", { grupoEvento: "Selecione Padrão ou escreva outro nome para o grupo." });
  }
  return { nome, nomeNormalizado };
}
