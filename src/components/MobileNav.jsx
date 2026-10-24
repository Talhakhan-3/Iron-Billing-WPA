import { Zap, Plus, List, Users, Settings } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Home',     Icon: Zap },
  { id: 'history',   label: 'History',  Icon: List },
  { id: 'new-bill',  label: 'New Bill', Icon: Plus, isAction: true },
  { id: 'parties',   label: 'Parties',  Icon: Users },
  { id: 'settings',  label: 'Settings', Icon: Settings },
]

export default function MobileNav({ currentPage, navigate, isOnline }) {
  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50 shadow-lg no-print">
      <div className="flex items-center justify-around">
        {NAV.map(({ id, label, Icon, isAction }) => {
          const active = currentPage === id || (id === 'parties' && currentPage === 'ledger')

          if (isAction) {
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                className="flex flex-col items-center justify-center -mt-5 relative focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 transition-transform active:scale-95">
                  <Icon size={22} />
                </div>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 mt-0.5">
                  {label}
                </span>
              </button>
            )
          }

          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`flex-1 flex flex-col items-center py-2 transition-colors relative ${
                active
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] mt-0.5">{label}</span>
              {active && (
                <div className="absolute bottom-0 w-6 h-0.5 rounded-full bg-emerald-700 dark:bg-emerald-400" />
              )}
            </button>
          )
        })}
      </div>
      <div className={`h-0.5 transition-colors ${isOnline ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`} />
    </nav>
  )
}
