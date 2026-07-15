import { Bot } from 'lucide-react'

import type { Agente } from '../../types/api'
import { AgentRow } from './AgentRow'

interface AgentListProps {
  agentes: Agente[]
  simulandoId: string | null
  aoAbrirHistorico: (agente: Agente) => void
  aoSimular: (agente: Agente) => void
  aoNovoAgente: () => void
}

export function AgentList({ agentes, simulandoId, aoAbrirHistorico, aoSimular, aoNovoAgente }: AgentListProps) {
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
        <button className="mt-6 h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700" type="button" onClick={aoNovoAgente}>Cadastrar primeiro agente</button>
      </section>
    )
  }

  return (
    <ul aria-label="Agentes cadastrados">
      {agentes.map((agente, indice) => (
        <AgentRow
          agente={agente}
          indice={indice}
          simulando={simulandoId === agente.id}
          aoAbrirHistorico={aoAbrirHistorico}
          aoSimular={aoSimular}
          key={agente.id}
        />
      ))}
    </ul>
  )
}
