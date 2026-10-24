import { useState, useEffect } from 'react'
import { ArrowLeft, Download, MessageCircle, Phone, TrendingDown, Eye, FileText, CheckCircle2 } from 'lucide-react'
import { db } from '../db/db'
import { exportPartyLedger } from '../utils/exportExcel'
import { useToast } from './Toast'
import PrintInvoiceModal from './PrintInvoiceModal'

const fmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtD = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_STYLE = {
  Paid:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Unpaid:  'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
  Partial: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
}

export default function PartyLedger({ partyName, navigate }) {
  const toast = useToast()

  const [party, setParty] = useState(null)
  const [bills, setBills] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeModalBill, setActiveModalBill] = useState(null)

  useEffect(() => {
    load()
  }, [partyName])

  const load = async () => {
    setLoading(true)
    try {
      const cleanName = (partyName || '').trim().toLowerCase()

      // Find party record
      const partyRecord = await db.parties
        .filter(p => p.name.toLowerCase() === cleanName)
        .first()

      // Fetch all bills where party is consignor OR consignee
      const allBills = await db.bills
        .filter(b => 
          (b.partyName && b.partyName.toLowerCase() === cleanName) ||
          (b.consigneeName && b.consigneeName.toLowerCase() === cleanName)
        )
        .toArray()

      // Fetch settings
      const allSettings = await db.settings.toArray()
      const sMap = {}
      allSettings.forEach(s => { sMap[s.key] = s.value })

      setSettings(sMap)
      setParty(partyRecord || { name: partyName })
      // Sort newest first
      setBills([...allBills].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).reverse())
    } catch (e) {
      console.error('Error loading party ledger:', e)
      toast.error('Could not load ledger: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Calculations with floating-point safety
  const totalBilled = Math.round(bills.reduce((s, b) => s + Number(b.total || 0), 0) * 100) / 100
  const totalPaid = Math.round(bills.reduce((s, b) => {
    if (b.status === 'Paid') return s + Number(b.total || 0)
    if (b.status === 'Partial') return s + Number(b.paidAmount || 0)
    return s
  }, 0) * 100) / 100
  const totalDue = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100)
  const unpaidBills = bills.filter(b => b.status !== 'Paid')

  // WhatsApp summary reminder for all pending bills
  const sendOverallReminder = () => {
    const bizName = settings.businessName || 'Shree Transport'
    const ph = party?.phone || ''
    const lines = unpaidBills.slice(0, 5).map(b => {
      const due = b.status === 'Partial'
        ? Math.max(0, Number(b.total) - Number(b.paidAmount || 0))
        : Number(b.total)
      return `  • Bill #${String(b.billNumber).padStart(5, '0')} (${fmtD(b.date)}) — Due: ${fmt(due)}`
    })

    const msg = [
      `*${bizName}* — Statement & Payment Reminder`,
      ``,
      `Dear *${partyName}*,`,
      ``,
      `Aapke ledger account ka outstanding summary:`,
      ...lines,
      unpaidBills.length > 5 ? `  ...aur ${unpaidBills.length - 5} aur bills` : '',
      ``,
      `*Total Pending Balance: ${fmt(totalDue)}*`,
      ``,
      `Please payment schedule review karke clear karein. Thank you! 🙏`,
    ].filter(Boolean).join('\n')

    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // WhatsApp reminder for single bill
  const sendSingleReminder = (bill) => {
    const bizName = settings.businessName || 'Shree Transport'
    const ph = party?.phone || ''
    const due = bill.status === 'Partial'
      ? Math.max(0, Number(bill.total) - Number(bill.paidAmount || 0))
      : Number(bill.total)

    const msg = [
      `*${bizName}* — Payment Reminder`,
      ``,
      `Dear *${partyName}*,`,
      ``,
      `Bill #${String(bill.billNumber).padStart(5, '0')} dated ${fmtD(bill.date)} ka payment pending hai.`,
      ``,
      `Bill Amount : ${fmt(bill.total)}`,
      bill.status === 'Partial' ? `Paid       : ${fmt(bill.paidAmount || 0)}` : '',
      `*Due Amount : ${fmt(due)}*`,
      ``,
      `Please clear the pending payment. Dhanyawad 🙏`,
    ].filter(Boolean).join('\n')

    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-sm">Loading ledger for {partyName}...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-14 animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('parties')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{partyName}</span>
              {party?.type && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {party.type}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Complete Party Ledger Statement · {bills.length} transactions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {party?.phone && (
            <a
              href={`tel:${party.phone}`}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors shadow-sm"
              title="Call Party"
            >
              <Phone size={15} />
            </a>
          )}
          <button
            onClick={() => exportPartyLedger(partyName, [...bills].reverse())}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Download size={13} />
            <span>Excel Statement</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-base p-4 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60">
          <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium mb-1">Total Invoiced</div>
          <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{fmt(totalBilled)}</div>
        </div>

        <div className="card-base p-4 shadow-sm bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60">
          <div className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">Total Paid / Cleared</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{fmt(totalPaid)}</div>
        </div>

        <div className={`card-base p-4 shadow-sm ${
          totalDue > 0
            ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
            : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
        }`}>
          <div className={`text-xs font-medium mb-1 ${totalDue > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
            Net Outstanding Due
          </div>
          <div className={`text-xl font-bold ${totalDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {fmt(totalDue)}
          </div>
        </div>
      </div>

      {/* WhatsApp reminder for ALL pending dues */}
      {totalDue > 0 && (
        <button
          onClick={sendOverallReminder}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
        >
          <MessageCircle size={16} />
          <span>Send Overall WhatsApp Statement ({fmt(totalDue)} Due)</span>
        </button>
      )}

      {/* Bills / Ledger Entries List */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Transaction History ({bills.length})
        </h3>

        {bills.length === 0 ? (
          <div className="card-base p-12 text-center text-slate-400 dark:text-slate-500 shadow-sm">
            <TrendingDown size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No billing records found for this party.</p>
          </div>
        ) : (
          <div className="card-base divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
            {bills.map(b => {
              const paid = b.status === 'Paid' ? Number(b.total) : Number(b.paidAmount || 0)
              const due = Math.max(0, Number(b.total) - paid)
              const isConsignor = b.partyName?.toLowerCase() === partyName.toLowerCase()

              return (
                <div key={b.id} className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          #{String(b.billNumber).padStart(5, '0')}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${STATUS_STYLE[b.status] || ''}`}>
                          {b.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {fmtD(b.date)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {isConsignor ? `To: ${b.consigneeName || 'Direct'}` : `From: ${b.partyName}`}
                        </span>
                        <span>·</span>
                        <span>{b.itemDescription} {b.itemSize ? `(${b.itemSize})` : ''}</span>
                        {b.weightKg && (
                          <>
                            <span>·</span>
                            <span>{Number(b.weightKg).toLocaleString('en-IN')} KG</span>
                          </>
                        )}
                        {b.vehicleNo && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{b.vehicleNo}</span>
                          </>
                        )}
                      </div>

                      {due > 0 && (
                        <div className="text-xs font-bold text-red-500 mt-1">
                          Pending: {fmt(due)} {b.status === 'Partial' ? `(Paid: ${fmt(b.paidAmount)})` : ''}
                        </div>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0 flex flex-col items-end">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{fmt(b.total)}</div>
                      <div className="text-[11px] text-slate-400">
                        @ ₹{b.ratePerKg}/KG
                      </div>

                      <div className="flex items-center gap-1 mt-2">
                        <button
                          onClick={() => setActiveModalBill(b)}
                          title="Preview & Print Invoice"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                        >
                          <FileText size={14} />
                        </button>

                        {b.status !== 'Paid' && (
                          <button
                            onClick={() => sendSingleReminder(b)}
                            title="WhatsApp Reminder"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/60 transition-colors"
                          >
                            <MessageCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
