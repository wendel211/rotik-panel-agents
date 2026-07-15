-- =====================================================================
--  Referência: POST /agents/:id/executions
--
--  Este arquivo NÃO roda no init do banco. Ele documenta o SQL exato que a
--  Etapa 2 (backend) executa, porque a corretude da regra de negócio central
--  está no SQL, não no TypeScript.
--
--  Contrato: registrar uma execução e consumir 1 unidade de cota é uma
--  operação atômica. Ou as duas coisas acontecem, ou nenhuma.
-- =====================================================================


-- ---------------------------------------------------------------------
--  PASSO 1: Validar existência, posse e status do agente.
--
--  Roda ANTES de tocar na cota: não queremos queimar cota de um cliente por
--  causa de um request para um agente que não existe. Sem FOR UPDATE de
--  propósito. Ver "ordem de lock" no fim do arquivo.
--
--  O filtro por cliente_id vem do JWT. É aqui que 404 e 403 colapsam em um
--  único 404: o agente de outro cliente simplesmente não existe para você.
-- ---------------------------------------------------------------------
SELECT id, status
  FROM agentes
 WHERE id = $1 AND cliente_id = $2;
-- 0 linhas → 404 AGENTE_NAO_ENCONTRADO
-- status <> 'ativo' → 409 AGENTE_INATIVO


-- ---------------------------------------------------------------------
--  PASSO 2: Consumir cota. O CORAÇÃO DA REGRA DE NEGÓCIO.
--
--  Um único UPDATE condicional faz, indivisivelmente:
--    a) o reset preguiçoso da competência (sem cron);
--    b) a verificação do limite;
--    c) o incremento do contador.
--
--  POR QUE NÃO "SELECT contador; if (contador < limite) UPDATE":
--  esse padrão é um check-then-act clássico. Dois requests concorrentes leem
--  99/100, ambos concluem "tem espaço", ambos incrementam → 101/100. A cota
--  vaza sob exatamente a carga em que ela mais importa.
--
--  Aqui a condição do limite está no WHERE do próprio UPDATE. O Postgres pega
--  um row lock na linha do cliente e reavalia o WHERE contra a versão já
--  commitada da linha (EvalPlanQual), serializando os concorrentes. O segundo
--  request enxerga 100/100 e o WHERE falha.
--
--  → 1 linha retornada  = cota consumida, pode gravar a execução.
--  → 0 linhas retornadas = limite atingido, bloquear. Sem ambiguidade,
--    sem race, sem precisar de SERIALIZABLE nem de advisory lock.
--
--  DUAS PREMISSAS QUE ESTA GARANTIA CARREGA (não são bugs, são limites):
--
--  1. Vale por linha, e só se TODO caminho de escrita passar por aqui.
--     Um script de correção manual, um import em massa ou um retry que
--     reemita um incremento cru furam a proteção inteira. Este UPDATE é o
--     único ponto autorizado a mexer em execucoes_mes_atual.
--
--  2. Depende de READ COMMITTED, que é o default do Postgres. Sob
--     REPEATABLE READ ou SERIALIZABLE o mesmo statement lançaria erro
--     40001 (could not serialize access) em vez de retornar 0 linhas.
--     Continua correto, nada estoura a cota, mas o modo de falha muda e a
--     aplicação passaria a precisar de retry. Se algum pooler ou ORM
--     alterar o isolamento padrão, a Etapa 2 quebra de forma silenciosa.
-- ---------------------------------------------------------------------
UPDATE clientes c
   SET execucoes_mes_atual =
         CASE WHEN c.periodo_referencia = periodo_atual()
              THEN c.execucoes_mes_atual + 1
              ELSE 1                       -- (a) virou o mês: reinicia em 1
         END,
       periodo_referencia = periodo_atual()
  FROM planos p
 WHERE c.id = $1
   AND c.plano_id = p.id
   AND (CASE WHEN c.periodo_referencia = periodo_atual()
             THEN c.execucoes_mes_atual
             ELSE 0                        -- competência velha ⇒ consumo zerado
        END) < p.limite_execucoes_mensal   -- (b) o limite, dentro do WHERE
RETURNING c.execucoes_mes_atual AS usado,
          p.limite_execucoes_mensal AS limite;


-- ---------------------------------------------------------------------
--  PASSO 3a: Caminho BLOQUEADO (passo 2 retornou 0 linhas).
--
--  A execução recusada é gravada mesmo assim. O briefing pede: "quando o
--  cliente estourar o limite, o agente deveria parar de responder (ou pelo
--  menos a gente precisa saber que isso aconteceu)". Isso é o "pelo menos".
--
--  Note que NENHUM contador é incrementado, cota estourada não vira cobrança.
--  A linha é auditoria, e é ela que alimenta o índice parcial
--  `execucoes_bloqueadas_idx` que o CS consulta.
--
--  A transação faz COMMIT (a linha precisa persistir) e a API devolve 429.
-- ---------------------------------------------------------------------
INSERT INTO execucoes (agente_id, cliente_id, status, mensagem_erro)
VALUES ($1, $2, 'bloqueada', 'Limite mensal do plano atingido.');


-- ---------------------------------------------------------------------
--  PASSO 3b: Caminho de SUCESSO (passo 2 retornou 1 linha).
--
--  Contador de atribuição do agente, com o mesmo reset preguiçoso do passo 2.
--  Se este UPDATE falhasse, a transação inteira faz rollback e a cota
--  consumida no passo 2 é devolvida, os dois contadores nunca divergem.
-- ---------------------------------------------------------------------
UPDATE agentes
   SET execucoes_mes_atual =
         CASE WHEN periodo_referencia = periodo_atual()
              THEN execucoes_mes_atual + 1
              ELSE 1
         END,
       periodo_referencia = periodo_atual(),
       total_execucoes    = total_execucoes + 1,
       ultima_execucao_em = now()
 WHERE id = $1 AND cliente_id = $2;

INSERT INTO execucoes (agente_id, cliente_id, status, duracao_ms, tokens_entrada, tokens_saida)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, criado_em;


-- =====================================================================
--  ORDEM DE LOCK: por que sempre `clientes` antes de `agentes`
--
--  Dois agentes do mesmo cliente executando em paralelo tocam as mesmas duas
--  tabelas. Se um caminho travasse `agentes` antes de `clientes` e o outro o
--  inverso, teríamos deadlock sob concorrência.
--
--  Regra do projeto: TODA transação que escreve contadores adquire o lock de
--  `clientes` primeiro. É por isso que o PASSO 1 não usa FOR UPDATE, ele
--  travaria `agentes` cedo demais e inverteria a ordem.
--
--  Risco aceito do passo 1 sem lock: o agente pode ser arquivado entre o
--  passo 1 e o passo 3b. O pior caso é uma execução a mais registrada num
--  agente recém-pausado, e a FK protege o caso de exclusão (o INSERT falha
--  e a transação inteira reverte). Aceitável, porque travar seria pior.
--
--
--  CUSTO DE LEITURA: a razão de tudo isso existir
--
--  "uso mensal" nunca vira COUNT(*) sobre `execucoes`:
--
--    COUNT(*) em tempo real   → O(execuções no mês). Degrada linearmente com
--                               o sucesso do cliente. O cliente que mais paga
--                               é o que tem o dashboard mais lento.
--    contador consolidado     → O(1). Uma leitura por PK, custo constante,
--                               tenha o cliente 10 ou 10 milhões de execuções.
--
--  O preço: +1 UPDATE por escrita e o risco de divergência entre contador e
--  fatos. Trocamos um custo que cresce sem limite por um custo fixo. Ver
--  README (Etapa 1) para o job de reconciliação que fecha o risco.
-- =====================================================================
