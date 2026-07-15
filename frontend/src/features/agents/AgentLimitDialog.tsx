import { UsersRound, X } from 'lucide-react'

import { Dialog } from '../../components/Dialog'

interface Props {
  aberto: boolean
  plano: string
  usado: number
  limite: number
  aoFechar: () => void
}

export function AgentLimitDialog({ aberto, plano, usado, limite, aoFechar }: Props) {
  return (
    <Dialog aberto={aberto} aoFechar={aoFechar} ariaLabelledby="titulo-limite-agentes">
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-warn-soft text-warn">
            <UsersRound className="size-6" aria-hidden="true" />
          </span>
          <button className="icon-button size-9" type="button" onClick={aoFechar} aria-label="Fechar aviso de limite de agentes">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-hi" id="titulo-limite-agentes">
          Limite de agentes atingido
        </h2>
        <p className="mt-3 leading-7 text-lo">
          O plano {plano} permite até {limite} agentes. Esta conta já utiliza {usado} e não pode cadastrar outro agente agora.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-warn-border bg-warn-soft px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-warn">Capacidade do plano</p>
          <p className="mt-1 text-xl font-semibold text-warn">{usado} de {limite} agentes</p>
        </div>

        <p className="mt-5 text-sm leading-6 text-lo">
          Para criar outro agente, a conta precisa liberar uma vaga ou ampliar o plano.
        </p>
        <button className="button-primary mt-7 h-11 w-full" type="button" onClick={aoFechar}>Entendi</button>
      </div>
    </Dialog>
  )
}
