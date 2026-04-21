import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { PedidosPage } from '@/pages/PedidosPage'
import { NovoPedidoPage } from '@/pages/NovoPedidoPage'
import { DetalhePedidoPage } from '@/pages/DetalhePedidoPage'
import { CadastrosPage } from '@/pages/CadastrosPage'
import { Shell } from '@/components/layout/Shell'
import { applyTheme } from '@/theme/applyTheme'

applyTheme()

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>
}

function AppRoot() {
  const { status } = useAuth()

  useEffect(() => {
    if (status === 'anonymous') document.title = 'PedidosWeb | Login'
    else document.title = 'PedidosWeb'
  }, [status])

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#F2F5F7]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#13293D] border-t-transparent" />
      </div>
    )
  }

  if (status === 'anonymous') return <LoginPage />

  return (
    <ProtectedLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/pedidos" replace />} />
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/pedidos/novo" element={<NovoPedidoPage />} />
        <Route path="/pedidos/:id" element={<DetalhePedidoPage />} />
        <Route path="/cadastros" element={<CadastrosPage />} />
        <Route path="*" element={<Navigate to="/pedidos" replace />} />
      </Routes>
    </ProtectedLayout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
