import { useState, useEffect, useRef } from 'react'
import { Search, Filter, Download, Trash2, Edit2, FileText, MessageCircle, X, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { db } from '../db/db'
import { generateBillPDF } from '../utils/generatePDF'
import { exportBillsToExcel } from '../utils/exportExcel'

const STATUS_STYLE = {
  Paid:    'bg-green-100 text-green-700',
  Unpaid:  'bg-red-100 text-red-700',
  Partial: 'bg-amber-100 text-amber-700',
}
const fmt  = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const fmtD = d => new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})

// Group bills by "Month Year" string
function groupByMonth(bills) {
  const groups = {}
  bills.forEach(b => {
    const d   = new Date(b.date)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const lbl = d.toLocaleDateString('en-IN',{month:'long',year:'numeric'})
    if (!groups[key]) groups[key] = { label: lbl, bills: [] }
    groups[key].bills.push(b)
  })
  // Sort keys descending (newest month first)
  return Object.entries(groups)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .map(([, v]) => v)
}

// ─── PARTY BILL VIEW ─────────────────────────────────────────────────────────
function PartyBillView({ partyName, bills, settings, onBack, navigate }) {
  const [openMonths, setOpenMonths] = useState({})
  const [deleteId,   setDeleteId]   = useState(null)

  const partyBills = bills
    .filter(b => b.partyName === partyName || b.consigneeName === partyName)
    .sort((a,b) => new Date(b.date) - new Date(a.date))

  const groups = groupByMonth(partyBills)

  useEffect(() => {
    // Auto-open first (most recent) month
    if (groups.length > 0) setOpenMonths({ [groups[0].label]: true })
  }, [partyName])

  const toggle = lbl => setOpenMonths(p => ({ ...p, [lbl]: !p[lbl] }))

  const totalBilled = partyBills.reduce((s,b) => s + Number(b.total), 0)
  const totalDue    = partyBills.reduce((s,b) => {
    if (b.status === 'Paid')    return s
    if (b.status === 'Partial') return s + Number(b.total) - Number(b.paidAmount||0)
    return s + Number(b.total)
  }, 0)

  const sendReminder = bill => {
    const bizName = settings.businessName || 'Shree Transport'
    const due = bill.status === 'Partial'
      ? Number(bill.total) - Number(bill.paidAmount||0)
      : Number(bill.total)
    const msg = [
      `*${bizName}* — Payment Reminder`,
      ``,
      `Dear *${partyName}*,`,
      ``,
      `Bill #${String(bill.billNumber).padStart(5,'0')} dated ${fmtD(bill.date)} ka payment pending hai.`,
      ``,
      `Bill Amount : ${fmt(bill.total)}`,
      bill.status === 'Partial' ? `Paid       : ${fmt(bill.paidAmount||0)}` : '',
      `*Due Amount : ${fmt(due)}*`,
      ``,
      `Please jald se payment karein. Dhanyawad 🙏`,
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const deleteB = async id => {
    await db.bills.delete(id); setDeleteId(null); onBack(id)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
          <ArrowLeft size={16} className="text-slate-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-800 truncate">{partyName}</h1>
          <p className="text-xs text-slate-400">{partyBills.length} bills · month-wise</p>
        </div>
        <button onClick={() => exportBillsToExcel(partyBills, partyName)}
          className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-2 rounded-xl font-medium hover:bg-green-700 transition-colors">
          <Download size={13} /> Excel
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="text-xs text-slate-400 mb-1">Total Billed</div>
          <div className="font-bold text-slate-800 text-base">{fmt(totalBilled)}</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-3 shadow-sm">
          <div className="text-xs text-red-400 mb-1">Total Due</div>
          <div className="font-bold text-red-600 text-base">{fmt(totalDue)}</div>
        </div>
      </div>

      {/* Month Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-16 text-slate-300">Koi bill nahi</div>
      ) : (
        <div className="space-y-3">
          {groups.map(grp => {
            const isOpen   = !!openMonths[grp.label]
            const grpTotal = grp.bills.reduce((s,b) => s+Number(b.total), 0)
            const grpDue   = grp.bills.reduce((s,b) => {
              if (b.status==='Paid') return s
              if (b.status==='Partial') return s + Number(b.total) - Number(b.paidAmount||0)
              return s + Number(b.total)
            }, 0)
            return (
              <div key={grp.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Month header — tap to expand */}
                <button onClick={() => toggle(grp.label)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    <div className="text-left">
                      <div className="font-semibold text-slate-700 text-sm">{grp.label}</div>
                      <div className="text-xs text-slate-400">{grp.bills.length} bills</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-700 text-sm">{fmt(grpTotal)}</div>
                    {grpDue > 0 && <div className="text-xs text-red-500">Baki: {fmt(grpDue)}</div>}
                  </div>
                </button>

                {/* Bills in this month */}
                {isOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {grp.bills.map(b => {
                      const balance = b.status==='Partial' ? Number(b.total)-Number(b.paidAmount||0)
                                    : b.status==='Unpaid'  ? Number(b.total) : 0
                      return (
                        <div key={b.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-slate-400">#{String(b.billNumber).padStart(5,'0')}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {fmtD(b.date)}
                                {b.weightKg ? ` · ${Number(b.weightKg).toLocaleString('en-IN')} KG` : ''}
                                {b.vehicleNo ? ` · ${b.vehicleNo}` : ''}
                              </div>
                              {/* Show other party */}
                              <div className="text-xs text-slate-500 mt-0.5">
                                {b.partyName === partyName
                                  ? `→ ${b.consigneeName}`
                                  : `← ${b.partyName}`}
                              </div>
                              {balance > 0 && <div className="text-xs text-red-500 font-medium mt-0.5">Baki: {fmt(balance)}</div>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-sm text-slate-800">{fmt(b.total)}</div>
                              <div className="flex gap-1 mt-1.5 justify-end">
                                <button onClick={() => generateBillPDF(b, settings)}
                                  className="p-1.5 text-slate-400 hover:text-brand-800 hover:bg-brand-50 rounded-lg transition-colors">
                                  <FileText size={13} />
                                </button>
                                {(b.status === 'Unpaid' || b.status === 'Partial') && settings.upiId && (
                                  <button
                                    onClick={async () => {
                                      const due = b.status === 'Partial'
                                        ? Number(b.total) - Number(b.paidAmount || 0)
                                        : Number(b.total)
                                      const { generateUPIQR } = await import('../utils/generateQR.js')
                                      const qr = await generateUPIQR({ upiId: settings.upiId, name: settings.businessName, amount: due, billNumber: b.billNumber })
                                      const win = window.open('', '_blank', 'width=300,height=380')
                                      win.document.write(`<html><body style="text-align:center;font-family:Arial;padding:20px;background:#fff"><h3 style="color:#1a3a2a">Bill #${String(b.billNumber).padStart(5,'0')}</h3><p style="color:#555;font-size:13px">${b.partyName}</p><img src="${qr}" style="width:200px;height:200px;margin:10px auto;display:block"/><p style="font-size:18px;font-weight:bold;color:#b91c1c">Due: ₹${due.toLocaleString('en-IN')}</p><p style="font-size:11px;color:#888">${settings.upiId}</p><p style="font-size:11px;color:#888">Scan with GPay / PhonePe / Paytm</p></body></html>`)
                                    }}
                                    title="Payment QR"
                                    className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="17" width="2" height="2"/><rect x="17" y="19" width="2" height="2"/><rect x="19" y="19" width="2" height="2"/></svg>
                                  </button>
                                )}
                                {b.status !== 'Paid' && (
                                  <button onClick={() => sendReminder(b)}
                                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                    <MessageCircle size={13} />
                                  </button>
                                )}
                                <button onClick={() => navigate('new-bill', b)}
                                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => setDeleteId(b.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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
              <button onClick={() => deleteB(deleteId)} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors">Haan</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN BILL HISTORY ────────────────────────────────────────────────────────
export default function BillHistory({ navigate }) {
  const [all,          setAll]          = useState([])
  const [filtered,     setFiltered]     = useState([])
  const [partyQ,       setPartyQ]       = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [statusF,      setStatusF]      = useState('All')
  const [suggestions,  setSugg]         = useState([])
  const [showSug,      setShowSug]      = useState(false)
  const [deleteId,     setDeleteId]     = useState(null)
  const [settings,     setSettings]     = useState({})
  const [showFilters,  setShowFilters]  = useState(false)
  const [selectedParty,setSelectedParty]= useState(null) // party name for drill-down
  const searchRef = useRef(null)

  useEffect(() => {
    load(); loadSettings()
    const h = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSug(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const load = async () => {
    const bills = await db.bills.orderBy('createdAt').reverse().toArray()
    setAll(bills); setFiltered(bills)
  }

  const loadSettings = async () => {
    const s = await db.settings.toArray()
    const map = {}; s.forEach(i => { map[i.key] = i.value }); setSettings(map)
  }

  const applyFilters = (party, from, to, status, source) => {
    let res = source || all
    if (party)          res = res.filter(b => b.partyName.toLowerCase().includes(party.toLowerCase()) || b.consigneeName?.toLowerCase().includes(party.toLowerCase()))
    if (from)           res = res.filter(b => b.date >= from)
    if (to)             res = res.filter(b => b.date <= to)
    if (status !== 'All') res = res.filter(b => b.status === status)
    setFiltered(res)
  }

  const onPartySearch = async val => {
    setPartyQ(val)
    applyFilters(val, dateFrom, dateTo, statusF)
    if (val.length < 1) { setSugg([]); return }
    const res = await db.parties.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).limit(6).toArray()
    setSugg(res); setShowSug(res.length > 0)
  }

  const clearFilters = () => { setPartyQ(''); setDateFrom(''); setDateTo(''); setStatusF('All'); setFiltered(all) }

  const deleteB = async id => {
    await db.bills.delete(id); setDeleteId(null)
    const updated = all.filter(b => b.id !== id)
    setAll(updated); applyFilters(partyQ, dateFrom, dateTo, statusF, updated)
  }

  const sendReminder = bill => {
    const bizName = settings.businessName || 'Shree Transport'
    const due = bill.status === 'Partial' ? Number(bill.total) - Number(bill.paidAmount||0) : Number(bill.total)
    const msg = [
      `*${bizName}* — Payment Reminder`, ``,
      `Dear *${bill.partyName}*,`, ``,
      `Bill #${String(bill.billNumber).padStart(5,'0')} dated ${fmtD(bill.date)} ka payment pending hai.`, ``,
      `Bill Amount : ${fmt(bill.total)}`,
      bill.status === 'Partial' ? `Paid       : ${fmt(bill.paidAmount||0)}` : '',
      `*Due Amount : ${fmt(due)}*`, ``,
      `Please jald se payment karein. Dhanyawad 🙏`,
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // If a party is selected, show drill-down
  if (selectedParty) {
    return (
      <PartyBillView
        partyName={selectedParty}
        bills={all}
        settings={settings}
        navigate={navigate}
        onBack={(deletedId) => {
          if (deletedId) {
            const updated = all.filter(b => b.id !== deletedId)
            setAll(updated); setFiltered(updated)
          }
          setSelectedParty(null)
        }}
      />
    )
  }

  const hasFilters  = partyQ || dateFrom || dateTo || statusF !== 'All'
  const totalRev    = filtered.reduce((s,b) => s+Number(b.total), 0)
  const totalWeight = filtered.reduce((s,b) => s+Number(b.weightKg||(b.tons*1000)||0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">Bill History</h1>
        <button onClick={() => exportBillsToExcel(filtered)}
          className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-3.5 py-2 rounded-xl font-medium hover:bg-green-700 transition-colors">
          <Download size={15} /> Excel
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 space-y-3">
        <div className="relative" ref={searchRef}>
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={partyQ}
            onChange={e => onPartySearch(e.target.value)}
            placeholder="Party name search..."
            className="inp pl-9" />
          {showSug && suggestions.length > 0 && (
            <div className="ac-dropdown">
              {suggestions.map(p => (
                <div key={p.id} className="ac-item" onClick={() => {
                  setPartyQ(p.name); setShowSug(false)
                  applyFilters(p.name, dateFrom, dateTo, statusF)
                }}>{p.name}</div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setShowFilters(s => !s)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-800 transition-colors">
          <Filter size={14} /> {showFilters ? 'Hide' : 'More'} Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-brand-500" />}
        </button>

        {showFilters && (
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">From Date</label>
                <input type="date" value={dateFrom} className="inp text-sm"
                  onChange={e => { setDateFrom(e.target.value); applyFilters(partyQ, e.target.value, dateTo, statusF) }} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">To Date</label>
                <input type="date" value={dateTo} className="inp text-sm"
                  onChange={e => { setDateTo(e.target.value); applyFilters(partyQ, dateFrom, e.target.value, statusF) }} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['All','Paid','Unpaid','Partial'].map(s => (
                <button key={s} onClick={() => { setStatusF(s); applyFilters(partyQ, dateFrom, dateTo, s) }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    statusF === s ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>{s}</button>
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

      {/* Summary row */}
      {filtered.length > 0 && (
        <div className="flex gap-3 mb-3 text-sm">
          <span className="text-slate-400">{filtered.length} bills</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">{totalWeight.toLocaleString('en-IN')} KG</span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-brand-800">{fmt(totalRev)}</span>
        </div>
      )}

      {/* Bill cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-slate-400">Koi bill nahi mila</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const balance = b.status==='Partial' ? Number(b.total)-Number(b.paidAmount||0) : 0
            const wKg = Number(b.weightKg||(b.tons*1000)||0)
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 transition-colors shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-mono text-slate-400">#{String(b.billNumber).padStart(5,'0')}</span>
                      {/* Party name — TAPPABLE → opens month-wise drill down */}
                      <button
                        onClick={() => setSelectedParty(b.partyName)}
                        className="font-semibold text-slate-800 hover:text-brand-800 hover:underline transition-colors text-left truncate max-w-[140px]">
                        {b.partyName}
                      </button>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {fmtD(b.date)}
                      {' · '}{wKg.toLocaleString('en-IN')} KG
                      {b.vehicleNo ? ` · ${b.vehicleNo}` : ''}
                      {b.consigneeName ? ` → ${b.consigneeName}` : ''}
                    </div>
                    {balance > 0 && <div className="text-xs text-red-500 mt-0.5 font-medium">Baki: {fmt(balance)}</div>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-bold text-slate-800 text-sm">{fmt(b.total)}</div>
                    <div className="flex gap-1 mt-1.5 justify-end">
                      <button onClick={() => generateBillPDF(b, settings)} title="PDF"
                        className="p-1.5 text-slate-400 hover:text-brand-800 hover:bg-brand-50 rounded-lg transition-colors">
                        <FileText size={14} />
                      </button>
                      {(b.status === 'Unpaid' || b.status === 'Partial') && settings.upiId && (
                        <button
                          onClick={async () => {
                            const due = b.status === 'Partial'
                              ? Number(b.total) - Number(b.paidAmount || 0)
                              : Number(b.total)
                            const { generateUPIQR } = await import('../utils/generateQR.js')
                            const qr = await generateUPIQR({ upiId: settings.upiId, name: settings.businessName, amount: due, billNumber: b.billNumber })
                            const win = window.open('', '_blank', 'width=300,height=380')
                            win.document.write(`<html><body style="text-align:center;font-family:Arial;padding:20px;background:#fff"><h3 style="color:#1a3a2a">Bill #${String(b.billNumber).padStart(5,'0')}</h3><p style="color:#555;font-size:13px">${b.partyName}</p><img src="${qr}" style="width:200px;height:200px;margin:10px auto;display:block"/><p style="font-size:18px;font-weight:bold;color:#b91c1c">Due: ₹${due.toLocaleString('en-IN')}</p><p style="font-size:11px;color:#888">${settings.upiId}</p><p style="font-size:11px;color:#888">Scan with GPay / PhonePe / Paytm</p></body></html>`)
                          }}
                          title="Payment QR"
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="17" width="2" height="2"/><rect x="17" y="19" width="2" height="2"/><rect x="19" y="19" width="2" height="2"/></svg>
                        </button>
                      )}
                      {b.status !== 'Paid' && (
                        <button onClick={() => sendReminder(b)} title="Reminder"
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <MessageCircle size={14} />
                        </button>
                      )}
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

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-slate-800 mb-1">Bill delete karna hai?</h3>
            <p className="text-slate-500 text-sm mb-5">Ye undo nahi hoga.</p>
            <div className="flex gap-2">
              <button onClick={() => deleteB(deleteId)} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors">Haan</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
