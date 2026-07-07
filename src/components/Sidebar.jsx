import { Zap, Plus, List, Users, Settings, Wifi, WifiOff, RefreshCw, BookOpen } from 'lucide-react'

const NAV = [
  { id:'dashboard', label:'Dashboard',   Icon:Zap     },
  { id:'new-bill',  label:'New Bill',    Icon:Plus    },
  { id:'history',   label:'Bill History',Icon:List    },
  { id:'parties',   label:'Parties',     Icon:Users   },
  { id:'settings',  label:'Settings',    Icon:Settings},
]

export default function Sidebar({ currentPage, navigate, syncStatus, isOnline }) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40" style={{ background:'#1a3a2a' }}>
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor:'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'rgba(255,255,255,0.15)' }}>
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm tracking-wide">IRON BILLING</div>
            <div className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.5)' }}>Shree Transport</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, Icon }) => {
          const active = currentPage === id || (id === 'parties' && currentPage === 'ledger')
          return (
            <button key={id} onClick={() => navigate(id)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                borderLeft: active ? '3px solid #4ade80' : '3px solid transparent',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
              <Icon size={16} />
              {label}
              {id === 'new-bill' && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium"
                  style={{ background:'rgba(74,222,128,0.2)', color:'#4ade80' }}>New</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Sync Status */}
      <div className="p-4 border-t" style={{ borderColor:'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              {syncStatus === 'syncing'
                ? <RefreshCw size={12} className="animate-spin" style={{ color:'#fbbf24' }} />
                : syncStatus === 'error'
                ? <div className="w-2 h-2 rounded-full bg-red-400" />
                : <Wifi size={12} style={{ color:'#4ade80' }} />}
              <span className="text-xs" style={{ color:'rgba(255,255,255,0.45)' }}>
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync error' : 'Online & Synced'}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={12} style={{ color:'rgba(255,255,255,0.3)' }} />
              <span className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>Offline — data safe</span>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
