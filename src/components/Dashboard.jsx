import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Package, AlertCircle, Receipt, Plus, RefreshCw } from 'lucide-react'
import { getAnalytics } from '../services/AnalyticsService'
import { syncWithCloud } from '../db/db'

const fmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtW = n => `${Number(n || 0).toLocaleString('en-IN')} KG`

const STATUS_STYLE = {
  Paid:    'bg-green-100 text-green-700',
  Unpaid:  'bg-red-100 text-red-700',
  Partial: 'bg-amber-100 text-amber-700',
}

export default function Dashboard({ navigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('today') // today | week | month

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const analytics = await getAnalytics()
    setData(analytics)
    setLoading(false)
  }

  const handleSync = async () => {
    await syncWithCloud()
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-brand-800" size={28} />
    </div>
  )

  const current = data[tab === 'today' ? 'today' : tab === 'week' ? 'thisWeek' : 'thisMonth']
  const maxRev  = Math.max(...data.last7.map(d => d.revenue), 1)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-400 text-sm">{data.totalBills} total bills in system</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} className="p-2 text-slate-400 hover:text-brand-800 rounded-lg hover:bg-brand-50 transition-colors">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => navigate('new-bill')}
            className="flex items-center gap-1.5 bg-brand-800 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-brand-900 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Bill
          </button>
        </div>
      </div>

      {/* Period Tab */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['today','Today'],['week','This Week'],['month','This Month']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Revenue',      value: fmt(current.revenue),  Icon: Receipt,      color: 'teal'  },
          { label: 'Weight Moved', value: fmtW(current.weight), Icon: Package, color: 'blue' },
          { label: 'Bills Created',value: current.bills,         Icon: TrendingUp,   color: 'purple'},
          { label: 'Pending Dues', value: fmt(data.pendingDues), Icon: AlertCircle,  color: 'red'   },
        ].map(({ label, value, Icon, color }) => {
          const colors = {
            teal:   'bg-brand-50 text-brand-800',
            blue:   'bg-blue-50 text-blue-700',
            purple: 'bg-purple-50 text-purple-700',
            red:    'bg-red-50 text-red-600',
          }
          return (
            <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
                <Icon size={18} />
              </div>
              <div className="text-lg font-bold text-slate-800 leading-tight">{value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          )
        })}
      </div>

      {/* Month vs Last Month Comparison */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700 text-sm">This Month vs Last Month</h2>
          {data.growth >= 0
            ? <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><TrendingUp size={15} />+{data.growth}%</span>
            : <span className="flex items-center gap-1 text-red-500 text-sm font-medium"><TrendingDown size={15} />{data.growth}%</span>
          }
        </div>
        <div className="flex gap-4">
          <div className="flex-1 bg-brand-50 rounded-xl p-3">
            <div className="text-xs text-brand-800 font-medium mb-1">This Month</div>
            <div className="text-lg font-bold text-brand-800">{fmt(data.thisMonth.revenue)}</div>
            <div className="text-xs text-slate-400">{fmtW(data.thisMonth.weight)} · {data.thisMonth.bills} bills</div>
          </div>
          <div className="flex-1 bg-slate-50 rounded-xl p-3">
            <div className="text-xs text-slate-500 font-medium mb-1">Last Month</div>
            <div className="text-lg font-bold text-slate-600">{fmt(data.lastMonth.revenue)}</div>
            <div className="text-xs text-slate-400">{fmtW(data.lastMonth.weight)} · {data.lastMonth.bills} bills</div>
          </div>
        </div>
      </div>

      {/* Last 7 Days Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Last 7 Days Revenue</h2>
        <div className="flex items-end gap-2 h-28">
          {data.last7.map((day, i) => {
            const pct = maxRev > 0 ? (day.revenue / maxRev) * 100 : 0
            const isToday = i === 6
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-brand-500' : 'bg-slate-200'}`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={fmt(day.revenue)}
                  />
                </div>
                <div className={`text-xs font-medium ${isToday ? 'text-brand-800' : 'text-slate-400'}`}>{day.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent Bills */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700 text-sm">Recent Bills</h2>
            <button onClick={() => navigate('history')} className="text-xs text-brand-800 hover:underline">View all</button>
          </div>
          {data.recentBills.length === 0 ? (
            <div className="text-center py-8 text-slate-300 text-sm">No bills yet</div>
          ) : (
            <div className="space-y-2">
              {data.recentBills.map(b => (
                <div key={b.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors" onClick={() => navigate('history')}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{b.partyName}</div>
                    <div className="text-xs text-slate-400">#{String(b.billNumber).padStart(4,'0')} · {new Date(b.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</div>
                  </div>
                  <div className="ml-2 text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-slate-700">{fmt(b.total)}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Dues */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700 text-sm">Pending Dues</h2>
            <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{data.pendingCount} bills</span>
          </div>
          {data.pendingBills.length === 0 ? (
            <div className="text-center py-8 text-slate-300 text-sm">🎉 All clear!</div>
          ) : (
            <div className="space-y-2">
              {data.pendingBills.map(b => {
                const due = b.status === 'Partial'
                  ? Number(b.total) - Number(b.paidAmount || 0)
                  : Number(b.total)
                return (
                  <div key={b.id} className="flex items-center justify-between p-2.5 rounded-xl bg-red-50/50 hover:bg-red-50 cursor-pointer transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{b.partyName}</div>
                      <div className="text-xs text-slate-400">{new Date(b.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
                    </div>
                    <div className="ml-2 text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-red-600">{fmt(due)}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Parties */}
        {data.topParties.length > 0 && (
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <h2 className="font-semibold text-slate-700 text-sm mb-3">Top Parties — This Month</h2>
            <div className="space-y-2.5">
              {data.topParties.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{p.name}</span>
                      <span className="text-sm font-semibold text-brand-800 ml-2 flex-shrink-0">{fmt(p.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                        <div className="bg-brand-500 h-1.5 rounded-full"
                          style={{ width: `${(p.revenue / data.topParties[0].revenue) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{fmtW(p.weight)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}