BEGIN;

ALTER TABLE planos
  ADD COLUMN limite_agentes integer NOT NULL DEFAULT 10
  CHECK (limite_agentes > 0);

ALTER TABLE execucoes
  ADD COLUMN quantidade_execucoes integer NOT NULL DEFAULT 1
  CHECK (quantidade_execucoes BETWEEN 1 AND 1000);

UPDATE planos SET nome = 'Pro' WHERE lower(nome) = 'scale';
UPDATE planos SET limite_agentes = 5 WHERE lower(nome) = 'growth';
UPDATE planos SET limite_agentes = 10 WHERE lower(nome) IN ('pro', 'enterprise');

CREATE OR REPLACE VIEW vw_agentes_consumo AS
SELECT
  a.id, a.cliente_id, a.nome, a.descricao, a.status, a.criado_em,
  a.ultima_execucao_em, a.total_execucoes,
  CASE WHEN a.periodo_referencia = periodo_atual() THEN a.execucoes_mes_atual ELSE 0 END AS execucoes_mes,
  CASE WHEN c.periodo_referencia = periodo_atual() THEN c.execucoes_mes_atual ELSE 0 END AS execucoes_mes_cliente,
  p.id AS plano_id, p.nome AS plano_nome,
  p.limite_execucoes_mensal AS limite_mensal,
  (a.status <> 'ativo' OR
    CASE WHEN c.periodo_referencia = periodo_atual() THEN c.execucoes_mes_atual ELSE 0 END
      >= p.limite_execucoes_mensal) AS bloqueado,
  round(100.0 * CASE WHEN c.periodo_referencia = periodo_atual() THEN c.execucoes_mes_atual ELSE 0 END
    / p.limite_execucoes_mensal, 2) AS percentual_uso_cliente,
  p.limite_agentes,
  count(*) OVER (PARTITION BY a.cliente_id) AS agentes_cliente
FROM agentes a
JOIN clientes c ON c.id = a.cliente_id
JOIN planos p ON p.id = c.plano_id;

COMMIT;
