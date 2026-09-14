/**
 * Erros de domínio: carregam uma mensagem legível para o usuário e um código
 * que a camada de apresentação usa para decidir como exibir.
 */
export class DomainError extends Error {
  readonly code: "REGRA" | "NAO_ENCONTRADO" | "SEM_PERMISSAO" | "VALIDACAO";
  readonly campos?: Record<string, string>;

  constructor(message: string, code: DomainError["code"] = "REGRA", campos?: Record<string, string>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.campos = campos;
  }
}

export class NaoEncontradoError extends DomainError {
  constructor(entidade = "Registro") {
    super(`${entidade} não encontrado.`, "NAO_ENCONTRADO");
  }
}

export class SemPermissaoError extends DomainError {
  constructor(message = "Você não tem permissão para executar esta ação.") {
    super(message, "SEM_PERMISSAO");
  }
}

export class ValidacaoError extends DomainError {
  constructor(message: string, campos?: Record<string, string>) {
    super(message, "VALIDACAO", campos);
  }
}
