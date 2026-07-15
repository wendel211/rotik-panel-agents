import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { AppError } from '../shared/AppError';

// O tipo de `req.clienteId` é declarado em src/types/express.d.ts.

interface PayloadToken {
  sub: string;
}

export function assinarToken(clienteId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: clienteId,
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export const autenticar: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw AppError.naoAutenticado('Envie o token no header Authorization: Bearer <token>.');
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as PayloadToken;

    if (!payload.sub) {
      throw AppError.naoAutenticado('Token sem identificação do cliente.');
    }

    req.clienteId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof AppError) throw error;

    // Distinguir expirado de inválido ajuda o frontend a decidir entre renovar
    // a sessão e mandar o usuário para o login. Nenhum dos dois casos revela
    // por que o token é inválido, o que seria oráculo para quem estiver testando.
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRADO', 'Sessão expirada. Faça login novamente.');
    }
    throw AppError.naoAutenticado('Token inválido.');
  }
};

/**
 * Lê o tenant do request já autenticado.
 *
 * Existe para que nenhum service precise fazer `req.clienteId!`. Se por algum
 * erro de montagem de rota o `autenticar` não tiver rodado, isso estoura como
 * 500 aqui, em vez de silenciosamente consultar o banco com `undefined` e
 * devolver lista vazia, que é o tipo de bug que passa despercebido em review.
 */
export function obterClienteId(req: Request): string {
  if (!req.clienteId) {
    throw new Error('obterClienteId chamado em rota sem o middleware `autenticar`.');
  }
  return req.clienteId;
}
