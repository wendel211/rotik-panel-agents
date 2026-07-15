export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando painel" className="animate-pulse">
      <div className="h-72 rounded-[1.4rem] bg-brand-900/15 sm:h-60" />
      <div className="mt-9">
        <div className="h-5 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-56 rounded bg-slate-100" />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        {[0, 1, 2].map((item) => (
          <div className="grid gap-5 border-b border-line px-6 py-7 last:border-0 lg:grid-cols-[1fr_26rem]" key={item}>
            <div>
              <div className="h-5 w-48 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full max-w-md rounded bg-slate-100" />
            </div>
            <div className="h-14 rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando dados dos agentes.</span>
    </div>
  )
}
