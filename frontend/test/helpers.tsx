import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

import { AuthContext, type AuthContextValue } from '../src/features/auth/authContext'
import type { Agente, Sessao } from '../src/types/api'

export const sessao: Sessao = {
  token: 'token-teste',
  cliente: { id: 'cliente-1', nome: 'Acme Operações', email: 'cs@acme.dev' },
}

export function agente(overrides: Partial<Agente> = {}): Agente {
  return {
    id: 'agente-1',
    nome: 'Assistente Comercial',
    descricao: 'Qualifica oportunidades',
    status: 'ativo',
    bloqueado: false,
    criadoEm: '2026-07-01T12:00:00.000Z',
    ultimaExecucaoEm: '2026-07-15T12:00:00.000Z',
    totalExecucoes: 40,
    plano: { id: 'plano-1', nome: 'Growth' },
    consumo: {
      execucoesMesAgente: 20,
      execucoesMesCliente: 40,
      limiteMensal: 100,
      restante: 60,
      percentualUsoCliente: 40,
    },
    ...overrides,
  }
}

export function renderizar(
  ui: ReactElement,
  authOverrides: Partial<AuthContextValue> = {},
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) {
  const auth: AuthContextValue = {
    sessao,
    entrar: async () => undefined,
    sair: () => undefined,
    ...authOverrides,
  }
  const envolver = (node: ReactElement) => (
    <QueryClientProvider client={client}>
      <AuthContext value={auth}>{node}</AuthContext>
    </QueryClientProvider>
  )
  const resultado = render(envolver(ui))
  return {
    client,
    ...resultado,
    rerender: (nextUi: ReactElement) => resultado.rerender(envolver(nextUi)),
  }
}
