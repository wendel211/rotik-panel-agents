/**
 * Erro de domínio: tudo que a API sabe explicar ao cliente.
 *
 * A distinção que importa: um AppError é uma resposta prevista (404, 409, 429)
 * e a mensagem pode ir para o cliente. Qualquer outro erro é bug ou falha de
 * infra, vira 500, e a mensagem NÃO pode vazar (ver errorHandler).
 *
 * `code` é um identificador estável e legível por máquina. O frontend deve
 * ramificar por ele, nunca pela mensagem, que é texto humano e vai mudar.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static naoEncontrado(recurso: string): AppError {
    return new AppError(404, 'NAO_ENCONTRADO', `${recurso} não encontrado.`);
  }

  static naoAutenticado(mensagem = 'Credenciais ausentes ou inválidas.'): AppError {
    return new AppError(401, 'NAO_AUTENTICADO', mensagem);
  }

  static conflito(code: string, mensagem: string): AppError {
    return new AppError(409, code, mensagem);
  }

  static validacao(mensagem: string, details?: unknown): AppError {
    return new AppError(400, 'DADOS_INVALIDOS', mensagem, details);
  }
}

/**
 * A regra central do desafio, como tipo.
 *
 * Sobre o 429: cota mensal esgotada é conceitualmente um rate limit (N chamadas
 * por janela de tempo), e 429 é o status que clientes HTTP e SDKs já sabem
 * tratar, inclusive respeitando Retry-After. A alternativa seria 402 Payment
 * Required, que é semanticamente mais próximo de "faça upgrade", mas é raro o
 * suficiente para que a maioria dos consumidores não trate. Escolhi
 * interoperabilidade em vez de pureza semântica.
 *
 * `retryAfterSegundos` aponta para o início da próxima competência, que é
 * quando a cota realmente volta. É informação verdadeira e acionável, não um
 * valor de enfeite.
 */
export class QuotaExcedidaError extends AppError {
  public readonly usado: number;
  public readonly limite: number;
  public readonly retryAfterSegundos: number;

  constructor(usado: number, limite: number, retryAfterSegundos: number) {
    super(
      429,
      'LIMITE_PLANO_ATINGIDO',
      `Limite mensal do plano atingido (${usado}/${limite}). ` +
        'A execução foi registrada como bloqueada e a cota volta na próxima competência.',
    );
    this.name = 'QuotaExcedidaError';
    this.usado = usado;
    this.limite = limite;
    this.retryAfterSegundos = retryAfterSegundos;
  }
}
