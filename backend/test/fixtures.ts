import bcrypt from 'bcryptjs';

import { pool } from '../src/db/pool';
import { assinarToken } from '../src/middlewares/auth';

interface ContaTeste {
  clienteId: string;
  agenteId: string;
  token: string;
  email: string;
  senha: string;
}

export async function limparBanco(): Promise<void> {
  await pool.query('TRUNCATE execucoes, agentes, clientes, planos RESTART IDENTITY CASCADE');
}

export async function criarConta(sufixo = 'principal', limite = 100): Promise<ContaTeste> {
  const senha = 'senha-segura';
  const hash = await bcrypt.hash(senha, 4);
  const plano = await pool.query<{ id: string }>(
    `INSERT INTO planos (nome, limite_execucoes_mensal) VALUES ($1, $2) RETURNING id`,
    [`Plano ${sufixo}`, limite],
  );
  const email = `${sufixo}@rotik.test`;
  const cliente = await pool.query<{ id: string }>(
    `INSERT INTO clientes (nome, email, senha_hash, plano_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [`Cliente ${sufixo}`, email, hash, plano.rows[0]!.id],
  );
  const clienteId = cliente.rows[0]!.id;
  const agente = await pool.query<{ id: string }>(
    `INSERT INTO agentes (cliente_id, nome, descricao)
     VALUES ($1, $2, $3) RETURNING id`,
    [clienteId, `Agente ${sufixo}`, 'Agente criado pelos testes.'],
  );

  return {
    clienteId,
    agenteId: agente.rows[0]!.id,
    token: assinarToken(clienteId),
    email,
    senha,
  };
}

export function autorizar(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
