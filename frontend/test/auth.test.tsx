import { QueryClient } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { AuthContext, useAuth } from '../src/features/auth/authContext'
import { LoginPage } from '../src/features/auth/LoginPage'
import { ApiError, api } from '../src/lib/api'
import { renderizar, sessao } from './helpers'

vi.mock('../src/features/dashboard/DashboardPage', () => ({
  DashboardPage: () => <div>Dashboard autenticado</div>,
}))

describe('autenticação', () => {
  it('exige contexto e escolhe login ou dashboard pela sessão', () => {
    expect(() => render(<ComponenteAuth />)).toThrow(/AuthProvider/)
    const { rerender } = renderizar(<App />, { sessao: null })
    expect(screen.getByText(/acesse sua operação/i)).toBeInTheDocument()
    rerender(<AuthContext value={{ sessao, entrar: vi.fn(), sair: vi.fn() }}><App /></AuthContext>)
    expect(screen.getByText('Dashboard autenticado')).toBeInTheDocument()
  })

  it('valida, preenche conta demo, alterna senha e autentica', async () => {
    const entrar = vi.fn().mockResolvedValue(undefined)
    renderizar(<LoginPage />, { sessao: null, entrar })
    await userEvent.click(screen.getByRole('button', { name: /entrar no painel/i }))
    expect(screen.getByText(/e-mail válido/i)).toBeInTheDocument()
    expect(screen.getByText(/informe a senha/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Acme' }))
    expect(screen.getByLabelText(/e-mail/i)).toHaveValue('cs@acme.dev')
    expect(screen.getByLabelText(/^senha$/i)).toHaveValue('senha123')
    await userEvent.click(screen.getByRole('button', { name: /mostrar senha/i }))
    expect(screen.getByLabelText(/^senha$/i)).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: /ocultar senha/i }))
    await userEvent.click(screen.getByRole('button', { name: /entrar no painel/i }))
    await waitFor(() => expect(entrar).toHaveBeenCalledWith('cs@acme.dev', 'senha123'))
  })

  it('explica falha conhecida e inesperada e remove a imagem quando falha', async () => {
    const entrar = vi.fn().mockRejectedValueOnce(new ApiError(401, 'NAO_AUTENTICADO', 'Credenciais inválidas'))
      .mockRejectedValueOnce(new Error('falha'))
    renderizar(<LoginPage />, { sessao: null, entrar })
    const imagem = document.querySelector('img[src^="https://rotik.io"]')!
    act(() => imagem.dispatchEvent(new Event('error', { bubbles: true })))
    expect(document.querySelector('img[src^="https://rotik.io"]')).toBeNull()

    await userEvent.type(screen.getByLabelText(/e-mail/i), 'teste@rotik.dev')
    await userEvent.type(screen.getByLabelText(/^senha$/i), 'senha')
    await userEvent.click(screen.getByRole('button', { name: /entrar no painel/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas')
    await userEvent.click(screen.getByRole('button', { name: /entrar no painel/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível entrar/i)
  })

  it('provider persiste entrada, limpa saída e reage à sessão expirada', async () => {
    vi.spyOn(api, 'login').mockResolvedValue(sessao)
    const client = new QueryClient()
    const clear = vi.spyOn(client, 'clear')
    const { getByRole } = renderizar(<PainelAuth />, {}, client)
    await userEvent.click(getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Acme Operações')
    expect(JSON.parse(localStorage.getItem('rotik:sessao')!)).toEqual(sessao)
    window.dispatchEvent(new CustomEvent('rotik:sessao-expirada'))
    await screen.findByText('sem sessão')
    expect(clear).toHaveBeenCalled()
  })
})

function ComponenteAuth() {
  useAuth()
  return null
}

function PainelAuth() {
  const [montado] = useState(true)
  if (!montado) return null
  return (
    <AuthProvider>
      <LeitorAuth />
    </AuthProvider>
  )
}

function LeitorAuth() {
  const auth = useAuth()
  return (
    <div>
      <span>{auth.sessao?.cliente.nome ?? 'sem sessão'}</span>
      <button onClick={() => void auth.entrar('cs@acme.dev', 'senha123')}>Entrar</button>
      <button onClick={auth.sair}>Sair</button>
    </div>
  )
}
