import { useCallback, useEffect, useState } from 'react'

export type Tema = 'escuro' | 'claro'

const CHAVE_TEMA = 'rotik:tema'

/**
 * O escuro é o padrão, por decisão de produto.
 *
 * De propósito NÃO seguimos `prefers-color-scheme`: o painel operacional da
 * Rotik é escuro, e herdar o tema do sistema faria a maioria dos usuários cair
 * numa versão que não é a identidade do produto. O claro existe para quem
 * escolhe, não como default acidental de quem usa Windows.
 */
const TEMA_PADRAO: Tema = 'escuro'

export function lerTema(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE_TEMA)
    return valor === 'claro' || valor === 'escuro' ? valor : TEMA_PADRAO
  } catch {
    // Modo privado ou storage bloqueado. Cair no padrão é melhor que quebrar.
    return TEMA_PADRAO
  }
}

/**
 * O CSS já nasce escuro (o @theme é o escuro), então o atributo só é escrito
 * quando o tema é claro. Sem atributo = escuro, o que faz o primeiro paint
 * nunca piscar no tema errado.
 */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement
  if (tema === 'claro') raiz.setAttribute('data-theme', 'light')
  else raiz.removeAttribute('data-theme')
}

export function useTema(): { tema: Tema; alternar: () => void } {
  const [tema, setTema] = useState<Tema>(lerTema)

  useEffect(() => {
    aplicarTema(tema)
    try {
      localStorage.setItem(CHAVE_TEMA, tema)
    } catch {
      // Preferência não persiste em modo privado. A sessão atual segue certa.
    }
  }, [tema])

  const alternar = useCallback(() => {
    setTema((atual) => (atual === 'escuro' ? 'claro' : 'escuro'))
  }, [])

  return { tema, alternar }
}
