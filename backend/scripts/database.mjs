import 'dotenv/config';

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
const arquivo = arquivos[acao];

if (!arquivo) {
  throw new Error('Ação inválida. Use "schema" ou "seed-demo".');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL é obrigatória para preparar o banco.');
}

if (acao === 'seed-demo' && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Seed de demonstração bloqueado. Defina ALLOW_DEMO_SEED=true conscientemente.');
}

const candidatos = [resolve(process.cwd(), '../db/init', arquivo), resolve(process.cwd(), 'db/init', arquivo)];
const caminho = candidatos.find(existsSync);

if (!caminho) {
  throw new Error(`Arquivo SQL não encontrado: ${arquivo}.`);
}

const sslExplicito = process.env.DATABASE_SSL;
const usarSsl = sslExplicito === 'true' || (sslExplicito !== 'false' && process.env.NODE_ENV === 'production');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: usarSsl ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  await client.query(await readFile(caminho, 'utf8'));
  console.info(acao === 'schema' ? 'Schema aplicado com sucesso.' : 'Dados de demonstração inseridos com sucesso.');
} finally {
  await client.end();
}
