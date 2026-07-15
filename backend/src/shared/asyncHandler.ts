import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Encaminha rejeições de handlers async para o error handler do Express.
 *
 * O Express 4 não captura promise rejeitada: sem isso, um `throw` dentro de um
 * handler async vira unhandled rejection e o request fica pendurado até o
 * timeout do cliente, em vez de responder 500.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
