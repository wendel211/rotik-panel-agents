import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client } from 'pg';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://rotik:rotik_dev_only@localhost:5432/rotik_test';

export default async function globalSetup(): Promise<void> {
  const target = new URL(testDatabaseUrl);
  const databaseName = target.pathname.slice(1);
  const adminUrl = new URL(testDatabaseUrl);
  adminUrl.pathname = '/postgres';

  if (!/^[a-zA-Z0-9_]+$/.test(databaseName) || databaseName === 'postgres') {
    throw new Error(`Banco de testes inseguro: ${databaseName}`);
  }

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }

  const schema = await readFile(resolve(import.meta.dirname, '../../db/init/01_schema.sql'), 'utf8');
  const usageLimits = await readFile(resolve(import.meta.dirname, '../../db/init/03_usage_limits.sql'), 'utf8');
  const testClient = new Client({ connectionString: testDatabaseUrl });
  await testClient.connect();
  try {
    await testClient.query(schema);
    await testClient.query(usageLimits);
  } finally {
    await testClient.end();
  }
}
