import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext({
  showToast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5)
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const success = useCallback((msg, duration) => showToast(msg, 'success', duration), [showToast])
  const error = useCallback((msg, duration) => showToast(msg, 'error', duration || 4500), [showToast])
  const warning = useCallback((msg, duration) => showToast(msg, 'warning', duration), [showToast])
  const info = useCallback((msg, duration) => showToast(msg, 'info', duration), [showToast])

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success'
          const isError = t.type === 'error'
          const isWarning = t.type === 'warning'

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl shadow-lg border text-sm font-medium transition-all transform translate-y-0 backdrop-blur-md ${
                isSuccess
                  ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                  : isError
                  ? 'bg-red-50/95 dark:bg-red-950/90 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100'
                  : isWarning
                  ? 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100'
                  : 'bg-slate-900/95 dark:bg-slate-800/95 border-slate-700 text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isSuccess && <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
                {isError && <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0" />}
                {isWarning && <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />}
                {!isSuccess && !isError && !isWarning && <Info size={18} className="text-blue-400 flex-shrink-0" />}
                <span className="truncate">{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
