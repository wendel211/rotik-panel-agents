import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../../db/pool';
import { assinarToken } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import { AppError } from '../../shared/AppError';
import { logger } from '../../shared/logger';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senha: z.string().min(1, 'Senha é obrigatória.'),
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

interface ClienteAutenticavel {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
}

async function buscarClientePorEmail(email: string): Promise<ClienteAutenticavel | null> {
  // lower(email) casa com o índice único `clientes_email_uniq_idx`.
  const { rows } = await pool.query<ClienteAutenticavel>(
    `SELECT id, nome, email, senha_hash FROM clientes WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

export const authRouter = Router();

/**
 * POST /auth/login
 *
 * Autenticação simplificada, que o desafio permite explicitamente. Sem refresh
 * token e sem OAuth: o token é de vida curta e o cliente refaz login.
 *
 * A senha é comparada com bcrypt contra o hash gerado pelo pgcrypto no seed,
 * que é compatível por serem ambos bcrypt ($2a$).
 */
authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, senha } = req.body as z.infer<typeof loginSchema>;

    const cliente = await buscarClientePorEmail(email);

    // Comparação sempre executada, mesmo sem cliente, para não criar um oráculo
    // de enumeração de e-mails: sem o hash falso, "e-mail inexistente"
    // responderia na hora e "senha errada" levaria ~80ms do bcrypt, e a
    // diferença de tempo revelaria quais e-mails existem na base.
    const hashComparacao = cliente?.senha_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const senhaConfere = await bcrypt.compare(senha, hashComparacao);

    if (!cliente || !senhaConfere) {
      logger.warn({ evento: 'login_falhou', email }, 'Tentativa de login rejeitada');
      // Mensagem genérica de propósito: não dizemos qual dos dois falhou.
      throw AppError.naoAutenticado('E-mail ou senha incorretos.');
    }

    logger.info({ evento: 'login_ok', clienteId: cliente.id }, 'Login realizado');

    res.json({
      token: assinarToken(cliente.id),
      cliente: { id: cliente.id, nome: cliente.nome, email: cliente.email },
    });
  }),
);
