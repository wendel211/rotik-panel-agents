import { Bot, Plus } from 'lucide-react'

import type { Agente } from '../../types/api'
import { AgentRow } from './AgentRow'

interface AgentListProps {
  agentes: Agente[]
  aoAbrirHistorico: (agente: Agente) => void
  aoSimular: (agente: Agente) => void
  aoNovoAgente: () => void
}

export function AgentList({
  agentes,
  aoAbrirHistorico,
  aoSimular,
  aoNovoAgente,
}: AgentListProps) {
  if (agentes.length === 0) {
    return <EstadoVazio aoNovoAgente={aoNovoAgente} />
  }

  return (
    <ul className="space-y-2.5" aria-label="Agentes cadastrados">
      {agentes.map((agente, indice) => (
        <AgentRow
          key={agente.id}
          agente={agente}
          indice={indice}
          aoAbrirHistorico={aoAbrirHistorico}
          aoSimular={aoSimular}
        />
      ))}
    </ul>
  )
}

/**
 * Estado vazio com saída, não só aviso.
 *
 * Uma conta nova cai aqui, e é o primeiro contato dela com o produto. Um
 * "nenhum agente encontrado" seco deixaria o usuário procurando o que fazer.
 */
function EstadoVazio({ aoNovoAgente }: { aoNovoAgente: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-hairline bg-shell/40 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-700/10 text-accent" aria-hidden="true">
        <Bot className="size-6" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-hi">Nenhum agente cadastrado</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-lo">
        Cadastre o primeiro agente desta conta para acompanhar consumo, bloqueios e histórico de
        execuções.
      </p>
      <button className="button-primary mt-5 h-10" type="button" onClick={aoNovoAgente}>
        <Plus className="size-4" aria-hidden="true" />
        Cadastrar agente
      </button>
    </div>
  )
}
