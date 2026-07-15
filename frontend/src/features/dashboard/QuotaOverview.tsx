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
  const corProgresso = esgotada ? 'bg-red-400' : emAlerta ? 'bg-amber-300' : 'bg-brand-600'

  return (
    <section className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-brand-950 text-white shadow-[var(--shadow-panel)]" aria-labelledby="titulo-cota">
      <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,.75fr)]">
        <div className="min-w-0 px-6 py-7 sm:px-8 sm:py-8 lg:px-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-[#b9c7e6]">
              <Gauge className="size-4 text-brand-300" aria-hidden="true" />
              <span id="titulo-cota">Cota mensal da conta</span>
            </span>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-semibold text-brand-100 ring-1 ring-inset ring-white/10">
              Plano {plano.nome}
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-end gap-x-3 gap-y-1">
            <strong className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              {formatarNumero(consumo.execucoesMesCliente)}
            </strong>
            <span className="pb-1 text-base text-[#8390ac] sm:text-lg">
              de {formatarNumero(consumo.limiteMensal)} execuções
            </span>
          </div>

          <div
            className="mt-7 h-2 overflow-hidden rounded-full bg-white/12"
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
            <span className="text-[#8390ac]">{formatarMesAtual()}</span>
          </div>
        </div>

        <div className="grid border-t border-white/10 bg-brand-900/70 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-t-0">
          <div className="px-6 py-5 sm:px-7 lg:flex lg:flex-col lg:justify-center lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8390ac]">Disponível</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
              {formatarNumero(consumo.restante)}
              <span className="ml-2 text-sm font-normal text-[#8390ac]">execuções</span>
            </p>
          </div>
          <div className="border-t border-white/10 px-6 py-5 sm:border-l sm:border-t-0 sm:px-7 lg:flex lg:items-center lg:border-l-0 lg:border-t lg:px-8">
            <div className="flex gap-3">
              <Icone className={`mt-0.5 size-5 shrink-0 ${esgotada ? 'text-red-300' : emAlerta ? 'text-amber-300' : 'text-brand-300'}`} aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  {esgotada ? 'Cota esgotada' : emAlerta ? 'Próxima do limite' : 'Operação saudável'}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#a8b6d3]">
                  {esgotada
                    ? 'Todos os agentes ativos estão bloqueados até a próxima competência.'
                    : 'O saldo é compartilhado por todos os agentes desta conta.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
