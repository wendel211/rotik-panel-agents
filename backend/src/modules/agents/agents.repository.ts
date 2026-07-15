import { DatabaseError } from 'pg';

import { pool } from '../../db/pool';
import { AppError } from '../../shared/AppError';

/** Linha de `vw_agentes_consumo`. A view já aplica o reset preguiçoso na leitura. */
interface LinhaConsumo {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  criado_em: Date;
  ultima_execucao_em: Date | null;
  total_execucoes: string; // bigint chega como string no driver
  execucoes_mes: number;
  execucoes_mes_cliente: number;
  plano_id: string;
  plano_nome: string;
  limite_mensal: number;
  bloqueado: boolean;
  percentual_uso_cliente: string; // numeric chega como string no driver
}

export interface AgenteComConsumo {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  bloqueado: boolean;
  criadoEm: Date;
  ultimaExecucaoEm: Date | null;
  totalExecucoes: number;
  plano: { id: string; nome: string };
  consumo: {
    execucoesMesAgente: number;
    execucoesMesCliente: number;
    limiteMensal: number;
    restante: number;
    percentualUsoCliente: number;
  };
}

/**
 * `bigint` e `numeric` chegam como string no node-postgres, de propósito: os
 * dois podem exceder o que um `number` do JS representa sem perda. Aqui a
 * conversão é segura, porque contador de execuções e percentual não chegam
 * perto de 2^53.
 */
function mapear(linha: LinhaConsumo): AgenteComConsumo {
  const limite = linha.limite_mensal;
  const usadoCliente = linha.execucoes_mes_cliente;

  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    status: linha.status,
    bloqueado: linha.bloqueado,
    criadoEm: linha.criado_em,
    ultimaExecucaoEm: linha.ultima_execucao_em,
    totalExecucoes: Number(linha.total_execucoes),
    plano: { id: linha.plano_id, nome: linha.plano_nome },
    consumo: {
      execucoesMesAgente: linha.execucoes_mes,
      execucoesMesCliente: usadoCliente,
      limiteMensal: limite,
      restante: Math.max(0, limite - usadoCliente),
      percentualUsoCliente: Number(linha.percentual_uso_cliente),
    },
  };
}

/**
 * Lista os agentes do tenant com consumo, limite e estado de bloqueio.
 *
 * Todo o payload sai de `vw_agentes_consumo`, que resolve isso com um index
 * scan em `agentes` mais lookups por PK. Zero COUNT(*) e zero GROUP BY: o custo
 * não depende de quantas execuções o cliente tem no histórico.
 */
export async function listarAgentesComConsumo(clienteId: string): Promise<AgenteComConsumo[]> {
  const { rows } = await pool.query<LinhaConsumo>(
    `SELECT id, nome, descricao, status, criado_em, ultima_execucao_em, total_execucoes,
            execucoes_mes, execucoes_mes_cliente, plano_id, plano_nome, limite_mensal,
            bloqueado, percentual_uso_cliente
       FROM vw_agentes_consumo
      WHERE cliente_id = $1
      ORDER BY criado_em DESC`,
    [clienteId],
  );
  return rows.map(mapear);
}

/**
 * Cadastra um agente para o tenant.
 *
 * `cliente_id` vem do JWT, jamais do body. Junto com o strip do Zod, isso
 * fecha a porta para um cliente cadastrar agente na conta de outro.
 */
export async function criarAgente(
  clienteId: string,
  dados: { nome: string; descricao?: string | undefined },
): Promise<AgenteComConsumo> {
  let agenteId: string;

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO agentes (cliente_id, nome, descricao) VALUES ($1, $2, $3) RETURNING id`,
      [clienteId, dados.nome, dados.descricao ?? null],
    );
    agenteId = rows[0]!.id;
  } catch (error) {
    // 23505 = unique_violation, aqui só pode ser `agentes_cliente_nome_uniq_idx`.
    // Traduzir para 409 evita que a mensagem do Postgres, com nome de índice e
    // de coluna, chegue ao cliente.
    if (error instanceof DatabaseError && error.code === '23505') {
      throw AppError.conflito(
        'AGENTE_JA_EXISTE',
        `Já existe um agente ativo chamado "${dados.nome}" nesta conta.`,
      );
    }
    throw error;
  }

  // Reler pela view devolve o agente já com consumo e limite, no mesmo formato
  // do GET /agents. O frontend recebe um objeto só, sem precisar de refetch.
  const { rows } = await pool.query<LinhaConsumo>(
    `SELECT id, nome, descricao, status, criado_em, ultima_execucao_em, total_execucoes,
            execucoes_mes, execucoes_mes_cliente, plano_id, plano_nome, limite_mensal,
            bloqueado, percentual_uso_cliente
       FROM vw_agentes_consumo
      WHERE id = $1 AND cliente_id = $2`,
    [agenteId, clienteId],
  );

  return mapear(rows[0]!);
}
