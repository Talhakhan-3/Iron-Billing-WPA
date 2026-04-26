import { useState, useEffect, useRef } from 'react'
import { ChevronDown, CheckCircle, FileText, Share2, RotateCcw } from 'lucide-react'
import { db, getNextBillNumber, getSettings, syncWithCloud } from '../db/db'
import { generateBillPDF } from '../utils/generatePDF'

const QUICK_KG = [100, 250, 500, 1000, 2000, 5000]

export default function NewBill({ navigate, editBill }) {
  const [form, setForm] = useState({
    partyName:       '',      // Consignor (From)
    consigneeName:   '',      // Consignee (To)
    date:            new Date().toISOString().split('T')[0],
    weightKg:        '',      // Weight in KG
    ratePerKg:       '',      // Rate per KG
    itemDescription: 'Iron / Loha',
    itemSize:        '',
    vehicleNo:       '',
    status:          'Unpaid',
    paidAmount:      '',
    paymentMode:     'Cash',
    bankName:        '',
    chequeNo:        '',
    notes:           '',
  })

  const [suggestions, setSuggestions]       = useState([])
  const [showSug, setShowSug]               = useState(false)
  const [consigneeSuggestions, setConsigneeSuggestions] = useState([])
  const [showConsigneeSug, setShowConsigneeSug] = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(null)
  const [settings, setSettings]             = useState({})
  const [rateEdited, setRateEdited]         = useState(false)

  const partyRef = useRef(null)
  const consigneeRef = useRef(null)

  useEffect(() => {
    init()
    const handler = e => {
      if (partyRef.current && !partyRef.current.contains(e.target)) setShowSug(false)
      if (consigneeRef.current && !consigneeRef.current.contains(e.target)) setShowConsigneeSug(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const init = async () => {
    const s = await getSettings()
    // Convert old per‑ton rate to per‑kg if needed (migration)
    let initialRatePerKg = ''
    if (s.currentRate) {
      const rateVal = parseFloat(s.currentRate)
      if (!isNaN(rateVal)) {
        initialRatePerKg = rateVal > 1000 ? (rateVal / 1000).toString() : s.currentRate
      }
    }
    setSettings(s)

    if (editBill) {
      // Edit mode: map old fields (tons, ratePerTon) to new ones
      const weightKg = editBill.weightKg || (editBill.tons ? editBill.tons * 1000 : '')
      const ratePerKg = editBill.ratePerKg || (editBill.ratePerTon ? editBill.ratePerTon / 1000 : '')
      setForm({
        partyName:       editBill.partyName || '',
        consigneeName:   editBill.consigneeName || '',
        date:            editBill.date || new Date().toISOString().split('T')[0],
        weightKg:        weightKg ? String(weightKg) : '',
        ratePerKg:       ratePerKg ? String(ratePerKg) : '',
        itemDescription: editBill.itemDescription || 'Iron / Loha',
        itemSize:        editBill.itemSize || '',
        vehicleNo:       editBill.vehicleNo || '',
        status:          editBill.status || 'Unpaid',
        paidAmount:      String(editBill.paidAmount || ''),
        paymentMode:     editBill.paymentMode || 'Cash',
        bankName:        editBill.bankName || '',
        chequeNo:        editBill.chequeNo || '',
        notes:           editBill.notes || '',
      })
    } else {
      setForm(f => ({
        ...f,
        ratePerKg: initialRatePerKg,
        itemDescription: 'Iron / Loha',
      }))
    }
  }

  // Autocomplete for Consignor (Party)
  const searchParty = async (val) => {
    setForm(f => ({ ...f, partyName: val }))
    if (val.length < 2) { setSuggestions([]); return }
    const res = await db.parties
      .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
      .limit(8).toArray()
    setSuggestions(res)
    setShowSug(res.length > 0)
  }

  // Autocomplete for Consignee (Party with type 'Consignee' or 'Both')
  const searchConsignee = async (val) => {
    setForm(f => ({ ...f, consigneeName: val }))
    if (val.length < 2) { setConsigneeSuggestions([]); return }
    const res = await db.parties
      .filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase()) &&
        (p.type === 'Consignee' || p.type === 'Both')
      )
      .limit(8).toArray()
    setConsigneeSuggestions(res)
    setShowConsigneeSug(res.length > 0)
  }

  const total = () => {
    const w = parseFloat(form.weightKg) || 0
    const r = parseFloat(form.ratePerKg) || 0
    return w * r
  }

  const handleSubmit = async () => {
    if (!form.partyName.trim())                       return alert('Consignor (Party) name is required!')
    if (!form.consigneeName.trim())                   return alert('Consignee (To Party) name is required!')
    if (!form.weightKg || parseFloat(form.weightKg) <= 0) return alert('Weight in KG is required!')
    if (!form.ratePerKg || parseFloat(form.ratePerKg) <= 0) return alert('Rate per KG is required!')
    if (!form.date)                                   return alert('Date is required!')

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const billData = {
        // New fields
        partyName:       form.partyName.trim(),
        consigneeName:   form.consigneeName.trim(),
        date:            form.date,
        weightKg:        parseFloat(form.weightKg),
        ratePerKg:       parseFloat(form.ratePerKg),
        total:           total(),
        itemDescription: form.itemDescription.trim() || 'Iron / Loha',
        itemSize:        form.itemSize.trim(),
        vehicleNo:       form.vehicleNo.trim(),
        status:          form.status,
        paidAmount:      form.status === 'Paid'    ? total()
                       : form.status === 'Partial' ? parseFloat(form.paidAmount) || 0
                       : 0,
        paymentMode:     form.paymentMode,
        bankName:        form.bankName.trim(),
        chequeNo:        form.chequeNo.trim(),
        notes:           form.notes.trim(),
        synced:          0,
        updatedAt:       now,

        // Legacy fields for backward compatibility
        tons:            parseFloat(form.weightKg) / 1000,
        ratePerTon:      parseFloat(form.ratePerKg) * 1000,
      }

      let finalBill
      if (editBill) {
        await db.bills.update(editBill.id, { ...billData })
        finalBill = { ...editBill, ...billData }
      } else {
        const billNumber = await getNextBillNumber()
        const id = await db.bills.add({ ...billData, billNumber, createdAt: now })
        finalBill = { ...billData, id, billNumber }
        
        // Save Consignor if new
        const consignorExists = await db.parties.where('name').equalsIgnoreCase(form.partyName.trim()).first()
        if (!consignorExists) {
          await db.parties.add({ name: form.partyName.trim(), phone: '', address: '', type: 'Consignor', synced: 0, updatedAt: now })
        }

        // Save Consignee if new
        const consigneeExists = await db.parties.where('name').equalsIgnoreCase(form.consigneeName.trim()).first()
        if (!consigneeExists) {
          await db.parties.add({ name: form.consigneeName.trim(), phone: '', address: '', type: 'Consignee', synced: 0, updatedAt: now })
        }
      }

      // Update current rate in settings if not edited manually and not editing an existing bill
      if (!rateEdited && !editBill && form.ratePerKg) {
        await db.settings.put({ key: 'currentRate', value: String(form.ratePerKg) })
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
    const weightKg = saved.weightKg
    const tons = (weightKg / 1000).toFixed(3)
    const msg = [
      `*${s.businessName || 'Iron Billing'}*`,
      `Bill No: #${String(saved.billNumber).padStart(4,'0')}`,
      `Consignor: ${saved.partyName}`,
      `Consignee: ${saved.consigneeName}`,
      `Date: ${new Date(saved.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`,
      `Item: ${saved.itemDescription} ${saved.itemSize ? `(${saved.itemSize})` : ''}`,
      `Vehicle: ${saved.vehicleNo || '-'}`,
      `Weight: ${weightKg} kg (${tons} T)`,
      `Rate: ₹${Number(saved.ratePerKg).toLocaleString('en-IN')}/kg`,
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
    })
    setRateEdited(false)
  }

  if (saved) return (
    <div className="max-w-sm mx-auto mt-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 text-center">
        <CheckCircle size={48} className="text-teal-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Bill Saved!</h2>
        <p className="text-slate-400 text-sm mt-0.5">#{String(saved.billNumber).padStart(4,'0')}</p>
        <p className="text-slate-600 text-sm">{saved.partyName} → {saved.consigneeName}</p>
        <div className="bg-teal-50 rounded-2xl p-4 my-5">
          <div className="text-2xl font-bold text-teal-600">₹{Number(saved.total).toLocaleString('en-IN')}</div>
          <div className="text-sm text-slate-400 mt-0.5">
            {saved.weightKg} kg × ₹{Number(saved.ratePerKg).toLocaleString('en-IN')}/kg
          </div>
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

  const totalAmount = total()
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-4">{editBill ? 'Edit Bill' : 'New Bill'}</h1>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">

        {/* Consignor (From Party) */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Consignor (From Party) *
          </label>
          <div className="relative" ref={partyRef}>
            <input
              type="text"
              value={form.partyName}
              onChange={e => searchParty(e.target.value)}
              onFocus={() => form.partyName.length >= 2 && setShowSug(true)}
              placeholder="Supplier / Seller name..."
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

        {/* Consignee (To Party) */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Consignee (To Party) *
          </label>
          <div className="relative" ref={consigneeRef}>
            <input
              type="text"
              value={form.consigneeName}
              onChange={e => searchConsignee(e.target.value)}
              onFocus={() => form.consigneeName.length >= 2 && setShowConsigneeSug(true)}
              placeholder="Buyer / Delivery party name..."
              className="inp"
              autoComplete="off"
            />
            {showConsigneeSug && consigneeSuggestions.length > 0 && (
              <div className="ac-dropdown">
                {consigneeSuggestions.map(p => (
                  <div key={p.id} className="ac-item" onClick={() => {
                    setForm(f => ({ ...f, consigneeName: p.name }))
                    setShowConsigneeSug(false)
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

        {/* Item Details */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Item Details *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Item Name</label>
              <input
                type="text"
                value={form.itemDescription}
                onChange={e => setForm(f => ({ ...f, itemDescription: e.target.value }))}
                placeholder="e.g. Iron / Loha, Steel Pipe"
                className="inp"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Size / Grade</label>
              <input
                type="text"
                value={form.itemSize}
                onChange={e => setForm(f => ({ ...f, itemSize: e.target.value }))}
                placeholder="e.g. 12mm, Grade A"
                className="inp"
              />
            </div>
          </div>
        </div>

        {/* Vehicle Number */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Vehicle Number
          </label>
          <input
            type="text"
            value={form.vehicleNo}
            onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value.toUpperCase() }))}
            placeholder="e.g. MH12AB1234"
            className="inp"
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        {/* Weight in KG */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Weight (KG) *
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_KG.map(kg => (
              <button key={kg}
                onClick={() => setForm(f => ({ ...f, weightKg: String(kg) }))}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  String(form.weightKg) === String(kg)
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {kg >= 1000 ? `${kg/1000}T` : `${kg}kg`}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={form.weightKg}
            onChange={e => setForm(f => ({ ...f, weightKg: e.target.value }))}
            placeholder="Custom weight in KG (e.g. 750)"
            className="inp"
            min="0" step="50"
          />
          {form.weightKg && (
            <p className="text-xs text-slate-400 mt-1">
              = {(parseFloat(form.weightKg)/1000).toFixed(3)} Tons
            </p>
          )}
        </div>

        {/* Rate per KG */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Rate per KG (₹) *
          </label>
          <input
            type="number"
            value={form.ratePerKg}
            onChange={e => { setForm(f => ({ ...f, ratePerKg: e.target.value })); setRateEdited(true) }}
            placeholder="e.g. 52"
            className="inp"
          />
          {form.ratePerKg && (
            <p className="text-xs text-slate-400 mt-1">
              = ₹{(parseFloat(form.ratePerKg)*1000).toLocaleString('en-IN')}/Ton
            </p>
          )}
        </div>

        {/* Total Preview */}
        {totalAmount > 0 && (
          <div className="px-4 py-3 bg-teal-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-teal-700">Total Amount</span>
              <span className="text-xl font-bold text-teal-700">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-xs text-teal-500 mt-0.5 text-right">
              {form.weightKg} kg × ₹{Number(form.ratePerKg).toLocaleString('en-IN')}/kg
            </div>
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
              placeholder="Amount received so far (₹)"
              className="inp mt-2.5"
            />
          )}
        </div>

        {/* Payment Mode */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Payment Mode
          </label>
          <div className="flex gap-2 flex-wrap mb-3">
            {['Cash', 'Cheque', 'GPay', 'PhonePe', 'Online', 'Pending'].map(mode => (
              <button key={mode}
                onClick={() => setForm(f => ({ ...f, paymentMode: mode }))}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
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
            <div className="space-y-2 mt-2">
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

          {(form.paymentMode === 'GPay' || form.paymentMode === 'PhonePe') && (
            <div className="mt-2 p-3 bg-teal-50 rounded-xl text-sm text-teal-700">
              {form.paymentMode === 'GPay' && settings.gpayNo &&
                <div>GPay No: <strong>{settings.gpayNo}</strong></div>}
              {form.paymentMode === 'PhonePe' && settings.phonepeNo &&
                <div>PhonePe No: <strong>{settings.phonepeNo}</strong></div>}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any remark..."
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