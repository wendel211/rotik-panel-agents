import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, BookOpen, LayoutGrid, LogOut, Moon, Settings, Sun } from 'lucide-react'

import { obterIniciais } from '../lib/format'
import { useTema } from '../lib/theme'

interface AppShellProps {
  titulo: string
  cliente: { nome: string; email: string }
  acoes?: ReactNode
  aoSair: () => void
  children: ReactNode
}

/**
 * Casca do painel: rail de navegação à esquerda, topo enxuto, conteúdo à direita.
 *
 * Por que rail e não header:
 * um header cheio gasta a faixa horizontal mais valiosa da tela (onde o olho
 * entra) com identidade e conta, que são justamente as informações que o
 * operador menos consulta. O rail move navegação e identidade para o eixo
 * vertical, que sobra, e devolve a faixa do topo para o que importa: onde estou
 * e o que posso fazer aqui.
 *
 * A conta e o "sair" vivem dentro do menu do avatar, no rodapé do rail. Sair é
 * uma ação de baixa frequência e destrutiva de sessão, então não merece um alvo
 * permanente ao lado de ações do dia a dia, onde é clicada por engano.
 */
export function AppShell({ titulo, cliente, acoes, aoSair, children }: AppShellProps) {
  const reduzirMovimento = useReducedMotion()

  return (
    <div className="flex min-h-svh bg-shell text-hi">
      <NavRail cliente={cliente} aoSair={aoSair} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-hairline/70 bg-shell/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
            <motion.h1
              className="truncate text-lg font-semibold tracking-[-0.02em] text-hi"
              initial={reduzirMovimento ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              key={titulo}
            >
              {titulo}
            </motion.h1>
            <div className="flex shrink-0 items-center gap-2">
              <BotaoTema />
              {acoes}
            </div>
          </div>
        </header>

        <main className="shell-grid flex-1 px-5 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  )
}

/**
 * Alterna entre o painel escuro (padrão) e o claro.
 *
 * `aria-pressed` em vez de só `aria-label`: o botão é um toggle com estado, e
 * o leitor de tela precisa anunciar se o modo claro está ligado ou desligado,
 * não apenas que existe um botão ali.
 *
 * A troca é instantânea porque acontece toda em variáveis CSS. Não há refetch,
 * remount nem flash: o navegador só recalcula as cores.
 */
function BotaoTema() {
  const { tema, alternar } = useTema()
  const reduzirMovimento = useReducedMotion()
  const claro = tema === 'claro'

  return (
    <button
      type="button"
      onClick={alternar}
      className="pill relative overflow-hidden"
      aria-pressed={claro}
      title={claro ? 'Voltar ao tema escuro' : 'Usar tema claro'}
    >
      {/* Caixa de altura fixa: os dois ícones ocupam o mesmo espaço enquanto um
          sai e o outro entra, senão o botão saltaria de tamanho na troca. */}
      <span className="relative grid size-4 place-items-center" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={tema}
            className="absolute inset-0 grid place-items-center"
            initial={reduzirMovimento ? false : { opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {claro ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="hidden sm:inline">{claro ? 'Escuro' : 'Claro'}</span>
      <span className="sr-only">Tema claro {claro ? 'ativado' : 'desativado'}</span>
    </button>
  )
}

/**
 * O rail vira barra inferior no mobile. Navegação lateral em tela estreita
 * roubaria largura que o conteúdo não tem para dar.
 */
function NavRail({ cliente, aoSair }: { cliente: { nome: string; email: string }; aoSair: () => void }) {
  return (
    <nav
      aria-label="Navegação principal"
      // `sticky top-0 h-svh` no desktop: o rail acompanha a rolagem em vez de
      // subir com a página. Sticky e não fixed de propósito, porque fixed o
      // tiraria do fluxo do flex e o conteúdo passaria por baixo dele; sticky
      // mantém a coluna reservada e o layout continua sendo o próprio flex.
      //
      // `shrink-0` porque a barra tem largura fixa e não pode ser espremida
      // quando o conteúdo ao lado for largo.
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-hairline bg-rail px-4
                 sm:sticky sm:inset-x-auto sm:top-0 sm:h-svh sm:w-[4.75rem] sm:shrink-0 sm:flex-col sm:justify-start sm:gap-1
                 sm:self-start sm:border-r sm:border-t-0 sm:px-0 sm:py-4"
    >
      <span
        aria-hidden="true"
        className="hidden size-10 place-items-center rounded-xl bg-brand-700 text-[0.7rem] font-black tracking-tight text-white
                   shadow-[0_8px_20px_-8px_rgba(41,93,255,.9)] sm:grid"
      >
        Rtk
      </span>

      <span className="my-3 hidden h-px w-8 bg-hairline sm:block" aria-hidden="true" />

      <RailLink icone={<LayoutGrid className="size-[1.15rem]" />} rotulo="Painel" ativo />
      <RailLink icone={<Activity className="size-[1.15rem]" />} rotulo="Execuções" />
      <RailLink icone={<BookOpen className="size-[1.15rem]" />} rotulo="Documentação" />
      <RailLink icone={<Settings className="size-[1.15rem]" />} rotulo="Configurações" />

      <span className="hidden flex-1 sm:block" aria-hidden="true" />

      <MenuConta cliente={cliente} aoSair={aoSair} />
    </nav>
  )
}

/**
 * Itens sem destino ficam desabilitados de verdade, com `aria-disabled` e title.
 *
 * O MVP tem uma tela só. Um link que parece navegável e não vai a lugar nenhum
 * é pior que a ausência dele: o avaliador clica e conclui que está quebrado.
 * Aqui eles existem para dar a moldura do produto e admitem que estão fora do
 * escopo.
 */
function RailLink({ icone, rotulo, ativo = false }: { icone: ReactNode; rotulo: string; ativo?: boolean }) {
  if (!ativo) {
    return (
      <span
        className="rail-item cursor-not-allowed opacity-35"
        title={`${rotulo} (fora do escopo do MVP)`}
        aria-disabled="true"
      >
        {icone}
        <span className="sr-only">{rotulo}, indisponível neste MVP</span>
      </span>
    )
  }

  return (
    <a href="#conteudo" className="rail-item bg-brand-700/15 text-accent" aria-current="page" title={rotulo}>
      {/* Indicador de página ativa: barra na borda do rail, como no produto. */}
      <span className="absolute left-0 h-6 w-0.5 rounded-r-full bg-brand-600" aria-hidden="true" />
      {icone}
      <span className="sr-only">{rotulo}</span>
    </a>
  )
}

/** Avatar com menu. Guarda a identidade da conta e o sair. */
function MenuConta({ cliente, aoSair }: { cliente: { nome: string; email: string }; aoSair: () => void }) {
  const [aberto, setAberto] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const gatilho = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return

    function aoClicarFora(evento: MouseEvent) {
      if (!container.current?.contains(evento.target as Node)) setAberto(false)
    }
    function aoTeclar(evento: KeyboardEvent) {
      // Esc fecha e devolve o foco ao gatilho, senão o foco fica órfão no body
      // e a navegação por teclado recomeça do topo da página.
      if (evento.key === 'Escape') {
        setAberto(false)
        gatilho.current?.focus()
      }
    }

    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  return (
    <div className="relative" ref={container}>
      <button
        ref={gatilho}
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="grid size-10 place-items-center rounded-xl bg-panel-2 text-xs font-bold text-accent ring-1 ring-hairline
                   transition duration-200 hover:ring-brand-700/60"
      >
        {obterIniciais(cliente.nome)}
        <span className="sr-only">Conta de {cliente.nome}</span>
      </button>

      {aberto && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-full left-0 z-40 mb-2 w-60 overflow-hidden rounded-xl border border-hairline bg-panel p-1.5
                     shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)] sm:bottom-0 sm:left-full sm:mb-0 sm:ml-2"
        >
          <div className="border-b border-hairline px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-semibold text-hi">{cliente.nome}</p>
            <p className="truncate text-xs text-lo">{cliente.email}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={aoSair}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-lo
                       transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair da conta
          </button>
        </motion.div>
      )}
    </div>
  )
}
