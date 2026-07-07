import { useState, useEffect, useRef } from 'react'
import { CheckCircle, FileText, MessageCircle, RotateCcw, Send } from 'lucide-react'
import { db, getSettings, syncWithCloud } from '../db/db'
import { generateBillPDF } from '../utils/generatePDF'

const QUICK_KG = [100, 250, 500, 1000, 2000, 5000]

export default function NewBill({ navigate, editBill }) {
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
    adjustments:     [],   // [{id, label, amount}]
  })

  const [suggestions,         setSuggestions]         = useState([])
  const [showSug,             setShowSug]             = useState(false)
  const [consigneeSuggestions,setConsigneeSuggestions]= useState([])
  const [showConsigneeSug,    setShowConsigneeSug]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(null)
  const [qrUrl,    setQrUrl]    = useState(null)
  const [settings, setSettings] = useState({})
  const [rateEdited, setRateEdited] = useState(false)
  const [partyPhone, setPartyPhone] = useState('')   // phone of consignor

  const partyRef    = useRef(null)
  const consigneeRef= useRef(null)

  useEffect(() => {
    init()
    const handler = e => {
      if (partyRef.current    && !partyRef.current.contains(e.target))    setShowSug(false)
      if (consigneeRef.current && !consigneeRef.current.contains(e.target)) setShowConsigneeSug(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const init = async () => {
    const s = await getSettings()
    let initialRatePerKg = ''
    if (s.currentRate) {
      const v = parseFloat(s.currentRate)
      if (!isNaN(v)) initialRatePerKg = v > 1000 ? (v / 1000).toString() : s.currentRate
    }
    setSettings(s)
    if (editBill) {
      const weightKg  = editBill.weightKg  || (editBill.tons       ? editBill.tons       * 1000 : '')
      const ratePerKg = editBill.ratePerKg || (editBill.ratePerTon ? editBill.ratePerTon / 1000 : '')
      setForm({
        billNumber:      String(editBill.billNumber || ''),
        partyName:       editBill.partyName       || '',
        consigneeName:   editBill.consigneeName   || '',
        date:            editBill.date             || new Date().toISOString().split('T')[0],
        weightKg:        weightKg  ? String(weightKg)  : '',
        ratePerKg:       ratePerKg ? String(ratePerKg) : '',
        itemDescription: editBill.itemDescription  || 'Iron / Loha',
        itemSize:        editBill.itemSize         || '',
        vehicleNo:       editBill.vehicleNo        || '',
        status:          editBill.status           || 'Unpaid',
        paidAmount:      String(editBill.paidAmount || ''),
        paymentMode:     editBill.paymentMode      || 'Cash',
        bankName:        editBill.bankName         || '',
        chequeNo:        editBill.chequeNo         || '',
        notes:           editBill.notes            || '',
        adjustments:     editBill.adjustments      || [],
      })
      // fetch phone for edit mode too
      const p = await db.parties.where('name').equalsIgnoreCase(editBill.partyName).first()
      if (p?.phone) setPartyPhone(p.phone)
    } else {
      setForm(f => ({ ...f, ratePerKg: initialRatePerKg, itemDescription: 'Iron / Loha' }))
    }
  }

  const searchParty = async val => {
    setForm(f => ({ ...f, partyName: val }))
    setPartyPhone('')
    if (val.length < 2) { setSuggestions([]); return }
    const res = await db.parties.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).limit(8).toArray()
    setSuggestions(res); setShowSug(res.length > 0)
  }

  const selectParty = p => {
    setForm(f => ({ ...f, partyName: p.name }))
    setPartyPhone(p.phone || '')
    setShowSug(false)
  }

  const searchConsignee = async val => {
    setForm(f => ({ ...f, consigneeName: val }))
    if (val.length < 2) { setConsigneeSuggestions([]); return }
    const res = await db.parties
      .filter(p => p.name.toLowerCase().includes(val.toLowerCase()) && (p.type === 'Consignee' || p.type === 'Both'))
      .limit(8).toArray()
    setConsigneeSuggestions(res); setShowConsigneeSug(res.length > 0)
  }

  const precise = (a, b) => Math.round(a * b * 100) / 100
  const subTotal = () => precise(parseFloat(form.weightKg) || 0, parseFloat(form.ratePerKg) || 0)
  const adjustmentsTotal = () => (form.adjustments || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
  const total = () => Math.round((subTotal() + adjustmentsTotal()) * 100) / 100

  const handleSubmit = async () => {
    if (!form.billNumber.toString().trim())              return alert('Bill number daalo!')
    if (!form.partyName.trim())                         return alert('Consignor name zaroori hai!')
    if (!form.consigneeName.trim())                     return alert('Consignee name zaroori hai!')
    if (!form.weightKg || parseFloat(form.weightKg)<=0) return alert('Weight KG daalo!')
    if (!form.ratePerKg|| parseFloat(form.ratePerKg)<=0)return alert('Rate per KG daalo!')
    if (!form.date)                                      return alert('Date daalo!')

    setSaving(true)
    try {
      const now      = new Date().toISOString()
      const billData = {
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
                       : form.status === 'Partial' ? parseFloat(form.paidAmount) || 0 : 0,
        paymentMode:     form.paymentMode,
        bankName:        form.bankName.trim(),
        chequeNo:        form.chequeNo.trim(),
        notes:           form.notes.trim(),
        adjustments:     form.adjustments || [],
        synced:          0,
        updatedAt:       now,
        tons:            parseFloat(form.weightKg) / 1000,
        ratePerTon:      parseFloat(form.ratePerKg) * 1000,
      }

      let finalBill
      if (editBill) {
        await db.bills.update(editBill.id, billData)
        finalBill = { ...editBill, ...billData }
      } else {
        const billNumber = parseInt(form.billNumber)
        const exists = await db.bills.where('billNumber').equals(billNumber).first()
        if (exists) return alert(`Bill #${billNumber} pehle se exist karta hai!`)
        const id = await db.bills.add({ ...billData, billNumber, createdAt: now })
        finalBill = { ...billData, id, billNumber }

        const cExists = await db.parties.where('name').equalsIgnoreCase(form.partyName.trim()).first()
        if (!cExists) await db.parties.add({ name:form.partyName.trim(), phone:'', address:'', type:'Consignor', synced:0, updatedAt:now })

        const eExists = await db.parties.where('name').equalsIgnoreCase(form.consigneeName.trim()).first()
        if (!eExists) await db.parties.add({ name:form.consigneeName.trim(), phone:'', address:'', type:'Consignee', synced:0, updatedAt:now })
      }

      if (!rateEdited && !editBill && form.ratePerKg)
        await db.settings.put({ key:'currentRate', value:String(form.ratePerKg) })

      setSaved({ ...finalBill, _partyPhone: partyPhone })

      // QR generate karo for success screen
      if (settings.upiId) {
        const { generateUPIQR } = await import('../utils/generateQR.js')
        const due = finalBill.status === 'Partial'
          ? finalBill.total - (finalBill.paidAmount || 0)
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
    } catch(e) { alert('Save error: ' + e.message) }
    setSaving(false)
  }

  // Bill share on WhatsApp (no pending amount mention — just bill details)
  const handleShareWhatsApp = () => {
    if (!saved) return
    const s = settings
    const msg = [
      `*${s.businessName || 'Iron Billing'}* — Bill Generated`,
      ``,
      `Bill No : #${String(saved.billNumber).padStart(5,'0')}`,
      `Date    : ${new Date(saved.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`,
      `From    : ${saved.partyName}`,
      `To      : ${saved.consigneeName}`,
      `Item    : ${saved.itemDescription}${saved.itemSize ? ` (${saved.itemSize})` : ''}`,
      `Vehicle : ${saved.vehicleNo || '—'}`,
      `Weight  : ${saved.weightKg} KG`,
      `Rate    : ₹${Number(saved.ratePerKg).toLocaleString('en-IN')}/KG`,
      `*Total  : ₹${Number(saved.total).toLocaleString('en-IN')}*`,
      `Status  : ${saved.status}`,
      saved.notes ? `Note    : ${saved.notes}` : '',
    ].filter(Boolean).join('\n')

    // If we have phone number, open direct chat; else just open share
    const ph = saved._partyPhone
    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // Payment reminder on WhatsApp (only if status is Unpaid or Partial)
  const handleReminderWhatsApp = () => {
    if (!saved) return
    if (saved.status === 'Paid') return
    const s       = settings
    const bizName = s.businessName || 'Shree Transport'
    const due     = saved.status === 'Partial'
      ? Number(saved.total) - Number(saved.paidAmount || 0)
      : Number(saved.total)
    const msg = [
      `*${bizName}* — Payment Reminder`,
      ``,
      `Dear *${saved.partyName}*,`,
      ``,
      `Bill #${String(saved.billNumber).padStart(5,'0')} dated ${new Date(saved.date).toLocaleDateString('en-IN')} ka payment pending hai.`,
      ``,
      `Bill Amount : ₹${Number(saved.total).toLocaleString('en-IN')}`,
      saved.status === 'Partial' ? `Paid       : ₹${Number(saved.paidAmount||0).toLocaleString('en-IN')}` : '',
      `*Due Amount : ₹${due.toLocaleString('en-IN')}*`,
      ``,
      `Please jald se payment karein. Dhanyawad 🙏`,
    ].filter(Boolean).join('\n')

    const ph = saved._partyPhone
    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const handlePDF = async () => { if (saved) await generateBillPDF(saved, settings) }

  const reset = () => {
    setSaved(null); setPartyPhone(''); setQrUrl(null)
    setForm({
      billNumber:'', partyName:'', consigneeName:'',
      date: new Date().toISOString().split('T')[0],
      weightKg:'', ratePerKg: settings.currentRate||'',
      itemDescription:'Iron / Loha', itemSize:'', vehicleNo:'',
      status:'Unpaid', paidAmount:'', paymentMode:'Cash',
      bankName:'', chequeNo:'', notes:'', adjustments:[],
    })
    setRateEdited(false)
  }

  // ─── SUCCESS SCREEN ───────────────────────────────────────────────────────
  if (saved) {
    const isPending = saved.status !== 'Paid'
    const due = saved.status === 'Partial'
      ? Number(saved.total) - Number(saved.paidAmount || 0)
      : saved.status === 'Unpaid' ? Number(saved.total) : 0

    return (
      <div className="max-w-sm mx-auto mt-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 text-center">
          <CheckCircle size={48} className="text-brand-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800">Bill Saved!</h2>
          <p className="text-slate-400 text-sm mt-0.5">#{String(saved.billNumber).padStart(5,'0')}</p>
          <p className="text-slate-600 text-sm">{saved.partyName} → {saved.consigneeName}</p>

          <div className="bg-brand-50 rounded-2xl p-4 my-5">
            <div className="text-2xl font-bold text-brand-800">
              ₹{Number(saved.total).toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-slate-400 mt-0.5">
              {saved.weightKg} kg × ₹{Number(saved.ratePerKg).toLocaleString('en-IN')}/kg
            </div>
            {isPending && due > 0 && (
              <div className="mt-2 text-sm font-semibold text-red-500">
                Baki: ₹{due.toLocaleString('en-IN')}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* PDF */}
            <button onClick={handlePDF}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <FileText size={22} className="text-slate-600" />
              <span className="text-xs font-medium text-slate-600">PDF / Print</span>
            </button>

            {/* WhatsApp Share bill */}
            <button onClick={handleShareWhatsApp}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors">
              <MessageCircle size={22} className="text-green-600" />
              <span className="text-xs font-medium text-green-600">WhatsApp Share</span>
            </button>
          </div>

          {/* WhatsApp Payment Reminder — only if pending */}
          {isPending && (
            <button onClick={handleReminderWhatsApp}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl mb-2 transition-colors"
              style={{ background:'#25d366', color:'#fff' }}>
              <Send size={16} />
              <span className="text-sm font-semibold">Payment Reminder Bhejo</span>
            </button>
          )}

          {/* QR Payment Card */}
          {qrUrl && saved.status !== 'Paid' && (
            <div className="mt-3 border border-slate-200 rounded-xl p-3 bg-slate-50 text-left">
              <p className="text-xs text-slate-500 text-center mb-2 font-medium">Scan to Pay (UPI)</p>
              <div className="flex items-center gap-4">
                <img src={qrUrl} alt="UPI QR" className="w-20 h-20 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-slate-500">Amount Due</div>
                  <div className="text-lg font-bold text-red-600">
                    ₹{(saved.status === 'Partial'
                        ? saved.total - (saved.paidAmount || 0)
                        : saved.total
                      ).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Scan with GPay / PhonePe / Paytm</div>
                </div>
              </div>
            </div>
          )}

          {/* New Bill */}
          <button onClick={reset}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-brand-50 hover:bg-brand-100 transition-colors">
            <RotateCcw size={18} className="text-brand-800" />
            <span className="text-sm font-medium text-brand-800">Naya Bill Banao</span>
          </button>

          <button onClick={() => navigate('history')}
            className="mt-3 w-full text-slate-400 text-sm hover:text-slate-600 py-2 transition-colors">
            History Dekho →
          </button>
        </div>
      </div>
    )
  }

  // ─── FORM ────────────────────────────────────────────────────────────────
  const totalAmount = total()
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-4">{editBill ? 'Edit Bill' : 'New Bill'}</h1>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">

        {/* Bill Number — MANUAL */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Bill / Invoice Number *
          </label>
          <input
            type="number"
            value={form.billNumber}
            onChange={e => setForm(f => ({ ...f, billNumber: e.target.value }))}
            placeholder="e.g. 22103"
            className="inp"
            min="1"
          />
          {form.billNumber && (
            <p className="text-xs text-slate-400 mt-1">
              Invoice will show as <strong>#{String(form.billNumber).padStart(5, '0')}</strong>
            </p>
          )}
        </div>

        {/* Consignor */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Consignor (From Party) *</label>
          <div className="relative" ref={partyRef}>
            <input type="text" value={form.partyName}
              onChange={e => searchParty(e.target.value)}
              onFocus={() => form.partyName.length >= 2 && setShowSug(true)}
              placeholder="Supplier / Seller name..." className="inp" autoComplete="off" />
            {showSug && suggestions.length > 0 && (
              <div className="ac-dropdown">
                {suggestions.map(p => (
                  <div key={p.id} className="ac-item" onClick={() => selectParty(p)}>
                    <span className="font-medium">{p.name}</span>
                    {p.phone && <span className="text-xs text-slate-400">{p.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Consignee */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Consignee (To Party) *</label>
          <div className="relative" ref={consigneeRef}>
            <input type="text" value={form.consigneeName}
              onChange={e => searchConsignee(e.target.value)}
              onFocus={() => form.consigneeName.length >= 2 && setShowConsigneeSug(true)}
              placeholder="Buyer / Delivery party name..." className="inp" autoComplete="off" />
            {showConsigneeSug && consigneeSuggestions.length > 0 && (
              <div className="ac-dropdown">
                {consigneeSuggestions.map(p => (
                  <div key={p.id} className="ac-item" onClick={() => { setForm(f => ({ ...f, consigneeName: p.name })); setShowConsigneeSug(false) }}>
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
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="inp" />
        </div>

        {/* Item Details */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Item Details *</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Item Name</label>
              <input type="text" value={form.itemDescription}
                onChange={e => setForm(f => ({ ...f, itemDescription: e.target.value }))}
                placeholder="Iron / Loha, Steel Pipe" className="inp" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Size / Grade</label>
              <input type="text" value={form.itemSize}
                onChange={e => setForm(f => ({ ...f, itemSize: e.target.value }))}
                placeholder="12mm, Grade A" className="inp" />
            </div>
          </div>
        </div>

        {/* Vehicle */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Vehicle Number</label>
          <input type="text" value={form.vehicleNo}
            onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value.toUpperCase() }))}
            placeholder="MH12AB1234" className="inp" style={{ textTransform:'uppercase' }} />
        </div>

        {/* Weight */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Weight (KG) *</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_KG.map(kg => (
              <button key={kg} onClick={() => setForm(f => ({ ...f, weightKg: String(kg) }))}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  String(form.weightKg) === String(kg)
                    ? 'border-brand-800 bg-brand-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-brand-600'
                }`}>
                {kg >= 1000 ? `${kg/1000}T` : `${kg}kg`}
              </button>
            ))}
          </div>
          <input type="text" inputMode="decimal" value={form.weightKg}
            onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, weightKg: v })) }}
            placeholder="Custom KG (e.g. 2580)" className="inp" />
          {form.weightKg && (
            <p className="text-xs text-slate-400 mt-1">= {(parseFloat(form.weightKg)/1000).toFixed(3)} Tons</p>
          )}
        </div>

        {/* Rate */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Rate per KG (₹) *</label>
          <input type="text" inputMode="decimal" value={form.ratePerKg}
            onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) { setForm(f => ({ ...f, ratePerKg: v })); setRateEdited(true) } }}
            placeholder="e.g. 2.75" className="inp" />
          {form.ratePerKg && (
            <p className="text-xs text-slate-400 mt-1">= ₹{(parseFloat(form.ratePerKg)*1000).toLocaleString('en-IN')}/Ton</p>
          )}
        </div>

        {/* Total Preview */}
        {totalAmount > 0 && (
          <div className="px-4 py-3 bg-brand-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-800">Total Amount</span>
              <span className="text-xl font-bold text-brand-800">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-xs text-brand-600 mt-0.5 text-right">
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
            ].map(([s, ac, ic]) => (
              <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                className={`min-h-[44px] py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.status === s ? ac : ic}`}>
                {s}
              </button>
            ))}
          </div>
          {form.status === 'Partial' && (
            <input type="number" value={form.paidAmount}
              onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))}
              placeholder="Amount received so far (₹)" className="inp mt-2.5" />
          )}
        </div>

        {/* Payment Mode */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Payment Mode</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {['Cash','Cheque','GPay','PhonePe','Online','Pending'].map(mode => (
              <button key={mode} onClick={() => setForm(f => ({ ...f, paymentMode: mode }))}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  form.paymentMode === mode
                    ? 'border-brand-800 bg-brand-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-brand-600'
                }`}>{mode}</button>
            ))}
          </div>
          {form.paymentMode === 'Cheque' && (
            <div className="space-y-2 mt-2">
              <input type="text" value={form.bankName}
                onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder="Bank Name" className="inp" />
              <input type="text" value={form.chequeNo}
                onChange={e => setForm(f => ({ ...f, chequeNo: e.target.value }))}
                placeholder="Cheque Number" className="inp" />
            </div>
          )}
          {(form.paymentMode === 'GPay' || form.paymentMode === 'PhonePe') && (
            <div className="mt-2 p-3 bg-brand-50 rounded-xl text-sm text-brand-800">
              {form.paymentMode === 'GPay'    && settings.gpayNo    && <div>GPay No: <strong>{settings.gpayNo}</strong></div>}
              {form.paymentMode === 'PhonePe' && settings.phonepeNo && <div>PhonePe: <strong>{settings.phonepeNo}</strong></div>}
            </div>
          )}
        </div>

        {/* Extra Line Items / Adjustments */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Extra Amounts (add / subtract)
            </label>
            <button
              onClick={() => setForm(f => ({
                ...f,
                adjustments: [...(f.adjustments || []), { id: Date.now(), label: '', amount: '' }]
              }))}
              className="text-xs font-semibold text-brand-800 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
            >
              + Add Line
            </button>
          </div>

          {(form.adjustments || []).length === 0 && (
            <p className="text-xs text-slate-400 italic">
              Koi extra amount nahi — "Add Line" dabao jaise Previous Balance, Advance, Discount etc.
            </p>
          )}

          <div className="space-y-2 mt-1">
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
                  placeholder="Label (e.g. Previous Balance)"
                  className="inp flex-1"
                />
                <input
                  type="number"
                  value={adj.amount}
                  onChange={e => {
                    const updated = [...form.adjustments]
                    updated[idx] = { ...updated[idx], amount: e.target.value }
                    setForm(f => ({ ...f, adjustments: updated }))
                  }}
                  placeholder="₹ (use - for deduction)"
                  className="inp w-40 text-right"
                />
                <button
                  onClick={() => setForm(f => ({ ...f, adjustments: f.adjustments.filter((_, i) => i !== idx) }))}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Running total preview */}
          {(form.adjustments || []).length > 0 && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Freight ({form.weightKg || 0} kg × ₹{form.ratePerKg || 0})</span>
                <span>₹{((parseFloat(form.weightKg)||0)*(parseFloat(form.ratePerKg)||0)).toLocaleString('en-IN')}</span>
              </div>
              {(form.adjustments || []).map((adj, idx) => adj.amount !== '' && (
                <div key={idx} className={`flex justify-between ${parseFloat(adj.amount) < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                  <span>{adj.label || `Line ${idx + 1}`}</span>
                  <span>{parseFloat(adj.amount) >= 0 ? '+' : ''}₹{Number(parseFloat(adj.amount)||0).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1 mt-1 text-sm">
                <span>Grand Total</span>
                <span>₹{total().toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Notes / Remarks (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Koi remark..." rows={2} className="inp resize-none" />
        </div>

        {/* Submit */}
        <div className="p-4">
          <button onClick={handleSubmit} disabled={saving}
            className="w-full min-h-[52px] bg-brand-800 text-white rounded-xl font-semibold text-base hover:bg-brand-900 transition-colors disabled:opacity-50 shadow-sm">
            {saving ? 'Saving...' : editBill ? '✓ Update Bill' : '✓ Save Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}
