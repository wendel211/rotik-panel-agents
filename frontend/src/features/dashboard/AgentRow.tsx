import { History, LoaderCircle, PauseCircle, Play } from 'lucide-react'
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

type MotivoBloqueio = 'cota' | 'pausado' | 'arquivado' | null

/**
 * `bloqueado` chega `true` por dois motivos diferentes: a cota do cliente
 * esgotou, ou o agente não está `ativo`. Tratar os dois como o mesmo estado
 * mentiria para o operador: um exige decisão comercial (upgrade de plano), o
 * outro é só um agente desligado de propósito.
 */
function obterMotivo(agente: Agente): MotivoBloqueio {
  if (agente.status === 'pausado') return 'pausado'
  if (agente.status === 'arquivado') return 'arquivado'
  if (agente.bloqueado) return 'cota'
  return null
}

function AgentRowComponent({ agente, indice, simulando, aoAbrirHistorico, aoSimular }: AgentRowProps) {
  const reduzirMovimento = useReducedMotion()
  const motivo = obterMotivo(agente)
  const podeSimular = motivo === null

  return (
    <motion.li
      className="panel-tile relative overflow-hidden p-4 transition-colors duration-200 hover:border-brand-700/40"
      initial={reduzirMovimento ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Escalonado, mas com teto: em uma lista longa, atraso proporcional faria
      // o último item aparecer segundos depois.
      transition={{ delay: Math.min(indice * 0.05, 0.3), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Faixa de estado. Redundante com o selo de propósito: cor sozinha não
          pode carregar significado (WCAG 1.4.1). */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-0.5 ${
          motivo === 'cota' ? 'bg-danger' : motivo ? 'bg-warn' : 'bg-ok/60'
        }`}
      />

      <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-hi">{agente.nome}</h3>
            <Selo motivo={motivo} />
          </div>

          {agente.descricao && (
            <p className="mt-1 line-clamp-1 text-xs leading-5 text-lo">{agente.descricao}</p>
          )}

          <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-lo">
            <div className="flex items-center gap-1.5">
              <dt>Neste mês:</dt>
              {/* Atribuição por agente, em número absoluto e não em barra: a cota
                  é do cliente, então uma barra aqui repetiria o mesmo percentual
                  em todas as linhas e leria como bug. */}
              <dd className="font-mono font-semibold tabular-nums text-hi">
                {formatarNumero(agente.consumo.execucoesMesAgente)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>Total:</dt>
              <dd className="font-mono tabular-nums">{formatarNumero(agente.totalExecucoes)}</dd>
            </div>
            <div>
              <dt className="sr-only">Última execução</dt>
              <dd>
                {agente.ultimaExecucaoEm
                  ? `Última ${formatarDataHora(agente.ultimaExecucaoEm)}`
                  : 'Nunca executou'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="btn-dark h-9"
            onClick={() => aoSimular(agente)}
            disabled={!podeSimular || simulando}
            title={
              motivo === 'cota'
                ? 'A cota da conta esgotou'
                : motivo
                  ? `Agente ${motivo}`
                  : 'Registrar uma execução de demonstração'
            }
          >
            {simulando ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{simulando ? 'Executando' : 'Simular'}</span>
            <span className="sr-only">execução do agente {agente.nome}</span>
          </button>

          <button type="button" className="btn-dark h-9" onClick={() => aoAbrirHistorico(agente)}>
            <History className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Histórico</span>
            <span className="sr-only">de execuções de {agente.nome}</span>
          </button>
        </div>
      </div>
    </motion.li>
  )
}

function Selo({ motivo }: { motivo: MotivoBloqueio }) {
  if (motivo === 'cota') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2 py-0.5 text-[0.68rem] font-semibold text-danger">
        <span className="size-1.5 rounded-full bg-danger animate-pulse-ring" aria-hidden="true" />
        Bloqueado por cota
      </span>
    )
  }

  if (motivo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2 py-0.5 text-[0.68rem] font-semibold capitalize text-warn">
        <PauseCircle className="size-3" aria-hidden="true" />
        {motivo}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-2 py-0.5 text-[0.68rem] font-medium text-ok">
      <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
      Ativo
    </span>
  )
}

export const AgentRow = memo(AgentRowComponent)
