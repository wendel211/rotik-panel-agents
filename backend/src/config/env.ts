import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação de ambiente no boot.
 *
 * A API falha ao subir se faltar variável ou se ela vier malformada, em vez de
 * quebrar no primeiro request que precisar dela. Um JWT_SECRET ausente viraria
 * `undefined` e o `jsonwebtoken` assinaria com string vazia, ou seja, um bug de
 * segurança silencioso que só aparece em produção.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().url('DATABASE_URL precisa ser uma URL de conexão válida'),
  // Alguns provedores exigem TLS na URL pública, enquanto redes privadas
  // internas podem terminar TLS antes do container. Sem override explícito,
  // produção usa TLS e desenvolvimento/teste não usam.
  DATABASE_SSL: z.enum(['true', 'false']).optional(),

  // 32 caracteres é o piso para um segredo HMAC não ser força-brutável.
  // O valor de exemplo do .env.example passa aqui de propósito, para o setup
  // local funcionar, mas em produção o deploy injeta um valor aleatório real.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter ao menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Sem logger ainda: ele depende de LOG_LEVEL, que é justamente o que falhou.
  console.error('Configuração de ambiente inválida:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const databaseSsl = env.DATABASE_SSL === undefined ? isProduction : env.DATABASE_SSL === 'true';
