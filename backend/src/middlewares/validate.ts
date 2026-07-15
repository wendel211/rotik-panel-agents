import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AnyZodObject, ZodTypeAny } from 'zod';

interface EsquemasRota {
  body?: ZodTypeAny;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

/**
 * Valida body, params e query com Zod antes do controller rodar.
 *
 * Reatribui o valor parseado de volta no request, e isso é intencional: o Zod
 * faz coerção (`?limite=20` chega string e vira number) e strip de campos não
 * declarados. Sem a reatribuição, o controller receberia o dado cru e a
 * validação viraria só um teste, sem efeito.
 *
 * O strip é a defesa contra mass assignment: um POST /agents com
 * `{"nome":"x","cliente_id":"<outro tenant>"}` tem o `cliente_id` descartado
 * aqui, antes de qualquer chance de chegar ao SQL.
 */
export function validate(esquemas: EsquemasRota): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (esquemas.params) req.params = esquemas.params.parse(req.params);
      if (esquemas.query) req.query = esquemas.query.parse(req.query);
      if (esquemas.body) req.body = esquemas.body.parse(req.body);
      next();
    } catch (error) {
      // ZodError é reconhecido pelo errorHandler e vira 400 com a lista de campos.
      next(error);
    }
  };
}
