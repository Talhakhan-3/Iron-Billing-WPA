import { Zap, Plus, List, Users, Settings, Wifi, WifiOff } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Home',    Icon: Zap },
  { id: 'new-bill',  label: 'New Bill', Icon: Plus },
  { id: 'history',   label: 'History',  Icon: List },
  { id: 'parties',   label: 'Parties',  Icon: Users },
  { id: 'settings',  label: 'Settings', Icon: Settings },
]

export default function MobileNav({ currentPage, navigate, isOnline }) {
  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 shadow-lg">
      <div className="flex">
        {NAV.map(({ id, label, Icon }) => {
          const active = currentPage === id
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                active ? 'text-teal-600' : 'text-slate-400'
              } ${id === 'new-bill' ? 'relative' : ''}`}
            >
              {id === 'new-bill' ? (
                <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-4 shadow-lg ${active ? 'bg-teal-600' : 'bg-teal-500'}`}>
                  <Icon size={22} className="text-white" />
                </div>
              ) : (
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              )}
              <span className="text-xs font-medium">{label}</span>
            </button>
          )
        })}
      </div>
      {/* Online indicator */}
      <div className={`h-0.5 ${isOnline ? 'bg-teal-500' : 'bg-slate-200'} transition-colors`} />
    </nav>
  )
}