import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, LoaderCircle, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'

import { Dialog } from '../../components/Dialog'
import { ApiError, api } from '../../lib/api'
import type { Agente, DetalheCampo } from '../../types/api'
import { useAuth } from '../auth/authContext'

const agenteSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do agente.').max(120, 'Use no máximo 120 caracteres.'),
  descricao: z.string().trim().max(500, 'Use no máximo 500 caracteres.'),
})

type ErrosAgente = Partial<Record<'nome' | 'descricao' | 'formulario', string>>

function saoDetalhesDeCampo(valor: unknown): valor is DetalheCampo[] {
  return Array.isArray(valor) && valor.every((item) =>
    item && typeof item === 'object' && 'campo' in item && 'mensagem' in item,
  )
}

interface NewAgentDialogProps {
  aberto: boolean
  aoFechar: () => void
}

export function NewAgentDialog({ aberto, aoFechar }: NewAgentDialogProps) {
  const { sessao } = useAuth()
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erros, setErros] = useState<ErrosAgente>({})

  const criacao = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error('Sessão ausente.')
      const dados = descricao.trim() ? { nome: nome.trim(), descricao: descricao.trim() } : { nome: nome.trim() }
      return api.criarAgente(sessao.token, dados)
    },
    onSuccess: ({ data }) => {
      if (!sessao) return
      queryClient.setQueryData<{ data: Agente[] }>(['agentes', sessao.cliente.id], (anterior) => ({
        data: [data, ...(anterior?.data ?? [])],
      }))
      aoFechar()
    },
    onError: (erro) => {
      if (!(erro instanceof ApiError)) {
        setErros({ formulario: 'Não foi possível cadastrar o agente.' })
        return
      }

      if (erro.codigo === 'AGENTE_JA_EXISTE') {
        setErros({ nome: erro.message })
        return
      }

      if (erro.codigo === 'DADOS_INVALIDOS' && saoDetalhesDeCampo(erro.detalhes)) {
        const errosApi: ErrosAgente = {}
        for (const detalhe of erro.detalhes) {
          if (detalhe.campo === 'nome' || detalhe.campo === 'descricao') errosApi[detalhe.campo] = detalhe.mensagem
        }
        setErros(Object.keys(errosApi).length ? errosApi : { formulario: erro.message })
        return
      }

      setErros({ formulario: erro.message })
    },
  })
  const { reset: resetarCriacao } = criacao

  useEffect(() => {
    if (aberto) return
    setNome('')
    setDescricao('')
    setErros({})
    resetarCriacao()
  }, [aberto, resetarCriacao])

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErros({})

    const resultado = agenteSchema.safeParse({ nome, descricao })
    if (!resultado.success) {
      const novosErros: ErrosAgente = {}
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0]
        if (campo === 'nome' || campo === 'descricao') novosErros[campo] = issue.message
      }
      setErros(novosErros)
      return
    }

    criacao.mutate()
  }

  return (
    <Dialog aberto={aberto} aoFechar={aoFechar} ariaLabelledby="titulo-novo-agente">
      <div className="flex items-start justify-between border-b border-hairline px-6 py-5 sm:px-7">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-700/10 text-accent">
            <Bot className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-hi" id="titulo-novo-agente">Cadastrar agente</h2>
            <p className="mt-1 text-sm text-lo">O agente será criado como ativo nesta conta.</p>
          </div>
        </div>
        <button className="icon-button size-9 shrink-0" type="button" onClick={aoFechar} aria-label="Fechar cadastro">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={enviar} noValidate>
        <div className="space-y-5 px-6 py-6 sm:px-7">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#444b66]" htmlFor="nome-agente">Nome do agente</label>
            <input
              className="field-dark h-11 px-3.5"
              id="nome-agente"
              autoFocus
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ex.: Assistente de vendas"
              maxLength={120}
              aria-invalid={Boolean(erros.nome)}
              aria-describedby={erros.nome ? 'erro-nome-agente' : undefined}
            />
            <div className="mt-1.5 flex justify-between gap-4 text-xs">
              {erros.nome ? <p className="text-danger" id="erro-nome-agente">{erros.nome}</p> : <span />}
              <span className="text-lo">{nome.length}/120</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#444b66]" htmlFor="descricao-agente">
              Descrição <span className="font-normal text-lo">(opcional)</span>
            </label>
            <textarea
              className="field-dark min-h-28 resize-y px-3.5 py-3"
              id="descricao-agente"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder="Descreva a função principal deste agente."
              maxLength={500}
              aria-invalid={Boolean(erros.descricao)}
              aria-describedby={erros.descricao ? 'erro-descricao-agente' : undefined}
            />
            <div className="mt-1.5 flex justify-between gap-4 text-xs">
              {erros.descricao ? <p className="text-danger" id="erro-descricao-agente">{erros.descricao}</p> : <span />}
              <span className="text-lo">{descricao.length}/500</span>
            </div>
          </div>

          {erros.formulario && <p className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{erros.formulario}</p>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-hairline bg-[#f8faff] px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button className="btn-dark h-10" type="button" onClick={aoFechar}>Cancelar</button>
          <button className="button-primary h-10" type="submit" disabled={criacao.isPending}>
            {criacao.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {criacao.isPending ? 'Cadastrando...' : 'Cadastrar agente'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
