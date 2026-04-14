import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { loginRequest, logoutRequest, sessionMeRequest } from '@/lib/api'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthContextValue = {
  status: AuthStatus
  userId: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [userId, setUserId] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    setStatus('loading')
    const me = await sessionMeRequest()
    if (me?.userId) {
      setUserId(me.userId)
      setStatus('authenticated')
    } else {
      setUserId(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const login = useCallback(async (username: string, password: string) => {
    await loginRequest(username, password)
    await refreshSession()
  }, [refreshSession])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUserId(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({ status, userId, login, logout }),
    [status, userId, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
