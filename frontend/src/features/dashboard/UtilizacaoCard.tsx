import { TriangleAlert } from 'lucide-react'

import { BarraFill } from '../../components/BarraFill'

/** Acima disso a conta entra em risco e a barra muda de cor. Ver README. */
const LIMIAR_ALERTA = 80

interface UtilizacaoCardProps {
  usado: number
  limite: number
  percentual: number
  totalAgentes: number
  agentesAtivos: number
  planoNome: string
}

/**
 * Cota do CLIENTE, que é a que bloqueia.
 *
 * Este card responde a pergunta que o briefing pede ("estamos perto de estourar?")
 * e por isso ocupa a posição de maior peso visual do painel. As barras por agente
 * não existem: a cota é um pool compartilhado, então uma barra por agente
 * mostraria o mesmo número repetido e leria como bug. A atribuição por agente
 * vive na lista, em números absolutos.
 */
export function UtilizacaoCard({
  usado,
  limite,
  percentual,
  totalAgentes,
  agentesAtivos,
  planoNome,
}: UtilizacaoCardProps) {
  const possuiCota = limite > 0
  const emRisco = percentual >= LIMIAR_ALERTA
  const esgotada = possuiCota && usado >= limite

  return (
    <section className="panel p-5" aria-labelledby="titulo-utilizacao">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-hi" id="titulo-utilizacao">
          Utilização
        </h2>
        <span className="rounded-full border border-hairline bg-panel-2 px-2.5 py-1 text-[0.7rem] font-medium text-lo">
          Plano {planoNome}
        </span>
      </div>

      <div className="space-y-5">
        <Medidor
          rotulo="Agentes cadastrados"
          valor={`${agentesAtivos}/${totalAgentes || 0}`}
          percentual={totalAgentes > 0 ? (agentesAtivos / totalAgentes) * 100 : 0}
          cor="bg-brand-600"
          descricao={`${agentesAtivos} de ${totalAgentes} agentes estão ativos`}
        />

        <Medidor
          rotulo="Execuções no mês"
          valor={`${usado.toLocaleString('pt-BR')}/${limite.toLocaleString('pt-BR')}`}
          percentual={percentual}
          cor={esgotada ? 'bg-danger' : emRisco ? 'bg-warn' : 'bg-brand-600'}
          pulsar={emRisco && !esgotada}
          descricao={`${percentual.toFixed(0)}% da cota mensal do plano consumida`}
        />
      </div>

      {/* A cota é compartilhada e isso não é óbvio. Dizer em texto evita que o
          operador conclua que só o agente que ele está olhando parou. */}
      <p className="mt-5 border-t border-hairline pt-4 text-xs leading-5 text-lo">
        {!possuiCota ? (
          <>O consumo será exibido após cadastrar o primeiro agente.</>
        ) : esgotada ? (
          <span className="flex items-start gap-2 text-danger">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Cota esgotada. <strong className="font-semibold">Todos os agentes</strong> desta conta
              estão bloqueados até a virada do mês.
            </span>
          </span>
        ) : emRisco ? (
          <span className="flex items-start gap-2 text-warn">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Restam <strong className="font-semibold">{(limite - usado).toLocaleString('pt-BR')}</strong>{' '}
              execuções. A cota é compartilhada por todos os agentes.
            </span>
          </span>
        ) : (
          <>
            A cota do plano é compartilhada por todos os agentes da conta e reinicia na virada do mês.
          </>
        )}
      </p>
    </section>
  )
}

interface MedidorProps {
  rotulo: string
  valor: string
  percentual: number
  cor: string
  pulsar?: boolean
  descricao: string
}

function Medidor({ rotulo, valor, percentual, cor, pulsar = false, descricao }: MedidorProps) {
  const largura = Math.min(100, Math.max(0, percentual))

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs text-lo">{rotulo}</span>
        <span className="font-mono text-xs font-semibold tabular-nums text-hi">{valor}</span>
      </div>

      {/* role=progressbar dá ao leitor de tela o mesmo dado que a barra dá ao
          olho. Sem isso, a informação central da tela seria só visual. */}
      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-shell"
        role="progressbar"
        aria-valuenow={Math.round(largura)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={descricao}
      >
        <BarraFill largura={largura / 100} cor={cor} pulsar={pulsar} />
      </div>
    </div>
  )
}
