import { Zap, Plus, List, Users, Settings } from 'lucide-react'

const NAV = [
  { id:'dashboard', label:'Home',     Icon:Zap      },
  { id:'new-bill',  label:'New Bill', Icon:Plus     },
  { id:'history',   label:'History',  Icon:List     },
  { id:'parties',   label:'Parties',  Icon:Users    },
  { id:'settings',  label:'Settings', Icon:Settings },
]

export default function MobileNav({ currentPage, navigate, isOnline }) {
  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 shadow-lg">
      <div className="flex">
        {NAV.map(({ id, label, Icon }) => {
          const active = currentPage === id || (id === 'parties' && currentPage === 'ledger')
          return (
            <button key={id} onClick={() => navigate(id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative"
              style={{ color: active ? '#1a3a2a' : '#94a3b8' }}>
              {id === 'new-bill' ? (
                <div className="w-11 h-11 rounded-full flex items-center justify-center -mt-4 shadow-lg"
                  style={{ background:'#1a3a2a' }}>
                  <Icon size={22} className="text-white" />
                </div>
              ) : (
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              )}
              <span className="text-xs font-medium">{label}</span>
              {active && id !== 'new-bill' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                  style={{ background:'#1a3a2a' }} />
              )}
            </button>
          )
        })}
      </div>
      <div className="h-0.5 transition-colors" style={{ background: isOnline ? '#2d6a4f' : '#e2e8f0' }} />
    </nav>
  )
}
