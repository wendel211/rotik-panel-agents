import { useEffect, useState } from 'react'

interface BarraFillProps {
  /** Proporção de 0 a 1. Valores fora da faixa são cortados. */
  largura: number
  /** Classe de cor de fundo, ex.: `bg-danger`. */
  cor: string
  /** Varredura de atenção. Só quando a conta está em risco. */
  pulsar?: boolean
  /** Atraso da entrada, em segundos, para escalonar barras irmãs. */
  atraso?: number
}

/**
 * Preenchimento de barra que cresce de 0 até `largura` ao montar.
 *
 * Duas armadilhas que esta implementação evita, ambas já custaram barra
 * invisível neste projeto:
 *
 * 1. Não usa `motion.span`. O `.bar-fill` já declara `transition: transform`,
 *    e a transição do navegador competia com a animação em JS pelo mesmo
 *    transform. Aqui só o CSS anima; o React troca o alvo uma vez.
 *
 * 2. O efeito não depende de `useReducedMotion`. Aquele hook devolve `null`
 *    antes de devolver o booleano, então o efeito re-rodava e o cleanup
 *    cancelava o frame agendado antes dele disparar: a barra ficava presa em
 *    zero para sempre. As dependências aqui são vazias de propósito.
 *
 * Movimento reduzido é respeitado pelo CSS, que zera a duração da transição na
 * media query. O valor final é o mesmo; só o caminho até ele é instantâneo.
 */
export function BarraFill({ largura, cor, pulsar = false, atraso = 0 }: BarraFillProps) {
  const [montado, setMontado] = useState(false)
  const alvo = Math.min(1, Math.max(0, largura))

  useEffect(() => {
    // O timer separa a pintura em zero da troca para o alvo em dois frames.
    // No mesmo frame, o navegador coalesce os dois valores e a transição não
    // dispara, ou seja, a barra apareceria pronta em vez de crescer.
    const id = setTimeout(() => setMontado(true), 40)
    return () => clearTimeout(id)
  }, [])

  return (
    <span
      className={`bar-fill block h-full w-full rounded-full ${cor} ${pulsar ? 'animate-sheen' : ''}`}
      style={{
        transform: `scaleX(${montado ? alvo : 0})`,
        transitionDelay: `${atraso}s`,
      }}
    />
  )
}
