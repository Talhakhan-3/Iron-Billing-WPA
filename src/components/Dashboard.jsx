import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Package, AlertCircle, Receipt, Plus,
  RefreshCw, ArrowUpRight, Scale, Clock, ChevronRight, FileText
} from 'lucide-react'
import { getAnalytics } from '../services/AnalyticsService'
import { syncWithCloud, getSettings } from '../db/db'
import { useToast } from './Toast'
import PrintInvoiceModal from './PrintInvoiceModal'

const fmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtW = n => `${Number(n || 0).toLocaleString('en-IN')} KG`

const STATUS_STYLE = {
  Paid:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Unpaid:  'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
  Partial: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
}

export default function Dashboard({ navigate }) {
  const toast = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState('today') // today | week | month
  const [activeModalBill, setActiveModalBill] = useState(null)
  const [settings, setSettings] = useState({})

  useEffect(() => {
    load()
    getSettings().then(setSettings)
  }, [])

  const load = async () => {
    try {
      const analytics = await getAnalytics()
      setData(analytics)
    } catch (err) {
      console.error('Error loading analytics', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setRefreshing(true)
    try {
      await syncWithCloud()
      await load()
      toast.success('Synced and refreshed data!')
    } catch (e) {
      toast.error('Sync failed: ' + e.message)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="animate-spin text-emerald-700 mr-2" size={24} />
        <span className="text-sm font-medium">Loading Dashboard Metrics...</span>
      </div>
    )
  }

  if (!data) return null

  const current = data[tab === 'today' ? 'today' : tab === 'week' ? 'thisWeek' : 'thisMonth']
  const maxRev  = Math.max(...data.last7.map(d => d.revenue), 1)

  return (
    <div className="space-y-4 pb-14 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Commercial Dashboard</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
              {data.totalBills} Lifetime Bills
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time iron & steel transport billing overview
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={refreshing}
            title="Refresh & Cloud Sync"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-700 transition-colors shadow-sm"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
          </button>

          <button
            onClick={() => navigate('new-bill')}
            className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Create New Bill</span>
          </button>
        </div>
      </div>

      {/* Period Selection Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit border border-slate-200/60 dark:border-slate-700/60">
        {[
          ['today', 'Today'],
          ['week', 'This Week'],
          ['month', 'This Month']
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === k
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Freight Revenue',
            value: fmt(current.revenue),
            sub: `${current.bills} bills in period`,
            Icon: Receipt,
            bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
          },
          {
            label: 'Weight Dispatched',
            value: fmtW(current.weight),
            sub: `${(current.weight / 1000).toFixed(2)} Metric Tons`,
            Icon: Scale,
            bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
          },
          {
            label: 'Bills Generated',
            value: current.bills,
            sub: 'Invoices created',
            Icon: TrendingUp,
            bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
          },
          {
            label: 'Total Pending Dues',
            value: fmt(data.pendingDues),
            sub: `${data.pendingCount} unpaid/partial`,
            Icon: AlertCircle,
            bg: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60'
          },
        ].map(({ label, value, sub, Icon, bg }) => (
          <div key={label} className="card-base p-4 shadow-sm relative overflow-hidden">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 border ${bg}`}>
              <Icon size={18} />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {value}
            </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
              {label}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Month vs Last Month Performance Comparison */}
      <div className="card-base p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
            Monthly Performance Comparison
          </h2>
          {data.growth >= 0 ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <TrendingUp size={13} /> +{data.growth}% vs Last Month
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-500 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
              <TrendingDown size={13} /> {data.growth}% vs Last Month
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5">
            <div className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
              Current Month
            </div>
            <div className="text-xl font-black text-emerald-900 dark:text-emerald-100">
              {fmt(data.thisMonth.revenue)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {data.thisMonth.tonsFormatted} ({fmtW(data.thisMonth.weight)}) · {data.thisMonth.bills} bills
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
              Previous Month
            </div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
              {fmt(data.lastMonth.revenue)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {data.lastMonth.tonsFormatted} ({fmtW(data.lastMonth.weight)}) · {data.lastMonth.bills} bills
            </div>
          </div>
        </div>
      </div>

      {/* Last 7 Days Daily Revenue Bar Chart */}
      <div className="card-base p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
            Daily Freight Trend (Last 7 Days)
          </h2>
          <span className="text-xs text-slate-400">Peak: {fmt(maxRev)}</span>
        </div>

        <div className="flex items-end gap-2 h-36 pt-2">
          {data.last7.map((day, i) => {
            const pct = maxRev > 0 ? (day.revenue / maxRev) * 100 : 0
            const isToday = i === 6

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 h-full group">
                <div className="w-full flex-1 flex flex-col justify-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 relative ${
                      isToday
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-700 hover:bg-emerald-400'
                    }`}
                    style={{ height: `${Math.max(pct, 6)}%` }}
                  >
                    {/* Hover tool tip */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap pointer-events-none transition-opacity z-10 shadow">
                      {fmt(day.revenue)}
                    </div>
                  </div>
                </div>

                <div className={`text-[11px] font-semibold ${isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {day.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Two Column Grid: Top Parties & Recent Invoices */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top 5 Parties this month */}
        <div className="card-base p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
              Top Parties (This Month)
            </h2>
            <button
              onClick={() => navigate('parties')}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
            >
              All Parties →
            </button>
          </div>

          {data.topParties.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No bills recorded for this month yet.
            </div>
          ) : (
            <div className="space-y-2">
              {data.topParties.map((p, idx) => (
                <div
                  key={p.name}
                  onClick={() => navigate('ledger', { partyName: p.name })}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {p.count} bills · {fmtW(p.weight)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      {fmt(p.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="card-base p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
              Recent Bills
            </h2>
            <button
              onClick={() => navigate('history')}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
            >
              Full History →
            </button>
          </div>

          {data.recentBills.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No recent bills found.
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentBills.map(b => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        #{String(b.billNumber).padStart(5, '0')}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${STATUS_STYLE[b.status] || ''}`}>
                        {b.status}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {b.partyName}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {fmt(b.total)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {b.weightKg ? `${b.weightKg} kg` : ''}
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveModalBill(b)}
                      title="Preview invoice"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                    >
                      <FileText size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invoice Print / Preview Modal */}
      {activeModalBill && (
        <PrintInvoiceModal
          bill={activeModalBill}
          settings={settings}
          onClose={() => setActiveModalBill(null)}
        />
      )}
    </div>
  )
}