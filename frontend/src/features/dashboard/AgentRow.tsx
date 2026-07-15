import { Activity, Archive, CalendarClock, CirclePause, FlaskConical, History, LoaderCircle, ShieldX } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'

import { formatarDataHora, formatarNumero } from '../../lib/format'
import type { Agente } from '../../types/api'

interface AgentRowProps {
  agente: Agente
  indice: number
  simulando: boolean
  aoAbrirHistorico: (agente: Agente) => void
  aoSimular: (agente: Agente) => void
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

function AgentRowComponent({ agente, indice, simulando, aoAbrirHistorico, aoSimular }: AgentRowProps) {
  const reduzirMovimento = useReducedMotion()
  const status = obterStatus(agente)
  const percentualAgente = Math.min(
    100,
    (agente.consumo.execucoesMesAgente / agente.consumo.limiteMensal) * 100,
  )

  return (
    <motion.li
      className="grid gap-5 border-b border-line px-6 py-6 last:border-b-0 hover:bg-[#fbfcff] lg:grid-cols-[minmax(0,1.45fr)_minmax(11rem,.65fr)_9rem_minmax(15rem,.75fr)] lg:items-center lg:gap-6 lg:px-7"
      initial={reduzirMovimento ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(indice * 0.05, 0.2), duration: 0.32 }}
    >
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold tracking-[-0.015em] text-ink">{agente.nome}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">
          {agente.descricao || 'Sem descrição cadastrada.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-subtle">
          <span>{formatarNumero(agente.totalExecucoes)} execuções no total</span>
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {agente.ultimaExecucaoEm
              ? `Última em ${formatarDataHora(agente.ultimaExecucaoEm)}`
              : 'Nenhuma execução registrada'}
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">
          {formatarNumero(agente.consumo.execucoesMesAgente)}
          <span className="ml-1.5 font-normal text-muted">execuções</span>
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-700" style={{ width: `${percentualAgente}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-subtle">{percentualAgente.toFixed(1).replace('.', ',')}% do limite da conta</p>
        <p className="sr-only">
          Este agente consumiu {formatarNumero(agente.consumo.execucoesMesAgente)} das {formatarNumero(agente.consumo.limiteMensal)} execuções disponíveis no pool do cliente.
        </p>
      </div>

      <div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.classe}`}>
          <status.Icone className="size-3.5" aria-hidden="true" />
          {status.rotulo}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <button className="button-secondary h-9 px-3" type="button" onClick={() => aoAbrirHistorico(agente)}>
          <History className="size-4" aria-hidden="true" />
          Histórico
        </button>
        <button
          className="button-primary h-9 px-3"
          type="button"
          onClick={() => aoSimular(agente)}
          disabled={agente.status !== 'ativo' || simulando}
          title={agente.status !== 'ativo' ? 'Agentes inativos não aceitam execuções' : 'Recurso de demonstração'}
        >
          {simulando ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FlaskConical className="size-4" aria-hidden="true" />}
          {simulando ? 'Simulando...' : agente.bloqueado ? 'Tentar execução' : 'Simular'}
        </button>
      </div>
    </motion.li>
  )
}

export const AgentRow = memo(AgentRowComponent)
