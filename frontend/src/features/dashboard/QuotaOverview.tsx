import { AlertTriangle, CheckCircle2, Gauge, ShieldAlert } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { formatarMesAtual, formatarNumero } from '../../lib/format'
import type { Agente } from '../../types/api'

interface QuotaOverviewProps {
  agente: Agente
}

export function QuotaOverview({ agente }: QuotaOverviewProps) {
  const reduzirMovimento = useReducedMotion()
  const { consumo, plano } = agente
  const percentual = Math.min(100, consumo.percentualUsoCliente)
  const esgotada = consumo.restante === 0
  const emAlerta = percentual >= 80 && !esgotada

  const Icone = esgotada ? ShieldAlert : emAlerta ? AlertTriangle : CheckCircle2
  const corProgresso = esgotada ? 'bg-red-500' : emAlerta ? 'bg-amber-400' : 'bg-blue-400'

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#102e72] px-6 py-7 text-white shadow-[0_24px_70px_-42px_rgba(13,44,114,.9)] sm:px-9 sm:py-8">
      <div className="pointer-events-none absolute -right-24 -top-36 size-80 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-12 -top-20 size-56 rounded-full border border-white/10" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-blue-100">
              <Gauge className="size-4" aria-hidden="true" />
              Cota mensal do cliente
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-blue-50">
              Plano {plano.nome}
            </span>
          </div>

          <div className="mt-6 flex items-end gap-3">
            <strong className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {formatarNumero(consumo.execucoesMesCliente)}
            </strong>
            <span className="pb-1 text-lg text-blue-200">
              de {formatarNumero(consumo.limiteMensal)} execuções
            </span>
          </div>

          <div
            className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-label="Consumo da cota mensal do cliente"
            aria-valuemin={0}
            aria-valuemax={consumo.limiteMensal}
            aria-valuenow={consumo.execucoesMesCliente}
            aria-valuetext={`${consumo.percentualUsoCliente}% da cota usada`}
          >
            <motion.div
              className={`h-full rounded-full ${corProgresso}`}
              initial={reduzirMovimento ? false : { width: 0 }}
              animate={{ width: `${percentual}%` }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-white">{consumo.percentualUsoCliente}% utilizado</span>
            <span className="text-blue-200">{formatarMesAtual()}</span>
          </div>
        </div>

        <div className="flex max-w-sm gap-3 border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pb-1 lg:pl-8 lg:pt-0">
          <Icone className={`mt-0.5 size-5 shrink-0 ${esgotada ? 'text-red-300' : emAlerta ? 'text-amber-300' : 'text-blue-300'}`} aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {esgotada
                ? 'Cota esgotada'
                : emAlerta
                  ? 'Conta próxima do limite'
                  : `${formatarNumero(consumo.restante)} execuções disponíveis`}
            </p>
            <p className="mt-1 text-sm leading-6 text-blue-100/75">
              {esgotada
                ? 'Todos os agentes ativos estão bloqueados até a próxima competência.'
                : 'Este pool é compartilhado por todos os agentes desta conta.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
