import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError, QuotaExcedidaError } from '../shared/AppError';
import { logger } from '../shared/logger';

/** Envelope único de erro. O frontend ramifica por `erro.codigo`, nunca pela mensagem. */
interface RespostaErro {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
}

/** Rotas desconhecidas viram 404 no mesmo formato, e não no HTML padrão do Express. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    erro: {
      codigo: 'ROTA_NAO_ENCONTRADA',
      mensagem: `Rota ${req.method} ${req.path} não existe.`,
    },
  } satisfies RespostaErro);
}

/**
 * Tratamento centralizado. Precisa ser o ÚLTIMO middleware registrado, e precisa
 * receber os 4 parâmetros: o Express identifica error handlers pela aridade da
 * função, então remover `_next` silenciosamente o transformaria em middleware
 * comum e todo erro viraria resposta pendurada.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Falha de validação de entrada.
  if (error instanceof ZodError) {
    res.status(400).json({
      erro: {
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Os dados enviados não passaram na validação.',
        detalhes: error.issues.map((i) => ({
          campo: i.path.join('.') || '(raiz)',
          mensagem: i.message,
        })),
      },
    } satisfies RespostaErro);
    return;
  }

  // 2. A regra central. Log em nível warn, com os campos que o negócio audita.
  //    Ver executions.service para o log de contexto completo do bloqueio.
  if (error instanceof QuotaExcedidaError) {
    res.setHeader('Retry-After', String(error.retryAfterSegundos));
    res.status(error.statusCode).json({
      erro: {
        codigo: error.code,
        mensagem: error.message,
        detalhes: {
          usado: error.usado,
          limite: error.limite,
          retryAfterSegundos: error.retryAfterSegundos,
        },
      },
    } satisfies RespostaErro);
    return;
  }

  // 3. Erros de domínio previstos.
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      erro: {
        codigo: error.code,
        mensagem: error.message,
        ...(error.details !== undefined ? { detalhes: error.details } : {}),
      },
    } satisfies RespostaErro);
    return;
  }

  // 4. Qualquer outra coisa é bug ou falha de infra.
  //    O detalhe vai para o log, NUNCA para a resposta: mensagens de erro do
  //    Postgres vazam nome de tabela, coluna e constraint, que é reconhecimento
  //    gratuito para quem estiver sondando a API.
  logger.error(
    {
      err: error,
      metodo: req.method,
      rota: req.path,
      clienteId: req.clienteId ?? null,
    },
    'Erro não tratado',
  );

  res.status(500).json({
    erro: {
      codigo: 'ERRO_INTERNO',
      mensagem: 'Erro interno no servidor. Se persistir, contate o suporte.',
    },
  } satisfies RespostaErro);
}
