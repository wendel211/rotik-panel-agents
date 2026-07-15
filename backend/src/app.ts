import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { checkDatabaseConnection } from './db/pool';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { agentsRouter } from './modules/agents/agents.module';
import { authRouter } from './modules/auth/auth.module';
import { executionsRouter } from './modules/executions/executions.module';
import { asyncHandler } from './shared/asyncHandler';

export function criarApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  // Limite de corpo: o maior payload legítimo aqui tem alguns KB. Sem teto, um
  // POST gigante viraria pressão de memória de graça.
  app.use(express.json({ limit: '64kb' }));

  /**
   * GET /health
   *
   * Verifica o banco, e não só o processo: uma API de pé que não alcança o
   * Postgres está inútil, e responder 200 nesse estado faria o orquestrador
   * manter no ar uma instância quebrada.
   */
  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const bancoOk = await checkDatabaseConnection();
      res.status(bancoOk ? 200 : 503).json({
        status: bancoOk ? 'ok' : 'degradado',
        banco: bancoOk ? 'ok' : 'indisponivel',
        timestamp: new Date().toISOString(),
      });
    }),
  );

  app.use('/auth', authRouter);
  app.use('/agents', agentsRouter);
  // As rotas de execução penduram em /agents/:id/executions, então dividem o
  // prefixo com o módulo de agentes.
  app.use('/agents', executionsRouter);

  // Ordem importa: 404 para rota desconhecida, e o errorHandler por último de
  // todos, senão os erros passariam direto sem serem formatados.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
