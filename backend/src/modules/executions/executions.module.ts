import { Router } from 'express';
import { z } from 'zod';

import { autenticar, obterClienteId } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import { QuotaExcedidaError } from '../../shared/AppError';
import { logger } from '../../shared/logger';
import { listarHistorico } from './executions.history';
import { registrarExecucao } from './executions.repository';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  id: z.string().uuid('id do agente deve ser um UUID.'),
});

/**
 * `status` aceita só 'sucesso' e 'erro'.
 *
 * 'bloqueada' existe no banco, mas é estado que só o SERVIDOR atribui, quando a
 * cota acaba. Aceitá-lo aqui deixaria o cliente forjar auditoria de bloqueio
 * sem nunca ter sido bloqueado, e poluiria a lista que o CS usa para decidir
 * upsell.
 */
const registrarExecucaoSchema = z.object({
  quantidadeExecucoes: z.number().int().min(1).max(1000).default(1),
  status: z.enum(['sucesso', 'erro']).default('sucesso'),
  duracaoMs: z.number().int().nonnegative().max(600_000).optional(),
  tokensEntrada: z.number().int().nonnegative().max(10_000_000).optional(),
  tokensSaida: z.number().int().nonnegative().max(10_000_000).optional(),
  mensagemErro: z.string().trim().max(1000).optional(),
}).refine((d) => d.status === 'erro' || !d.mensagemErro, {
  message: 'mensagemErro só pode ser enviada quando status é "erro".',
  path: ['mensagemErro'],
});

const historicoQuerySchema = z.object({
  // Teto de 100 para um cliente não conseguir pedir a tabela inteira em um request.
  limite: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Segundos até o início da próxima competência (UTC), que é quando a cota
 * realmente volta. Vira o header Retry-After do 429.
 *
 * `Date.UTC` com mês + 1 trata a virada de dezembro para janeiro sozinho.
 */
function segundosAteProximaCompetencia(agora = new Date()): number {
  const proxima = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((proxima - agora.getTime()) / 1000));
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

export const executionsRouter = Router({ mergeParams: true });

executionsRouter.use(autenticar);

/**
 * POST /agents/:id/executions
 *
 * A regra de negócio central. Ver db/queries/registrar_execucao.sql.
 */
executionsRouter.post(
  '/:id/executions',
  validate({ params: paramsSchema, body: registrarExecucaoSchema }),
  asyncHandler(async (req, res) => {
    const clienteId = obterClienteId(req);
    const agenteId = req.params.id!;
    const dados = req.body as z.infer<typeof registrarExecucaoSchema>;

    const resultado = await registrarExecucao(clienteId, agenteId, dados);

    if (resultado.bloqueada) {
      // A transação JÁ commitou: a tentativa recusada está gravada. Só agora
      // viramos o resultado em 429. Lançar antes teria feito ROLLBACK e perdido
      // a auditoria que o briefing pede.
      //
      // Log em warn, e não error: bloqueio é comportamento esperado do produto,
      // não falha. Se fosse error, poluiria o alerta de erro real e o time
      // aprenderia a ignorar. Estruturado para permitir consultar
      // "quais contas bateram no limite esta semana" sem regex.
      logger.warn(
        {
          evento: 'execucao_bloqueada',
          clienteId,
          agenteId,
          usado: resultado.usado,
          limite: resultado.limite,
          quantidadeExecucoes: dados.quantidadeExecucoes,
        },
        'Execução bloqueada: limite mensal do plano atingido',
      );

      throw new QuotaExcedidaError(
        resultado.usado,
        resultado.limite,
        segundosAteProximaCompetencia(),
      );
    }

    res.status(201).json({
      data: {
        ...resultado.execucao,
        quantidadeExecucoes: dados.quantidadeExecucoes,
        consumo: {
          usado: resultado.usado,
          limite: resultado.limite,
          restante: Math.max(0, resultado.limite - resultado.usado),
        },
      },
    });
  }),
);

/** GET /agents/:id/executions: histórico paginado por keyset. */
executionsRouter.get(
  '/:id/executions',
  validate({ params: paramsSchema, query: historicoQuerySchema }),
  asyncHandler(async (req, res) => {
    const { limite, cursor } = req.query as unknown as z.infer<typeof historicoQuerySchema>;

    const pagina = await listarHistorico(obterClienteId(req), req.params.id!, { limite, cursor });
    res.json(pagina);
  }),
);
