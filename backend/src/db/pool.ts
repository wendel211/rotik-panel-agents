import { Pool, type PoolClient } from 'pg';

import { databaseSsl, env } from '../config/env';
import { logger } from '../shared/logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Conexões públicas de provedores gerenciados normalmente exigem TLS. Redes
  // privadas podem desativá-lo explicitamente com DATABASE_SSL=false.
  ...(databaseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

// Um erro em cliente ocioso não deve derrubar o processo silenciosamente.
pool.on('error', (err) => {
  logger.error({ err }, 'Erro inesperado em cliente ocioso do pool');
});

/**
 * Executa `fn` dentro de uma transação, com COMMIT no sucesso e ROLLBACK em
 * qualquer exceção.
 *
 * Detalhe que importa para a regra de negócio: se `fn` lançar, TUDO é revertido,
 * inclusive a cota já consumida. É por isso que o caminho de bloqueio
 * (executions.repository) NÃO lança de dentro daqui: a linha de auditoria
 * precisa sobreviver ao commit. Quem lança o 429 é o service, depois.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError: unknown) => {
      // Se o ROLLBACK falhar, o erro original é o que interessa. Registramos o
      // segundo para não perdê-lo, mas propagamos o primeiro.
      logger.error({ err: rollbackError }, 'Falha ao executar ROLLBACK');
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Healthcheck do banco falhou');
    return false;
  }
}
