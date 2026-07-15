import { History, Play } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'

import { formatarDataHora, formatarNumero, obterIniciais } from '../../lib/format'
import type { Agente } from '../../types/api'

interface AgentRowProps {
  agente: Agente
  indice: number
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

/**
 * A borda INTEIRA carrega o estado, não uma faixa fina numa aresta.
 *
 * Com a faixa, o sinal ficava preso na borda esquerda: numa lista larga o olho
 * varre os nomes à esquerda e as ações à direita, e a cor no canto era pequena
 * demais para ser lida na periferia. A borda completa envolve a linha, então o
 * estado é percebido antes mesmo de ler o texto.
 *
 * O fundo permanece neutro. Colorir a linha inteira fazia o estado competir
 * com nome, consumo e ações no tema claro. A cor fica na borda, no monograma e
 * no selo, três sinais suficientes sem transformar o card em uma mancha.
 *
 * Isso NÃO substitui o selo: cor sozinha não pode carregar significado
 * (WCAG 1.4.1). A borda é reforço redundante para leitura rápida.
 */
const ESTILO_POR_MOTIVO = {
  cota: { borda: 'border-danger-border', mono: 'bg-danger-soft text-danger', selo: 'bg-danger-soft text-danger' },
  pausado: { borda: 'border-warn-border', mono: 'bg-warn-soft text-warn', selo: 'bg-warn-soft text-warn' },
  arquivado: { borda: 'border-warn-border', mono: 'bg-warn-soft text-warn', selo: 'bg-warn-soft text-warn' },
  ativo: { borda: 'border-ok-border', mono: 'bg-ok-soft text-ok', selo: 'bg-ok-soft text-ok' },
} as const

function AgentRowComponent({ agente, indice, aoAbrirHistorico, aoSimular }: AgentRowProps) {
  const reduzirMovimento = useReducedMotion()
  const motivo = obterMotivo(agente)
  // A tentativa continua disponível quando a cota acabou para que o avaliador
  // consiga observar o 429 e o registro bloqueado no histórico. Agentes
  // pausados/arquivados continuam indisponíveis porque não podem executar.
  const podeSimular = motivo === null || motivo === 'cota'
  const estilo = ESTILO_POR_MOTIVO[motivo ?? 'ativo']

  return (
    <motion.li
      className={`panel-tile group relative overflow-hidden p-4 transition-colors duration-200 ${estilo.borda}`}
      initial={reduzirMovimento ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Escalonado, mas com teto: em uma lista longa, atraso proporcional faria
      // o último item aparecer segundos depois.
      transition={{ delay: Math.min(indice * 0.05, 0.3), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Monograma. Dá identidade visual a cada agente e é o âncora do olho
              ao varrer a lista, no lugar do ícone genérico repetido em todas as
              linhas. A cor vem do estado, então ele também informa. */}
          <span
            aria-hidden="true"
            className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-[0.7rem] font-bold ${estilo.mono}`}
          >
            {obterIniciais(agente.nome)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-medium text-hi">{agente.nome}</h3>
              <Selo motivo={motivo} />
            </div>

            {agente.descricao && (
              <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-lo">{agente.descricao}</p>
            )}

            {/* Números na frente, rótulos atrás. A versão anterior repetia
                "Neste mês:" e "Total:" em toda linha com o mesmo peso do valor,
                e o olho tinha que ler o rótulo para achar o dado. */}
            <dl className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
              <div className="flex items-baseline gap-1.5">
                <dd className="font-mono text-sm font-semibold tabular-nums text-hi">
                  {formatarNumero(agente.consumo.execucoesMesAgente)}
                </dd>
                <dt className="text-lo">no mês</dt>
              </div>

              <span className="text-hi/15" aria-hidden="true">
                |
              </span>

              <div className="flex items-baseline gap-1.5">
                <dd className="font-mono tabular-nums text-lo">{formatarNumero(agente.totalExecucoes)}</dd>
                <dt className="text-lo/70">no total</dt>
              </div>

              <span className="text-hi/15" aria-hidden="true">
                |
              </span>

              <div>
                <dt className="sr-only">Última execução</dt>
                <dd className="text-lo/70">
                  {agente.ultimaExecucaoEm
                    ? formatarDataHora(agente.ultimaExecucaoEm)
                    : 'nunca executou'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
          <button
            type="button"
            className="btn-dark h-9"
            onClick={() => aoSimular(agente)}
            disabled={!podeSimular}
            title={
              motivo === 'cota'
                ? 'Tentar execução para demonstrar o bloqueio por cota'
                : motivo
                  ? `Agente ${motivo}`
                  : 'Registrar uma execução de demonstração'
            }
          >
            <Play className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {motivo === 'cota' ? 'Tentar' : 'Simular'}
            </span>
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2 py-0.5 text-[0.68rem] font-semibold text-danger">
        <span className="size-1.5 rounded-full bg-danger animate-pulse-ring" aria-hidden="true" />
        Bloqueado por cota
      </span>
    )
  }

  if (motivo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2 py-0.5 text-[0.68rem] font-semibold capitalize text-warn">
        <span className="size-1.5 rounded-full bg-warn" aria-hidden="true" />
        {motivo}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2 py-0.5 text-[0.68rem] font-medium text-ok">
      <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
      Ativo
    </span>
  )
}

export const AgentRow = memo(AgentRowComponent)
