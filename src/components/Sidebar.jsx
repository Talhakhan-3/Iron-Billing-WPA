import {
  Zap, Plus, List, Users, Settings, Wifi, WifiOff, RefreshCw, Sun, Moon, Monitor
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',    Icon: Zap },
  { id: 'new-bill',  label: 'New Bill',     Icon: Plus, badge: 'Quick' },
  { id: 'history',   label: 'Bill History', Icon: List },
  { id: 'parties',   label: 'Parties',      Icon: Users },
  { id: 'settings',  label: 'Settings',     Icon: Settings },
]

export default function Sidebar({ currentPage, navigate, syncStatus, isOnline }) {
  const { theme, isDark, setTheme } = useTheme()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800/80 shadow-sm transition-colors duration-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-extrabold text-sm tracking-wide">
              IRON BILLING
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              Commercial Transport
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ id, label, Icon, badge }) => {
          const active = currentPage === id || (id === 'parties' && currentPage === 'ledger')
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 text-left cursor-pointer ${
                active
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-l-4 border-emerald-600 dark:border-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-900/60 border-l-4 border-transparent'
              }`}
            >
              <Icon size={17} className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                  active
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom Controls: Theme Switcher & Sync Status */}
      <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/30">
        {/* Theme mode buttons */}
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 px-1">
            Appearance
          </div>
          <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTheme('light')}
              title="Light Mode"
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-white text-emerald-800 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sun size={13} />
              <span className="text-[10px]">Light</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              title="Dark Mode"
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-800 text-emerald-300 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Moon size={13} />
              <span className="text-[10px]">Dark</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              title="System Preference"
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                theme === 'system'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Monitor size={13} />
              <span className="text-[10px]">Auto</span>
            </button>
          </div>
        </div>

        {/* Sync & Connectivity Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px]">
          {isOnline ? (
            <>
              {syncStatus === 'syncing' ? (
                <RefreshCw size={12} className="animate-spin text-amber-500" />
              ) : syncStatus === 'error' ? (
                <div className="w-2 h-2 rounded-full bg-red-500" />
              ) : (
                <Wifi size={12} className="text-emerald-600 dark:text-emerald-400" />
              )}
              <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync error' : 'Online & Ready'}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Offline (Local DB)</span>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
