import { RefreshCw, WifiOff } from 'lucide-react'

interface ErrorStateProps {
  mensagem: string
  aoTentarNovamente: () => void
}

export function ErrorState({ mensagem, aoTentarNovamente }: ErrorStateProps) {
  return (
    <section className="rounded-2xl border border-danger/35 bg-panel px-5 py-12 text-center shadow-[var(--shadow-panel)] sm:px-8" role="alert">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-red-100 text-danger">
        <WifiOff className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-hi">Não foi possível carregar os agentes</h2>
      <p className="mx-auto mt-2 max-w-lg leading-7 text-lo">{mensagem}</p>
      <button
        className="btn-dark mx-auto mt-6 h-10"
        type="button"
        onClick={aoTentarNovamente}
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        Tentar novamente
      </button>
    </section>
  )
}
