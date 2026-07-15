import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { AppShell } from '../../components/AppShell'
import { ErrorState } from '../../components/ErrorState'
import { StatusToast, type Aviso } from '../../components/StatusToast'
import { ApiError, api } from '../../lib/api'
import type { Agente, DetalhesLimite, SimulacaoExecucao } from '../../types/api'
import { NewAgentDialog } from '../agents/NewAgentDialog'
import { useAuth } from '../auth/authContext'
import { HistoryDialog } from '../executions/HistoryDialog'
import { LimitDialog } from '../executions/LimitDialog'
import { SimulationDialog } from '../executions/SimulationDialog'
import { AgentList } from './AgentList'
import { DashboardSkeleton } from './DashboardSkeleton'
import { MetricTiles } from './MetricTiles'
import { UtilizacaoCard } from './UtilizacaoCard'

export function DashboardPage() {
  const { sessao, sair } = useAuth()
  const queryClient = useQueryClient()
  const [novoAgenteAberto, setNovoAgenteAberto] = useState(false)
  const [agenteHistorico, setAgenteHistorico] = useState<Agente | null>(null)
  const [agenteSimulacao, setAgenteSimulacao] = useState<Agente | null>(null)
  const [erroSimulacao, setErroSimulacao] = useState<string | null>(null)
  const [detalhesLimite, setDetalhesLimite] = useState<DetalhesLimite | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const token = sessao?.token ?? ''
  const clienteId = sessao?.cliente.id ?? 'sem-sessao'

  const consulta = useQuery({
    queryKey: ['agentes', clienteId],
    queryFn: () => {
      if (!token) throw new Error('Consulta de agentes sem sessão.')
      return api.listarAgentes(token)
    },
    enabled: Boolean(sessao),
  })

  const agentes = useMemo(() => consulta.data?.data ?? [], [consulta.data])

  /**
   * A cota é do CLIENTE, mas a API a devolve repetida em cada agente, porque a
   * view junta agente e cliente. Derivar aqui, uma vez, evita que cada
   * componente leia `agentes[0]` e quebre quando a lista está vazia.
   */
  const resumo = useMemo(() => {
    const primeiro = agentes[0]
    return {
      usado: primeiro?.consumo.execucoesMesCliente ?? 0,
      limite: primeiro?.consumo.limiteMensal ?? 0,
      percentual: primeiro?.consumo.percentualUsoCliente ?? 0,
      plano: primeiro?.plano.nome ?? 'n/d',
      limiteAgentes: consulta.data?.meta?.plano.limiteAgentes ?? primeiro?.plano.limiteAgentes ?? 0,
      total: consulta.data?.meta?.agentes.usado ?? agentes.length,
      ativos: agentes.filter((a) => a.status === 'ativo').length,
      pausados: agentes.filter((a) => a.status !== 'ativo').length,
      bloqueados: agentes.filter((a) => a.bloqueado && a.status === 'ativo').length,
    }
  }, [agentes, consulta.data?.meta])

  const simulacao = useMutation({
    mutationFn: ({ agente, dados }: { agente: Agente; dados: SimulacaoExecucao }) => {
      if (!token) throw new Error('Simulação solicitada sem sessão.')
      return api.simularExecucao(token, agente.id, dados)
    },
    onSuccess: async (_data, { agente, dados }) => {
      setAgenteSimulacao(null)
      setAviso({ tipo: 'sucesso', mensagem: `${dados.quantidadeExecucoes} execuções de ${agente.nome} processadas. A cota foi atualizada.` })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agentes', clienteId] }),
        queryClient.invalidateQueries({ queryKey: ['execucoes', agente.id] }),
      ])
    },
    onError: async (erro, { agente }) => {
      if (erro instanceof ApiError && erro.codigo === 'LIMITE_PLANO_ATINGIDO' && saoDetalhesLimite(erro.detalhes)) {
        setDetalhesLimite(erro.detalhes)
        setAgenteSimulacao(null)
        // A tentativa recusada foi gravada pela API, então a lista e o histórico
        // mudaram mesmo o request tendo "falhado". Sem invalidar, a tela mentiria.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['agentes', clienteId] }),
          queryClient.invalidateQueries({ queryKey: ['execucoes', agente.id] }),
        ])
        return
      }
      setErroSimulacao(erro instanceof ApiError ? erro.message : 'Não foi possível simular as execuções.')
    },
  })

  const fecharAviso = useCallback(() => setAviso(null), [])
  const abrirHistorico = useCallback((agente: Agente) => setAgenteHistorico(agente), [])
  const simular = useCallback((agente: Agente) => { setErroSimulacao(null); setAgenteSimulacao(agente) }, [])
  const limiteAgentesAtingido = resumo.limiteAgentes > 0 && resumo.total >= resumo.limiteAgentes

  async function atualizarPainel() {
    setAviso(null)
    const resultado = await consulta.refetch()

    if (resultado.isSuccess) {
      setAviso({ tipo: 'sucesso', mensagem: 'Dados do painel atualizados.' })
      return
    }

    const mensagem = resultado.error instanceof ApiError ? resultado.error.message : 'A API não respondeu.'
    setAviso({
      tipo: 'erro',
      mensagem: `Não foi possível atualizar: ${mensagem} Os dados anteriores foram mantidos.`,
    })
  }

  if (!sessao) return null

  return (
    <AppShell
      titulo="Painel de agentes"
      cliente={sessao.cliente}
      aoSair={sair}
      acoes={
        <>
          <a className="pill hidden sm:inline-flex" href="https://rotik.io/" target="_blank" rel="noopener noreferrer">
            <BookOpen className="size-3.5" aria-hidden="true" />
            Guia de uso
          </a>
          <button
            className="pill"
            type="button"
            onClick={() => void atualizarPainel()}
            disabled={consulta.isFetching}
            aria-busy={consulta.isFetching}
            title={consulta.isFetching ? 'Atualizando dados do painel' : 'Buscar dados mais recentes'}
          >
            <RefreshCw
              className={`size-3.5 ${consulta.isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline" aria-live="polite">
              {consulta.isFetching ? 'Atualizando...' : 'Atualizar'}
            </span>
            <span className="sr-only sm:hidden" aria-live="polite">
              {consulta.isFetching ? 'Atualizando dados do painel' : 'Atualizar dados do painel'}
            </span>
          </button>
          <button className="button-primary h-9 text-xs" type="button" onClick={() => setNovoAgenteAberto(true)} disabled={limiteAgentesAtingido} title={limiteAgentesAtingido ? `Limite de ${resumo.limiteAgentes} agentes do plano atingido` : undefined}>
            <Plus className="size-3.5" aria-hidden="true" />
            Novo agente
          </button>
        </>
      }
    >
      {/* pb no mobile abre espaço para o rail, que vira barra inferior fixa. */}
      <div className="mx-auto max-w-[80rem] pb-20 sm:pb-0" id="conteudo">
        {consulta.isPending ? (
          <DashboardSkeleton />
        ) : consulta.isError && !consulta.data ? (
          <ErrorState
            mensagem={
              consulta.error instanceof ApiError
                ? consulta.error.message
                : 'Ocorreu uma falha inesperada ao consultar a API.'
            }
            aoTentarNovamente={() => void consulta.refetch()}
          />
        ) : (
          <>
            {/* Bento: métricas ocupam a largura, utilização ancora a direita.
                A cota fica na coluna que o olho alcança depois do resumo, e
                permanece visível enquanto a lista rola. */}
            <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
              <MetricTiles
                ativos={resumo.ativos}
                pausados={resumo.pausados}
                bloqueados={resumo.bloqueados}
                execucoesMes={resumo.usado}
                limiteMensal={resumo.limite}
              />
              <UtilizacaoCard
                usado={resumo.usado}
                limite={resumo.limite}
                percentual={resumo.percentual}
                totalAgentes={resumo.total}
                limiteAgentes={resumo.limiteAgentes}
                planoNome={resumo.plano}
              />
            </div>

            <section className="panel mt-4 p-5" aria-labelledby="titulo-agentes">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-hi" id="titulo-agentes">
                    Agentes
                  </h2>
                  <p className="mt-0.5 text-xs text-lo">
                    {limiteAgentesAtingido
                      ? `Limite de ${resumo.limiteAgentes} agentes do plano ${resumo.plano} atingido`
                      : resumo.total === 1 ? '1 agente nesta conta' : `${resumo.total} agentes nesta conta`}
                  </p>
                </div>
              </div>

              <AgentList
                agentes={agentes}
                aoAbrirHistorico={abrirHistorico}
                aoSimular={simular}
                aoNovoAgente={() => setNovoAgenteAberto(true)}
              />
            </section>
          </>
        )}
      </div>

      <NewAgentDialog aberto={novoAgenteAberto} aoFechar={() => setNovoAgenteAberto(false)} limite={resumo.limiteAgentes ? { usado: resumo.total, limite: resumo.limiteAgentes } : undefined} />
      <SimulationDialog agente={agenteSimulacao} enviando={simulacao.isPending} erro={erroSimulacao} aoFechar={() => setAgenteSimulacao(null)} aoConfirmar={(dados) => agenteSimulacao && simulacao.mutate({ agente: agenteSimulacao, dados })} />
      <HistoryDialog agente={agenteHistorico} aoFechar={() => setAgenteHistorico(null)} />
      <LimitDialog detalhes={detalhesLimite} aoFechar={() => setDetalhesLimite(null)} />
      <StatusToast aviso={aviso} aoFechar={fecharAviso} />
    </AppShell>
  )
}

function saoDetalhesLimite(valor: unknown): valor is DetalhesLimite {
  return Boolean(
    valor &&
      typeof valor === 'object' &&
      'usado' in valor &&
      typeof valor.usado === 'number' &&
      'limite' in valor &&
      typeof valor.limite === 'number' &&
      'retryAfterSegundos' in valor &&
      typeof valor.retryAfterSegundos === 'number',
  )
}
