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
          <span className="grid size-12 place-items-center rounded-2xl bg-red-100 text-red-700">
            <ShieldAlert className="size-6" aria-hidden="true" />
          </span>
          <button className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" type="button" onClick={aoFechar} aria-label="Fechar aviso de limite">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950" id="titulo-limite">Cota mensal esgotada</h2>
        <p className="mt-3 leading-7 text-slate-600">
          A tentativa foi bloqueada e registrada no histórico. Como a cota pertence ao cliente, todos os agentes ativos desta conta ficam bloqueados juntos.
        </p>

        {detalhes && (
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-red-200 ring-1 ring-red-200">
            <div className="bg-red-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-red-700">Consumo</p>
              <p className="mt-1 text-xl font-semibold text-red-950">{formatarNumero(detalhes.usado)} de {formatarNumero(detalhes.limite)}</p>
            </div>
            <div className="bg-red-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-red-700">Liberação prevista</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-red-950">{dataLiberacao}</p>
            </div>
          </div>
        )}

        <p className="mt-5 text-sm leading-6 text-slate-500">Para liberar antes da próxima competência, o plano do cliente precisa ser ampliado.</p>
        <button className="mt-7 h-11 w-full rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800" type="button" onClick={aoFechar}>Entendi</button>
      </div>
    </Dialog>
  )
}
