import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NewAgentDialog } from '../src/features/agents/NewAgentDialog'
import { DashboardPage } from '../src/features/dashboard/DashboardPage'
import { HistoryDialog } from '../src/features/executions/HistoryDialog'
import { ApiError, api } from '../src/lib/api'
import type { Execucao } from '../src/types/api'
import { agente, renderizar } from './helpers'

beforeEach(() => {
  vi.spyOn(api, 'listarAgentes').mockResolvedValue({ data: [] })
})

describe('cadastro de agente', () => {
  it('valida, cria, atualiza cache e fecha', async () => {
    const fechar = vi.fn()
    const criado = agente({ id: 'novo', nome: 'Novo Agente' })
    vi.spyOn(api, 'criarAgente').mockResolvedValue({ data: criado })
    const { client } = renderizar(<NewAgentDialog aberto aoFechar={fechar} />)

    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar agente' }))
    expect(screen.getByText(/informe o nome/i)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/nome do agente/i), '  Novo Agente  ')
    await userEvent.type(screen.getByLabelText(/descrição/i), '  Atendimento  ')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar agente' }))
    await waitFor(() => expect(api.criarAgente).toHaveBeenCalledWith('token-teste', { nome: 'Novo Agente', descricao: 'Atendimento' }))
    expect(client.getQueryData<{ data: unknown[] }>(['agentes', 'cliente-1'])?.data).toEqual([criado])
    expect(fechar).toHaveBeenCalled()
  })

  it('mapeia duplicidade, detalhes de campo, erro da API e erro inesperado', async () => {
    const criar = vi.spyOn(api, 'criarAgente')
      .mockRejectedValueOnce(new ApiError(409, 'AGENTE_JA_EXISTE', 'Nome já usado'))
      .mockRejectedValueOnce(new ApiError(400, 'DADOS_INVALIDOS', 'Dados ruins', [{ campo: 'descricao', mensagem: 'Descrição ruim' }]))
      .mockRejectedValueOnce(new ApiError(400, 'DADOS_INVALIDOS', 'Dados ruins', [{ campo: 'outro', mensagem: 'x' }]))
      .mockRejectedValueOnce(new ApiError(500, 'ERRO', 'Falha da API'))
      .mockRejectedValueOnce(new Error('falha'))
    renderizar(<NewAgentDialog aberto aoFechar={vi.fn()} />)
    const nome = screen.getByLabelText(/nome do agente/i)
    await userEvent.type(nome, 'Agente')
    const submit = screen.getByRole('button', { name: 'Cadastrar agente' })

    await userEvent.click(submit)
    expect(await screen.findByText('Nome já usado')).toBeInTheDocument()
    await userEvent.click(submit)
    expect(await screen.findByText('Descrição ruim')).toBeInTheDocument()
    await userEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('Dados ruins')
    await userEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha da API')
    await userEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível cadastrar/i)
    expect(criar).toHaveBeenCalledTimes(5)
  })

  it('fecha e reseta os campos', async () => {
    const fechar = vi.fn()
    const { rerender } = renderizar(<NewAgentDialog aberto aoFechar={fechar} />)
    await userEvent.type(screen.getByLabelText(/nome do agente/i), 'Temporário')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(fechar).toHaveBeenCalled()
    rerender(<NewAgentDialog aberto={false} aoFechar={fechar} />)
    expect(screen.getByLabelText(/nome do agente/i)).toHaveValue('')
  })
})

describe('histórico', () => {
  const execucoes: Execucao[] = [
    { id: '1', status: 'sucesso', duracaoMs: null, tokensEntrada: null, tokensSaida: null, quantidadeExecucoes: 1, mensagemErro: null, criadoEm: '2026-07-15T12:00:00Z' },
    { id: '2', status: 'erro', duracaoMs: 200, tokensEntrada: 10, tokensSaida: 5, quantidadeExecucoes: 3, mensagemErro: 'Timeout', criadoEm: '2026-07-15T11:00:00Z' },
    { id: '3', status: 'bloqueada', duracaoMs: null, tokensEntrada: null, tokensSaida: null, quantidadeExecucoes: 5, mensagemErro: 'Cota', criadoEm: '2026-07-15T10:00:00Z' },
  ]

  it('lista todos os estados e carrega a próxima página', async () => {
    vi.spyOn(api, 'listarExecucoes')
      .mockResolvedValueOnce({ data: execucoes, proximoCursor: 'cursor-2' })
      .mockResolvedValueOnce({ data: [{ ...execucoes[0]!, id: '4' }], proximoCursor: null })
    renderizar(<HistoryDialog agente={agente()} aoFechar={vi.fn()} />)
    expect(await screen.findByText('Sucesso')).toBeInTheDocument()
    expect(screen.getByText('Erro')).toBeInTheDocument()
    expect(screen.getByText('Bloqueada')).toBeInTheDocument()
    expect(screen.getByText(/sem métricas adicionais/i)).toBeInTheDocument()
    expect(screen.getByText('45 tokens no lote')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /carregar mais/i }))
    await waitFor(() => expect(api.listarExecucoes).toHaveBeenLastCalledWith('token-teste', 'agente-1', 'cursor-2'))
  })

  it('representa vazio e permite tentar novamente após erro', async () => {
    vi.spyOn(api, 'listarExecucoes').mockResolvedValueOnce({ data: [], proximoCursor: null })
    const vazio = renderizar(<HistoryDialog agente={agente()} aoFechar={vi.fn()} />)
    expect(await screen.findByText(/nenhuma execução registrada/i)).toBeInTheDocument()
    vazio.unmount()

    vi.spyOn(api, 'listarExecucoes').mockRejectedValueOnce(new ApiError(500, 'ERRO', 'Histórico indisponível')).mockResolvedValueOnce({ data: [], proximoCursor: null })
    renderizar(<HistoryDialog agente={agente({ id: 'outro' })} aoFechar={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Histórico indisponível')
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(await screen.findByText(/nenhuma execução registrada/i)).toBeInTheDocument()
  })
})

describe('dashboard integrado', () => {
  it('carrega agentes, abre fluxos e registra simulação', async () => {
    const dados = [agente(), agente({ id: '2', nome: 'Agente Pausado', status: 'pausado' })]
    vi.mocked(api.listarAgentes).mockResolvedValue({ data: dados })
    vi.spyOn(api, 'simularExecucao').mockResolvedValue({})
    vi.spyOn(api, 'listarExecucoes').mockResolvedValue({ data: [], proximoCursor: null })
    renderizar(<DashboardPage />)
    expect(await screen.findByText('Assistente Comercial')).toBeInTheDocument()
    expect(screen.getByText(/2 agentes nesta conta/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /novo agente/i }))
    expect(screen.getByRole('heading', { name: /cadastrar agente/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /fechar cadastro/i }))

    await userEvent.click(screen.getAllByRole('button', { name: /execuções de assistente/i })[0]!)
    expect(await screen.findByRole('heading', { name: /histórico de assistente/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /fechar histórico/i }))

    await userEvent.click(screen.getAllByRole('button', { name: /execução do agente assistente/i })[0]!)
    expect(screen.getByRole('heading', { name: /simular consumo/i })).toBeInTheDocument()
    const quantidade = screen.getByLabelText(/execuções que serão consumidas/i)
    await userEvent.clear(quantidade)
    await userEvent.type(quantidade, '61')
    expect(screen.getByRole('button', { name: /cota insuficiente/i })).toBeDisabled()
    expect(screen.getByText(/reduza o lote para continuar/i)).toBeInTheDocument()

    await userEvent.clear(quantidade)
    await userEvent.type(quantidade, '12')
    expect(screen.getByText('48 restantes')).toBeInTheDocument()
    expect(screen.queryByLabelText(/tokens/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /confirmar lote/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/processadas/i)
    expect(api.simularExecucao).toHaveBeenCalledWith('token-teste', 'agente-1', { quantidadeExecucoes: 12 })
  })

  it('mostra erro de consulta e refaz a chamada', async () => {
    vi.mocked(api.listarAgentes).mockRejectedValueOnce(new ApiError(500, 'ERRO', 'API fora')).mockResolvedValueOnce({ data: [] })
    renderizar(<DashboardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('API fora')
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(await screen.findByText(/nenhum agente cadastrado/i)).toBeInTheDocument()
  })

  it('explicita o refresh e preserva os dados quando a atualização falha', async () => {
    const dados = { data: [agente()] }
    let concluirAtualizacao!: (valor: typeof dados) => void
    const atualizacaoPendente = new Promise<typeof dados>((resolve) => {
      concluirAtualizacao = resolve
    })

    vi.mocked(api.listarAgentes).mockResolvedValueOnce(dados).mockReturnValueOnce(atualizacaoPendente)
    renderizar(<DashboardPage />)

    expect(await screen.findByText('Assistente Comercial')).toBeInTheDocument()
    const atualizar = screen.getByRole('button', { name: /atualizar dados do painel/i })
    await userEvent.click(atualizar)
    expect(screen.getByRole('button', { name: /atualizando dados do painel/i })).toBeDisabled()

    concluirAtualizacao(dados)
    expect(await screen.findByRole('status')).toHaveTextContent(/dados do painel atualizados/i)
    await userEvent.click(screen.getByRole('button', { name: /fechar aviso/i }))

    vi.mocked(api.listarAgentes).mockRejectedValueOnce(new ApiError(503, 'INDISPONIVEL', 'Serviço indisponível.'))
    await userEvent.click(screen.getByRole('button', { name: /atualizar dados do painel/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/dados anteriores foram mantidos/i)
    expect(screen.getByText('Assistente Comercial')).toBeInTheDocument()
  })

  it('abre limite no 429 e toast em falhas comuns', async () => {
    vi.mocked(api.listarAgentes).mockResolvedValue({ data: [agente()] })
    const simular = vi.spyOn(api, 'simularExecucao')
      .mockRejectedValueOnce(new ApiError(429, 'LIMITE_PLANO_ATINGIDO', 'Cota', { usado: 100, limite: 100, retryAfterSegundos: 60 }))
      .mockRejectedValueOnce(new ApiError(500, 'ERRO', 'Falha controlada'))
      .mockRejectedValueOnce(new Error('falha'))
    renderizar(<DashboardPage />)
    const botao = await screen.findByRole('button', { name: /execução do agente assistente/i })
    await userEvent.click(botao)
    await userEvent.click(screen.getByRole('button', { name: /confirmar lote/i }))
    expect(await screen.findByRole('heading', { name: /cota mensal esgotada/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    await userEvent.click(botao)
    await userEvent.click(screen.getByRole('button', { name: /confirmar lote/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha controlada')
    await userEvent.click(screen.getByRole('button', { name: /confirmar lote/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível simular/i)
    expect(simular).toHaveBeenCalledTimes(3)
  })

  it('não renderiza sem sessão', () => {
    const { container } = renderizar(<DashboardPage />, { sessao: null })
    expect(container).toBeEmptyDOMElement()
  })

  it('abre um aviso explicativo quando o plano atinge o limite de agentes', async () => {
    vi.mocked(api.listarAgentes).mockResolvedValue({
      data: Array.from({ length: 5 }, (_, indice) => agente({ id: `agente-${indice}`, nome: `Agente ${indice}` })),
    })
    renderizar(<DashboardPage />)
    expect(await screen.findByText(/limite de 5 agentes do plano growth atingido/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /novo agente/i }))
    expect(screen.getByRole('heading', { name: /limite de agentes atingido/i })).toBeInTheDocument()
    expect(screen.getByText(/plano growth permite até 5 agentes/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /cadastrar agente/i })).not.toBeInTheDocument()
  })
})
