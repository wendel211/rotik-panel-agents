export interface Cliente {
  id: string
  nome: string
  email: string
}

export interface Sessao {
  token: string
  cliente: Cliente
}

export interface RespostaLogin extends Sessao {}

export interface DetalheCampo {
  campo: string
  mensagem: string
}

export interface DetalhesLimite {
  usado: number
  limite: number
  retryAfterSegundos: number
}

export interface EnvelopeErro {
  erro: {
    codigo: string
    mensagem: string
    detalhes?: unknown
  }
}

export type StatusAgente = 'ativo' | 'pausado' | 'arquivado'

export interface Agente {
  id: string
  nome: string
  descricao: string | null
  status: StatusAgente
  bloqueado: boolean
  criadoEm: string
  ultimaExecucaoEm: string | null
  totalExecucoes: number
  plano: {
    id: string
    nome: string
    limiteAgentes: number
  }
  agentes: {
    usado: number
    limite: number
    restante: number
  }
  consumo: {
    execucoesMesAgente: number
    execucoesMesCliente: number
    limiteMensal: number
    restante: number
    percentualUsoCliente: number
  }
}

export interface LimitesAgentes {
  plano: Agente['plano']
  agentes: Agente['agentes']
}

export interface RespostaAgentes {
  data: Agente[]
  // Opcional durante o rollout: a versão anterior da API retornava apenas data.
  meta?: LimitesAgentes
}

export interface SimulacaoExecucao {
  quantidadeExecucoes: number
}

export type StatusExecucao = 'sucesso' | 'erro' | 'bloqueada'

export interface Execucao {
  id: string
  status: StatusExecucao
  duracaoMs: number | null
  tokensEntrada: number | null
  tokensSaida: number | null
  quantidadeExecucoes: number
  mensagemErro: string | null
  criadoEm: string
}

export interface PaginaExecucoes {
  data: Execucao[]
  proximoCursor: string | null
}
