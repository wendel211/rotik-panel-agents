import { createContext, use } from 'react'

import type { Sessao } from '../../types/api'

export interface AuthContextValue {
  sessao: Sessao | null
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const contexto = use(AuthContext)
  if (!contexto) throw new Error('useAuth precisa ser usado dentro de AuthProvider.')
  return contexto
}
