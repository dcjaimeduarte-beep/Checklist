import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Lock, User, Info } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import logoSeven from '@/assets/logo.png'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('sevenadmin')
  const [password, setPassword] = useState('@Seven2026')
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
      setError('Não foi possível entrar. Verifique usuário e senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#0d1f30] lg:flex lg:items-center lg:justify-center">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <img src={logoSeven} alt="Seven Sistemas" className="h-36 w-auto object-contain drop-shadow-lg" />
          <p className="text-xs font-medium tracking-[0.25em] uppercase text-white/30">
            Reforma Tributária
          </p>
        </div>
      </aside>

      <main className="flex flex-col justify-center bg-white px-5 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <img src={logoSeven} alt="Seven Sistemas" className="h-10 w-auto object-contain" />
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/40">Reforma Tributária</p>
          </div>

          <header className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Entrar</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Acesse o painel de análise tributária</p>
          </header>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="username" className="text-xs font-medium text-foreground">Usuário</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" aria-hidden />
                <Input
                  id="username" name="username" autoComplete="username"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  className="h-[38px] rounded-md border-border bg-white pl-8 text-[13px] placeholder:text-muted-foreground/50"
                  placeholder="seuemail@empresa.com" required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-medium text-foreground">Senha</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" aria-hidden />
                <Input
                  id="password" name="password" autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-[38px] rounded-md border-border bg-white pl-8 pr-9 text-[13px] placeholder:text-muted-foreground/50"
                  placeholder="Digite sua senha" required
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground/40 cursor-pointer hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

            <Button type="submit" size="lg" disabled={loading} className="h-[38px] w-full">
              {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Entrando…</> : 'Entrar'}
            </Button>
          </form>

          <div className="rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
              <div className="text-[11px] leading-relaxed text-amber-700">
                <p className="font-medium">Ambiente de demonstração</p>
                <p className="mt-0.5">
                  Usuário: <code className="rounded bg-amber-100/80 px-1 py-px font-mono text-amber-800">sevenadmin</code>
                  {' · '}
                  Senha: <code className="rounded bg-amber-100/80 px-1 py-px font-mono text-amber-800">@Seven2026</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
