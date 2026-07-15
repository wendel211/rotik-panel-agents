import pino from 'pino';

import { env, isProduction } from '../config/env';

/**
 * Log estruturado (JSON) em produção, legível em desenvolvimento.
 *
 * JSON não é preciosismo: é o que permite consultar "todos os bloqueios do
 * cliente X nas últimas 24h" em qualquer coletor (Datadog, Loki, CloudWatch)
 * sem depender de regex sobre texto livre.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),

  // Nunca deixar credencial ou token cair no log, mesmo que alguém logue o
  // request inteiro por engano em algum ponto futuro.
  redact: {
    paths: ['req.headers.authorization', 'senha', '*.senha', 'senha_hash', '*.senha_hash'],
    censor: '[REDACTED]',
  },
});
