import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ApiError, api } from '../src/lib/api'
import { formatarDataHora, formatarMesAtual, formatarNumero, obterIniciais } from '../src/lib/format'
import { queryClient } from '../src/lib/queryClient'
import { lerSessao, removerSessao, salvarSessao } from '../src/lib/session'
import { aplicarTema, lerTema, useTema } from '../src/lib/theme'
import { sessao } from './helpers'

describe('cliente HTTP', () => {
  it('monta todos os contratos de sucesso', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    await api.login('a@b.com', 'senha')
    await api.listarAgentes('token')
    await api.criarAgente('token', { nome: 'Agente' })
    await api.listarExecucoes('token', 'agente', 'cursor valor')
    await api.listarExecucoes('token', 'agente')
    await api.simularExecucao('token', 'agente')

    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[1]![1]!.headers).toHaveProperty('get')
    expect(String(fetchMock.mock.calls[3]![0])).toContain('cursor=cursor+valor')
  })

  it('traduz falha de rede, envelope da API e resposta inválida', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'))
    await expect(api.listarAgentes('token')).rejects.toMatchObject({ codigo: 'FALHA_REDE', status: 0 })

    const evento = vi.fn()
    window.addEventListener('rotik:sessao-expirada', evento)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ erro: { codigo: 'TOKEN_EXPIRADO', mensagem: 'Expirou', detalhes: { x: 1 } } }),
        { status: 401, headers: { 'Retry-After': '30' } },
      ),
    )
    await expect(api.listarAgentes('token')).rejects.toMatchObject({
      codigo: 'TOKEN_EXPIRADO',
      detalhes: { x: 1 },
      retryAfterSegundos: 30,
    })
    expect(evento).toHaveBeenCalled()

    vi.mocked(fetch).mockResolvedValueOnce(new Response('texto', { status: 500 }))
    await expect(api.listarAgentes('token')).rejects.toMatchObject({ codigo: 'RESPOSTA_INVALIDA' })
  })
})

describe('sessão, tema, formato e retry', () => {
  it('persiste apenas sessões válidas', () => {
    expect(lerSessao()).toBeNull()
    salvarSessao(sessao)
    expect(lerSessao()).toEqual(sessao)
    removerSessao()
    expect(lerSessao()).toBeNull()

    localStorage.setItem('rotik:sessao', JSON.stringify({ token: '' }))
    expect(lerSessao()).toBeNull()
    localStorage.setItem('rotik:sessao', '{quebrado')
    expect(lerSessao()).toBeNull()
  })

  it('lê, aplica e alterna o tema', () => {
    expect(lerTema()).toBe('escuro')
    localStorage.setItem('rotik:tema', 'claro')
    expect(lerTema()).toBe('claro')
    aplicarTema('claro')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    aplicarTema('escuro')
    expect(document.documentElement).not.toHaveAttribute('data-theme')

    const { result } = renderHook(() => useTema())
    expect(result.current.tema).toBe('claro')
    act(() => result.current.alternar())
    expect(result.current.tema).toBe('escuro')
  })

  it('formata os dados operacionais', () => {
    expect(formatarNumero(1234)).toMatch(/1[.\s]234/)
    expect(formatarDataHora('2026-07-15T12:00:00.000Z')).toMatch(/15\/07\/2026/)
    expect(formatarMesAtual()).toMatch(/^[A-ZÁÉÍÓÚ]/)
    expect(obterIniciais('Acme Operações')).toBe('AO')
  })

  it('não repete 4xx e limita retry de falhas transitórias', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry as (count: number, error: Error) => boolean
    expect(retry(0, new ApiError(429, 'LIMITE', 'limite'))).toBe(false)
    expect(retry(0, new ApiError(500, 'ERRO', 'erro'))).toBe(true)
    expect(retry(2, new Error('rede'))).toBe(false)
  })
})
