const formatoNumero = new Intl.NumberFormat('pt-BR')
const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const formatoMes = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

export function formatarNumero(valor: number): string {
  return formatoNumero.format(valor)
}

export function formatarDataHora(valor: string): string {
  return formatoDataHora.format(new Date(valor))
}

export function formatarMesAtual(): string {
  const mes = formatoMes.format(new Date())
  return mes.charAt(0).toUpperCase() + mes.slice(1)
}

export function obterIniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join('')
    .toUpperCase()
}
