import { lazy, Suspense, useState, useEffect } from 'react'
import { syncWithCloud, onSyncStatus, migrateBillNumber } from './db/db'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Sidebar    from './components/Sidebar'
import MobileNav  from './components/MobileNav'
import Login      from './components/Login'
import PartyLedger from './components/PartyLedger'

const Dashboard   = lazy(() => import('./components/Dashboard'))
const NewBill     = lazy(() => import('./components/NewBill'))
const BillHistory = lazy(() => import('./components/BillHistory'))
const Parties     = lazy(() => import('./components/Parties'))
const Settings    = lazy(() => import('./components/Settings'))

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-brand-800 border-t-transparent rounded-full animate-spin" />
  </div>
)

function AppInner() {
  const { user, loading } = useAuth()
  const [page,       setPage]       = useState('dashboard')
  const [pageData,   setPageData]   = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [isOnline,   setIsOnline]   = useState(navigator.onLine)

  useEffect(() => {
    const unsub = onSyncStatus(setSyncStatus)
    const onOn  = () => setIsOnline(true)
    const onOff = () => setIsOnline(false)
    window.addEventListener('online',  onOn)
    window.addEventListener('offline', onOff)
    migrateBillNumber()
    return () => { unsub(); window.removeEventListener('online', onOn); window.removeEventListener('offline', onOff) }
  }, [])

  const navigate = (p, data = null) => {
    setPageData(data)
    setPage(p)
    window.scrollTo(0, 0)
  }

  if (loading) return <Spinner />
  if (!user)   return <Login />

  const renderPage = () => {
    if (page === 'ledger' && pageData?.partyName) {
      return <PartyLedger partyName={pageData.partyName} navigate={navigate} />
    }
    switch (page) {
      case 'dashboard': return <Dashboard navigate={navigate} />
      case 'new-bill':  return <NewBill   navigate={navigate} editBill={pageData} />
      case 'history':   return <BillHistory navigate={navigate} />
      case 'parties':   return <Parties   navigate={navigate} />
      case 'settings':  return <Settings />
      default:          return <Dashboard navigate={navigate} />
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden md:block">
        <Sidebar currentPage={page} navigate={navigate} syncStatus={syncStatus} isOnline={isOnline} />
      </div>
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        <div className="page-enter p-4 md:p-6 max-w-5xl mx-auto">
          <Suspense fallback={<Spinner />}>
            {renderPage()}
          </Suspense>
        </div>
      </main>
      <div className="md:hidden">
        <MobileNav currentPage={page} navigate={navigate} isOnline={isOnline} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
