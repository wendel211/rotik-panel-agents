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
      <section className="rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-[var(--shadow-panel)]">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Bot className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-ink">Nenhum agente cadastrado</h2>
        <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
          Cadastre o primeiro agente para começar a acompanhar consumo e execuções.
        </p>
        <button className="button-primary mt-6 h-10" type="button" onClick={aoNovoAgente}>Cadastrar primeiro agente</button>
      </section>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-panel)]">
      <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(11rem,.65fr)_9rem_minmax(15rem,.75fr)] gap-6 border-b border-line bg-[#f8faff] px-6 py-3 text-xs font-semibold uppercase tracking-[0.11em] text-subtle lg:grid lg:px-7">
        <span>Agente</span>
        <span>Consumo no mês</span>
        <span>Status</span>
        <span className="text-right">Ações</span>
      </div>
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
    </div>
  )
}
