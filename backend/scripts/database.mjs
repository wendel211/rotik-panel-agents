import 'dotenv/config';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

import pg from 'pg';

const arquivos = {
  schema: '01_schema.sql',
  'seed-demo': '02_seed.sql',
};

const acao = process.argv[2];

if (!['schema', 'seed-demo', 'deploy'].includes(acao)) {
  throw new Error('Ação inválida. Use "schema", "seed-demo" ou "deploy".');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL é obrigatória para preparar o banco.');
}

if (acao === 'seed-demo' && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Seed de demonstração bloqueado. Defina ALLOW_DEMO_SEED=true conscientemente.');
}

function localizar(arquivo) {
  const candidatos = [resolve(process.cwd(), '../db/init', arquivo), resolve(process.cwd(), 'db/init', arquivo)];
  const caminho = candidatos.find(existsSync);
  if (!caminho) throw new Error(`Arquivo SQL não encontrado: ${arquivo}.`);
  return caminho;
}

const sslExplicito = process.env.DATABASE_SSL;
const usarSsl = sslExplicito === 'true' || (sslExplicito !== 'false' && process.env.NODE_ENV === 'production');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: usarSsl ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nome text PRIMARY KEY,
      checksum text NOT NULL,
      aplicado_em timestamptz NOT NULL DEFAULT now()
    )
  `);

  async function aplicarMigracao(nome, arquivo) {
    const conteudo = await readFile(localizar(arquivo), 'utf8');
    const checksum = createHash('sha256').update(conteudo).digest('hex');
    // Os arquivos também são executáveis pelo entrypoint oficial do Postgres.
    // Aqui o BEGIN/COMMIT externo é removido para que SQL + registro da versão
    // sejam uma única transação protegida contra dois deploys simultâneos.
    const sql = conteudo.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');

    await client.query('BEGIN');
    try {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('rotik_schema_migrations'))`);
      const existente = await client.query('SELECT checksum FROM schema_migrations WHERE nome = $1', [nome]);

      if (existente.rowCount) {
        if (existente.rows[0].checksum !== checksum) {
          throw new Error(`A migração já aplicada foi alterada: ${nome}. Crie uma nova migração.`);
        }
        await client.query('COMMIT');
        console.info(`Migração já aplicada: ${nome}.`);
        return;
      }

      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nome, checksum) VALUES ($1, $2)', [nome, checksum]);
      await client.query('COMMIT');
      console.info(`Migração aplicada: ${nome}.`);
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    }
  }

  if (acao === 'schema' || acao === 'deploy') {
    await aplicarMigracao('001_schema', arquivos.schema);
  }
  if (acao === 'seed-demo' || (acao === 'deploy' && process.env.ALLOW_DEMO_SEED === 'true')) {
    await aplicarMigracao('002_seed_demo', arquivos['seed-demo']);
  } else if (acao === 'deploy') {
    console.info('Seed de demonstração não solicitado.');
  }
} finally {
  await client.end();
}
