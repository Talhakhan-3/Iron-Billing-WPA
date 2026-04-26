import { lazy, Suspense, useState, useEffect } from 'react'
import { syncWithCloud, onSyncStatus } from './db/db'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import { migrateBillNumber } from './db/db'

// Lazy load all page components
const Dashboard   = lazy(() => import('./components/Dashboard'))
const NewBill     = lazy(() => import('./components/NewBill'))
const BillHistory = lazy(() => import('./components/BillHistory'))
const Parties     = lazy(() => import('./components/Parties'))
const Settings    = lazy(() => import('./components/Settings'))

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [editBill, setEditBill] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const unsub = onSyncStatus(setSyncStatus)
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    migrateBillNumber()
    return () => {
      unsub()
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const navigate = (p, data = null) => {
    setEditBill(data)
    setPage(p)
    window.scrollTo(0, 0)
  }

  const pages = {
    dashboard: <Dashboard navigate={navigate} />,
    'new-bill': <NewBill navigate={navigate} editBill={editBill} />,
    history: <BillHistory navigate={navigate} />,
    parties: <Parties />,
    settings: <Settings />,
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar currentPage={page} navigate={navigate} syncStatus={syncStatus} isOnline={isOnline} />
      </div>

      {/* Main Content with Lazy Loading & Suspense */}
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        <div className="page-enter p-4 md:p-6 max-w-5xl mx-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            {pages[page] || pages.dashboard}
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden">
        <MobileNav currentPage={page} navigate={navigate} isOnline={isOnline} />
      </div>
    </div>
  )
}