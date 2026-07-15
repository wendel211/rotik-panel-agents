import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

export interface Aviso {
  tipo: 'sucesso' | 'erro'
  mensagem: string
}

interface StatusToastProps {
  aviso: Aviso | null
  aoFechar: () => void
}

export function StatusToast({ aviso, aoFechar }: StatusToastProps) {
  const reduzirMovimento = useReducedMotion()

  useEffect(() => {
    if (!aviso) return
    const timer = window.setTimeout(aoFechar, 4_500)
    return () => window.clearTimeout(timer)
  }, [aviso, aoFechar])

  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100%-2.5rem)] items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-[0_20px_55px_-24px_rgba(6,16,43,.55)] sm:max-w-sm"
          role={aviso.tipo === 'erro' ? 'alert' : 'status'}
          initial={reduzirMovimento ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduzirMovimento ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
        >
          {aviso.tipo === 'sucesso' ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
          )}
          <p className="pr-2 text-sm leading-6 text-[#444b66]">{aviso.mensagem}</p>
          <button className="icon-button size-6 shrink-0" type="button" onClick={aoFechar} aria-label="Fechar aviso">
            <X className="size-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
