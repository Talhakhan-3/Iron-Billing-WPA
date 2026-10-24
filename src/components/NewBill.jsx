import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle, FileText, MessageCircle, RotateCcw, Send,
  Plus, Trash2, ArrowRight, Printer, Sparkles, Building2, User,
  Calendar, Truck, Scale, DollarSign, CreditCard
} from 'lucide-react'
import { db, getSettings, syncWithCloud, peekNextBillNumber, commitBillNumber } from '../db/db'
import { generateUPIQR } from '../utils/generateQR'
import { useToast } from './Toast'
import PrintInvoiceModal from './PrintInvoiceModal'

const QUICK_WEIGHTS = [
  { label: '250 kg', val: 250 },
  { label: '500 kg', val: 500 },
  { label: '1 Ton',  val: 1000 },
  { label: '2 Ton',  val: 2000 },
  { label: '5 Ton',  val: 5000 },
  { label: '10 Ton', val: 10000 },
  { label: '15 Ton', val: 15000 },
  { label: '20 Ton', val: 20000 },
]

export default function NewBill({ navigate, editBill }) {
  const toast = useToast()

  const [form, setForm] = useState({
    billNumber:      '',
    partyName:       '',
    consigneeName:   '',
    date:            new Date().toISOString().split('T')[0],
    weightKg:        '',
    ratePerKg:       '',
    itemDescription: 'Iron / Loha',
    itemSize:        '',
    vehicleNo:       '',
    status:          'Unpaid',
    paidAmount:      '',
    paymentMode:     'Cash',
    bankName:        '',
    chequeNo:        '',
    notes:           '',
    adjustments:     [],
  })

  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug] = useState(false)
  const [selectedSugIdx, setSelectedSugIdx] = useState(-1)

  const [consigneeSuggestions, setConsigneeSuggestions] = useState([])
  const [showConsigneeSug, setShowConsigneeSug] = useState(false)
  const [selectedConsigneeIdx, setSelectedConsigneeIdx] = useState(-1)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [qrUrl, setQrUrl] = useState(null)
  const [settings, setSettings] = useState({})
  const [rateEdited, setRateEdited] = useState(false)
  const [partyPhone, setPartyPhone] = useState('')
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [errors, setErrors] = useState({})

  const partyRef = useRef(null)
  const consigneeRef = useRef(null)
  const billNumInputRef = useRef(null)
  const weightInputRef = useRef(null)

  useEffect(() => {
    init()

    const handler = (e) => {
      if (partyRef.current && !partyRef.current.contains(e.target)) setShowSug(false)
      if (consigneeRef.current && !consigneeRef.current.contains(e.target)) setShowConsigneeSug(false)
    }

    const keyHandler = (e) => {
      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    }

    document.addEventListener('mousedown', handler)
    window.addEventListener('keydown', keyHandler)

    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', keyHandler)
    }
  }, [form, saving])

  const init = async () => {
    const s = await getSettings()
    setSettings(s)

    let initialRatePerKg = ''
    if (s.currentRate) {
      const v = parseFloat(s.currentRate)
      if (!isNaN(v)) initialRatePerKg = v > 1000 ? (v / 1000).toString() : s.currentRate
    }

    if (editBill) {
      const weightKg = editBill.weightKg || (editBill.tons ? editBill.tons * 1000 : '')
      const ratePerKg = editBill.ratePerKg || (editBill.ratePerTon ? editBill.ratePerTon / 1000 : '')
      setForm({
        billNumber:      String(editBill.billNumber || ''),
        partyName:       editBill.partyName || '',
        consigneeName:   editBill.consigneeName || '',
        date:            editBill.date || new Date().toISOString().split('T')[0],
        weightKg:        weightKg ? String(weightKg) : '',
        ratePerKg:       ratePerKg ? String(ratePerKg) : '',
        itemDescription: editBill.itemDescription || 'Iron / Loha',
        itemSize:        editBill.itemSize || '',
        vehicleNo:       editBill.vehicleNo || '',
        status:          editBill.status || 'Unpaid',
        paidAmount:      editBill.paidAmount !== undefined && editBill.paidAmount !== null ? String(editBill.paidAmount) : '',
        paymentMode:     editBill.paymentMode || 'Cash',
        bankName:        editBill.bankName || '',
        chequeNo:        editBill.chequeNo || '',
        notes:           editBill.notes || '',
        adjustments:     editBill.adjustments || [],
      })

      // Fetch party phone
      const p = await db.parties.where('name').equalsIgnoreCase(editBill.partyName).first()
      if (p?.phone) setPartyPhone(p.phone)
    } else {
      // Auto populate next bill number
      const nextNum = await peekNextBillNumber()
      setForm(f => ({
        ...f,
        billNumber: String(nextNum),
        ratePerKg: initialRatePerKg,
        itemDescription: 'Iron / Loha',
      }))
    }
  }

  // ── Autocomplete for Consignor ──────────────────────────────────────────
  const searchParty = async (val) => {
    setForm(f => ({ ...f, partyName: val }))
    if (errors.partyName) setErrors(e => ({ ...e, partyName: null }))
    setPartyPhone('')
    setSelectedSugIdx(-1)

    if (val.trim().length < 1) {
      setSuggestions([])
      setShowSug(false)
      return
    }

    const q = val.toLowerCase()
    const res = await db.parties
      .filter(p => p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q)))
      .limit(8)
      .toArray()
    setSuggestions(res)
    setShowSug(res.length > 0)
  }

  const selectParty = (p) => {
    setForm(f => ({ ...f, partyName: p.name }))
    setPartyPhone(p.phone || '')
    setShowSug(false)
  }

  // ── Autocomplete for Consignee ──────────────────────────────────────────
  const searchConsignee = async (val) => {
    setForm(f => ({ ...f, consigneeName: val }))
    if (errors.consigneeName) setErrors(e => ({ ...e, consigneeName: null }))
    setSelectedConsigneeIdx(-1)

    if (val.trim().length < 1) {
      setConsigneeSuggestions([])
      setShowConsigneeSug(false)
      return
    }

    const q = val.toLowerCase()
    // Prioritize consignees & both, but allow any party
    const res = await db.parties
      .filter(p => p.name.toLowerCase().includes(q))
      .limit(8)
      .toArray()
    setConsigneeSuggestions(res)
    setShowConsigneeSug(res.length > 0)
  }

  const selectConsignee = (p) => {
    setForm(f => ({ ...f, consigneeName: p.name }))
    setShowConsigneeSug(false)
  }

  // Calculations
  const weightNum = parseFloat(form.weightKg) || 0
  const rateNum = parseFloat(form.ratePerKg) || 0
  const subTotal = Math.round(weightNum * rateNum * 100) / 100
  const adjustmentsTotal = Math.round(
    (form.adjustments || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) * 100
  ) / 100
  const totalAmount = Math.round((subTotal + adjustmentsTotal) * 100) / 100
  const tonsEquivalent = (weightNum / 1000).toFixed(3)

  // Validation
  const validate = () => {
    const newErrors = {}
    if (!form.billNumber.toString().trim() || parseInt(form.billNumber, 10) <= 0) {
      newErrors.billNumber = 'Valid Bill Number is required'
    }
    if (!form.partyName.trim()) {
      newErrors.partyName = 'Consignor (From Party) is required'
    }
    if (!form.consigneeName.trim()) {
      newErrors.consigneeName = 'Consignee (To Party) is required'
    }
    if (weightNum <= 0) {
      newErrors.weightKg = 'Weight must be greater than 0'
    }
    if (rateNum <= 0) {
      newErrors.ratePerKg = 'Rate must be greater than 0'
    }
    if (!form.date) {
      newErrors.date = 'Date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (saving) return // Guard against duplicate submissions

    if (!validate()) {
      toast.error('Please fill all mandatory fields properly.')
      return
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const billNumber = parseInt(form.billNumber, 10)

      const billData = {
        partyName:       form.partyName.trim(),
        consigneeName:   form.consigneeName.trim(),
        date:            form.date,
        weightKg:        weightNum,
        ratePerKg:       rateNum,
        total:           totalAmount,
        itemDescription: form.itemDescription.trim() || 'Iron / Loha',
        itemSize:        form.itemSize.trim(),
        vehicleNo:       form.vehicleNo.trim().toUpperCase(),
        status:          form.status,
        paidAmount:      form.status === 'Paid'
                           ? totalAmount
                           : form.status === 'Partial' ? Math.min(totalAmount, parseFloat(form.paidAmount) || 0) : 0,
        paymentMode:     form.paymentMode,
        bankName:        form.bankName.trim(),
        chequeNo:        form.chequeNo.trim(),
        notes:           form.notes.trim(),
        adjustments:     form.adjustments || [],
        synced:          0,
        updatedAt:       now,
        tons:            weightNum / 1000,
        ratePerTon:      rateNum * 1000,
      }

      let finalBill
      if (editBill) {
        await db.bills.update(editBill.id, billData)
        finalBill = { ...editBill, ...billData, billNumber }
        toast.success(`Bill #${billNumber} updated successfully!`)
      } else {
        const exists = await db.bills.where('billNumber').equals(billNumber).first()
        if (exists) {
          setSaving(false)
          setErrors(e => ({ ...e, billNumber: `Bill #${billNumber} already exists!` }))
          toast.error(`Bill #${billNumber} already exists. Please pick another number.`)
          return
        }

        const id = await db.bills.add({ ...billData, billNumber, createdAt: now })
        await commitBillNumber(billNumber)
        finalBill = { ...billData, id, billNumber }
        toast.success(`Bill #${billNumber} created successfully!`)

        // Save new parties if they don't exist yet
        const cExists = await db.parties.where('name').equalsIgnoreCase(form.partyName.trim()).first()
        if (!cExists) {
          await db.parties.add({
            name: form.partyName.trim(),
            phone: partyPhone || '',
            address: '',
            type: 'Consignor',
            synced: 0,
            updatedAt: now
          })
        }

        const eExists = await db.parties.where('name').equalsIgnoreCase(form.consigneeName.trim()).first()
        if (!eExists) {
          await db.parties.add({
            name: form.consigneeName.trim(),
            phone: '',
            address: '',
            type: 'Consignee',
            synced: 0,
            updatedAt: now
          })
        }
      }

      // Update current rate in settings if changed
      if (!rateEdited && !editBill && form.ratePerKg) {
        await db.settings.put({ key: 'currentRate', value: String(form.ratePerKg) })
      }

      setSaved({ ...finalBill, _partyPhone: partyPhone })

      // Generate UPI QR code for success view
      if (settings.upiId) {
        const due = finalBill.status === 'Partial'
          ? Math.max(0, finalBill.total - (finalBill.paidAmount || 0))
          : finalBill.status === 'Unpaid' ? finalBill.total : 0
        const qr = await generateUPIQR({
          upiId:      settings.upiId,
          name:       settings.businessName,
          amount:     due,
          billNumber: finalBill.billNumber,
        })
        setQrUrl(qr)
      }

      syncWithCloud()
    } catch (e) {
      toast.error('Error saving bill: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleShareWhatsApp = () => {
    if (!saved) return
    const s = settings
    const msg = [
      `*${s.businessName || 'Iron Billing'}* — Bill Generated`,
      ``,
      `Bill No : #${String(saved.billNumber).padStart(5, '0')}`,
      `Date    : ${new Date(saved.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      `From    : ${saved.partyName}`,
      `To      : ${saved.consigneeName}`,
      `Item    : ${saved.itemDescription}${saved.itemSize ? ` (${saved.itemSize})` : ''}`,
      `Vehicle : ${saved.vehicleNo || '—'}`,
      `Weight  : ${Number(saved.weightKg).toLocaleString('en-IN')} KG (${(Number(saved.weightKg)/1000).toFixed(3)} MT)`,
      `Rate    : ₹${Number(saved.ratePerKg).toLocaleString('en-IN')}/KG`,
      `*Total  : ₹${Number(saved.total).toLocaleString('en-IN')}*`,
      `Status  : ${saved.status}`,
      saved.notes ? `Note    : ${saved.notes}` : '',
    ].filter(Boolean).join('\n')

    const ph = saved._partyPhone
    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const handleReminderWhatsApp = () => {
    if (!saved || saved.status === 'Paid') return
    const s = settings
    const bizName = s.businessName || 'Shree Transport'
    const due = saved.status === 'Partial'
      ? Math.max(0, Number(saved.total) - Number(saved.paidAmount || 0))
      : Number(saved.total)

    const msg = [
      `*${bizName}* — Payment Reminder`,
      ``,
      `Dear *${saved.partyName}*,`,
      ``,
      `Bill #${String(saved.billNumber).padStart(5, '0')} dated ${new Date(saved.date).toLocaleDateString('en-IN')} pending balance:`,
      ``,
      `Bill Amount : ₹${Number(saved.total).toLocaleString('en-IN')}`,
      saved.status === 'Partial' ? `Paid       : ₹${Number(saved.paidAmount || 0).toLocaleString('en-IN')}` : '',
      `*Due Amount : ₹${due.toLocaleString('en-IN')}*`,
      ``,
      `Please clear the pending payment. Thank you! 🙏`,
    ].filter(Boolean).join('\n')

    const ph = saved._partyPhone
    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const reset = async () => {
    setSaved(null)
    setPartyPhone('')
    setQrUrl(null)
    setErrors({})
    const nextNum = await peekNextBillNumber()
    setForm({
      billNumber:      String(nextNum),
      partyName:       '',
      consigneeName:   '',
      date:            new Date().toISOString().split('T')[0],
      weightKg:        '',
      ratePerKg:       settings.currentRate || '',
      itemDescription: 'Iron / Loha',
      itemSize:        '',
      vehicleNo:       '',
      status:          'Unpaid',
      paidAmount:      '',
      paymentMode:     'Cash',
      bankName:        '',
      chequeNo:        '',
      notes:           '',
      adjustments:     [],
    })
    setRateEdited(false)
    billNumInputRef.current?.focus()
  }

  // ─── SUCCESS SCREEN ───────────────────────────────────────────────────────
  if (saved) {
    const isPending = saved.status !== 'Paid'
    const due = saved.status === 'Partial'
      ? Math.max(0, Number(saved.total) - Number(saved.paidAmount || 0))
      : saved.status === 'Unpaid' ? Number(saved.total) : 0

    return (
      <div className="max-w-md mx-auto my-6 animate-fade-in">
        <div className="card-base p-6 text-center shadow-lg">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Bill Saved Successfully!</h2>
          <div className="inline-block mt-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
            #{String(saved.billNumber).padStart(5, '0')}
          </div>

          <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">{saved.partyName}</span>
            <span className="mx-1.5 text-slate-400">→</span>
            <span className="font-semibold text-slate-900 dark:text-slate-200">{saved.consigneeName}</span>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 my-5">
            <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
              ₹{Number(saved.total).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {Number(saved.weightKg).toLocaleString('en-IN')} kg × ₹{Number(saved.ratePerKg).toLocaleString('en-IN')}/kg
            </div>
            {isPending && due > 0 && (
              <div className="mt-2.5 pt-2 border-t border-emerald-200 dark:border-emerald-800/80 text-xs font-bold text-red-600 dark:text-red-400">
                Pending Balance: ₹{due.toLocaleString('en-IN')} ({saved.status})
              </div>
            )}
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition-colors"
            >
              <Printer size={16} className="text-emerald-600" />
              <span>Preview & Print</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/60 hover:bg-green-100 dark:hover:bg-green-900/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 font-medium text-xs transition-colors"
            >
              <MessageCircle size={16} className="text-green-600" />
              <span>WhatsApp Share</span>
            </button>
          </div>

          {isPending && due > 0 && (
            <button
              onClick={handleReminderWhatsApp}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl mb-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              <Send size={15} />
              <span>Send Payment Reminder (₹{due.toLocaleString('en-IN')})</span>
            </button>
          )}

          {/* QR Payment View */}
          {qrUrl && isPending && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50 text-left mb-4 flex items-center gap-3">
              <img src={qrUrl} alt="UPI QR" className="w-18 h-18 rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-1 flex-shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Scan to Pay UPI Due:</div>
                <div className="text-base font-bold text-red-600 dark:text-red-400">
                  ₹{due.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  PhonePe / GPay / Paytm
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm transition-colors shadow-sm"
            >
              <RotateCcw size={16} />
              <span>Create Another Bill</span>
            </button>

            <button
              onClick={() => navigate('history')}
              className="w-full py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium transition-colors"
            >
              View in Bill History →
            </button>
          </div>
        </div>

        {/* Print Modal */}
        {showPrintModal && (
          <PrintInvoiceModal
            bill={saved}
            settings={settings}
            onClose={() => setShowPrintModal(false)}
          />
        )}
      </div>
    )
  }

  // ─── BILLING FORM ────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {editBill ? 'Edit Bill' : 'New Bill'}
            {!editBill && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                Quick Billing Mode
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {editBill ? `Modifying invoice #${editBill.billNumber}` : 'Fast keyboard-enabled entry for iron & steel freight'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Clear Form
          </button>
        </div>
      </div>

      <div className="card-base divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">

        {/* 1. Bill Number & Date */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-emerald-600" />
                Invoice / Bilty No. *
              </label>
              {!editBill && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  Auto-assigned
                </span>
              )}
            </div>
            <input
              ref={billNumInputRef}
              type="number"
              value={form.billNumber}
              onChange={e => {
                setForm(f => ({ ...f, billNumber: e.target.value }))
                if (errors.billNumber) setErrors(e => ({ ...e, billNumber: null }))
              }}
              placeholder="e.g. 22104"
              className={`inp font-mono font-bold text-base ${errors.billNumber ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {errors.billNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.billNumber}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-emerald-600" />
              Bill Date *
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="inp"
            />
          </div>
        </div>

        {/* 2. Parties: Consignor & Consignee */}
        <div className="p-4 space-y-3">
          {/* Consignor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} className="text-emerald-600" />
                Consignor (From Party / Seller) *
              </label>
              {partyPhone && (
                <span className="text-[11px] text-emerald-600 font-medium">📞 {partyPhone}</span>
              )}
            </div>
            <div className="relative" ref={partyRef}>
              <input
                type="text"
                value={form.partyName}
                onChange={e => searchParty(e.target.value)}
                onFocus={() => form.partyName.length >= 1 && setShowSug(true)}
                placeholder="Type supplier name or search..."
                className={`inp ${errors.partyName ? 'border-red-500 focus:border-red-500' : ''}`}
                autoComplete="off"
              />
              {showSug && suggestions.length > 0 && (
                <div className="ac-dropdown">
                  {suggestions.map((p, idx) => (
                    <div
                      key={p.id}
                      className={`ac-item ${selectedSugIdx === idx ? 'active' : ''}`}
                      onClick={() => selectParty(p)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                          {p.type || 'Party'}
                        </span>
                      </div>
                      {p.phone && <span className="text-xs text-slate-400 mt-0.5">📞 {p.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.partyName && <p className="text-xs text-red-500 mt-1">{errors.partyName}</p>}
          </div>

          {/* Consignee */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <User size={13} className="text-emerald-600" />
              Consignee (To Party / Buyer) *
            </label>
            <div className="relative" ref={consigneeRef}>
              <input
                type="text"
                value={form.consigneeName}
                onChange={e => searchConsignee(e.target.value)}
                onFocus={() => form.consigneeName.length >= 1 && setShowConsigneeSug(true)}
                placeholder="Type buyer or destination party name..."
                className={`inp ${errors.consigneeName ? 'border-red-500 focus:border-red-500' : ''}`}
                autoComplete="off"
              />
              {showConsigneeSug && consigneeSuggestions.length > 0 && (
                <div className="ac-dropdown">
                  {consigneeSuggestions.map((p, idx) => (
                    <div
                      key={p.id}
                      className={`ac-item ${selectedConsigneeIdx === idx ? 'active' : ''}`}
                      onClick={() => selectConsignee(p)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                          {p.type || 'Consignee'}
                        </span>
                      </div>
                      {p.phone && <span className="text-xs text-slate-400 mt-0.5">📞 {p.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.consigneeName && <p className="text-xs text-red-500 mt-1">{errors.consigneeName}</p>}
          </div>
        </div>

        {/* 3. Item, Grade & Vehicle */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Item Name *
            </label>
            <input
              type="text"
              value={form.itemDescription}
              onChange={e => setForm(f => ({ ...f, itemDescription: e.target.value }))}
              placeholder="Iron / Loha, Steel TMT"
              className="inp"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Size / Grade
            </label>
            <input
              type="text"
              value={form.itemSize}
              onChange={e => setForm(f => ({ ...f, itemSize: e.target.value }))}
              placeholder="e.g. 12mm, Fe550D"
              className="inp"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Truck size={12} className="text-emerald-600" />
              Vehicle Number
            </label>
            <input
              type="text"
              value={form.vehicleNo}
              onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value.toUpperCase() }))}
              placeholder="MH12AB1234"
              className="inp font-mono uppercase"
            />
          </div>
        </div>

        {/* 4. Weight & Rate (Optimized with Quick Presets) */}
        <div className="p-4 space-y-3 bg-slate-50/40 dark:bg-slate-800/20">
          {/* Quick weight selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Scale size={13} className="text-emerald-600" />
                Weight (KG) *
              </label>
              {weightNum > 0 && (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  = {tonsEquivalent} Metric Tons (MT)
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {QUICK_WEIGHTS.map(item => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, weightKg: String(item.val) }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    String(form.weightKg) === String(item.val)
                      ? 'bg-emerald-800 border-emerald-800 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              {/* Increment buttons */}
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, weightKg: String((parseFloat(f.weightKg) || 0) + 500) }))}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
              >
                +500kg
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, weightKg: String((parseFloat(f.weightKg) || 0) + 1000) }))}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
              >
                +1 Ton
              </button>
            </div>

            <input
              ref={weightInputRef}
              type="number"
              value={form.weightKg}
              onChange={e => {
                setForm(f => ({ ...f, weightKg: e.target.value }))
                if (errors.weightKg) setErrors(e => ({ ...e, weightKg: null }))
              }}
              placeholder="Enter weight in kilograms (e.g. 750)"
              className={`inp text-base font-semibold ${errors.weightKg ? 'border-red-500 focus:border-red-500' : ''}`}
              min="0"
              step="any"
            />
            {errors.weightKg && <p className="text-xs text-red-500 mt-1">{errors.weightKg}</p>}
          </div>

          {/* Rate per KG */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-600" />
                Rate per KG (₹) *
              </label>
              {rateNum > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  = ₹{(rateNum * 1000).toLocaleString('en-IN')}/Ton
                </span>
              )}
            </div>
            <input
              type="number"
              value={form.ratePerKg}
              onChange={e => {
                setForm(f => ({ ...f, ratePerKg: e.target.value }))
                setRateEdited(true)
                if (errors.ratePerKg) setErrors(e => ({ ...e, ratePerKg: null }))
              }}
              placeholder="e.g. 52"
              className={`inp text-base font-semibold ${errors.ratePerKg ? 'border-red-500 focus:border-red-500' : ''}`}
              step="any"
            />
            {errors.ratePerKg && <p className="text-xs text-red-500 mt-1">{errors.ratePerKg}</p>}
          </div>

          {/* Subtotal Preview Banner */}
          {subTotal > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Freight Subtotal</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {Number(weightNum).toLocaleString('en-IN')} kg × ₹{rateNum}/kg
                </div>
              </div>
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
                ₹{subTotal.toLocaleString('en-IN')}
              </div>
            </div>
          )}
        </div>

        {/* 5. Extra Adjustments (Taxes, Previous Balance, Loading, Advance) */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Extra Charges / Deductions
              </label>
              <p className="text-[11px] text-slate-400">
                Previous balance, advance discount, loading charge etc.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({
                ...f,
                adjustments: [...(f.adjustments || []), { id: Date.now(), label: '', amount: '' }]
              }))}
              className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors flex items-center gap-1"
            >
              <Plus size={13} />
              Add Line
            </button>
          </div>

          <div className="space-y-2 mt-2">
            {(form.adjustments || []).map((adj, idx) => (
              <div key={adj.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={adj.label}
                  onChange={e => {
                    const updated = [...form.adjustments]
                    updated[idx] = { ...updated[idx], label: e.target.value }
                    setForm(f => ({ ...f, adjustments: updated }))
                  }}
                  placeholder="Charge label (e.g. Previous Dues, Advance)"
                  className="inp flex-1 text-xs"
                />
                <input
                  type="number"
                  value={adj.amount}
                  onChange={e => {
                    const updated = [...form.adjustments]
                    updated[idx] = { ...updated[idx], amount: e.target.value }
                    setForm(f => ({ ...f, adjustments: updated }))
                  }}
                  placeholder="₹ (- for deduction)"
                  className="inp w-36 text-right font-mono text-xs"
                  step="any"
                />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, adjustments: f.adjustments.filter((_, i) => i !== idx) }))}
                  className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Running grand total breakdown */}
          {(form.adjustments || []).length > 0 && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-xs border border-slate-200 dark:border-slate-700/60">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Base Freight</span>
                <span>₹{subTotal.toLocaleString('en-IN')}</span>
              </div>
              {(form.adjustments || []).map((adj, idx) => adj.amount !== '' && (
                <div key={idx} className={`flex justify-between ${parseFloat(adj.amount) < 0 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                  <span>{adj.label || `Adjustment #${idx + 1}`}</span>
                  <span>{parseFloat(adj.amount) >= 0 ? '+' : ''}₹{Number(parseFloat(adj.amount) || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1.5 text-sm">
                <span>Grand Total</span>
                <span className="text-emerald-700 dark:text-emerald-400">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

        {/* 6. Payment Status & Mode */}
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <CreditCard size={13} className="text-emerald-600" />
              Payment Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Unpaid',  'bg-red-600 border-red-600 text-white shadow-sm', 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-400'],
                ['Paid',    'bg-emerald-600 border-emerald-600 text-white shadow-sm', 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400'],
                ['Partial', 'bg-amber-500 border-amber-500 text-white shadow-sm', 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'],
              ].map(([status, activeClass, inactiveClass]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status }))}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${form.status === status ? activeClass : inactiveClass}`}
                >
                  {status}
                </button>
              ))}
            </div>

            {form.status === 'Partial' && (
              <div className="mt-2.5 animate-fade-in">
                <label className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1 block">
                  Amount Received So Far (₹)
                </label>
                <input
                  type="number"
                  value={form.paidAmount}
                  onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))}
                  placeholder="e.g. 15000"
                  className="inp"
                  max={totalAmount}
                />
                {totalAmount > 0 && form.paidAmount && (
                  <p className="text-xs text-red-500 font-medium mt-1">
                    Pending Dues: ₹{(totalAmount - (parseFloat(form.paidAmount) || 0)).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Payment Mode
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {['Cash', 'Cheque', 'GPay', 'PhonePe', 'Online', 'Pending'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, paymentMode: mode }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.paymentMode === mode
                      ? 'bg-emerald-800 border-emerald-800 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {form.paymentMode === 'Cheque' && (
              <div className="grid grid-cols-2 gap-2 mt-2 animate-fade-in">
                <input
                  type="text"
                  value={form.bankName}
                  onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                  placeholder="Bank Name"
                  className="inp text-xs"
                />
                <input
                  type="text"
                  value={form.chequeNo}
                  onChange={e => setForm(f => ({ ...f, chequeNo: e.target.value }))}
                  placeholder="Cheque No."
                  className="inp text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* 7. Notes */}
        <div className="p-4">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
            Notes / Remarks (Optional)
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Delivery instructions, LR number, etc."
            className="inp text-xs"
          />
        </div>

        {/* 8. Grand Total & Submit Button */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Final Invoice Total</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              ₹{totalAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400">
              Shortcut: press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-mono">Ctrl+Enter</kbd> to save
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full sm:w-auto min-w-[200px] min-h-[48px] px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Bill...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{editBill ? 'Update Bill' : 'Save & Generate Bilty'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
