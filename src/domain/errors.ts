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

/** Nomes femininos usados com `NaoEncontradoError` (pela primeira palavra): "Solicitação não encontrada". */
const FEMININO = /^(solicitação|peça|linha|arena|reforma|versão|posição|uma|área|ata|resposta|foto|regra)\b/i;

export class NaoEncontradoError extends DomainError {
  constructor(entidade = "Registro") {
    // Concordância e o que fazer (antes: "Solicitação não encontrado."; auditoria de textos 28/10).
    super(`${entidade} não ${FEMININO.test(entidade) ? "encontrada" : "encontrado"}. Atualize a página e tente de novo.`, "NAO_ENCONTRADO");
  }
}

export class SemPermissaoError extends DomainError {
  // Diz a quem recorrer (auditoria 28/10, nº 176); mantém "permissão", que os testes procuram.
  constructor(message = "Seu perfil não tem permissão para isto. Se precisar, fale com o administrador.") {
    super(message, "SEM_PERMISSAO");
  }
}

export class ValidacaoError extends DomainError {
  constructor(message: string, campos?: Record<string, string>) {
    super(message, "VALIDACAO", campos);
  }
}
