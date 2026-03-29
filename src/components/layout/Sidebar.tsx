import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BookOpen, Bookmark, FileText, CalendarDays, List, CheckSquare,
  LogOut, Menu, X, GraduationCap, Network, ClipboardCheck, Kanban,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/diario',      label: 'Diário de Campo',    icon: BookOpen,     color: 'text-amber-600',  bg: 'bg-amber-50',  activeBg: 'bg-amber-100' },
  { to: '/listas',      label: 'Listas e Memorandos', icon: List,         color: 'text-orange-600', bg: 'bg-orange-50', activeBg: 'bg-orange-100' },
  { to: '/tarefas',     label: 'Tarefas',             icon: CheckSquare,  color: 'text-pink-600',   bg: 'bg-pink-50',   activeBg: 'bg-pink-100' },
  { to: '/bookmarks',   label: 'Favoritos',           icon: Bookmark,     color: 'text-blue-600',   bg: 'bg-blue-50',   activeBg: 'bg-blue-100' },
  { to: '/fichamentos', label: 'Fichamentos',          icon: FileText,       color: 'text-green-600',  bg: 'bg-green-50',  activeBg: 'bg-green-100' },
  { to: '/revisoes',    label: 'Revisões',             icon: ClipboardCheck, color: 'text-teal-600',   bg: 'bg-teal-50',   activeBg: 'bg-teal-100' },
  { to: '/planos',      label: 'Planos',               icon: CalendarDays,   color: 'text-purple-600', bg: 'bg-purple-50', activeBg: 'bg-purple-100' },
  { to: '/submissoes',  label: 'Submissões',           icon: Kanban,         color: 'text-violet-600', bg: 'bg-violet-50', activeBg: 'bg-violet-100' },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, signOut, isDemoMode } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.displayName ?? user?.email ?? 'Usuário'
  const email = user?.email ?? ''
  const avatarUrl = user?.photoURL ?? ''
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">pqLAB</div>
            <div className="text-xs text-gray-400">coLAB/UFF</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md text-gray-500">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Demo badge */}
      {isDemoMode && (
        <div className="mx-4 mt-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 font-medium">Modo Demonstração</p>
          <p className="text-xs text-amber-600">Configure o GitHub para persistência</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, color, activeBg }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? cn(activeBg, color)
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', isActive ? 'bg-white/70' : 'bg-gray-100')}>
                  <Icon className={cn('w-4 h-4', isActive ? color : 'text-gray-500')} />
                </div>
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Separator */}
        <div className="pt-2 pb-1">
          <div className="h-px bg-gray-100 mx-2" />
        </div>

        {/* Mapa de Conhecimento */}
        <NavLink
          to="/mapa"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-indigo-100 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', isActive ? 'bg-white/70' : 'bg-gray-100')}>
                <Network className={cn('w-4 h-4', isActive ? 'text-indigo-600' : 'text-gray-500')} />
              </div>
              <span className="truncate">Visualização em Mapa</span>
            </>
          )}
        </NavLink>
      </nav>

      {/* User area */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <Avatar className="h-8 w-8 flex-shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>
          <button onClick={handleLogout} title="Sair"
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 flex-shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </div>

      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-64">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
