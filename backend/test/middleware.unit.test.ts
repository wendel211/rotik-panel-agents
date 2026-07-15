import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { obterClienteId } from '../src/middlewares/auth';
import { errorHandler, notFoundHandler } from '../src/middlewares/errorHandler';
import { AppError } from '../src/shared/AppError';

function respostaFake() {
  const resposta = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  resposta.status.mockReturnValue(resposta);
  return resposta;
}

describe('middlewares de fronteira', () => {
  it('falha explicitamente quando o tenant não foi injetado', () => {
    expect(() => obterClienteId({} as Request)).toThrow('rota sem o middleware');
    expect(obterClienteId({ clienteId: 'cliente-1' } as Request)).toBe('cliente-1');
  });

  it('formata validação Zod, AppError com detalhes e falha inesperada', () => {
    const req = { method: 'POST', path: '/teste' } as Request;
    const next = vi.fn() as NextFunction;

    const zodResult = z.object({ nome: z.string().min(1) }).safeParse({ nome: '' });
    if (zodResult.success) throw new Error('fixture inválida');
    const zodResponse = respostaFake();
    errorHandler(zodResult.error, req, zodResponse as unknown as Response, next);
    expect(zodResponse.status).toHaveBeenCalledWith(400);
    expect(zodResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.objectContaining({ codigo: 'DADOS_INVALIDOS' }) }),
    );

    const appResponse = respostaFake();
    errorHandler(
      AppError.validacao('Inválido.', { campo: 'nome' }),
      req,
      appResponse as unknown as Response,
      next,
    );
    expect(appResponse.json).toHaveBeenCalledWith({
      erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Inválido.', detalhes: { campo: 'nome' } },
    });

    const unexpectedResponse = respostaFake();
    errorHandler(new Error('segredo interno'), req, unexpectedResponse as unknown as Response, next);
    expect(unexpectedResponse.status).toHaveBeenCalledWith(500);
    expect(unexpectedResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.objectContaining({ codigo: 'ERRO_INTERNO' }) }),
    );
  });

  it('inclui método e caminho no 404', () => {
    const response = respostaFake();
    notFoundHandler(
      { method: 'DELETE', path: '/fantasma' } as Request,
      response as unknown as Response,
    );
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.objectContaining({ mensagem: expect.stringContaining('DELETE /fantasma') }) }),
    );
  });
});
