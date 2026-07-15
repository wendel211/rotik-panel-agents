import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './api'

function deveTentarNovamente(contagem: number, erro: Error): boolean {
  if (erro instanceof ApiError && erro.status >= 400 && erro.status < 500) return false
  return contagem < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: deveTentarNovamente,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
