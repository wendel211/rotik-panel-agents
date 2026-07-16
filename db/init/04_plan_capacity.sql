BEGIN;

-- =====================================================================
--  Capacidade dos planos em escala de produto real.
--
--  Os limites anteriores (Growth 100, Pro 1.000) eram números de laboratório:
--  uma plataforma de agentes de IA com 100 chamadas por mês não é um produto,
--  é um teste. Growth com 5.000 e Pro com 25.000 aproximam a demonstração de
--  um plano que alguém contrataria de verdade.
--
--  Migração nova em vez de editar o 02_seed.sql de propósito: o runner
--  compara checksum e recusa arquivo já aplicado que mudou ("Crie uma nova
--  migração"). Editar o seed quebraria o deploy.
-- =====================================================================

UPDATE planos SET limite_execucoes_mensal = 5000  WHERE lower(nome) = 'growth';
UPDATE planos SET limite_execucoes_mensal = 25000 WHERE lower(nome) = 'pro';
UPDATE planos SET limite_execucoes_mensal = 120000 WHERE lower(nome) = 'enterprise';

-- ---------------------------------------------------------------------
--  Consumo da demonstração, reescalado junto com o limite.
--
--  Subir só o limite esvaziaria a barra: a Acme cairia para ~2% e o painel
--  abriria mostrando uma conta tranquila. Mas o briefing pede exatamente o
--  contrário ("ser alertados quando um cliente está perto de estourar"), e a
--  conta em zona de alerta é o estado que este produto existe para mostrar.
--
--  A Acme volta para 82% (4.100/5.000), o mesmo percentual da demo original.
--  Sobram 900 execuções: dá para encher a cota em um lote (o teto por lote é
--  1.000) e ver o bloqueio ao vivo, sem risco de alguém travar a demo por
--  acidente antes da apresentação.
--
--  Os contadores por agente somam o do cliente. Esse invariante é o mesmo que
--  a aplicação mantém em transação, e o seed não pode ser a exceção que o
--  quebra.
-- ---------------------------------------------------------------------

-- Acme: 3.000 + 1.100 + 0 = 4.100  ->  82% de 5.000
UPDATE clientes
   SET execucoes_mes_atual = 4100,
       periodo_referencia = periodo_atual()
 WHERE email = 'cs@acme.dev';

UPDATE agentes SET execucoes_mes_atual = 3000, total_execucoes = 48200,
                   periodo_referencia = periodo_atual()
 WHERE nome = 'Triagem de Tickets'
   AND cliente_id = (SELECT id FROM clientes WHERE email = 'cs@acme.dev');

UPDATE agentes SET execucoes_mes_atual = 1100, total_execucoes = 22400,
                   periodo_referencia = periodo_atual()
 WHERE nome = 'FAQ Bot'
   AND cliente_id = (SELECT id FROM clientes WHERE email = 'cs@acme.dev');

-- Pausado: não consome cota, então segue em zero na competência.
-- O total vitalício sobe porque ele já rodou antes de ser pausado.
UPDATE agentes SET execucoes_mes_atual = 0, total_execucoes = 1850,
                   periodo_referencia = periodo_atual()
 WHERE nome = 'Resumo de Chamadas'
   AND cliente_id = (SELECT id FROM clientes WHERE email = 'cs@acme.dev');

-- Globex: 3.500  ->  14% de 25.000. O contraste com a Acme é o ponto:
-- uma conta em risco ao lado de uma folgada.
UPDATE clientes
   SET execucoes_mes_atual = 3500,
       periodo_referencia = periodo_atual()
 WHERE email = 'cs@globex.dev';

UPDATE agentes SET execucoes_mes_atual = 3500, total_execucoes = 61300,
                   periodo_referencia = periodo_atual()
 WHERE nome = 'Qualificação de Leads'
   AND cliente_id = (SELECT id FROM clientes WHERE email = 'cs@globex.dev');

-- Execuções bloqueadas acumuladas de testes anteriores não representam o
-- estado da demonstração e poluiriam o histórico que o CS consulta.
DELETE FROM execucoes WHERE status = 'bloqueada';

COMMIT;
