-- =====================================================================
--  Rotik | Painel de Monitoramento de Agentes de IA
--  Etapa 1: Modelagem de dados  |  PostgreSQL 14+
--
--  Princípio central deste schema:
--  "uso mensal" NUNCA é derivado de COUNT(*) sobre `execucoes`.
--  Ele é mantido como contador consolidado, atualizado de forma
--  transacional no mesmo momento em que a execução é gravada.
--  Ver seção "Etapa 1" do README.md para a justificativa completa.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid() e crypt()

-- ---------------------------------------------------------------------
--  Helpers
-- ---------------------------------------------------------------------

-- Período (competência) de faturamento corrente = primeiro dia do mês em UTC.
--
-- Fixamos UTC explicitamente: `date_trunc('month', now())` depende do TimeZone
-- da sessão, o que faria a virada do mês acontecer em horários diferentes para
-- conexões diferentes, e um cliente poderia consumir duas cotas na virada.
-- Ancorar em UTC torna a competência determinística e independente do cliente.
--
-- STABLE (não IMMUTABLE) porque depende de now(). Consequência prática:
-- pode ser usada em DEFAULT e em queries, mas NÃO em CHECK nem em índice.
CREATE OR REPLACE FUNCTION periodo_atual() RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
$$;

COMMENT ON FUNCTION periodo_atual() IS
  'Primeiro dia do mês corrente em UTC. Âncora única da competência mensal.';

CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
--  planos
--  Catálogo de planos comerciais. O limite mensal de execuções vive aqui,
--  nunca no cliente: mudar o limite do "Growth" deve valer para todos os
--  clientes do Growth sem UPDATE em massa.
-- ---------------------------------------------------------------------
CREATE TABLE planos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                    text NOT NULL
                            CHECK (length(btrim(nome)) BETWEEN 1 AND 60),
  limite_execucoes_mensal integer NOT NULL
                            CHECK (limite_execucoes_mensal > 0),
  ativo                   boolean NOT NULL DEFAULT true,
  criado_em               timestamptz NOT NULL DEFAULT now(),
  atualizado_em           timestamptz NOT NULL DEFAULT now()
);

-- Unicidade case-insensitive, igual a clientes.email e agentes.nome.
-- Um UNIQUE simples deixaria "Growth" e "growth" coexistirem como planos
-- distintos, o que é um bug de catálogo esperando acontecer.
CREATE UNIQUE INDEX planos_nome_uniq_idx ON planos (lower(nome));

COMMENT ON COLUMN planos.limite_execucoes_mensal IS
  'Cota mensal de execuções do plano. Compartilhada entre TODOS os agentes do cliente.';

CREATE TRIGGER planos_set_atualizado_em
  BEFORE UPDATE ON planos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------
--  clientes
--  Também é a fronteira de tenant: toda query da API é filtrada por
--  cliente_id extraído do JWT, nunca por parâmetro vindo do request.
--
--  `execucoes_mes_atual` + `periodo_referencia` são o par de consolidação
--  que substitui COUNT(*) e é a fonte de verdade do enforcement de cota.
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  email               text NOT NULL CHECK (position('@' IN email) > 1),
  senha_hash          text NOT NULL,
  plano_id            uuid NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,

  -- --- consolidação de uso mensal (nível de enforcement) ---
  execucoes_mes_atual integer NOT NULL DEFAULT 0
                        CHECK (execucoes_mes_atual >= 0),
  periodo_referencia  date NOT NULL DEFAULT periodo_atual(),

  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN clientes.execucoes_mes_atual IS
  'Contador consolidado de execuções cobradas na competência `periodo_referencia`. '
  'Só é confiável se periodo_referencia = periodo_atual(); caso contrário vale 0 '
  '(reset preguiçoso, ver README).';
COMMENT ON COLUMN clientes.periodo_referencia IS
  'Competência à qual execucoes_mes_atual se refere. Se ficou para trás, o contador está obsoleto.';

-- E-mail é case-insensitive na prática: unicidade sobre lower(email).
CREATE UNIQUE INDEX clientes_email_uniq_idx ON clientes (lower(email));
CREATE INDEX clientes_plano_id_idx ON clientes (plano_id);

CREATE TRIGGER clientes_set_atualizado_em
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------
--  agentes
--  Contadores aqui são de ATRIBUIÇÃO, não de enforcement: respondem
--  "qual agente está queimando a cota do cliente?", pergunta que o CS
--  faz o tempo todo e que o contador do cliente sozinho não responde.
-- ---------------------------------------------------------------------
CREATE TABLE agentes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome                text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  descricao           text CHECK (descricao IS NULL OR length(descricao) <= 500),
  status              text NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo', 'pausado', 'arquivado')),

  -- --- consolidação de uso mensal (nível de atribuição) ---
  execucoes_mes_atual integer NOT NULL DEFAULT 0
                        CHECK (execucoes_mes_atual >= 0),
  periodo_referencia  date NOT NULL DEFAULT periodo_atual(),

  -- --- consolidação vitalícia ---
  -- Evita COUNT(*) para exibir "total de execuções" do agente no dashboard.
  -- Conta apenas execuções que rodaram (sucesso e erro): tentativas recusadas
  -- não são execuções. Por isso não serve como total da paginação, que lista
  -- todas as tentativas. A paginação é keyset e dispensa total (ver Etapa 2).
  total_execucoes     bigint NOT NULL DEFAULT 0 CHECK (total_execucoes >= 0),
  ultima_execucao_em  timestamptz,

  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now(),

  -- Necessário para a FK composta de `execucoes` (ver abaixo). Redundante
  -- com a PK do ponto de vista lógico, mas é o que permite ao banco, e não
  -- ao código de aplicação, garantir o isolamento entre tenants.
  CONSTRAINT agentes_id_cliente_uniq UNIQUE (id, cliente_id)
);

COMMENT ON COLUMN agentes.execucoes_mes_atual IS
  'Consumo do agente na competência. Usado para atribuição/diagnóstico; '
  'o bloqueio é decidido pelo contador do CLIENTE, não por este.';

-- Nome único por cliente, ignorando arquivados (permite reaproveitar o nome
-- de um agente arquivado sem colidir).
CREATE UNIQUE INDEX agentes_cliente_nome_uniq_idx
  ON agentes (cliente_id, lower(nome))
  WHERE status <> 'arquivado';

-- Cobre o dashboard: "agentes do cliente X, mais recentes primeiro".
CREATE INDEX agentes_cliente_criado_idx ON agentes (cliente_id, criado_em DESC);

CREATE TRIGGER agentes_set_atualizado_em
  BEFORE UPDATE ON agentes
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------
--  execucoes
--  Tabela de fatos, append-only, de longe a que mais cresce.
--
--  Guarda TAMBÉM as execuções recusadas (status='bloqueada'): o briefing
--  pede "ou pelo menos a gente precisa saber que isso aconteceu". Elas são
--  auditoria, não incrementam nenhum contador e não consomem cota.
-- ---------------------------------------------------------------------
CREATE TABLE execucoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id      uuid NOT NULL,

  -- Desnormalização deliberada. Justificativa:
  --  1. Isolamento de tenant sem JOIN em toda leitura do histórico;
  --  2. Permite o índice (cliente_id, criado_em DESC) para queries do CS;
  --  3. É imutável (uma execução nunca troca de cliente), então não há risco
  --     de divergência por UPDATE.
  -- A FK composta abaixo impede que este campo minta.
  cliente_id     uuid NOT NULL,

  status         text NOT NULL CHECK (status IN ('sucesso', 'erro', 'bloqueada')),
  duracao_ms     integer CHECK (duracao_ms IS NULL OR duracao_ms >= 0),
  tokens_entrada integer CHECK (tokens_entrada IS NULL OR tokens_entrada >= 0),
  tokens_saida   integer CHECK (tokens_saida IS NULL OR tokens_saida >= 0),
  mensagem_erro  text CHECK (mensagem_erro IS NULL OR length(mensagem_erro) <= 1000),
  criado_em      timestamptz NOT NULL DEFAULT now(),

  -- O banco garante que execucoes.cliente_id == agentes.cliente_id.
  -- Sem isso, um bug na aplicação poderia gravar uma execução do agente do
  -- cliente A sob o cliente B, ou seja, vazamento entre tenants.
  --
  -- Sobre o CASCADE: apagar um agente apaga o histórico dele, inclusive as
  -- linhas 'bloqueada' que são auditoria. Isso é aceito porque o CASCADE aqui
  -- existe para o off-boarding do CLIENTE (clientes -> agentes -> execucoes em
  -- um comando, o que ajuda em LGPD). Trocar por RESTRICT quebraria essa
  -- cadeia: a exclusão do cliente falharia ao esbarrar nas execuções.
  --
  -- A proteção da auditoria vem de uma regra de aplicação, não do banco:
  -- AGENTE NUNCA É APAGADO, é arquivado (status='arquivado'). A única
  -- remoção legítima de linhas é a do cliente inteiro saindo da base.
  CONSTRAINT execucoes_agente_fk FOREIGN KEY (agente_id, cliente_id)
    REFERENCES agentes (id, cliente_id) ON DELETE CASCADE,

  -- Coerência semântica: só faz sentido ter mensagem de erro se não houve sucesso.
  CONSTRAINT execucoes_msg_erro_chk
    CHECK (status <> 'sucesso' OR mensagem_erro IS NULL)
);

-- Paginação keyset do histórico: WHERE agente_id = $1 AND (criado_em, id) < ($2, $3)
-- ORDER BY criado_em DESC, id DESC LIMIT n  →  index-only scan, custo O(limit)
-- independente da profundidade da página.
-- `id` entra na chave como desempate: `criado_em` não é único e sem ele um
-- registro poderia ser pulado ou repetido entre páginas.
CREATE INDEX execucoes_agente_keyset_idx
  ON execucoes (agente_id, criado_em DESC, id DESC);

-- Mesma ideia no escopo do tenant (ex.: "últimas execuções do cliente").
CREATE INDEX execucoes_cliente_keyset_idx
  ON execucoes (cliente_id, criado_em DESC, id DESC);

-- Índice parcial: bloqueios são raros (<1% das linhas) mas é exatamente o que
-- o CS precisa buscar. O índice fica pequeno e barato de manter.
CREATE INDEX execucoes_bloqueadas_idx
  ON execucoes (cliente_id, criado_em DESC)
  WHERE status = 'bloqueada';

-- ---------------------------------------------------------------------
--  vw_agentes_consumo
--  Alimenta GET /agents inteiro. Aplica o reset preguiçoso na LEITURA:
--  se `periodo_referencia` ficou para trás, o contador é obsoleto e vale 0.
--  Sem isso, um cliente que não executou nada em julho apareceria em agosto
--  ainda mostrando o consumo de julho.
--
--  Zero COUNT(*), zero agregação: 1 index scan em `agentes` + 2 lookups por PK.
-- ---------------------------------------------------------------------
CREATE VIEW vw_agentes_consumo AS
SELECT
  a.id,
  a.cliente_id,
  a.nome,
  a.descricao,
  a.status,
  a.criado_em,
  a.ultima_execucao_em,
  a.total_execucoes,

  -- consumo do agente na competência corrente (atribuição)
  CASE WHEN a.periodo_referencia = periodo_atual()
       THEN a.execucoes_mes_atual ELSE 0 END                      AS execucoes_mes,

  -- consumo do cliente na competência corrente (enforcement)
  CASE WHEN c.periodo_referencia = periodo_atual()
       THEN c.execucoes_mes_atual ELSE 0 END                      AS execucoes_mes_cliente,

  p.id                                                            AS plano_id,
  p.nome                                                          AS plano_nome,
  p.limite_execucoes_mensal                                       AS limite_mensal,

  -- Um agente está bloqueado quando a COTA DO CLIENTE acabou (o pool é
  -- compartilhado), ou quando ele próprio não está ativo.
  (
    a.status <> 'ativo'
    OR (CASE WHEN c.periodo_referencia = periodo_atual()
             THEN c.execucoes_mes_atual ELSE 0 END) >= p.limite_execucoes_mensal
  )                                                               AS bloqueado,

  -- Divisão segura: limite_execucoes_mensal > 0 é garantido por CHECK em `planos`.
  round(
    100.0 * (CASE WHEN c.periodo_referencia = periodo_atual()
                  THEN c.execucoes_mes_atual ELSE 0 END)
    / p.limite_execucoes_mensal
  , 2)                                                            AS percentual_uso_cliente

FROM agentes a
JOIN clientes c ON c.id = a.cliente_id
JOIN planos   p ON p.id = c.plano_id;

COMMIT;
