import { RefreshCw, WifiOff } from 'lucide-react'

interface ErrorStateProps {
  mensagem: string
  aoTentarNovamente: () => void
}

export function ErrorState({ mensagem, aoTentarNovamente }: ErrorStateProps) {
  return (
    <section className="border-y border-red-200 bg-red-50 px-5 py-12 text-center sm:px-8" role="alert">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-red-100 text-red-700">
        <WifiOff className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">Não foi possível carregar os agentes</h2>
      <p className="mx-auto mt-2 max-w-lg leading-7 text-slate-600">{mensagem}</p>
      <button
        className="mx-auto mt-6 flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        type="button"
        onClick={aoTentarNovamente}
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        Tentar novamente
      </button>
    </section>
  )
}
