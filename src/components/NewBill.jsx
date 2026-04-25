import { useState, useEffect, useRef } from 'react'
import { ChevronDown, CheckCircle, FileText, Share2, RotateCcw } from 'lucide-react'
import { db, getNextBillNumber, getSettings, syncWithCloud } from '../db/db'
import { generateBillPDF } from '../utils/generatePDF'

const QUICK_TONS = [0.5, 1, 2, 5, 10, 20]

export default function NewBill({ navigate, editBill }) {
  const [form, setForm] = useState({
    partyName: '',
    date:       new Date().toISOString().split('T')[0],
    tons:       '',
    ratePerTon: '',
    status:     'Unpaid',
    paidAmount: '',
    notes:      '',
    // Naye fields yahan hain
    deliveryPoint: '',
    paymentMode: 'Cash',
    bankName: '',
    chequeNo: '',
  })
  
  const [suggestions, setSuggestions]   = useState([])
  const [showSug, setShowSug]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(null)
  const [settings, setSettings]         = useState({})
  const [rateEdited, setRateEdited]     = useState(false)
  const partyRef = useRef(null)

  useEffect(() => {
    init()
    const handler = e => {
      if (partyRef.current && !partyRef.current.contains(e.target)) setShowSug(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const init = async () => {
    const s = await getSettings()
    setSettings(s)
    if (editBill) {
      setForm({
        partyName:     editBill.partyName,
        date:          editBill.date,
        tons:          String(editBill.tons),
        ratePerTon:    String(editBill.ratePerTon),
        status:        editBill.status,
        paidAmount:    String(editBill.paidAmount || ''),
        notes:         editBill.notes || '',
        // Edit logic for new fields
        deliveryPoint: editBill.deliveryPoint || '',
        paymentMode:   editBill.paymentMode || 'Cash',
        bankName:      editBill.bankName || '',
        chequeNo:      editBill.chequeNo || '',
      })
    } else {
      setForm(f => ({ ...f, ratePerTon: s.currentRate || '' }))
    }
  }

  const searchParty = async (val) => {
    setForm(f => ({ ...f, partyName: val }))
    if (val.length < 2) { setSuggestions([]); return }
    const res = await db.parties
      .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
      .limit(8).toArray()
    setSuggestions(res)
    setShowSug(res.length > 0)
  }

  const total = () => {
    const t = parseFloat(form.tons)    || 0
    const r = parseFloat(form.ratePerTon) || 0
    return t * r
  }

  const handleSubmit = async () => {
    if (!form.partyName.trim())                       return alert('Party naam zaroori hai!')
    if (!form.tons || parseFloat(form.tons) <= 0)     return alert('Tons daalo!')
    if (!form.ratePerTon || parseFloat(form.ratePerTon) <= 0) return alert('Rate daalo!')
    if (!form.date)                                   return alert('Date daalo!')

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const billData = {
        partyName:  form.partyName.trim(),
        date:       form.date,
        tons:       parseFloat(form.tons),
        ratePerTon: parseFloat(form.ratePerTon),
        total:      total(),
        status:     form.status,
        paidAmount: form.status === 'Paid'    ? total() : form.status === 'Partial' ? parseFloat(form.paidAmount) || 0 : 0,
        notes:      form.notes.trim(),
        // BillData update
        deliveryPoint: form.deliveryPoint.trim(),
        paymentMode:   form.paymentMode,
        bankName:      form.bankName.trim(),
        chequeNo:      form.chequeNo.trim(),
        synced:    0,
        updatedAt: now,
      }

      let finalBill
      if (editBill) {
        await db.bills.update(editBill.id, { ...billData })
        finalBill = { ...editBill, ...billData }
      } else {
        const billNumber = await getNextBillNumber()
        const id = await db.bills.add({ ...billData, billNumber, createdAt: now })
        finalBill = { ...billData, id, billNumber }
        const exists = await db.parties.where('name').equalsIgnoreCase(form.partyName.trim()).first()
        if (!exists) {
          await db.parties.add({ name: form.partyName.trim(), phone: '', address: '', synced: 0, updatedAt: now })
        }
      }

      if (!rateEdited === false || !editBill) {
        await db.settings.put({ key: 'currentRate', value: String(form.ratePerTon) })
      }
      setSaved(finalBill)
      syncWithCloud()
    } catch (e) {
      alert('Save error: ' + e.message)
    }
    setSaving(false)
  }

  const handleWhatsApp = () => {
    if (!saved) return
    const s = settings
    const msg = [
      `*${s.businessName || 'Iron Billing'}*`,
      `Bill No: #${String(saved.billNumber).padStart(4,'0')}`,
      `Party: ${saved.partyName}`,
      `Date: ${new Date(saved.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`,
      `Quantity: ${saved.tons} Ton${saved.tons > 1 ? 's' : ''}`,
      `Rate: ₹${Number(saved.ratePerTon).toLocaleString('en-IN')}/T`,
      `*Total: ₹${Number(saved.total).toLocaleString('en-IN')}*`,
      `Status: ${saved.status}`,
      saved.notes ? `Note: ${saved.notes}` : '',
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handlePDF = async () => {
    if (!saved) return
    await generateBillPDF(saved, settings)
  }

  const reset = () => {
    setSaved(null)
    setForm({
      partyName: '', date: new Date().toISOString().split('T')[0],
      tons: '', ratePerTon: settings.currentRate || '',
      status: 'Unpaid', paidAmount: '', notes: '',
      deliveryPoint: '', paymentMode: 'Cash', bankName: '', chequeNo: '',
    })
  }

  if (saved) return (
    <div className="max-w-sm mx-auto mt-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 text-center">
        <CheckCircle size={48} className="text-teal-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Bill Saved!</h2>
        <p className="text-slate-400 text-sm mt-0.5">#{String(saved.billNumber).padStart(4,'0')} — {saved.partyName}</p>
        <div className="bg-teal-50 rounded-2xl p-4 my-5">
          <div className="text-2xl font-bold text-teal-600">₹{Number(saved.total).toLocaleString('en-IN')}</div>
          <div className="text-sm text-slate-400 mt-0.5">{saved.tons} T × ₹{Number(saved.ratePerTon).toLocaleString('en-IN')}/T</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={handlePDF} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
            <FileText size={20} className="text-slate-600" />
            <span className="text-xs font-medium text-slate-600">PDF</span>
          </button>
          <button onClick={handleWhatsApp} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors">
            <Share2 size={20} className="text-green-600" />
            <span className="text-xs font-medium text-green-600">WhatsApp</span>
          </button>
          <button onClick={reset} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-teal-50 hover:bg-teal-100 transition-colors">
            <RotateCcw size={20} className="text-teal-600" />
            <span className="text-xs font-medium text-teal-600">New Bill</span>
          </button>
        </div>
        <button onClick={() => navigate('history')} className="mt-3 w-full text-slate-400 text-sm hover:text-slate-600 py-2 transition-colors">
          View History →
        </button>
      </div>
    </div>
  )

  const t = total()
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-4">{editBill ? 'Edit Bill' : 'New Bill'}</h1>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">

        {/* Party Name */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Party Name</label>
          <div className="relative" ref={partyRef}>
            <input
              type="text"
              value={form.partyName}
              onChange={e => searchParty(e.target.value)}
              onFocus={() => form.partyName.length >= 2 && setShowSug(true)}
              placeholder="2-3 akshar likhein..."
              className="inp"
              autoComplete="off"
            />
            {showSug && suggestions.length > 0 && (
              <div className="ac-dropdown">
                {suggestions.map(p => (
                  <div key={p.id} className="ac-item" onClick={() => {
                    setForm(f => ({ ...f, partyName: p.name }))
                    setShowSug(false)
                  }}>
                    <span className="font-medium">{p.name}</span>
                    {p.phone && <span className="text-xs text-slate-400">{p.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Bill Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="inp"
          />
        </div>

        {/* Tons */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Quantity (Tons)</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_TONS.map(t => (
              <button key={t}
                onClick={() => setForm(f => ({ ...f, tons: String(t) }))}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  String(form.tons) === String(t)
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600'
                }`}
              >
                {t}T
              </button>
            ))}
          </div>
          <input
            type="number"
            value={form.tons}
            onChange={e => setForm(f => ({ ...f, tons: e.target.value }))}
            placeholder="Custom amount (e.g. 1.5)"
            className="inp"
            min="0" step="0.5"
          />
        </div>

        {/* Rate */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Rate per Ton (₹)</label>
          <input
            type="number"
            value={form.ratePerTon}
            onChange={e => { setForm(f => ({ ...f, ratePerTon: e.target.value })); setRateEdited(true) }}
            placeholder="e.g. 52000"
            className="inp"
          />
        </div>

        {/* Total Preview */}
        {t > 0 && (
          <div className="px-4 py-3 bg-teal-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-teal-700">Total Amount</span>
              <span className="text-xl font-bold text-teal-700">₹{t.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-xs text-teal-500 mt-0.5 text-right">{form.tons}T × ₹{Number(form.ratePerTon).toLocaleString('en-IN')}</div>
          </div>
        )}

        {/* Payment Status */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Payment Status</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Unpaid',  'border-red-300 bg-red-500 text-white',    'border-slate-200 text-slate-500 hover:border-red-200'],
              ['Paid',    'border-green-300 bg-green-500 text-white', 'border-slate-200 text-slate-500 hover:border-green-200'],
              ['Partial', 'border-amber-300 bg-amber-400 text-white', 'border-slate-200 text-slate-500 hover:border-amber-200'],
            ].map(([s, activeClass, inactiveClass]) => (
              <button key={s}
                onClick={() => setForm(f => ({ ...f, status: s }))}
                className={`min-h-[44px] py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.status === s ? activeClass : inactiveClass}`}
              >
                {s}
              </button>
            ))}
          </div>
          {form.status === 'Partial' && (
            <input
              type="number"
              value={form.paidAmount}
              onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))}
              placeholder="Abhi tak kitna mila? (₹)"
              className="inp mt-2.5"
            />
          )}
        </div>

        {/* Delivery Point (Ship To) */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Delivery Point (Ship To)
          </label>
          <input
            type="text"
            value={form.deliveryPoint}
            onChange={e => setForm(f => ({ ...f, deliveryPoint: e.target.value }))}
            placeholder="Delivery address ya location..."
            className="inp"
          />
        </div>

        {/* Payment Mode */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Payment Mode
          </label>
          <div className="flex gap-2 flex-wrap mb-3">
            {['Cash', 'Cheque', 'Online', 'Pending'].map(mode => (
              <button
                key={mode}
                onClick={() => setForm(f => ({ ...f, paymentMode: mode }))}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  form.paymentMode === mode
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {form.paymentMode === 'Cheque' && (
            <div className="space-y-2.5 mt-2">
              <input
                type="text"
                value={form.bankName}
                onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder="Bank Name"
                className="inp"
              />
              <input
                type="text"
                value={form.chequeNo}
                onChange={e => setForm(f => ({ ...f, chequeNo: e.target.value }))}
                placeholder="Cheque Number"
                className="inp"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Koi note ya remark..."
            rows={2}
            className="inp resize-none"
          />
        </div>

        {/* Submit */}
        <div className="p-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full min-h-[52px] bg-teal-600 text-white rounded-xl font-semibold text-base hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Saving...' : editBill ? '✓ Update Bill' : '✓ Save Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}