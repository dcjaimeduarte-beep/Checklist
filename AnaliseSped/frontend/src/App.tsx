import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { ConfrontProvider } from '@/confront/ConfrontContext'
import { LoginPage } from '@/pages/LoginPage'
import { UploadPage } from '@/pages/UploadPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/* ── Page state ─────────────────────────────────────────────────── */
type PageId = 'upload' | 'resultados'

const PAGE_STORAGE_KEY = 'analisesped:activePage'

const PageContext = createContext<{
  page: PageId
  setPage: (p: PageId) => void
}>({ page: 'upload', setPage: () => {} })

export function usePage() {
  return useContext(PageContext)
}

function getInitialPage(): PageId {
  const stored = sessionStorage.getItem(PAGE_STORAGE_KEY)
  if (stored === 'upload' || stored === 'resultados') return stored
  return 'upload'
}

function PageProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageId>(getInitialPage)

  useEffect(() => {
    sessionStorage.setItem(PAGE_STORAGE_KEY, page)
  }, [page])

  useEffect(() => {
    if (window.location.hash || window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/')
    }
  }, [page])

  return (
    <PageContext.Provider value={{ page, setPage }}>
      {children}
    </PageContext.Provider>
  )
}

function AuthenticatedApp() {
  const { page } = usePage()

  useEffect(() => {
    document.title = page === 'resultados' ? 'AnaliseSped | Resultado' : 'AnaliseSped | Confronto'
  }, [page])

  return page === 'resultados' ? <ResultsPage /> : <UploadPage />
}

function AppRoot() {
  const { status } = useAuth()

  useEffect(() => {
    if (status === 'anonymous') document.title = 'AnaliseSped | Login'
  }, [status])

  if (status === 'loading') return null
  if (status === 'anonymous') return <LoginPage />
  return <AuthenticatedApp />
}

function App() {
  return (
    <AuthProvider>
      <ConfrontProvider>
        <PageProvider>
          <AppRoot />
        </PageProvider>
      </ConfrontProvider>
    </AuthProvider>
  )
}

export default App
