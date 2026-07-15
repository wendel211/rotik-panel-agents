import { motion, useReducedMotion } from 'motion/react'
import { Ban, CircleCheck, PauseCircle, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

interface MetricTilesProps {
  ativos: number
  pausados: number
  bloqueados: number
  execucoesMes: number
}

/**
 * Leitura de 3 segundos do estado da conta.
 *
 * "Bloqueados" tem destaque próprio porque é o único número desta linha que
 * exige ação. Os outros três são contexto.
 */
export function MetricTiles({ ativos, pausados, bloqueados, execucoesMes }: MetricTilesProps) {
  return (
    <section className="panel p-5" aria-labelledby="titulo-visao">
      <h2 className="mb-4 text-sm font-semibold text-hi" id="titulo-visao">
        Visão geral
      </h2>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile
          rotulo="Ativos"
          valor={ativos}
          icone={<CircleCheck className="size-4" />}
          corChip="bg-brand-700/15 text-accent"
          indice={0}
        />
        <Tile
          rotulo="Pausados"
          valor={pausados}
          icone={<PauseCircle className="size-4" />}
          corChip="bg-warn/15 text-warn"
          indice={1}
        />
        <Tile
          rotulo="Bloqueados"
          valor={bloqueados}
          icone={<Ban className="size-4" />}
          corChip="bg-danger/15 text-danger"
          destacar={bloqueados > 0}
          indice={2}
        />
        <Tile
          rotulo="Execuções no mês"
          valor={execucoesMes}
          icone={<Zap className="size-4" />}
          corChip="bg-ok/15 text-ok"
          indice={3}
        />
      </div>
    </section>
  )
}

interface TileProps {
  rotulo: string
  valor: number
  icone: ReactNode
  corChip: string
  destacar?: boolean
  indice: number
}

function Tile({ rotulo, valor, icone, corChip, destacar = false, indice }: TileProps) {
  const reduzirMovimento = useReducedMotion()

  return (
    <motion.div
      className={`panel-tile flex items-center justify-between gap-3 p-3.5 ${
        destacar ? 'border-danger/40 bg-danger/5' : ''
      }`}
      initial={reduzirMovimento ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // Entrada escalonada: o olho lê da esquerda para a direita em vez de
      // receber os quatro tiles de uma vez.
      transition={{ delay: 0.05 + indice * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="min-w-0">
        <p className="truncate text-[0.7rem] text-lo">{rotulo}</p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums leading-none text-hi">
          {valor.toLocaleString('pt-BR')}
        </p>
      </div>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${corChip}`} aria-hidden="true">
        {icone}
      </span>
    </motion.div>
  )
}
