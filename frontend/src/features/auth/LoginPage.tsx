import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { BrandLogo } from '../../components/BrandLogo'
import { ApiError } from '../../lib/api'
import { useAuth } from './authContext'

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

type ErrosLogin = Partial<Record<'email' | 'senha' | 'formulario', string>>

const contasDemo = [
  { nome: 'Acme', email: 'cs@acme.dev' },
  { nome: 'Globex', email: 'cs@globex.dev' },
]

export function LoginPage() {
  const { entrar } = useAuth()
  const reduzirMovimento = useReducedMotion()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [imagemDisponivel, setImagemDisponivel] = useState(true)
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

  function preencherConta(emailDemo: string) {
    setEmail(emailDemo)
    setSenha('senha123')
    setErros({})
  }

  return (
    // h-svh + overflow-hidden trava a altura na viewport: o painel nunca rola.
    // Cada coluna vira uma área de rolagem própria, e só rola se o conteúdo
    // realmente não couber (telas muito baixas), em vez de a página inteira
    // rolar por causa da ilustração da esquerda.
    <main className="grid h-svh overflow-hidden bg-canvas lg:grid-cols-[minmax(34rem,1.08fr)_minmax(29rem,0.92fr)]">
      <section className="relative hidden h-svh min-h-0 overflow-hidden bg-brand-950 px-10 py-6 text-white lg:flex lg:flex-col xl:px-14">
        <BrandLogo />

        <motion.div
          className="my-auto min-h-0 w-full max-w-2xl py-4"
          initial={reduzirMovimento ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-brand-300">
            Operações com agentes de IA
          </p>
          {/* clamp por vh em vez de degraus de breakpoint: a altura disponível
              varia de forma contínua, e o texto precisa encolher junto para o
              painel caber sem rolagem em telas baixas (1366x768 e notebooks
              13"). O texto cede altura antes da imagem, e não o contrário. */}
          <h1 className="max-w-lg font-semibold leading-[1.05] tracking-[-0.052em] [font-size:clamp(1.75rem,2.6vh+1.05rem,2.6rem)]">
            Controle total sobre cada execução.
          </h1>
          <p className="mt-3 max-w-md leading-6 text-[#b9c7e6] [font-size:clamp(.82rem,.7vh+.52rem,.95rem)]">
            Acompanhe consumo, investigue bloqueios e mantenha seus agentes operando dentro da cota.
          </p>

          {imagemDisponivel && (
            <motion.figure
              // w-fit: a moldura encolhe até a imagem em vez de esticar. Com
              // uma caixa de largura fixa sobrava letterbox nas laterais (a
              // caixa era mais larga que a proporção 2:1 do print), e a faixa
              // aparecia dentro da borda arredondada. Deixando a figure seguir
              // a imagem, a borda abraça o print e não sobra nada.
              className="mt-5 hidden w-fit overflow-hidden rounded-xl border border-white/10 shadow-[0_30px_80px_-35px_rgba(41,93,255,.7)] lg:block"
              initial={reduzirMovimento ? false : { opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                // A imagem é dimensionada pela ALTURA (max-h em vh) e a largura
                // segue a proporção. Isso a mantém inteira, nunca cortada, e faz
                // dela a peça que cede espaço quando a viewport encolhe, sem
                // nunca empurrar rolagem.
                //
                // max-w-full protege o caso inverso: viewport alta e estreita,
                // onde a largura proporcional estouraria a coluna.
                className="block h-auto max-h-[40vh] w-auto max-w-full"
                src="https://rotik.io/wp-content/uploads/2026/02/ilu-svg-hero-2x-2048x1028-1.webp"
                alt=""
                onError={() => setImagemDisponivel(false)}
              />
            </motion.figure>
          )}
        </motion.div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-[#8390ac]">
          <ShieldCheck className="size-4 text-brand-300" aria-hidden="true" />
          Ambiente seguro e isolado por cliente
        </div>
      </section>

      <section className="flex h-svh min-h-0 flex-col overflow-y-auto bg-surface">
        <div className="flex h-14 shrink-0 items-center bg-brand-950 px-6 lg:hidden">
          <BrandLogo />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-10 lg:px-12">
          <motion.div
            className="w-full max-w-[28rem]"
            initial={reduzirMovimento ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-semibold text-brand-700">Painel de agentes</p>
            <h2 className="mt-1.5 text-3xl font-semibold tracking-[-0.04em] text-ink">
              Acesse sua operação
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Entre com sua conta ou use um dos acessos de demonstração.
            </p>

            <div className="mt-5" aria-label="Contas de demonstração">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                Acesso rápido
              </p>
              <div className="grid grid-cols-2 gap-2">
                {contasDemo.map((conta) => (
                  <button
                    className="button-secondary h-10 justify-between px-3"
                    type="button"
                    onClick={() => preencherConta(conta.email)}
                    key={conta.email}
                  >
                    {conta.nome}
                    <ArrowRight className="size-3.5 text-brand-700" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.12em] text-subtle">
              <span className="h-px flex-1 bg-line" />
              ou use suas credenciais
              <span className="h-px flex-1 bg-line" />
            </div>

            <form className="space-y-4" onSubmit={enviar} noValidate>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#444b66]" htmlFor="email">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <input
                    className="control-field h-11 pl-11 pr-4"
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
                <label className="mb-2 block text-sm font-medium text-[#444b66]" htmlFor="senha">
                  Senha
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <input
                    className="control-field h-11 pl-11 pr-12"
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
                    className="icon-button absolute right-1.5 top-1/2 size-9 -translate-y-1/2"
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

              <button className="button-primary group h-11 w-full" type="submit" disabled={login.isPending}>
                {login.isPending ? 'Entrando...' : 'Entrar no painel'}
                {!login.isPending && <ArrowRight className="size-[1.1rem] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-subtle">
              As contas de demonstração usam a senha <strong className="font-semibold text-muted">senha123</strong>.
            </p>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
