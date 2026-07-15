import { useInfiniteQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Clock3, History, LoaderCircle, ShieldX, X } from 'lucide-react'

import { Dialog } from '../../components/Dialog'
import { ApiError, api } from '../../lib/api'
import { formatarDataHora, formatarNumero } from '../../lib/format'
import type { Agente, Execucao, StatusExecucao } from '../../types/api'
import { useAuth } from '../auth/authContext'

const statusConfig: Record<StatusExecucao, { rotulo: string; Icone: typeof CheckCircle2; classe: string }> = {
  sucesso: { rotulo: 'Sucesso', Icone: CheckCircle2, classe: 'border-emerald-200 bg-emerald-50/70 text-emerald-800' },
  erro: { rotulo: 'Erro', Icone: AlertCircle, classe: 'border-amber-200 bg-amber-50/70 text-amber-900' },
  bloqueada: { rotulo: 'Bloqueada', Icone: ShieldX, classe: 'border-red-300 bg-red-50 text-red-900' },
}

function ExecucaoItem({ execucao }: { execucao: Execucao }) {
  const status = statusConfig[execucao.status]
  const totalTokens = (execucao.tokensEntrada ?? 0) + (execucao.tokensSaida ?? 0)

  return (
    <li className={`border-l-4 px-4 py-4 sm:px-5 ${status.classe}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <status.Icone className="size-4" aria-hidden="true" />
          <span className="text-sm font-semibold">{status.rotulo}</span>
        </div>
        <time className="text-xs text-slate-500" dateTime={execucao.criadoEm}>{formatarDataHora(execucao.criadoEm)}</time>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {execucao.duracaoMs !== null && <span>{formatarNumero(execucao.duracaoMs)} ms</span>}
        {totalTokens > 0 && <span>{formatarNumero(totalTokens)} tokens</span>}
        {execucao.duracaoMs === null && totalTokens === 0 && execucao.status === 'sucesso' && <span>Sem métricas adicionais</span>}
      </div>
      {execucao.mensagemErro && <p className="mt-3 text-sm leading-6 text-slate-700">{execucao.mensagemErro}</p>}
    </li>
  )
}

interface HistoryDialogProps {
  agente: Agente | null
  aoFechar: () => void
}

export function HistoryDialog({ agente, aoFechar }: HistoryDialogProps) {
  const { sessao } = useAuth()
  const consulta = useInfiniteQuery({
    queryKey: ['execucoes', agente?.id],
    queryFn: ({ pageParam }) => {
      if (!sessao || !agente) throw new Error('Histórico solicitado sem contexto.')
      return api.listarExecucoes(sessao.token, agente.id, pageParam)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultimaPagina) => ultimaPagina.proximoCursor ?? undefined,
    enabled: Boolean(sessao && agente),
  })

  const execucoes = consulta.data?.pages.flatMap((pagina) => pagina.data) ?? []

  return (
    <Dialog aberto={Boolean(agente)} aoFechar={aoFechar} ariaLabelledby="titulo-historico" className="max-w-3xl">
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 sm:px-7">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <History className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-950" id="titulo-historico">Histórico de {agente?.nome}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {agente ? `${formatarNumero(agente.totalExecucoes)} execuções realizadas no total` : 'Execuções do agente'}
            </p>
          </div>
        </div>
        <button className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" type="button" onClick={aoFechar} aria-label="Fechar histórico">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="max-h-[68svh] overflow-y-auto px-6 py-6 sm:px-7">
        {consulta.isPending ? (
          <div className="space-y-3" aria-label="Carregando histórico" aria-busy="true">
            {[0, 1, 2, 3].map((item) => <div className="h-24 animate-pulse rounded-xl bg-slate-100" key={item} />)}
          </div>
        ) : consulta.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center" role="alert">
            <AlertCircle className="mx-auto size-6 text-red-700" aria-hidden="true" />
            <p className="mt-3 font-semibold text-slate-900">Não foi possível carregar o histórico</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{consulta.error instanceof ApiError ? consulta.error.message : 'Tente novamente em instantes.'}</p>
            <button className="mt-4 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700" type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button>
          </div>
        ) : execucoes.length === 0 ? (
          <div className="py-12 text-center">
            <Clock3 className="mx-auto size-7 text-slate-400" aria-hidden="true" />
            <p className="mt-4 font-semibold text-slate-900">Nenhuma execução registrada</p>
            <p className="mt-2 text-sm text-slate-500">As tentativas deste agente aparecerão aqui.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-3" aria-label="Execuções do agente">
              {execucoes.map((execucao) => <ExecucaoItem execucao={execucao} key={execucao.id} />)}
            </ul>
            {consulta.hasNextPage && (
              <button className="mx-auto mt-6 flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60" type="button" onClick={() => void consulta.fetchNextPage()} disabled={consulta.isFetchingNextPage}>
                {consulta.isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                {consulta.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
