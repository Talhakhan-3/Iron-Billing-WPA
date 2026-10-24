import { lazy, Suspense, useState, useEffect } from 'react'
import { syncWithCloud, onSyncStatus, migrateBillNumber } from './db/db'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider } from './lib/ThemeContext'
import { ToastProvider } from './components/Toast'
import Sidebar    from './components/Sidebar'
import MobileNav  from './components/MobileNav'
import Login      from './components/Login'
import PartyLedger from './components/PartyLedger'
import ThemeToggle from './components/ThemeToggle'
import { Zap, Plus, Wifi, WifiOff } from 'lucide-react'

const Dashboard   = lazy(() => import('./components/Dashboard'))
const NewBill     = lazy(() => import('./components/NewBill'))
const BillHistory = lazy(() => import('./components/BillHistory'))
const Parties     = lazy(() => import('./components/Parties'))
const Settings    = lazy(() => import('./components/Settings'))

const Spinner = () => (
  <div className="flex items-center justify-center h-64 text-slate-400">
    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

const PAGE_TITLES = {
  dashboard: 'Commercial Overview',
  'new-bill': 'New Transport Bill',
  history: 'Invoice & Bill History',
  parties: 'Parties & Transporters',
  settings: 'System & Profile Settings',
  ledger: 'Party Ledger Account',
}

function AppInner() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [pageData, setPageData] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const unsub = onSyncStatus(setSyncStatus)
    const onOn  = () => setIsOnline(true)
    const onOff = () => setIsOnline(false)
    window.addEventListener('online', onOn)
    window.addEventListener('offline', onOff)
    migrateBillNumber()

    // Global keyboard shortcuts
    const handleGlobalKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey) {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault()
          navigate('new-bill')
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault()
          navigate('history')
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault()
          navigate('dashboard')
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeys)

    return () => {
      unsub()
      window.removeEventListener('online', onOn)
      window.removeEventListener('offline', onOff)
      window.removeEventListener('keydown', handleGlobalKeys)
    }
  }, [])

  const navigate = (p, data = null) => {
    setPageData(data)
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <Spinner />
  if (!user) return <Login />

  const renderPage = () => {
    if (page === 'ledger' && pageData?.partyName) {
      return <PartyLedger partyName={pageData.partyName} navigate={navigate} />
    }
    switch (page) {
      case 'dashboard': return <Dashboard navigate={navigate} />
      case 'new-bill':  return <NewBill navigate={navigate} editBill={pageData} />
      case 'history':   return <BillHistory navigate={navigate} />
      case 'parties':   return <Parties navigate={navigate} />
      case 'settings':  return <Settings />
      default:          return <Dashboard navigate={navigate} />
    }
  }

  const currentTitle = page === 'ledger' && pageData?.partyName
    ? `Ledger — ${pageData.partyName}`
    : PAGE_TITLES[page] || 'Iron Billing'

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          currentPage={page}
          navigate={navigate}
          syncStatus={syncStatus}
          isOnline={isOnline}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-60 pb-20 md:pb-6 min-w-0">
        {/* Top Header Bar on both Desktop and Mobile */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-6 py-2.5 flex items-center justify-between no-print transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <span className="md:hidden font-extrabold text-sm tracking-wide text-emerald-700 dark:text-emerald-400">
              IRON BILLING
            </span>
            <span className="hidden md:inline font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
              {currentTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {page !== 'new-bill' && (
              <button
                type="button"
                onClick={() => navigate('new-bill')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>New Bill</span>
              </button>
            )}
            <ThemeToggle showLabel={false} />
          </div>
        </header>

        <div className="page-enter p-3 sm:p-5 md:p-6 max-w-5xl mx-auto">
          <Suspense fallback={<Spinner />}>
            {renderPage()}
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileNav
          currentPage={page}
          navigate={navigate}
          isOnline={isOnline}
        />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
