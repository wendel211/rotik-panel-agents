import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'

// Fontes self-hosted, antes do index.css para o CSS já poder referenciá-las.
//
// Antes o CSS pedia "Inter" e nada carregava a fonte, então o painel inteiro
// caía no Segoe UI e os números no Consolas. Era só uma declaração sem lastro.
//
// Variable em vez de pesos soltos: um arquivo cobre 100..900, então dá para
// usar qualquer peso sem multiplicar requests.
//
// Via npm e não Google Fonts: evita request a terceiro no caminho crítico,
// funciona offline e não vaza IP do usuário para outro domínio.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { queryClient } from './lib/queryClient.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
