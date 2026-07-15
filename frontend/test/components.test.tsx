import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from '../src/components/AppShell'
import { BarraFill } from '../src/components/BarraFill'
import { Dialog } from '../src/components/Dialog'
import { ErrorState } from '../src/components/ErrorState'
import { StatusToast } from '../src/components/StatusToast'
import { AgentList } from '../src/features/dashboard/AgentList'
import { AgentRow } from '../src/features/dashboard/AgentRow'
import { MetricTiles } from '../src/features/dashboard/MetricTiles'
import { UtilizacaoCard } from '../src/features/dashboard/UtilizacaoCard'
import { LimitDialog } from '../src/features/executions/LimitDialog'
import { agente } from './helpers'

describe('componentes de base', () => {
  it('anima, limita e desmonta a barra', () => {
    vi.useFakeTimers()
    const { container, unmount, rerender } = render(<BarraFill largura={2} cor="bg-ok" pulsar atraso={0.2} />)
    const barra = container.firstElementChild as HTMLElement
    expect(barra).toHaveStyle({ transform: 'scaleX(0)', transitionDelay: '0.2s' })
    expect(barra).toHaveClass('animate-sheen')
    act(() => vi.advanceTimersByTime(40))
    expect(barra).toHaveStyle({ transform: 'scaleX(1)' })
    rerender(<BarraFill largura={-1} cor="bg-ok" />)
    expect(barra).toHaveStyle({ transform: 'scaleX(0)' })
    unmount()
    vi.useRealTimers()
  })

  it('abre o dialog, fecha por cancelamento e restaura scroll/foco', async () => {
    const fechar = vi.fn()
    const { rerender } = render(
      <>
        <button>Anterior</button>
        <Dialog aberto={false} aoFechar={fechar} ariaLabelledby="titulo"><h2 id="titulo">Janela</h2></Dialog>
      </>,
    )
    screen.getByRole('button', { name: 'Anterior' }).focus()
    rerender(
      <>
        <button>Anterior</button>
        <Dialog aberto aoFechar={fechar} ariaLabelledby="titulo"><h2 id="titulo">Janela</h2></Dialog>
      </>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(fechar).toHaveBeenCalled()
    rerender(<Dialog aberto={false} aoFechar={fechar} ariaLabelledby="titulo"><h2 id="titulo">Janela</h2></Dialog>)
    expect(document.body.style.overflow).toBe('')
  })

  it('fecha o dialog ao clicar no backdrop', () => {
    const fechar = vi.fn()
    render(<Dialog aberto aoFechar={fechar} ariaLabelledby="titulo"><h2 id="titulo">Janela</h2></Dialog>)
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(fechar).toHaveBeenCalled()
  })

  it('exibe erro acionável e toast temporário/manual', async () => {
    const tentar = vi.fn()
    const { rerender } = render(<ErrorState mensagem="API indisponível" aoTentarNovamente={tentar} />)
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(tentar).toHaveBeenCalled()

    vi.useFakeTimers()
    const fechar = vi.fn()
    rerender(<StatusToast aviso={{ tipo: 'sucesso', mensagem: 'Salvo' }} aoFechar={fechar} />)
    expect(screen.getByRole('status')).toHaveTextContent('Salvo')
    act(() => vi.advanceTimersByTime(4500))
    expect(fechar).toHaveBeenCalled()
    rerender(<StatusToast aviso={{ tipo: 'erro', mensagem: 'Falhou' }} aoFechar={fechar} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou')
    fireEvent.click(screen.getByRole('button', { name: /fechar aviso/i }))
    expect(fechar).toHaveBeenCalledTimes(2)
    rerender(<StatusToast aviso={null} aoFechar={fechar} />)
    vi.useRealTimers()
  })
})

describe('shell e indicadores', () => {
  it('alterna tema e controla o menu da conta por clique, Escape e clique externo', async () => {
    const sair = vi.fn()
    render(<AppShell titulo="Painel" cliente={{ nome: 'Acme Operações', email: 'cs@acme.dev' }} aoSair={sair}>Conteúdo</AppShell>)
    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
    const tema = screen.getByRole('button', { name: /tema claro/i })
    await userEvent.click(tema)
    expect(tema).toHaveAttribute('aria-pressed', 'true')

    const conta = screen.getByRole('button', { name: /conta de acme/i })
    await userEvent.click(conta)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(conta).toHaveFocus()

    await userEvent.click(conta)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await userEvent.click(conta)
    await userEvent.click(screen.getByRole('menuitem', { name: /sair/i }))
    expect(sair).toHaveBeenCalled()
    expect(screen.getAllByText(/indisponível neste MVP/i)).toHaveLength(3)
  })

  it('representa métricas normais, em risco e esgotadas', () => {
    const { rerender } = render(<MetricTiles ativos={0} pausados={0} bloqueados={0} execucoesMes={0} limiteMensal={0} />)
    expect(screen.getByText('Ativos')).toBeInTheDocument()
    rerender(<MetricTiles ativos={3} pausados={1} bloqueados={1} execucoesMes={90} limiteMensal={100} />)
    expect(screen.getByText('Bloqueados').closest('div')).toBeTruthy()

    rerender(<UtilizacaoCard usado={20} limite={100} percentual={20} totalAgentes={0} limiteAgentes={5} planoNome="Growth" />)
    expect(screen.getByText(/reinicia na virada/i)).toBeInTheDocument()
    rerender(<UtilizacaoCard usado={85} limite={100} percentual={85} totalAgentes={4} limiteAgentes={5} planoNome="Growth" />)
    expect(screen.getByText(/restam/i)).toBeInTheDocument()
    rerender(<UtilizacaoCard usado={100} limite={100} percentual={100} totalAgentes={4} limiteAgentes={5} planoNome="Growth" />)
    expect(screen.getByText(/cota esgotada/i)).toBeInTheDocument()
    rerender(<UtilizacaoCard usado={0} limite={0} percentual={0} totalAgentes={0} limiteAgentes={0} planoNome="indisponível" />)
    expect(screen.getByText(/após cadastrar o primeiro agente/i)).toBeInTheDocument()
    expect(screen.queryByText(/cota esgotada/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(2)
  })
})

describe('agentes e limite', () => {
  it('renderiza os estados e aciona simulação/histórico', async () => {
    const simular = vi.fn()
    const historico = vi.fn()
    const base = agente()
    const { rerender } = render(<AgentRow agente={base} indice={20} simulando={false} aoSimular={simular} aoAbrirHistorico={historico} />)
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /execução do agente/i }))
    await userEvent.click(screen.getByRole('button', { name: /execuções de/i }))
    expect(simular).toHaveBeenCalledWith(base)
    expect(historico).toHaveBeenCalledWith(base)

    const bloqueado = agente({ bloqueado: true })
    rerender(<AgentRow agente={bloqueado} indice={0} simulando={false} aoSimular={simular} aoAbrirHistorico={historico} />)
    expect(screen.getByText(/bloqueado por cota/i)).toBeInTheDocument()
    expect(screen.getByText('Tentar')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /execução do agente/i }))
    expect(simular).toHaveBeenCalledWith(bloqueado)
    rerender(<AgentRow agente={agente({ status: 'pausado', ultimaExecucaoEm: null, descricao: null })} indice={0} simulando={false} aoSimular={simular} aoAbrirHistorico={historico} />)
    expect(screen.getByText('pausado')).toBeInTheDocument()
    expect(screen.getByText(/nunca executou/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /execução do agente/i })).toBeDisabled()
    rerender(<AgentRow agente={agente({ status: 'arquivado' })} indice={0} simulando aoSimular={simular} aoAbrirHistorico={historico} />)
    expect(screen.getByText('arquivado')).toBeInTheDocument()
  })

  it('oferece uma saída no vazio e lista múltiplos agentes', async () => {
    const novo = vi.fn()
    const props = { simulandoId: null, aoAbrirHistorico: vi.fn(), aoSimular: vi.fn(), aoNovoAgente: novo }
    const { rerender } = render(<AgentList agentes={[]} {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /cadastrar agente/i }))
    expect(novo).toHaveBeenCalled()
    rerender(<AgentList agentes={[agente(), agente({ id: '2', nome: 'Suporte' })]} {...props} />)
    expect(screen.getByRole('list', { name: /agentes cadastrados/i })).toBeInTheDocument()
  })

  it('detalha e fecha o bloqueio de cota', async () => {
    const fechar = vi.fn()
    const { rerender } = render(<LimitDialog detalhes={null} aoFechar={fechar} />)
    rerender(<LimitDialog detalhes={{ usado: 100, limite: 100, retryAfterSegundos: 60 }} aoFechar={fechar} />)
    expect(screen.getByText(/100 de 100/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(fechar).toHaveBeenCalled()
  })
})
