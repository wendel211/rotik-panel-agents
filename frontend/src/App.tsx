import { LogOut } from 'lucide-react'

import { LoginPage } from './features/auth/LoginPage'
import { useAuth } from './features/auth/authContext'

function App() {
  const { sessao, sair } = useAuth()

  if (!sessao) return <LoginPage />

  return (
    <main className="min-h-svh bg-[#f5f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-[#0d2c72] text-xs font-black text-white">R</span>
            <span className="font-bold tracking-[0.16em] text-[#0d2c72]">ROTIK</span>
          </div>
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950" type="button" onClick={sair}>
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <p className="text-sm font-medium text-blue-700">{sessao.cliente.nome}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Painel de agentes</h1>
        <p className="mt-3 text-slate-500">A área de monitoramento será carregada aqui.</p>
      </section>
    </main>
  )
}

export default App
