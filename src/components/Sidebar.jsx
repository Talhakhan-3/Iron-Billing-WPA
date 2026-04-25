import { Zap, Plus, List, Users, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',    Icon: Zap },
  { id: 'new-bill',  label: 'New Bill',     Icon: Plus },
  { id: 'history',   label: 'Bill History', Icon: List },
  { id: 'parties',   label: 'Parties',      Icon: Users },
  { id: 'settings',  label: 'Settings',     Icon: Settings },
]

export default function Sidebar({ currentPage, navigate, syncStatus, isOnline }) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Iron Billing</div>
            <div className="text-slate-400 text-xs">Management System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, Icon }) => {
          const active = currentPage === id
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={17} />
              {label}
              {id === 'new-bill' && (
                <span className="ml-auto bg-teal-500/20 text-teal-300 text-xs px-1.5 py-0.5 rounded-md">
                  Quick
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Sync Status */}
      <div className="p-4 border-t border-slate-700/60">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              {syncStatus === 'syncing'
                ? <RefreshCw size={13} className="text-amber-400 animate-spin" />
                : syncStatus === 'error'
                ? <div className="w-2 h-2 rounded-full bg-red-400" />
                : <Wifi size={13} className="text-teal-400" />
              }
              <span className="text-xs text-slate-400">
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync error' : 'Online & Synced'}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-slate-500" />
              <span className="text-xs text-slate-500">Offline — data safe</span>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}