import { z } from 'zod'

import type { Sessao } from '../types/api'

const CHAVE_SESSAO = 'rotik:sessao'

const sessaoSchema = z.object({
  token: z.string().min(1),
  cliente: z.object({
    id: z.string().min(1),
    nome: z.string().min(1),
    email: z.email(),
  }),
})

export function lerSessao(): Sessao | null {
  try {
    const valor = localStorage.getItem(CHAVE_SESSAO)
    if (!valor) return null

    const resultado = sessaoSchema.safeParse(JSON.parse(valor))
    if (resultado.success) return resultado.data

    localStorage.removeItem(CHAVE_SESSAO)
    return null
  } catch {
    localStorage.removeItem(CHAVE_SESSAO)
    return null
  }
}

export function salvarSessao(sessao: Sessao): void {
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
}

export function removerSessao(): void {
  localStorage.removeItem(CHAVE_SESSAO)
}
