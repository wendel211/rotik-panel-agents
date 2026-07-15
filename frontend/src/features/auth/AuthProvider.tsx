import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { api } from '../../lib/api'
import { lerSessao, removerSessao, salvarSessao } from '../../lib/session'
import type { Sessao } from '../../types/api'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(lerSessao)
  const queryClient = useQueryClient()

  const sair = useCallback(() => {
    removerSessao()
    setSessao(null)
    queryClient.clear()
  }, [queryClient])

  const entrar = useCallback(async (email: string, senha: string) => {
    const novaSessao = await api.login(email, senha)
    salvarSessao(novaSessao)
    setSessao(novaSessao)
  }, [])

  useEffect(() => {
    window.addEventListener('rotik:sessao-expirada', sair)
    return () => window.removeEventListener('rotik:sessao-expirada', sair)
  }, [sair])

  const valor = useMemo(() => ({ sessao, entrar, sair }), [entrar, sair, sessao])

  return <AuthContext value={valor}>{children}</AuthContext>
}
