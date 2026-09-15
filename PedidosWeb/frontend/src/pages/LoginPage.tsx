import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Lock, User, ShoppingCart } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import logoSeven from '@/assets/logo.png'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
    } catch {
      setError('Usuário ou senha inválidos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* ── Painel navy animado ── */}
      <aside className="relative hidden overflow-hidden bg-[#0d1f30] lg:flex lg:items-center lg:justify-center">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />

        <div className="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
          <div className="rounded-2xl bg-white p-5 shadow-2xl">
            <img
              src={logoSeven}
              alt="Seven Sistemas de Automação"
              className="h-14 w-auto object-contain"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#3E7080]" />
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/50">
                Pedidos Web
              </p>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-white/25">
              Gestão de pedidos integrada ao ERP — rápido, seguro e direto do navegador.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { n: '100%', l: 'Web' },
              { n: 'ERP', l: 'Integrado' },
              { n: 'Real', l: 'Time' },
            ].map(({ n, l }) => (
              <div key={l} className="rounded-xl bg-white/5 px-4 py-3">
                <p className="text-base font-bold text-white">{n}</p>
                <p className="mt-0.5 text-[10px] text-white/30">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Formulário ── */}
      <main className="flex flex-col justify-center bg-white px-5 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm space-y-7">
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <img src={logoSeven} alt="Seven Sistemas" className="h-10 w-auto object-contain" />
            <p className="text-[10px] tracking-[0.15em] uppercase text-gray-400">Pedidos Web</p>
          </div>

          <header className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-[#1A2332]">Entrar</h1>
            <p className="mt-1 text-[13px] text-gray-500">Acesse o sistema de pedidos</p>
          </header>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="username" className="text-xs font-medium text-[#1A2332]">
                Usuário
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  id="username" name="username" autoComplete="username"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  className="h-[38px] rounded-md pl-8 text-[13px]"
                  placeholder="seu.usuario" required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-medium text-[#1A2332]">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password" name="password" autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-[38px] rounded-md pl-8 pr-9 text-[13px]"
                  placeholder="••••••••" required
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:text-gray-700 cursor-pointer"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit" size="lg" disabled={loading}
              className="h-[38px] w-full bg-[#13293D] hover:bg-[#1a3a52] text-white"
            >
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Entrando…</>
              ) : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-[11px] text-gray-300">
            Seven Sistemas de Automação © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  )
}
