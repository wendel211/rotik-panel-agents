import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

interface DialogProps {
  aberto: boolean
  aoFechar: () => void
  ariaLabelledby: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ aberto, aoFechar, ariaLabelledby, children, className = '' }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const focoAnteriorRef = useRef<HTMLElement | null>(null)
  const reduzirMovimento = useReducedMotion()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (aberto && !dialog.open) {
      focoAnteriorRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
      const overflowAnterior = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = overflowAnterior
        if (dialog.open) dialog.close()
        focoAnteriorRef.current?.focus()
      }
    }
  }, [aberto])

  function fechar() {
    aoFechar()
    focoAnteriorRef.current?.focus()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ariaLabelledby}
      className={`m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-visible bg-transparent p-0 text-left text-ink backdrop:bg-brand-950/70 backdrop:backdrop-blur-[3px] ${className}`}
      onClose={fechar}
      onCancel={(evento) => {
        evento.preventDefault()
        dialogRef.current?.close()
      }}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) dialogRef.current?.close()
      }}
    >
      <motion.div
        className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.4rem] border border-white/70 bg-surface shadow-[0_28px_90px_-30px_rgba(6,16,43,.65)]"
        initial={reduzirMovimento ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </dialog>
  )
}
