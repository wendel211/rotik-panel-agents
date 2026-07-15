import { ShieldAlert, X } from 'lucide-react'

import { Dialog } from '../../components/Dialog'
import { formatarNumero } from '../../lib/format'
import type { DetalhesLimite } from '../../types/api'

interface LimitDialogProps {
  detalhes: DetalhesLimite | null
  aoFechar: () => void
}

export function LimitDialog({ detalhes, aoFechar }: LimitDialogProps) {
  const dataLiberacao = detalhes
    ? new Date(Date.now() + detalhes.retryAfterSegundos * 1_000).toLocaleString('pt-BR', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : ''

  return (
    <Dialog aberto={Boolean(detalhes)} aoFechar={aoFechar} ariaLabelledby="titulo-limite">
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-100 text-danger">
            <ShieldAlert className="size-6" aria-hidden="true" />
          </span>
          <button className="icon-button size-9" type="button" onClick={aoFechar} aria-label="Fechar aviso de limite">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-hi" id="titulo-limite">Cota mensal esgotada</h2>
        <p className="mt-3 leading-7 text-lo">
          A tentativa foi bloqueada e registrada no histórico. Como a cota pertence ao cliente, todos os agentes ativos desta conta ficam bloqueados juntos.
        </p>

        {detalhes && (
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-red-200 ring-1 ring-danger/30">
            <div className="bg-danger/10 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-danger">Consumo</p>
              <p className="mt-1 text-xl font-semibold text-danger">{formatarNumero(detalhes.usado)} de {formatarNumero(detalhes.limite)}</p>
            </div>
            <div className="bg-danger/10 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-danger">Liberação prevista</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-danger">{dataLiberacao}</p>
            </div>
          </div>
        )}

        <p className="mt-5 text-sm leading-6 text-lo">Para liberar antes da próxima competência, o plano do cliente precisa ser ampliado.</p>
        <button className="button-primary mt-7 h-11 w-full" type="button" onClick={aoFechar}>Entendi</button>
      </div>
    </Dialog>
  )
}
