import { useState, useEffect, useRef } from 'react'
import { Search, Filter, Download, Trash2, Edit2, FileText, Share2, X } from 'lucide-react'
import { db } from '../db/db'
import { generateBillPDF } from '../utils/generatePDF'
import { exportBillsToExcel } from '../utils/exportExcel'

const STATUS_STYLE = {
  Paid:    'bg-green-100 text-green-700',
  Unpaid:  'bg-red-100 text-red-700',
  Partial: 'bg-amber-100 text-amber-700',
}

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function BillHistory({ navigate }) {
  const [all, setAll]               = useState([])
  const [filtered, setFiltered]     = useState([])
  const [partyQ, setPartyQ]         = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [statusF, setStatusF]       = useState('All')
  const [suggestions, setSugg]      = useState([])
  const [showSug, setShowSug]       = useState(false)
  const [deleteId, setDeleteId]     = useState(null)
  const [settings, setSettings]     = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    load()
    loadSettings()
    const h = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSug(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const load = async () => {
    const bills = await db.bills.orderBy('createdAt').reverse().toArray()
    setAll(bills)
    setFiltered(bills)
  }

  const loadSettings = async () => {
    const s = await db.settings.toArray()
    const map = {}
    s.forEach(i => { map[i.key] = i.value })
    setSettings(map)
  }

  const applyFilters = (party, from, to, status, source) => {
    let res = source || all
    if (party)           res = res.filter(b => b.partyName.toLowerCase().includes(party.toLowerCase()))
    if (from)            res = res.filter(b => b.date >= from)
    if (to)              res = res.filter(b => b.date <= to)
    if (status !== 'All') res = res.filter(b => b.status === status)
    setFiltered(res)
  }

  const onPartySearch = async val => {
    setPartyQ(val)
    applyFilters(val, dateFrom, dateTo, statusF)
    if (val.length < 1) { setSugg([]); return }
    const res = await db.parties.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).limit(6).toArray()
    setSugg(res)
    setShowSug(res.length > 0)
  }

  const clearFilters = () => {
    setPartyQ(''); setDateFrom(''); setDateTo(''); setStatusF('All')
    setFiltered(all)
  }

  const deleteB = async id => {
    await db.bills.delete(id)
    setDeleteId(null)
    const updated = all.filter(b => b.id !== id)
    setAll(updated)
    applyFilters(partyQ, dateFrom, dateTo, statusF, updated)
  }

  const whatsapp = bill => {
    const msg = `*${settings.businessName || 'Iron Billing'}*\nBill #${String(bill.billNumber).padStart(4,'0')}\nParty: ${bill.partyName}\nDate: ${new Date(bill.date).toLocaleDateString('en-IN')}\nWeight: ${bill.weightKg || (bill.tons * 1000) || 0} KG\nTotal: ₹${Number(bill.total).toLocaleString('en-IN')}\nStatus: ${bill.status}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const totalRev  = filtered.reduce((s, b) => s + Number(b.total), 0)
  const totalWeight = filtered.reduce((s, b) => s + Number(b.weightKg || (b.tons * 1000) || 0), 0)
  const hasFilters = partyQ || dateFrom || dateTo || statusF !== 'All'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">Bill History</h1>
        <button
          onClick={() => exportBillsToExcel(filtered)}
          className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-3.5 py-2 rounded-xl font-medium hover:bg-green-700 transition-colors"
        >
          <Download size={15} /> Excel
        </button>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 space-y-3">
        <div className="relative" ref={searchRef}>
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={partyQ}
            onChange={e => onPartySearch(e.target.value)}
            placeholder="Party name search..."
            className="inp pl-9"
          />
          {showSug && suggestions.length > 0 && (
            <div className="ac-dropdown">
              {suggestions.map(p => (
                <div key={p.id} className="ac-item" onClick={() => {
                  setPartyQ(p.name); setShowSug(false)
                  applyFilters(p.name, dateFrom, dateTo, statusF)
                }}>
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowFilters(s => !s)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors"
        >
          <Filter size={14} /> {showFilters ? 'Hide' : 'More'} Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-teal-500" />}
        </button>

        {showFilters && (
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">From Date</label>
                <input type="date" value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); applyFilters(partyQ, e.target.value, dateTo, statusF) }}
                  className="inp text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">To Date</label>
                <input type="date" value={dateTo}
                  onChange={e => { setDateTo(e.target.value); applyFilters(partyQ, dateFrom, e.target.value, statusF) }}
                  className="inp text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['All','Paid','Unpaid','Partial'].map(s => (
                <button key={s} onClick={() => { setStatusF(s); applyFilters(partyQ, dateFrom, dateTo, s) }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusF === s ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {s}
                </button>
              ))}
              {hasFilters && (
                <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="flex gap-3 mb-3 text-sm">
          <span className="text-slate-400">{filtered.length} bills</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">{totalWeight.toLocaleString('en-IN')} KG</span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-teal-600">{fmt(totalRev)}</span>
        </div>
      )}

      {/* Bills List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-slate-400">Koi bill nahi mila</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const balance = b.status === 'Partial' ? Number(b.total) - Number(b.paidAmount || 0) : 0
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 transition-colors shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-mono text-slate-400">#{String(b.billNumber).padStart(4,'0')}</span>
                      <span className="font-semibold text-slate-800 truncate">{b.partyName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                      {b.synced === 0 && <span className="text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">Pending sync</span>}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(b.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                      {' · '}{b.weightKg || (b.tons * 1000) || 0} KG
                      {' · '}₹{Number(b.ratePerTon).toLocaleString('en-IN')}/T
                      {b.notes && <> · {b.notes}</>}
                    </div>
                    {balance > 0 && (
                      <div className="text-xs text-red-500 mt-0.5">Baki: {fmt(balance)}</div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-bold text-slate-800 text-sm">{fmt(b.total)}</div>
                    <div className="flex gap-1 mt-1.5 justify-end">
                      <button onClick={() => generateBillPDF(b, settings)} title="PDF"
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                        <FileText size={14} />
                      </button>
                      <button onClick={() => whatsapp(b)} title="WhatsApp"
                        className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <Share2 size={14} />
                      </button>
                      <button onClick={() => navigate('new-bill', b)} title="Edit"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(b.id)} title="Delete"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-slate-800 mb-1">Bill delete karna hai?</h3>
            <p className="text-slate-500 text-sm mb-5">Ye undo nahi hoga.</p>
            <div className="flex gap-2">
              <button onClick={() => deleteB(deleteId)}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors">
                Haan, Delete
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}