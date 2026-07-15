import { Router } from 'express';
import { z } from 'zod';

import { autenticar, obterClienteId } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import { criarAgente, listarAgentesComConsumo } from './agents.repository';

// ---------------------------------------------------------------------------
// Schemas
//
// Os limites espelham os CHECK do schema (nome 1..120, descricao <= 500). A
// validação aqui existe para devolver 400 com o campo errado apontado, em vez
// de deixar o banco recusar e virar 500.
// ---------------------------------------------------------------------------

const criarAgenteSchema = z.object({
  nome: z
    .string({ required_error: 'nome é obrigatório.' })
    .trim()
    .min(1, 'nome não pode ser vazio.')
    .max(120, 'nome deve ter no máximo 120 caracteres.'),
  descricao: z
    .string()
    .trim()
    .max(500, 'descricao deve ter no máximo 500 caracteres.')
    .optional(),
});

export const agentsRouter = Router();

// Todas as rotas do módulo exigem autenticação. Registrar no router inteiro,
// e não rota a rota, evita o esquecimento que abriria um endpoint sem tenant.
agentsRouter.use(autenticar);

/** POST /agents */
agentsRouter.post(
  '/',
  validate({ body: criarAgenteSchema }),
  asyncHandler(async (req, res) => {
    const dados = req.body as z.infer<typeof criarAgenteSchema>;
    const agente = await criarAgente(obterClienteId(req), dados);
    res.status(201).json({ data: agente });
  }),
);

/** GET /agents: lista com consumo vs limite do plano. */
agentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const agentes = await listarAgentesComConsumo(obterClienteId(req));
    res.json({ data: agentes });
  }),
);
