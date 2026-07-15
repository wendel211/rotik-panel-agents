import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, LogOut, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

import { BrandLogo } from '../../components/BrandLogo'
import { ErrorState } from '../../components/ErrorState'
import { StatusToast, type Aviso } from '../../components/StatusToast'
import { ApiError, api } from '../../lib/api'
import { obterIniciais } from '../../lib/format'
import type { Agente, DetalhesLimite } from '../../types/api'
import { NewAgentDialog } from '../agents/NewAgentDialog'
import { useAuth } from '../auth/authContext'
import { HistoryDialog } from '../executions/HistoryDialog'
import { LimitDialog } from '../executions/LimitDialog'
import { AgentList } from './AgentList'
import { DashboardSkeleton } from './DashboardSkeleton'
import { QuotaOverview } from './QuotaOverview'

export function DashboardPage() {
  const { sessao, sair } = useAuth()
  const queryClient = useQueryClient()
  const [novoAgenteAberto, setNovoAgenteAberto] = useState(false)
  const [agenteHistorico, setAgenteHistorico] = useState<Agente | null>(null)
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

  const agentes = consulta.data?.data ?? []

  const simulacao = useMutation({
    mutationFn: (agente: Agente) => {
      if (!token) throw new Error('Simulação solicitada sem sessão.')
      return api.simularExecucao(token, agente.id)
    },
    onSuccess: async (_data, agente) => {
      setAviso({ tipo: 'sucesso', mensagem: `Execução de ${agente.nome} registrada. A cota foi atualizada.` })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agentes', clienteId] }),
        queryClient.invalidateQueries({ queryKey: ['execucoes', agente.id] }),
      ])
    },
    onError: async (erro, agente) => {
      if (erro instanceof ApiError && erro.codigo === 'LIMITE_PLANO_ATINGIDO' && saoDetalhesLimite(erro.detalhes)) {
        setDetalhesLimite(erro.detalhes)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['agentes', clienteId] }),
          queryClient.invalidateQueries({ queryKey: ['execucoes', agente.id] }),
        ])
        return
      }
      setAviso({ tipo: 'erro', mensagem: erro instanceof ApiError ? erro.message : 'Não foi possível simular a execução.' })
    },
  })

  const fecharAviso = useCallback(() => setAviso(null), [])

  if (!sessao) return null

  return (
    <div className="min-h-svh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-950/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[82rem] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-5">
            <BrandLogo />
            <span className="hidden h-6 w-px bg-white/15 sm:block" aria-hidden="true" />
            <span className="hidden items-center gap-2 text-sm font-medium text-[#b9c7e6] sm:flex">
              <Activity className="size-4 text-brand-300" aria-hidden="true" />
              Painel de agentes
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-52 truncate text-sm font-semibold text-white">{sessao.cliente.nome}</p>
              <p className="max-w-52 truncate text-xs text-[#8390ac]">{sessao.cliente.email}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white ring-1 ring-white/15">
              {obterIniciais(sessao.cliente.nome)}
            </span>
            <button
              className="grid size-9 place-items-center rounded-xl text-[#8390ac] transition hover:bg-white/10 hover:text-white"
              type="button"
              onClick={sair}
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut className="size-[1.1rem]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[82rem] px-5 py-8 sm:px-8 sm:py-11">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Visão operacional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
              Monitoramento de agentes
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Acompanhe a cota compartilhada, o consumo individual e o histórico de cada agente.
            </p>
          </div>
          <button className="button-primary h-11 shrink-0 self-start sm:self-auto" type="button" onClick={() => setNovoAgenteAberto(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Novo agente
          </button>
        </div>

        {consulta.isPending ? (
          <DashboardSkeleton />
        ) : consulta.isError ? (
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
            {agentes[0] && <QuotaOverview agente={agentes[0]} />}

            <section className={agentes.length > 0 ? 'mt-9' : 'mt-2'} aria-labelledby="titulo-agentes">
              <div className="mb-4">
                <h2 className="text-xl font-semibold tracking-[-0.025em] text-ink" id="titulo-agentes">Agentes cadastrados</h2>
                <p className="mt-1 text-sm text-muted">
                  {agentes.length === 1 ? '1 agente nesta conta' : `${agentes.length} agentes nesta conta`}
                </p>
              </div>
              <AgentList
                agentes={agentes}
                simulandoId={simulacao.isPending ? simulacao.variables.id : null}
                aoAbrirHistorico={setAgenteHistorico}
                aoSimular={(agente) => simulacao.mutate(agente)}
                aoNovoAgente={() => setNovoAgenteAberto(true)}
              />
            </section>
          </>
        )}
      </main>
      <NewAgentDialog aberto={novoAgenteAberto} aoFechar={() => setNovoAgenteAberto(false)} />
      <HistoryDialog agente={agenteHistorico} aoFechar={() => setAgenteHistorico(null)} />
      <LimitDialog detalhes={detalhesLimite} aoFechar={() => setDetalhesLimite(null)} />
      <StatusToast aviso={aviso} aoFechar={fecharAviso} />
    </div>
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
