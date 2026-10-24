import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'

export default function ThemeToggle({ compact = false }) {
  const { isDark, setTheme, toggleTheme } = useTheme()

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        {isDark ? (
          <Sun size={16} className="text-amber-400" />
        ) : (
          <Moon size={16} className="text-slate-600" />
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          !isDark
            ? 'bg-white text-emerald-800 shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Sun size={13} className={!isDark ? 'text-amber-500' : 'text-slate-400'} />
        <span>Light</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          isDark
            ? 'bg-slate-700 text-emerald-300 shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Moon size={13} className={isDark ? 'text-amber-400' : 'text-slate-400'} />
        <span>Dark</span>
      </button>
    </div>
  )
}
