export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando painel" className="animate-pulse">
      <div className="h-64 rounded-3xl bg-slate-200 sm:h-56" />
      <div className="mt-12 flex items-end justify-between">
        <div>
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-56 rounded bg-slate-100" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-slate-200" />
      </div>
      <div className="mt-6 border-t border-slate-200">
        {[0, 1, 2].map((item) => (
          <div className="grid gap-5 border-b border-slate-200 py-7 lg:grid-cols-[1fr_26rem]" key={item}>
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
