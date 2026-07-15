import type {
  Agente,
  EnvelopeErro,
  PaginaExecucoes,
  RespostaLogin,
} from '../types/api'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/$/, '')

interface OpcoesRequest extends Omit<RequestInit, 'body'> {
  token?: string
  body?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly codigo: string
  readonly detalhes: unknown
  readonly retryAfterSegundos: number | null

  constructor(
    status: number,
    codigo: string,
    mensagem: string,
    detalhes?: unknown,
    retryAfterSegundos: number | null = null,
  ) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
    this.retryAfterSegundos = retryAfterSegundos
  }
}

function pareceEnvelopeErro(valor: unknown): valor is EnvelopeErro {
  if (!valor || typeof valor !== 'object' || !('erro' in valor)) return false
  const erro = valor.erro
  return Boolean(
    erro &&
      typeof erro === 'object' &&
      'codigo' in erro &&
      typeof erro.codigo === 'string' &&
      'mensagem' in erro &&
      typeof erro.mensagem === 'string',
  )
}

async function request<T>(caminho: string, opcoes: OpcoesRequest = {}): Promise<T> {
  const { token, body, ...requestInit } = opcoes
  const headers = new Headers(opcoes.headers)
  headers.set('Accept', 'application/json')

  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const fetchOptions: RequestInit = { ...requestInit, headers }
  if (body !== undefined) fetchOptions.body = JSON.stringify(body)

  let resposta: Response
  try {
    resposta = await fetch(`${API_URL}${caminho}`, fetchOptions)
  } catch {
    throw new ApiError(
      0,
      'FALHA_REDE',
      'Não foi possível alcançar a API. Confira se o servidor está em execução.',
    )
  }

  const payload: unknown = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    const envelope = pareceEnvelopeErro(payload) ? payload.erro : null
    const codigo = envelope?.codigo ?? 'RESPOSTA_INVALIDA'
    const mensagem = envelope?.mensagem ?? 'A API devolveu uma resposta inesperada.'
    const retryAfter = resposta.headers.get('Retry-After')

    if (resposta.status === 401 && ['NAO_AUTENTICADO', 'TOKEN_EXPIRADO'].includes(codigo)) {
      window.dispatchEvent(new CustomEvent('rotik:sessao-expirada', { detail: codigo }))
    }

    throw new ApiError(
      resposta.status,
      codigo,
      mensagem,
      envelope?.detalhes,
      retryAfter ? Number(retryAfter) : null,
    )
  }

  return payload as T
}

export const api = {
  login(email: string, senha: string): Promise<RespostaLogin> {
    return request('/auth/login', {
      method: 'POST',
      body: { email, senha },
    })
  },

  listarAgentes(token: string): Promise<{ data: Agente[] }> {
    return request('/agents', { token })
  },

  criarAgente(token: string, dados: { nome: string; descricao?: string }): Promise<{ data: Agente }> {
    return request('/agents', { method: 'POST', token, body: dados })
  },

  listarExecucoes(token: string, agenteId: string, cursor?: string): Promise<PaginaExecucoes> {
    const query = new URLSearchParams({ limite: '20' })
    if (cursor) query.set('cursor', cursor)
    return request(`/agents/${agenteId}/executions?${query.toString()}`, { token })
  },

  simularExecucao(token: string, agenteId: string): Promise<unknown> {
    return request(`/agents/${agenteId}/executions`, {
      method: 'POST',
      token,
      body: { status: 'sucesso' },
    })
  },
}
