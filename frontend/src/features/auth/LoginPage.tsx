import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { ApiError } from '../../lib/api'
import { useAuth } from './authContext'

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

type ErrosLogin = Partial<Record<'email' | 'senha' | 'formulario', string>>

export function LoginPage() {
  const { entrar } = useAuth()
  const reduzirMovimento = useReducedMotion()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<ErrosLogin>({})

  const login = useMutation({
    mutationFn: () => entrar(email.trim(), senha),
    onError: (erro) => {
      setErros({
        formulario:
          erro instanceof ApiError ? erro.message : 'Não foi possível entrar. Tente novamente.',
      })
    },
  })

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErros({})

    const resultado = loginSchema.safeParse({ email: email.trim(), senha })
    if (!resultado.success) {
      const novosErros: ErrosLogin = {}
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0]
        if (campo === 'email' || campo === 'senha') novosErros[campo] = issue.message
      }
      setErros(novosErros)
      return
    }

    login.mutate()
  }

  return (
    <main className="grid min-h-svh bg-[#f6f8fc] lg:grid-cols-[minmax(24rem,0.92fr)_minmax(32rem,1.08fr)]">
      <section className="relative hidden min-h-svh overflow-hidden bg-[#0d2c72] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:54px_54px]" />
        <div className="absolute -right-44 top-1/2 size-[32rem] -translate-y-1/2 rounded-full border border-blue-300/30" />
        <div className="absolute -right-20 top-1/2 size-[20rem] -translate-y-1/2 rounded-full border border-blue-200/20" />

        <div className="relative flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[0.65rem] bg-white text-sm font-black text-[#0d2c72]">
            R
          </span>
          <span className="text-lg font-bold tracking-[0.18em]">ROTIK</span>
        </div>

        <motion.div
          className="relative max-w-lg"
          initial={reduzirMovimento ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-blue-200">
            Monitoramento de agentes
          </p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-6xl">
            Visibilidade para agir antes do limite.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-blue-100/80">
            Acompanhe a cota compartilhada, identifique o consumo por agente e investigue bloqueios.
          </p>
        </motion.div>

        <p className="relative text-sm text-blue-200/70">Painel interno de operações</p>
      </section>

      <section className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-10">
        <motion.div
          className="w-full max-w-[27rem]"
          initial={reduzirMovimento ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-[0.65rem] bg-[#0d2c72] text-sm font-black text-white">
              R
            </span>
            <span className="font-bold tracking-[0.18em] text-[#0d2c72]">ROTIK</span>
          </div>

          <p className="text-sm font-semibold text-blue-700">Acesso seguro</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
            Entre na sua conta
          </h2>
          <p className="mt-3 leading-7 text-slate-500">
            Use as credenciais de demonstração documentadas no README.
          </p>

          <form className="mt-9 space-y-5" onSubmit={enviar} noValidate>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-800" htmlFor="email">
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-slate-950 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  aria-invalid={Boolean(erros.email)}
                  aria-describedby={erros.email ? 'erro-email' : undefined}
                />
              </div>
              {erros.email && <p className="mt-2 text-sm text-red-700" id="erro-email">{erros.email}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-800" htmlFor="senha">
                Senha
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-12 text-slate-950 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
                  id="senha"
                  name="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(evento) => setSenha(evento.target.value)}
                  aria-invalid={Boolean(erros.senha)}
                  aria-describedby={erros.senha ? 'erro-senha' : undefined}
                />
                <button
                  className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  type="button"
                  onClick={() => setMostrarSenha((valor) => !valor)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff className="size-[1.1rem]" /> : <Eye className="size-[1.1rem]" />}
                </button>
              </div>
              {erros.senha && <p className="mt-2 text-sm text-red-700" id="erro-senha">{erros.senha}</p>}
            </div>

            {erros.formulario && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
                {erros.formulario}
              </div>
            )}

            <button
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#155eef] px-5 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(21,94,239,.8)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-65"
              type="submit"
              disabled={login.isPending}
            >
              {login.isPending ? 'Entrando...' : 'Entrar no painel'}
              {!login.isPending && <ArrowRight className="size-[1.1rem] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
            <p><span className="font-medium text-slate-700">Acme:</span> cs@acme.dev</p>
            <p><span className="font-medium text-slate-700">Globex:</span> cs@globex.dev</p>
          </div>
        </motion.div>
      </section>
    </main>
  )
}
