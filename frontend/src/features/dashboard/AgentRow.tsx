import { Activity, Archive, CalendarClock, CirclePause, ShieldX } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'

import { formatarDataHora, formatarNumero } from '../../lib/format'
import type { Agente } from '../../types/api'

interface AgentRowProps {
  agente: Agente
  indice: number
}

function obterStatus(agente: Agente) {
  if (agente.status === 'pausado') {
    return { rotulo: 'Pausado', Icone: CirclePause, classe: 'bg-amber-50 text-amber-800 ring-amber-200' }
  }
  if (agente.status === 'arquivado') {
    return { rotulo: 'Arquivado', Icone: Archive, classe: 'bg-slate-100 text-slate-700 ring-slate-200' }
  }
  if (agente.bloqueado) {
    return { rotulo: 'Cota esgotada', Icone: ShieldX, classe: 'bg-red-50 text-red-800 ring-red-200' }
  }
  return { rotulo: 'Ativo', Icone: Activity, classe: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }
}

function AgentRowComponent({ agente, indice }: AgentRowProps) {
  const reduzirMovimento = useReducedMotion()
  const status = obterStatus(agente)
  const percentualAgente = Math.min(
    100,
    (agente.consumo.execucoesMesAgente / agente.consumo.limiteMensal) * 100,
  )

  return (
    <motion.li
      className="grid gap-7 border-b border-slate-200 py-7 first:border-t lg:grid-cols-[minmax(0,1fr)_minmax(25rem,0.72fr)] lg:items-center"
      initial={reduzirMovimento ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(indice * 0.055, 0.22), duration: 0.35 }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="truncate text-lg font-semibold tracking-[-0.02em] text-slate-950">{agente.nome}</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.classe}`}>
            <status.Icone className="size-3.5" aria-hidden="true" />
            {status.rotulo}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {agente.descricao || 'Sem descrição cadastrada.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          <span>{formatarNumero(agente.totalExecucoes)} execuções realizadas</span>
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {agente.ultimaExecucaoEm
              ? `Última em ${formatarDataHora(agente.ultimaExecucaoEm)}`
              : 'Nenhuma execução registrada'}
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 px-5 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Consumo deste agente</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {formatarNumero(agente.consumo.execucoesMesAgente)}
              <span className="ml-1.5 text-sm font-normal text-slate-500">execuções no mês</span>
            </p>
          </div>
          <p className="shrink-0 text-xs font-medium text-slate-500">
            de {formatarNumero(agente.consumo.limiteMensal)}
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${percentualAgente}%` }} />
        </div>
        <p className="sr-only">
          Este agente consumiu {agente.consumo.execucoesMesAgente} das {agente.consumo.limiteMensal} execuções disponíveis no pool do cliente.
        </p>
      </div>
    </motion.li>
  )
}

export const AgentRow = memo(AgentRowComponent)
