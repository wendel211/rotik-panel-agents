import { Calculator, LoaderCircle, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { z } from 'zod'

import { Dialog } from '../../components/Dialog'
import { formatarNumero } from '../../lib/format'
import type { Agente, SimulacaoExecucao } from '../../types/api'

const schema = z.object({
  quantidadeExecucoes: z.number().int().min(1).max(1000),
})

interface Props {
  agente: Agente | null
  enviando: boolean
  erro?: string | null
  aoFechar: () => void
  aoConfirmar: (dados: SimulacaoExecucao) => void
}

export function SimulationDialog({ agente, enviando, erro, aoFechar, aoConfirmar }: Props) {
  const [quantidade, setQuantidade] = useState('1')
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  useEffect(() => {
    if (agente) return
    setQuantidade('1')
    setErroLocal(null)
  }, [agente])

  const projecao = useMemo(() => {
    const execucoes = Number(quantidade) || 0
    const usado = agente?.consumo.execucoesMesCliente ?? 0
    const limite = agente?.consumo.limiteMensal ?? 0
    return { execucoes, usado, limite, projetado: usado + execucoes }
  }, [agente, quantidade])

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const dados = { quantidadeExecucoes: Number(quantidade) }
    const resultado = schema.safeParse(dados)
    if (!resultado.success) {
      setErroLocal('Informe uma quantidade inteira entre 1 e 1.000 execuções.')
      return
    }
    const usado = agente?.consumo.execucoesMesCliente ?? 0
    const limite = agente?.consumo.limiteMensal ?? 0
    if (limite > 0 && usado + resultado.data.quantidadeExecucoes > limite) {
      setErroLocal(`O lote ultrapassa o saldo de ${Math.max(0, limite - usado)} execuções.`)
      return
    }
    setErroLocal(null)
    aoConfirmar(resultado.data)
  }

  const excede = projecao.limite > 0 && projecao.projetado > projecao.limite
  const saldoExecucoes = Math.max(0, projecao.limite - projecao.usado)
  const saldoDepois = Math.max(0, projecao.limite - projecao.projetado)

  return (
    <Dialog aberto={Boolean(agente)} aoFechar={enviando ? () => undefined : aoFechar} ariaLabelledby="titulo-simulacao">
      <div className="flex items-start justify-between border-b border-hairline px-6 py-5 sm:px-7">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-700/10 text-accent"><Calculator className="size-5" aria-hidden="true" /></span>
          <div><h2 className="text-lg font-semibold text-hi" id="titulo-simulacao">Simular consumo</h2><p className="mt-1 text-sm text-lo">{agente?.nome}</p></div>
        </div>
        <button className="icon-button size-9" type="button" onClick={aoFechar} disabled={enviando} aria-label="Fechar simulação"><X className="size-5" /></button>
      </div>

      <form onSubmit={enviar} noValidate>
        <div className="space-y-5 px-6 py-6 sm:px-7">
          <div>
            <label className="mb-2 block text-sm font-medium text-hi" htmlFor="quantidade-execucoes">Execuções que serão consumidas</label>
            <input className="field-dark h-11 px-3.5" id="quantidade-execucoes" type="number" min="1" max={Math.min(1000, saldoExecucoes)} step="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} autoFocus />
            <p className="mt-1.5 text-xs text-lo">Digite o lote diretamente. Saldo disponível: {formatarNumero(saldoExecucoes)} execuções.</p>
          </div>
          <section className={`rounded-xl border px-4 py-4 ${excede ? 'border-danger-border bg-danger-soft' : 'border-hairline bg-[#f8faff]'}`} aria-live="polite">
            <div className="flex items-baseline justify-between gap-4"><h3 className="text-sm font-semibold text-hi">Projeção da cota</h3><strong className="font-mono text-sm tabular-nums text-hi">{formatarNumero(saldoDepois)} restantes</strong></div>
            <p className={`mt-2 text-sm ${excede ? 'text-danger' : 'text-lo'}`}>A cota passará de {formatarNumero(projecao.usado)} para {formatarNumero(projecao.projetado)} de {formatarNumero(projecao.limite)} execuções. {excede && 'Reduza o lote para continuar; nenhuma execução será enviada acima do limite.'}</p>
          </section>
          {(erroLocal || erro) && <p className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{erroLocal || erro}</p>}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-hairline bg-[#f8faff] px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button className="btn-dark h-10" type="button" onClick={aoFechar} disabled={enviando}>Cancelar</button>
          <button className="button-primary h-10" type="submit" disabled={enviando || excede}>{enviando && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{enviando ? 'Registrando lote...' : excede ? 'Cota insuficiente' : 'Confirmar lote'}</button>
        </div>
      </form>
    </Dialog>
  )
}
