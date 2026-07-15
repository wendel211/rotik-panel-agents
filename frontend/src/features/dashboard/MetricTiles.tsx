import { motion, useReducedMotion } from 'motion/react'

import { BarraFill } from '../../components/BarraFill'

interface MetricTilesProps {
  ativos: number
  pausados: number
  bloqueados: number
  execucoesMes: number
  limiteMensal: number
}

/**
 * Leitura de 3 segundos do estado da conta.
 *
 * Sem chips de ícone: um quadrado colorido com um ícone genérico ao lado do
 * número é decoração pura, não diz nada que o número já não diga, e é o
 * carimbo visual de dashboard de template. No lugar dele entra uma régua cuja
 * largura é a proporção real do valor, ou seja, o mesmo espaço passa a carregar
 * informação em vez de enfeite.
 *
 * O número só ganha cor quando exige atenção. Um "0" em bloqueados pintado de
 * vermelho gritaria sobre a melhor notícia possível da tela.
 */
export function MetricTiles({ ativos, pausados, bloqueados, execucoesMes, limiteMensal }: MetricTilesProps) {
  const totalAgentes = ativos + pausados

  return (
    <section className="panel p-5" aria-labelledby="titulo-visao">
      <h2 className="mb-4 text-sm font-semibold text-hi" id="titulo-visao">
        Visão geral
      </h2>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile
          rotulo="Ativos"
          valor={ativos}
          proporcao={totalAgentes > 0 ? ativos / totalAgentes : 0}
          cor="bg-accent"
          indice={0}
        />
        <Tile
          rotulo="Pausados"
          valor={pausados}
          proporcao={totalAgentes > 0 ? pausados / totalAgentes : 0}
          cor="bg-warn"
          corTexto={pausados > 0 ? 'text-warn' : undefined}
          indice={1}
        />
        <Tile
          rotulo="Bloqueados"
          valor={bloqueados}
          proporcao={totalAgentes > 0 ? bloqueados / totalAgentes : 0}
          cor="bg-danger"
          corTexto={bloqueados > 0 ? 'text-danger' : undefined}
          destacar={bloqueados > 0}
          indice={2}
        />
        <Tile
          rotulo="Execuções no mês"
          valor={execucoesMes}
          proporcao={limiteMensal > 0 ? execucoesMes / limiteMensal : 0}
          cor="bg-ok"
          indice={3}
        />
      </div>
    </section>
  )
}

interface TileProps {
  rotulo: string
  valor: number
  proporcao: number
  cor: string
  corTexto?: string | undefined
  destacar?: boolean
  indice: number
}

function Tile({ rotulo, valor, proporcao, cor, corTexto, destacar = false, indice }: TileProps) {
  const reduzirMovimento = useReducedMotion()
  const largura = Math.min(1, Math.max(0, proporcao))

  return (
    <motion.div
      className={`panel-tile p-3.5 ${destacar ? 'border-danger-border' : ''}`}
      initial={reduzirMovimento ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // Entrada escalonada: o olho lê da esquerda para a direita em vez de
      // receber os quatro tiles de uma vez.
      transition={{ delay: 0.05 + indice * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="truncate text-[0.62rem] font-medium uppercase tracking-[0.11em] text-lo">
        {rotulo}
      </p>

      <p className={`mt-2 font-mono text-[1.7rem] font-semibold tabular-nums leading-none ${corTexto ?? 'text-hi'}`}>
        {valor.toLocaleString('pt-BR')}
      </p>

      {/* A régua é a proporção do valor, não enfeite. Ela some do leitor de tela
          porque o número ao lado já é o dado; anunciar duas vezes seria ruído. */}
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-hi/8" aria-hidden="true">
        <BarraFill largura={largura} cor={cor} atraso={0.12 + indice * 0.06} />
      </div>
    </motion.div>
  )
}
