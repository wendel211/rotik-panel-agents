-- =====================================================================
--  Seed de DEMONSTRAÇÃO | Rotik
--
--  AVISO: este arquivo cria usuários com senha conhecida. Use somente em
--  desenvolvimento ou na instância pública descartável do desafio; nunca em
--  ambiente com dados reais de clientes. Ver README, seção DevOps.
-- =====================================================================

BEGIN;

-- O hash é gerado no banco com bcrypt (pgcrypto), compatível com bcryptjs.

-- ---------------------------------------------------------------------
--  Planos
--  Limites propositalmente pequenos: dá para estourar a cota do Starter
--  na demo sem gerar 10 mil requests.
-- ---------------------------------------------------------------------
INSERT INTO planos (nome, limite_execucoes_mensal) VALUES
  ('Growth',     100),
  ('Scale',      1000),
  ('Enterprise', 10000);

-- ---------------------------------------------------------------------
--  Clientes
--  Dois tenants distintos, é o que permite testar, de verdade, que um
--  cliente não enxerga dados do outro (Etapa 2, camada de autorização).
-- ---------------------------------------------------------------------
INSERT INTO clientes (nome, email, senha_hash, plano_id, execucoes_mes_atual)
SELECT
  'Acme Atendimento',
  'cs@acme.dev',
  crypt('senha123', gen_salt('bf', 10)),
  p.id,
  -- 82/100 = 82%: a conta abre em zona de alerta, que é o estado que o painel
  -- existe para mostrar. Abrir folgado esconderia a regra central do desafio.
  82
FROM planos p WHERE p.nome = 'Growth';

INSERT INTO clientes (nome, email, senha_hash, plano_id, execucoes_mes_atual)
SELECT
  'Globex Suporte',
  'cs@globex.dev',
  crypt('senha123', gen_salt('bf', 10)),
  p.id,
  140                      -- 140/1000 = 14%: contraste com a Acme, conta folgada
FROM planos p WHERE p.nome = 'Scale';

-- ---------------------------------------------------------------------
--  Agentes
--  Os contadores por agente somam exatamente o contador do cliente,
--  o seed respeita o mesmo invariante que a aplicação mantém.
-- ---------------------------------------------------------------------
INSERT INTO agentes (cliente_id, nome, descricao, status, execucoes_mes_atual, total_execucoes, ultima_execucao_em)
SELECT c.id, v.nome, v.descricao, v.status, v.exec_mes, v.total, now() - interval '2 hours'
FROM clientes c
CROSS JOIN (VALUES
  ('Triagem de Tickets',  'Classifica e roteia tickets de suporte por assunto.', 'ativo',   60, 1240),
  ('FAQ Bot',             'Responde dúvidas frequentes na central de ajuda.',    'ativo',   22,  530),
  ('Resumo de Chamadas',  'Gera resumo pós-atendimento. Pausado para revisão.',  'pausado',  0,   18)
) AS v(nome, descricao, status, exec_mes, total)
WHERE c.email = 'cs@acme.dev';   -- 60 + 22 + 0 = 82 ✓ bate com o cliente

INSERT INTO agentes (cliente_id, nome, descricao, status, execucoes_mes_atual, total_execucoes, ultima_execucao_em)
SELECT c.id, v.nome, v.descricao, v.status, v.exec_mes, v.total, now() - interval '30 minutes'
FROM clientes c
CROSS JOIN (VALUES
  ('Qualificação de Leads', 'Qualifica leads inbound antes de passar ao comercial.', 'ativo', 140, 3100)
) AS v(nome, descricao, status, exec_mes, total)
WHERE c.email = 'cs@globex.dev';  -- 140 = 140 ✓

-- ---------------------------------------------------------------------
--  Execuções
--  Amostra pequena só para o histórico não abrir vazio na demo.
--  NÃO tenta reproduzir as 1.240 execuções vitalícias: `total_execucoes` é
--  consolidado justamente para não depender das linhas de fato existirem
--  (elas seriam expurgadas por retenção, ver README, "fora de escopo").
-- ---------------------------------------------------------------------
INSERT INTO execucoes (agente_id, cliente_id, status, duracao_ms, tokens_entrada, tokens_saida, mensagem_erro, criado_em)
SELECT
  a.id,
  a.cliente_id,
  CASE WHEN g % 7 = 0 THEN 'erro' ELSE 'sucesso' END,
  180 + (g * 37) % 1500,
  120 + (g * 11) % 400,
  60 + (g * 13) % 250,
  CASE WHEN g % 7 = 0 THEN 'Timeout ao chamar o provedor de LLM (upstream 504).' END,
  now() - (g * interval '17 minutes')
FROM agentes a
CROSS JOIN generate_series(1, 25) AS g
WHERE a.status = 'ativo';

COMMIT;
