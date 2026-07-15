import { pool } from '../../db/pool';
import { AppError } from '../../shared/AppError';

export interface ItemHistorico {
  id: string;
  status: string;
  duracaoMs: number | null;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  mensagemErro: string | null;
  criadoEm: Date;
}

export interface PaginaHistorico {
  data: ItemHistorico[];
  proximoCursor: string | null;
}

interface Cursor {
  c: string; // criado_em em ISO
  i: string; // id, desempate
}

/**
 * O cursor é opaco de propósito: o cliente não deve construir nem interpretar
 * ele, só devolver o que recebeu. Isso deixa a chave de ordenação livre para
 * mudar sem quebrar contrato. Base64url porque vai na query string.
 */
function codificarCursor(item: ItemHistorico): string {
  const payload: Cursor = { c: item.criadoEm.toISOString(), i: item.id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodificarCursor(cursor: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Cursor;
    if (!parsed.c || !parsed.i || Number.isNaN(Date.parse(parsed.c))) {
      throw new Error('cursor malformado');
    }
    return parsed;
  } catch {
    throw AppError.validacao('Cursor de paginação inválido.');
  }
}

/**
 * Histórico paginado por keyset.
 *
 * Por que não OFFSET: `OFFSET 10000` obriga o Postgres a varrer e descartar
 * 10 mil linhas antes de devolver a página, ou seja, a página 500 custa 500
 * vezes a página 1. Com keyset, o índice
 * `execucoes (agente_id, criado_em DESC, id DESC)` posiciona direto no ponto de
 * corte e o custo é o mesmo em qualquer profundidade.
 *
 * A comparação é `(criado_em, id) < (cursor.c, cursor.i)`, em tupla, e não
 * apenas por criado_em: o timestamp NÃO é único, e sem o id como desempate uma
 * execução no mesmo milissegundo do corte seria pulada ou repetida entre
 * páginas. O OFFSET tem esse mesmo bug de forma ainda mais grave, porque uma
 * inserção concorrente desloca todas as páginas seguintes.
 *
 * Não devolvo total de itens: contar exigiria o COUNT(*) que este projeto
 * evita. `agentes.total_execucoes` já dá o total de execuções do agente no
 * GET /agents, que é onde essa informação faz sentido para o CS.
 */
export async function listarHistorico(
  clienteId: string,
  agenteId: string,
  opcoes: { limite: number; cursor?: string | undefined },
): Promise<PaginaHistorico> {
  // Confirma posse antes de listar. Sem isso, um agente de outro tenant
  // devolveria lista vazia (200) em vez de 404, o que confirmaria a existência
  // do id para quem estivesse sondando.
  const { rowCount } = await pool.query(`SELECT 1 FROM agentes WHERE id = $1 AND cliente_id = $2`, [
    agenteId,
    clienteId,
  ]);
  if (rowCount === 0) throw AppError.naoEncontrado('Agente');

  const cursor = opcoes.cursor ? decodificarCursor(opcoes.cursor) : null;

  // Busca uma linha a mais que o pedido para saber se existe próxima página,
  // sem precisar de uma segunda query.
  const { rows } = await pool.query<{
    id: string;
    status: string;
    duracao_ms: number | null;
    tokens_entrada: number | null;
    tokens_saida: number | null;
    mensagem_erro: string | null;
    criado_em: Date;
  }>(
    `SELECT id, status, duracao_ms, tokens_entrada, tokens_saida, mensagem_erro, criado_em
       FROM execucoes
      WHERE agente_id = $1
        AND cliente_id = $2
        AND ($3::timestamptz IS NULL OR (criado_em, id) < ($3::timestamptz, $4::uuid))
      ORDER BY criado_em DESC, id DESC
      LIMIT $5`,
    [agenteId, clienteId, cursor?.c ?? null, cursor?.i ?? null, opcoes.limite + 1],
  );

  const temProxima = rows.length > opcoes.limite;
  const pagina = temProxima ? rows.slice(0, opcoes.limite) : rows;

  const data: ItemHistorico[] = pagina.map((l) => ({
    id: l.id,
    status: l.status,
    duracaoMs: l.duracao_ms,
    tokensEntrada: l.tokens_entrada,
    tokensSaida: l.tokens_saida,
    mensagemErro: l.mensagem_erro,
    criadoEm: l.criado_em,
  }));

  return {
    data,
    proximoCursor: temProxima && data.length > 0 ? codificarCursor(data[data.length - 1]!) : null,
  };
}
