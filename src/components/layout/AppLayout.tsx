import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Search, Settings, Building2, ScanSearch } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Analyser URL', icon: Search, end: true },
  { to: '/search', label: 'Rechercher', icon: ScanSearch },
  { to: '/opportunities', label: 'Opportunités', icon: BarChart3 },
  { to: '/settings', label: 'Paramètres', icon: Settings },
]

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">ImmoAgent</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">LMNP · Île-de-France</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
