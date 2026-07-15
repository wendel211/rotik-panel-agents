import type { PoolClient } from 'pg';

import { withTransaction } from '../../db/pool';
import { AppError } from '../../shared/AppError';

export interface DadosExecucao {
  status: 'sucesso' | 'erro';
  duracaoMs?: number | undefined;
  tokensEntrada?: number | undefined;
  tokensSaida?: number | undefined;
  mensagemErro?: string | undefined;
}

export interface ExecucaoRegistrada {
  id: string;
  status: string;
  criadoEm: Date;
}

/**
 * União discriminada de propósito: o caminho bloqueado NÃO é exceção aqui.
 *
 * Se o repositório lançasse no bloqueio, o `withTransaction` faria ROLLBACK e a
 * linha de auditoria `status='bloqueada'` seria perdida, que é exatamente o
 * "pelo menos a gente precisa saber que isso aconteceu" do briefing. A
 * transação precisa COMMITAR nos dois caminhos. Quem transforma o bloqueio em
 * 429 é o service, depois do commit.
 */
export type ResultadoRegistro =
  | { bloqueada: false; execucao: ExecucaoRegistrada; usado: number; limite: number }
  | { bloqueada: true; usado: number; limite: number };

/**
 * PASSO 2 do db/queries/registrar_execucao.sql, a regra central do desafio.
 *
 * Um único UPDATE condicional faz, indivisivelmente: o reset preguiçoso da
 * competência, a verificação do limite e o incremento do contador.
 *
 * O limite está no WHERE do próprio UPDATE, e não em um `if` no TypeScript. É o
 * que elimina o check-then-act: o Postgres pega row lock na linha do cliente e
 * reavalia o WHERE contra a versão já commitada (EvalPlanQual), serializando os
 * concorrentes. Verificado com 40 conexões simultâneas: para exato no limite,
 * enquanto o padrão ingênuo vaza (ver README, Etapa 1).
 *
 * 0 linhas afetadas é o sinal inequívoco de bloqueio.
 */
const SQL_CONSUMIR_COTA = `
  UPDATE clientes c
     SET execucoes_mes_atual =
           CASE WHEN c.periodo_referencia = periodo_atual()
                THEN c.execucoes_mes_atual + 1
                ELSE 1
           END,
         periodo_referencia = periodo_atual()
    FROM planos p
   WHERE c.id = $1
     AND c.plano_id = p.id
     AND (CASE WHEN c.periodo_referencia = periodo_atual()
               THEN c.execucoes_mes_atual
               ELSE 0
          END) < p.limite_execucoes_mensal
  RETURNING c.execucoes_mes_atual AS usado, p.limite_execucoes_mensal AS limite
`;

async function validarAgente(client: PoolClient, agenteId: string, clienteId: string): Promise<void> {
  // Sem FOR UPDATE de propósito: travaria `agentes` antes de `clientes` e
  // inverteria a ordem de lock do projeto, criando risco de deadlock entre dois
  // agentes do mesmo cliente executando em paralelo.
  const { rows } = await client.query<{ status: string }>(
    `SELECT status FROM agentes WHERE id = $1 AND cliente_id = $2`,
    [agenteId, clienteId],
  );

  // O filtro por cliente_id faz 404 e 403 colapsarem: o agente de outro cliente
  // simplesmente não existe para você. Um 403 aqui confirmaria que o id existe,
  // o que é vazamento de informação entre tenants.
  const agente = rows[0];
  if (!agente) throw AppError.naoEncontrado('Agente');

  if (agente.status !== 'ativo') {
    throw AppError.conflito(
      'AGENTE_INATIVO',
      `Agente está "${agente.status}" e não aceita execuções.`,
    );
  }
}

async function consultarCota(
  client: PoolClient,
  clienteId: string,
): Promise<{ usado: number; limite: number }> {
  const { rows } = await client.query<{ usado: number; limite: number }>(
    `SELECT CASE WHEN c.periodo_referencia = periodo_atual()
                 THEN c.execucoes_mes_atual ELSE 0 END AS usado,
            p.limite_execucoes_mensal AS limite
       FROM clientes c
       JOIN planos p ON p.id = c.plano_id
      WHERE c.id = $1`,
    [clienteId],
  );
  return rows[0]!;
}

export async function registrarExecucao(
  clienteId: string,
  agenteId: string,
  dados: DadosExecucao,
): Promise<ResultadoRegistro> {
  return withTransaction(async (client) => {
    // PASSO 1: existência, posse e status. Antes da cota, para não queimar cota
    // do cliente por causa de um request para agente inexistente.
    await validarAgente(client, agenteId, clienteId);

    // PASSO 2: consumir cota. Trava `clientes` (sempre antes de `agentes`).
    const consumo = await client.query<{ usado: number; limite: number }>(SQL_CONSUMIR_COTA, [
      clienteId,
    ]);

    // PASSO 3a: bloqueado. Grava a tentativa recusada como auditoria e NÃO
    // incrementa contador nenhum: cota estourada não vira cobrança.
    if (consumo.rowCount === 0) {
      await client.query(
        `INSERT INTO execucoes (agente_id, cliente_id, status, mensagem_erro)
         VALUES ($1, $2, 'bloqueada', 'Limite mensal do plano atingido.')`,
        [agenteId, clienteId],
      );

      const { usado, limite } = await consultarCota(client, clienteId);
      return { bloqueada: true, usado, limite };
    }

    const { usado, limite } = consumo.rows[0]!;

    // PASSO 3b: sucesso. Contador de atribuição do agente, com o mesmo reset
    // preguiçoso. Se este UPDATE falhar, a transação inteira reverte e a cota
    // consumida no passo 2 volta: os dois contadores nunca divergem.
    await client.query(
      `UPDATE agentes
          SET execucoes_mes_atual =
                CASE WHEN periodo_referencia = periodo_atual()
                     THEN execucoes_mes_atual + 1
                     ELSE 1
                END,
              periodo_referencia = periodo_atual(),
              total_execucoes    = total_execucoes + 1,
              ultima_execucao_em = now()
        WHERE id = $1 AND cliente_id = $2`,
      [agenteId, clienteId],
    );

    const { rows } = await client.query<{ id: string; status: string; criado_em: Date }>(
      `INSERT INTO execucoes
         (agente_id, cliente_id, status, duracao_ms, tokens_entrada, tokens_saida, mensagem_erro)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, status, criado_em`,
      [
        agenteId,
        clienteId,
        dados.status,
        dados.duracaoMs ?? null,
        dados.tokensEntrada ?? null,
        dados.tokensSaida ?? null,
        dados.mensagemErro ?? null,
      ],
    );

    const linha = rows[0]!;
    return {
      bloqueada: false,
      execucao: { id: linha.id, status: linha.status, criadoEm: linha.criado_em },
      usado,
      limite,
    };
  });
}
