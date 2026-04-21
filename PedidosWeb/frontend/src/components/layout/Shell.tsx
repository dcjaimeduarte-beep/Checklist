import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  PlusCircle,
  LogOut,
  LayoutDashboard,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/AuthContext'
import logoSeven from '@/assets/logo.png'

const NAV = [
  { to: '/cadastros', label: 'Cadastros', icon: BookOpen },
  { to: '/pedidos', label: 'Pedidos', icon: LayoutDashboard },
  { to: '/pedidos/novo', label: 'Novo Pedido', icon: PlusCircle },
]

export function Shell({ children }: { children: ReactNode }) {
  const { logout, userId } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-svh bg-[#F2F5F7]">
      {/* ── Sidebar ── */}
      <aside className="flex w-56 flex-col bg-[#13293D] text-white shadow-xl">
        {/* Logo */}
        <div className="flex items-center justify-center border-b border-white/10 px-4 py-5">
          <div className="rounded-lg bg-white p-2.5">
            <img
              src={logoSeven}
              alt="Seven Sistemas"
              className="h-8 w-auto object-contain"
            />
          </div>
        </div>

        {/* Sistema label */}
        <div className="px-4 pb-2 pt-4">
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5 text-[#3E7080]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Pedidos Web
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 pb-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/pedidos'}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all',
                  isActive
                    ? 'bg-[#3E7080] text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/8 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
            </NavLink>
          ))}
        </nav>

        {/* Footer do sidebar */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3E7080] text-[11px] font-bold text-white">
              {(userId ?? 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-white/80">{userId ?? 'Usuário'}</p>
              <p className="text-[10px] text-white/30">Conectado</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
