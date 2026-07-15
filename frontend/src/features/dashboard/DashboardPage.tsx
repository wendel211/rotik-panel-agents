import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, LogOut, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

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
    <div className="min-h-svh bg-[#f5f7fb]">
      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[76rem] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-[#0d2c72] text-xs font-black text-white">R</span>
              <span className="font-bold tracking-[0.16em] text-[#0d2c72]">ROTIK</span>
            </div>
            <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <span className="hidden items-center gap-2 text-sm font-medium text-slate-600 sm:flex">
              <Bot className="size-4 text-blue-600" aria-hidden="true" />
              Monitoramento
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="max-w-52 truncate text-sm font-semibold text-slate-800">{sessao.cliente.nome}</p>
              <p className="max-w-52 truncate text-xs text-slate-500">{sessao.cliente.email}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-800 ring-1 ring-blue-100">
              {obterIniciais(sessao.cliente.nome)}
            </span>
            <button
              className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
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

      <main className="mx-auto max-w-[76rem] px-5 py-9 sm:px-8 sm:py-12">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-700">Visão da conta</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Agentes de IA</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-500">
            Acompanhe a cota compartilhada e identifique quais agentes concentram o consumo.
          </p>
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

            <section className={agentes.length > 0 ? 'mt-12' : 'mt-2'} aria-labelledby="titulo-agentes">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950" id="titulo-agentes">Agentes cadastrados</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {agentes.length === 1 ? '1 agente nesta conta' : `${agentes.length} agentes nesta conta`}
                  </p>
                </div>
                <button className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700" type="button" onClick={() => setNovoAgenteAberto(true)}>
                  <Plus className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Novo agente</span>
                  <span className="sm:hidden">Novo</span>
                </button>
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
