import { useState, useEffect, useRef } from 'react'
import {
  Search, Filter, Download, Trash2, Edit2, FileText,
  MessageCircle, X, ChevronDown, ChevronRight, ArrowLeft,
  Calendar, Eye, QrCode, Building2, Truck
} from 'lucide-react'
import { db } from '../db/db'
import { exportBillsToExcel } from '../utils/exportExcel'
import { useToast } from './Toast'
import PrintInvoiceModal from './PrintInvoiceModal'
import { generateUPIQR } from '../utils/generateQR'

const STATUS_STYLE = {
  Paid:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Unpaid:  'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
  Partial: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
}

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtD = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// Group bills by "Month Year" string
function groupByMonth(bills) {
  const groups = {}
  bills.forEach(b => {
    const d   = new Date(b.date || Date.now())
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const lbl = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { label: lbl, bills: [] }
    groups[key].bills.push(b)
  })
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, v]) => v)
}

export default function BillHistory({ navigate }) {
  const toast = useToast()

  const [all, setAll] = useState([])
  const [filtered, setFiltered] = useState([])
  const [searchQ, setSearchQ] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusF, setStatusF] = useState('All')
  const [deleteId, setDeleteId] = useState(null)
  const [settings, setSettings] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [activeModalBill, setActiveModalBill] = useState(null)
  const [qrModalData, setQrModalData] = useState(null)
  const [openMonths, setOpenMonths] = useState({})

  useEffect(() => {
    load()
    loadSettings()
  }, [])

  const load = async () => {
    try {
      const bills = await db.bills.orderBy('createdAt').reverse().toArray()
      setAll(bills)
      applyFilters(searchQ, dateFrom, dateTo, statusF, bills)
      
      // Auto-open newest month group
      const groups = groupByMonth(bills)
      if (groups.length > 0) {
        setOpenMonths({ [groups[0].label]: true })
      }
    } catch (e) {
      console.error('Error loading bills', e)
    }
  }

  const loadSettings = async () => {
    const s = await db.settings.toArray()
    const map = {}
    s.forEach(i => { map[i.key] = i.value })
    setSettings(map)
  }

  const applyFilters = (query, from, to, status, source) => {
    let res = source || all
    if (query && query.trim()) {
      const q = query.trim().toLowerCase()
      res = res.filter(b =>
        (b.partyName && b.partyName.toLowerCase().includes(q)) ||
        (b.consigneeName && b.consigneeName.toLowerCase().includes(q)) ||
        (b.vehicleNo && b.vehicleNo.toLowerCase().includes(q)) ||
        (b.billNumber && String(b.billNumber).includes(q))
      )
    }
    if (from) res = res.filter(b => b.date >= from)
    if (to) res = res.filter(b => b.date <= to)
    if (status !== 'All') res = res.filter(b => b.status === status)
    setFiltered(res)
  }

  const onSearchChange = (val) => {
    setSearchQ(val)
    applyFilters(val, dateFrom, dateTo, statusF)
  }

  const clearFilters = () => {
    setSearchQ('')
    setDateFrom('')
    setDateTo('')
    setStatusF('All')
    setFiltered(all)
  }

  const toggleMonth = (lbl) => {
    setOpenMonths(p => ({ ...p, [lbl]: !p[lbl] }))
  }

  const deleteB = async (id) => {
    try {
      await db.bills.delete(id)
      setDeleteId(null)
      const updated = all.filter(b => b.id !== id)
      setAll(updated)
      applyFilters(searchQ, dateFrom, dateTo, statusF, updated)
      toast.success('Bill deleted successfully.')
    } catch (e) {
      toast.error('Could not delete bill: ' + e.message)
    }
  }

  const sendReminder = (bill) => {
    const bizName = settings.businessName || 'Shree Transport'
    const due = bill.status === 'Partial'
      ? Math.max(0, Number(bill.total) - Number(bill.paidAmount || 0))
      : Number(bill.total)

    const msg = [
      `*${bizName}* — Payment Reminder`,
      ``,
      `Dear *${bill.partyName}*,`,
      ``,
      `Bill #${String(bill.billNumber).padStart(5, '0')} dated ${fmtD(bill.date)} ka payment pending hai.`,
      ``,
      `Bill Amount : ${fmt(bill.total)}`,
      bill.status === 'Partial' ? `Paid       : ${fmt(bill.paidAmount || 0)}` : '',
      `*Due Amount : ${fmt(due)}*`,
      ``,
      `Please clear the pending payment. Thank you! 🙏`,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleShowQr = async (bill) => {
    if (!settings.upiId) {
      toast.warning('Configure UPI ID in Settings to show payment QR.')
      return
    }

    const due = bill.status === 'Partial'
      ? Math.max(0, Number(bill.total) - Number(bill.paidAmount || 0))
      : Number(bill.total)

    const qr = await generateUPIQR({
      upiId: settings.upiId,
      name: settings.businessName,
      amount: due,
      billNumber: bill.billNumber,
    })

    setQrModalData({
      bill,
      due,
      qr,
      upiId: settings.upiId,
      name: settings.businessName || 'Iron Billing'
    })
  }

  // Summary Metrics
  const totalBilled = filtered.reduce((s, b) => s + Number(b.total || 0), 0)
  const totalDue = filtered.reduce((s, b) => {
    if (b.status === 'Paid') return s
    if (b.status === 'Partial') return s + Math.max(0, Number(b.total || 0) - Number(b.paidAmount || 0))
    return s + Number(b.total || 0)
  }, 0)

  const monthGroups = groupByMonth(filtered)

  return (
    <div className="space-y-4 pb-14">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bill History</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} bills displayed · Total: {fmt(totalBilled)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportBillsToExcel(filtered, 'Bills_Export')}
            className="flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl font-semibold transition-colors shadow-sm"
          >
            <Download size={14} />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-base p-3.5 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Total Invoiced</div>
          <div className="font-bold text-slate-900 dark:text-white text-lg">{fmt(totalBilled)}</div>
        </div>
        <div className="card-base p-3.5 shadow-sm bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Total Outstanding</div>
          <div className="font-bold text-red-600 dark:text-red-400 text-lg">{fmt(totalDue)}</div>
        </div>
        <div className="card-base p-3.5 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Bill Count</div>
          <div className="font-bold text-slate-900 dark:text-white text-lg">{filtered.length}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card-base p-3.5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQ}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search by party, consignee, bill no (#22104), or vehicle..."
              className="inp pl-10 text-xs"
            />
            {searchQ && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
              showFilters || dateFrom || dateTo || statusF !== 'All'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter size={14} />
            <span>Filters</span>
          </button>
        </div>

        {/* Status Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['All', 'Unpaid', 'Partial', 'Paid'].map(s => (
            <button
              key={s}
              onClick={() => {
                setStatusF(s)
                applyFilters(searchQ, dateFrom, dateTo, s)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusF === s
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {s}
            </button>
          ))}

          {(searchQ || dateFrom || dateTo || statusF !== 'All') && (
            <button
              onClick={clearFilters}
              className="text-xs text-red-500 hover:underline px-2 py-1 ml-auto self-center"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Date Filters Expandable */}
        {showFilters && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fade-in">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => {
                  setDateFrom(e.target.value)
                  applyFilters(searchQ, e.target.value, dateTo, statusF)
                }}
                className="inp text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => {
                  setDateTo(e.target.value)
                  applyFilters(searchQ, dateFrom, e.target.value, statusF)
                }}
                className="inp text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bills Grouped by Month */}
      {monthGroups.length === 0 ? (
        <div className="card-base p-12 text-center text-slate-400 dark:text-slate-500 shadow-sm">
          <FileText size={40} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No matching bills found.</p>
          <p className="text-xs mt-1">Try clearing your filters or create a new bill.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {monthGroups.map(grp => {
            const isOpen = !!openMonths[grp.label]
            const grpTotal = grp.bills.reduce((s, b) => s + Number(b.total || 0), 0)
            const grpDue = grp.bills.reduce((s, b) => {
              if (b.status === 'Paid') return s
              if (b.status === 'Partial') return s + Math.max(0, Number(b.total || 0) - Number(b.paidAmount || 0))
              return s + Number(b.total || 0)
            }, 0)

            return (
              <div key={grp.label} className="card-base shadow-sm overflow-hidden">
                {/* Month Group Header Accordion */}
                <button
                  type="button"
                  onClick={() => toggleMonth(grp.label)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400">
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{grp.label}</div>
                      <div className="text-[11px] text-slate-400">{grp.bills.length} bills</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{fmt(grpTotal)}</div>
                    {grpDue > 0 && (
                      <div className="text-[11px] font-semibold text-red-500">Pending: {fmt(grpDue)}</div>
                    )}
                  </div>
                </button>

                {/* Bills Table / Cards */}
                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {grp.bills.map(b => {
                      const balance = b.status === 'Partial'
                        ? Math.max(0, Number(b.total) - Number(b.paidAmount || 0))
                        : b.status === 'Unpaid' ? Number(b.total) : 0

                      return (
                        <div key={b.id} className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  #{String(b.billNumber).padStart(5, '0')}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${STATUS_STYLE[b.status] || ''}`}>
                                  {b.status}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">
                                  {fmtD(b.date)}
                                </span>
                              </div>

                              {/* Parties & Route */}
                              <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                <span>{b.partyName}</span>
                                <span className="text-slate-400 text-xs">→</span>
                                <span className="text-slate-600 dark:text-slate-300 text-xs font-normal">
                                  {b.consigneeName || '—'}
                                </span>
                              </div>

                              {/* Weight & Item */}
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span>{b.itemDescription} {b.itemSize ? `(${b.itemSize})` : ''}</span>
                                {b.weightKg && (
                                  <>
                                    <span>·</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                      {Number(b.weightKg).toLocaleString('en-IN')} KG ({(Number(b.weightKg)/1000).toFixed(3)} MT)
                                    </span>
                                  </>
                                )}
                                {b.vehicleNo && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono text-[11px]">{b.vehicleNo}</span>
                                  </>
                                )}
                              </div>

                              {balance > 0 && (
                                <div className="text-xs font-bold text-red-500 mt-1">
                                  Due Balance: {fmt(balance)}
                                </div>
                              )}
                            </div>

                            {/* Right side: Amount & Action buttons */}
                            <div className="text-right flex-shrink-0 flex flex-col items-end">
                              <div className="font-bold text-base text-slate-900 dark:text-white">{fmt(b.total)}</div>
                              <div className="text-[11px] text-slate-400">
                                @ ₹{b.ratePerKg}/KG
                              </div>

                              <div className="flex items-center gap-1 mt-2">
                                {/* Print Preview Modal trigger */}
                                <button
                                  onClick={() => setActiveModalBill(b)}
                                  title="Preview & Print Invoice"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                                >
                                  <FileText size={15} />
                                </button>

                                {/* Payment QR */}
                                {balance > 0 && settings.upiId && (
                                  <button
                                    onClick={() => handleShowQr(b)}
                                    title="Show Payment QR"
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors"
                                  >
                                    <QrCode size={15} />
                                  </button>
                                )}

                                {/* WhatsApp Reminder */}
                                {b.status !== 'Paid' && (
                                  <button
                                    onClick={() => sendReminder(b)}
                                    title="Send WhatsApp Reminder"
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/60 transition-colors"
                                  >
                                    <MessageCircle size={15} />
                                  </button>
                                )}

                                {/* Edit Bill */}
                                <button
                                  onClick={() => navigate('new-bill', b)}
                                  title="Edit Bill"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                                >
                                  <Edit2 size={15} />
                                </button>

                                {/* Delete Bill */}
                                <button
                                  onClick={() => setDeleteId(b.id)}
                                  title="Delete Bill"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors"
                                >
                                  <Trash2 size={15} />
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

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="card-base p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
              Delete this Bill?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-5">
              This invoice will be permanently removed from this device and cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteB(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-semibold text-xs transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="card-base p-6 max-w-xs w-full text-center shadow-2xl">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">
              UPI Payment QR
            </h3>
            <p className="text-xs text-slate-500 mb-3 font-mono">
              Bill #{String(qrModalData.bill.billNumber).padStart(5, '0')}
            </p>

            <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-inner mb-3">
              <img src={qrModalData.qr} alt="UPI QR" className="w-48 h-48 block mx-auto" />
            </div>

            <div className="text-lg font-black text-red-600 dark:text-red-400 mb-1">
              Due: ₹{Number(qrModalData.due).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 font-mono mb-4">
              {qrModalData.upiId}
            </div>

            <button
              onClick={() => setQrModalData(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Print / Preview Invoice Modal */}
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
