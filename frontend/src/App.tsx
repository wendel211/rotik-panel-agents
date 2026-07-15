import { LoginPage } from './features/auth/LoginPage'
import { useAuth } from './features/auth/authContext'
import { DashboardPage } from './features/dashboard/DashboardPage'

function App() {
  const { sessao } = useAuth()
  return sessao ? <DashboardPage /> : <LoginPage />
}

export default App
