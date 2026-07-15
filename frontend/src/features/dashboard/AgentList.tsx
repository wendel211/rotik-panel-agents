import { Bot } from 'lucide-react'

import type { Agente } from '../../types/api'
import { AgentRow } from './AgentRow'

interface AgentListProps {
  agentes: Agente[]
}

export function AgentList({ agentes }: AgentListProps) {
  if (agentes.length === 0) {
    return (
      <section className="border-y border-slate-200 py-16 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <Bot className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-slate-950">Nenhum agente cadastrado</h2>
        <p className="mx-auto mt-2 max-w-md leading-7 text-slate-500">
          Cadastre o primeiro agente para começar a acompanhar consumo e execuções.
        </p>
      </section>
    )
  }

  return (
    <ul aria-label="Agentes cadastrados">
      {agentes.map((agente, indice) => (
        <AgentRow agente={agente} indice={indice} key={agente.id} />
      ))}
    </ul>
  )
}
