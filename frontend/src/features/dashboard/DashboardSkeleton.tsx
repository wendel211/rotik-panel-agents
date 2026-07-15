/**
 * Skeleton com a mesma silhueta do conteúdo real (bento de duas colunas, depois
 * a lista). Um skeleton com forma diferente do que chega provoca um salto de
 * layout no momento em que os dados carregam, que é justamente o que ele
 * deveria evitar.
 */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando painel" className="animate-pulse">
      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div className="panel p-5">
          <div className="mb-4 h-4 w-24 rounded bg-panel-2" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div className="h-[4.4rem] rounded-xl bg-panel-2" key={item} />
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-5 h-4 w-20 rounded bg-panel-2" />
          <div className="space-y-5">
            {[0, 1].map((item) => (
              <div key={item}>
                <div className="mb-2 h-3 w-32 rounded bg-panel-2" />
                <div className="h-1.5 rounded-full bg-panel-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel mt-4 p-5">
        <div className="mb-4 h-4 w-20 rounded bg-panel-2" />
        <div className="space-y-2.5">
          {[0, 1, 2].map((item) => (
            <div className="h-[5.5rem] rounded-xl bg-panel-2" key={item} />
          ))}
        </div>
      </div>

      <span className="sr-only">Carregando dados dos agentes.</span>
    </div>
  )
}
