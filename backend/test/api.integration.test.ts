import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app';
import { env } from '../src/config/env';
import { pool } from '../src/db/pool';
import { autorizar, criarConta, limparBanco } from './fixtures';

const app = criarApp();

beforeEach(limparBanco);
afterAll(() => pool.end());

describe('API HTTP', () => {
  it('expõe healthcheck real e envelope 404', async () => {
    const docs = await request(app).get('/docs.json');
    expect(docs.status).toBe(200);
    expect(docs.body).toMatchObject({
      openapi: '3.0.3',
      paths: {
        '/health': { get: expect.any(Object) },
        '/auth/login': { post: expect.any(Object) },
        '/agents': { get: expect.any(Object), post: expect.any(Object) },
        '/agents/{id}/executions': { get: expect.any(Object), post: expect.any(Object) },
      },
    });
    const swagger = await request(app).get('/docs/');
    expect(swagger.status).toBe(200);
    expect(swagger.text).toContain('Rotik Panel Agents API');

    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: 'ok', banco: 'ok' });
    expect(new Date(health.body.timestamp).toString()).not.toBe('Invalid Date');

    const desconhecida = await request(app).get('/nao-existe');
    expect(desconhecida.status).toBe(404);
    expect(desconhecida.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });

  it('autentica sem revelar qual credencial falhou', async () => {
    const conta = await criarConta();
    const sucesso = await request(app).post('/auth/login').send({
      email: `  ${conta.email.toUpperCase()}  `,
      senha: conta.senha,
    });
    expect(sucesso.status).toBe(200);
    expect(sucesso.body.cliente).toMatchObject({ id: conta.clienteId, email: conta.email });
    expect(jwt.verify(sucesso.body.token, env.JWT_SECRET)).toMatchObject({ sub: conta.clienteId });

    for (const credenciais of [
      { email: conta.email, senha: 'errada' },
      { email: 'inexistente@rotik.test', senha: 'errada' },
    ]) {
      const falha = await request(app).post('/auth/login').send(credenciais);
      expect(falha.status).toBe(401);
      expect(falha.body.erro).toMatchObject({ codigo: 'NAO_AUTENTICADO' });
    }

    const invalido = await request(app).post('/auth/login').send({ email: 'invalido', senha: '' });
    expect(invalido.status).toBe(400);
    expect(invalido.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(invalido.body.erro.detalhes).toHaveLength(2);
  });

  it('protege as rotas contra tokens ausentes, inválidos e expirados', async () => {
    expect((await request(app).get('/agents')).status).toBe(401);
    expect((await request(app).get('/agents').set(autorizar('lixo'))).body.erro.codigo).toBe(
      'NAO_AUTENTICADO',
    );

    const semSub = jwt.sign({}, env.JWT_SECRET, { expiresIn: '1h' });
    expect((await request(app).get('/agents').set(autorizar(semSub))).status).toBe(401);

    const expirado = jwt.sign({}, env.JWT_SECRET, { subject: 'cliente', expiresIn: -1 });
    const resposta = await request(app).get('/agents').set(autorizar(expirado));
    expect(resposta.status).toBe(401);
    expect(resposta.body.erro.codigo).toBe('TOKEN_EXPIRADO');
  });

  it('cria e lista agentes apenas dentro do tenant autenticado', async () => {
    const a = await criarConta('a');
    const b = await criarConta('b');
    const criado = await request(app)
      .post('/agents')
      .set(autorizar(a.token))
      .send({ nome: '  SDR Assistente  ', descricao: ' Prospecção ', clienteId: b.clienteId });

    expect(criado.status).toBe(201);
    expect(criado.body.data).toMatchObject({
      nome: 'SDR Assistente',
      descricao: 'Prospecção',
      bloqueado: false,
      consumo: { execucoesMesCliente: 0, limiteMensal: 100 },
    });

    const listaA = await request(app).get('/agents').set(autorizar(a.token));
    const listaB = await request(app).get('/agents').set(autorizar(b.token));
    expect(listaA.body.data.map((agente: { nome: string }) => agente.nome)).toContain('SDR Assistente');
    expect(listaB.body.data.map((agente: { nome: string }) => agente.nome)).not.toContain(
      'SDR Assistente',
    );

    const duplicado = await request(app)
      .post('/agents')
      .set(autorizar(a.token))
      .send({ nome: 'sdr assistente' });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.erro.codigo).toBe('AGENTE_JA_EXISTE');

    for (const body of [{}, { nome: ' '.repeat(2) }, { nome: 'x'.repeat(121) }]) {
      expect((await request(app).post('/agents').set(autorizar(a.token)).send(body)).status).toBe(400);
    }
  });

  it('registra sucesso e erro, valida entrada e aplica reset mensal preguiçoso', async () => {
    const conta = await criarConta('execucao', 5);
    await pool.query(
      `UPDATE clientes SET execucoes_mes_atual = 4, periodo_referencia = periodo_atual() - 35
       WHERE id = $1`,
      [conta.clienteId],
    );

    const sucesso = await request(app)
      .post(`/agents/${conta.agenteId}/executions`)
      .set(autorizar(conta.token))
      .send({ duracaoMs: 120, tokensEntrada: 10, tokensSaida: 20 });
    expect(sucesso.status).toBe(201);
    expect(sucesso.body.data).toMatchObject({ status: 'sucesso', consumo: { usado: 1, restante: 4 } });

    const erro = await request(app)
      .post(`/agents/${conta.agenteId}/executions`)
      .set(autorizar(conta.token))
      .send({ status: 'erro', mensagemErro: 'Timeout' });
    expect(erro.status).toBe(201);
    expect(erro.body.data.status).toBe('erro');

    const invalido = await request(app)
      .post(`/agents/${conta.agenteId}/executions`)
      .set(autorizar(conta.token))
      .send({ status: 'sucesso', mensagemErro: 'não permitido' });
    expect(invalido.status).toBe(400);

    expect(
      (await request(app).post('/agents/id-invalido/executions').set(autorizar(conta.token))).status,
    ).toBe(400);
  });

  it('não consome cota para agente inexistente, de outro tenant ou inativo', async () => {
    const a = await criarConta('dono');
    const b = await criarConta('intruso');
    const outroTenant = await request(app)
      .post(`/agents/${a.agenteId}/executions`)
      .set(autorizar(b.token));
    expect(outroTenant.status).toBe(404);

    await pool.query(`UPDATE agentes SET status = 'pausado' WHERE id = $1`, [a.agenteId]);
    const inativo = await request(app)
      .post(`/agents/${a.agenteId}/executions`)
      .set(autorizar(a.token));
    expect(inativo.status).toBe(409);
    expect(inativo.body.erro.codigo).toBe('AGENTE_INATIVO');

    const consumo = await pool.query<{ execucoes_mes_atual: number }>(
      `SELECT execucoes_mes_atual FROM clientes WHERE id = $1`,
      [a.clienteId],
    );
    expect(consumo.rows[0]!.execucoes_mes_atual).toBe(0);
  });

  it('bloqueia no limite, preserva a cota e grava a tentativa para auditoria', async () => {
    const conta = await criarConta('limite', 2);
    for (let i = 0; i < 2; i += 1) {
      expect(
        (await request(app).post(`/agents/${conta.agenteId}/executions`).set(autorizar(conta.token)))
          .status,
      ).toBe(201);
    }

    const bloqueada = await request(app)
      .post(`/agents/${conta.agenteId}/executions`)
      .set(autorizar(conta.token));
    expect(bloqueada.status).toBe(429);
    expect(Number(bloqueada.headers['retry-after'])).toBeGreaterThan(0);
    expect(bloqueada.body.erro).toMatchObject({
      codigo: 'LIMITE_PLANO_ATINGIDO',
      detalhes: { usado: 2, limite: 2 },
    });

    const estado = await pool.query<{
      execucoes_mes_atual: number;
      total_execucoes: string;
      bloqueadas: string;
    }>(
      `SELECT c.execucoes_mes_atual, a.total_execucoes,
              count(e.id) FILTER (WHERE e.status = 'bloqueada') AS bloqueadas
         FROM clientes c JOIN agentes a ON a.cliente_id = c.id
         LEFT JOIN execucoes e ON e.agente_id = a.id
        WHERE c.id = $1 GROUP BY c.execucoes_mes_atual, a.total_execucoes`,
      [conta.clienteId],
    );
    expect(estado.rows[0]).toMatchObject({ execucoes_mes_atual: 2, total_execucoes: '2', bloqueadas: '1' });
  });

  it('mantém exatamente 100 sucessos em 112 requests concorrentes', async () => {
    const conta = await criarConta('concorrencia', 100);
    const respostas = await Promise.all(
      Array.from({ length: 112 }, () =>
        request(app).post(`/agents/${conta.agenteId}/executions`).set(autorizar(conta.token)),
      ),
    );
    expect(respostas.filter((resposta) => resposta.status === 201)).toHaveLength(100);
    expect(respostas.filter((resposta) => resposta.status === 429)).toHaveLength(12);

    const estado = await pool.query<{ consumo: number; executadas: string; bloqueadas: string }>(
      `SELECT c.execucoes_mes_atual AS consumo,
              count(e.id) FILTER (WHERE e.status <> 'bloqueada') AS executadas,
              count(e.id) FILTER (WHERE e.status = 'bloqueada') AS bloqueadas
         FROM clientes c JOIN execucoes e ON e.cliente_id = c.id
        WHERE c.id = $1 GROUP BY c.execucoes_mes_atual`,
      [conta.clienteId],
    );
    expect(estado.rows[0]).toEqual({ consumo: 100, executadas: '100', bloqueadas: '12' });
  }, 30_000);

  it('pagina o histórico por cursor sem repetir linhas e valida posse/cursor', async () => {
    const conta = await criarConta('historico', 10);
    const outro = await criarConta('outro');
    for (let i = 0; i < 5; i += 1) {
      await request(app).post(`/agents/${conta.agenteId}/executions`).set(autorizar(conta.token));
    }

    const primeira = await request(app)
      .get(`/agents/${conta.agenteId}/executions?limite=3`)
      .set(autorizar(conta.token));
    expect(primeira.status).toBe(200);
    expect(primeira.body.data).toHaveLength(3);
    expect(primeira.body.proximoCursor).toBeTypeOf('string');

    const segunda = await request(app)
      .get(`/agents/${conta.agenteId}/executions?limite=3&cursor=${primeira.body.proximoCursor}`)
      .set(autorizar(conta.token));
    expect(segunda.body.data).toHaveLength(2);
    expect(segunda.body.proximoCursor).toBeNull();
    const ids = [...primeira.body.data, ...segunda.body.data].map((item) => item.id);
    expect(new Set(ids)).toHaveLength(5);

    expect(
      (
        await request(app)
          .get(`/agents/${conta.agenteId}/executions?cursor=invalido`)
          .set(autorizar(conta.token))
      ).status,
    ).toBe(400);
    for (const cursor of [
      Buffer.from(JSON.stringify({ c: new Date().toISOString() })).toString('base64url'),
      Buffer.from(JSON.stringify({ c: 'data-invalida', i: conta.agenteId })).toString('base64url'),
      Buffer.from(JSON.stringify({ c: new Date().toISOString(), i: 'nao-e-uuid' })).toString('base64url'),
    ]) {
      expect(
        (
          await request(app)
            .get(`/agents/${conta.agenteId}/executions?cursor=${cursor}`)
            .set(autorizar(conta.token))
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await request(app)
          .get(`/agents/${conta.agenteId}/executions`)
          .set(autorizar(outro.token))
      ).status,
    ).toBe(404);
  });
});
