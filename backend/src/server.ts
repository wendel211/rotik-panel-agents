import { criarApp } from './app';
import { env } from './config/env';
import { pool } from './db/pool';
import { logger } from './shared/logger';

const app = criarApp();

const server = app.listen(env.PORT, () => {
  logger.info({ porta: env.PORT, ambiente: env.NODE_ENV }, 'API no ar');
});

/**
 * Shutdown gracioso.
 *
 * Sem isso, um deploy mataria requests em voo no meio de uma transação. O
 * ROLLBACK aconteceria de qualquer forma, mas o cliente veria a conexão cair
 * sem resposta em vez de receber a dele.
 */
async function encerrar(sinal: string): Promise<void> {
  logger.info({ sinal }, 'Encerrando, aguardando requests em voo');

  server.close(() => {
    void pool.end().then(() => {
      logger.info('Pool encerrado, saindo');
      process.exit(0);
    });
  });

  // Rede de segurança: se algum request travar, não ficamos presos para sempre.
  setTimeout(() => {
    logger.error('Timeout no shutdown, forçando saída');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));
