import { useState, useEffect } from 'react'
import { Save, Download, Upload, RefreshCw, LogOut, Key } from 'lucide-react'
import { db, syncWithCloud } from '../db/db'
import { useAuth } from '../lib/AuthContext'

// ─── Sub-components defined OUTSIDE Settings to prevent remount on every keystroke ───

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="font-semibold text-slate-700 text-sm mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, k, type = 'text', placeholder = '', value, onChange }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="inp"
      />
    </div>
  )
}

function SaveBtn({ onClick, saved }) {
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[44px] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-1.5 mt-4 ${
        saved ? 'bg-green-500 text-white' : 'bg-brand-800 text-white hover:bg-brand-900'
      }`}
    >
      <Save size={15} /> {saved ? '✓ Saved!' : 'Save Settings'}
    </button>
  )
}

// ─── Main Settings component ───────────────────────────────────────────────

export default function Settings() {
  const { logout, changePIN } = useAuth()

  const [form, setForm] = useState({
    businessName: '', businessAddress: '', businessPhone: '', gstin: '', currentRate: '',
    paymentNote: '', termsText: '', branchContacts: '', businessTiming: '',
    lampingCharge: '0', loadingCharge: '0', deliveryCharge: '0',
    biltyCharge: '0', serviceTax: '0',
    bankName: '', accountNo: '', ifscCode: '', gpayNo: '', phonepeNo: '', upiId: '',
  })
  const [saved,           setSaved]     = useState(false)
  const [msg,             setMsg]       = useState('')
  const [syncing,         setSyncing]   = useState(false)
  const [logoBase64,      setLogo]      = useState('')
  const [signatureBase64, setSignature] = useState('')
  const [oldPIN,          setOldPIN]    = useState('')
  const [newPIN,     setNewPIN]    = useState('')
  const [pinMsg,     setPinMsg]    = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    const all = await db.settings.toArray()
    const s = {}
    all.forEach(i => { s[i.key] = i.value })
    if (s.logoBase64) setLogo(s.logoBase64)
    if (s.signatureBase64) setSignature(s.signatureBase64)
    setForm({
      businessName:    s.businessName    || '',
      businessAddress: s.businessAddress || '',
      businessPhone:   s.businessPhone   || '',
      gstin:           s.gstin           || '',
      currentRate:     s.currentRate     || '',
      paymentNote:     s.paymentNote     || 'Payment by Cheque only. No Cash accepted.',
      termsText:       s.termsText       || '1. Delivery within 7 days. No claims after 7 days.\n2. After 30 days company not responsible for loss of goods.',
      branchContacts:  s.branchContacts  || '',
      businessTiming:  s.businessTiming  || '',
      lampingCharge:   s.lampingCharge   || '0',
      loadingCharge:   s.loadingCharge   || '0',
      deliveryCharge:  s.deliveryCharge  || '0',
      biltyCharge:     s.biltyCharge     || '0',
      serviceTax:      s.serviceTax      || '0',
      bankName:        s.bankName        || '',
      accountNo:       s.accountNo       || '',
      ifscCode:        s.ifscCode        || '',
      gpayNo:          s.gpayNo          || '',
      phonepeNo:       s.phonepeNo       || '',
      upiId:           s.upiId           || '',
    })
  }

  const saveSettings = async () => {
    try {
      for (const [key, value] of Object.entries(form)) {
        await db.settings.put({ key, value })
      }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { alert('Error: ' + e.message) }
  }

  const f = (k) => ({
    value: form[k],
    onChange: e => setForm(p => ({ ...p, [k]: e.target.value }))
  })

  const backup = async () => {
    const [parties, bills, settings] = await Promise.all([
      db.parties.toArray(), db.bills.toArray(), db.settings.toArray()
    ])
    const blob = new Blob(
      [JSON.stringify({ parties, bills, settings, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    )
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `IronBilling_Backup_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.json`
    })
    a.click(); URL.revokeObjectURL(a.href)
    setMsg('✅ Backup download ho gaya!')
    setTimeout(() => setMsg(''), 3000)
  }

  const restore = async e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.bills || !data.parties) return alert('Invalid backup file!')
        if (!window.confirm(`Restore: ${data.parties.length} parties, ${data.bills.length} bills. Sure?`)) return
        await Promise.all([db.parties.clear(), db.bills.clear(), db.settings.clear()])
        if (data.parties.length)  await db.parties.bulkAdd(data.parties)
        if (data.bills.length)    await db.bills.bulkAdd(data.bills)
        if (data.settings.length) await db.settings.bulkPut(data.settings)
        setMsg('✅ Restore ho gaya! Reload...')
        setTimeout(() => window.location.reload(), 1500)
      } catch { alert('Backup file galat hai.') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handlePINChange = () => {
    try {
      if (newPIN.length < 4) return setPinMsg('Naya PIN 4+ digits ka hona chahiye')
      changePIN(oldPIN, newPIN)
      setOldPIN(''); setNewPIN('')
      setPinMsg('✅ PIN change ho gaya!')
      setTimeout(() => setPinMsg(''), 3000)
    } catch (e) { setPinMsg(e.message) }
  }

  return (
    <div className="max-w-lg space-y-4 pb-10">
      <h1 className="text-xl font-bold text-slate-800">Settings</h1>

      {/* Business Info */}
      <Section title="Business Information">
        <div className="space-y-3">
          <div className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">Company Logo (PDF mein aayega)</label>
            <input type="file" accept="image/*" className="inp"
              onChange={async e => {
                const file = e.target.files[0]; if (!file) return
                const reader = new FileReader()
                reader.onload = async ev => {
                  const b64 = ev.target.result
                  setLogo(b64)
                  await db.settings.put({ key: 'logoBase64', value: b64 })
                }
                reader.readAsDataURL(file)
              }} />
            {logoBase64 && (
              <div className="mt-2 flex items-center gap-3">
                <img src={logoBase64} className="h-12 object-contain border border-slate-200 rounded-lg p-1" alt="logo" />
                <button onClick={async () => { setLogo(''); await db.settings.put({ key: 'logoBase64', value: '' }) }}
                  className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            )}
          </div>

          {/* Authorized Signature */}
          <div className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">Authorized Signature (PDF mein dikhega)</label>
            <input type="file" accept="image/*" className="inp"
              onChange={async e => {
                const file = e.target.files[0]; if (!file) return
                const reader = new FileReader()
                reader.onload = async ev => {
                  const img = new Image()
                  img.onload = async () => {
                    const canvas = document.createElement('canvas')
                    const maxW = 400
                    const scale = Math.min(1, maxW / img.width)
                    canvas.width  = img.width  * scale
                    canvas.height = img.height * scale
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                    const b64 = canvas.toDataURL('image/png')
                    setSignature(b64)
                    await db.settings.put({ key: 'signatureBase64', value: b64 })
                  }
                  img.src = ev.target.result
                }
                reader.readAsDataURL(file)
              }} />
            {signatureBase64 && (
              <div className="mt-2 flex items-center gap-3">
                <img src={signatureBase64} className="max-h-12 object-contain border border-slate-200 rounded-lg p-1" alt="signature" />
                <button onClick={async () => { setSignature(''); await db.settings.put({ key: 'signatureBase64', value: '' }) }}
                  className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            )}
            <p className="text-xs text-amber-600 mt-1">💡 White background pe kali ink se sign karo, photo lo — clean PDF aayega</p>
          </div>
          <Field label="Business Name"         k="businessName"    {...f('businessName')} />
          <Field label="Address"               k="businessAddress" {...f('businessAddress')} />
          <Field label="Phone Number"          k="businessPhone"   {...f('businessPhone')} />
          <Field label="GSTIN (optional)"      k="gstin"           {...f('gstin')} />
          <Field label="Default Rate per KG (₹)" k="currentRate"  {...f('currentRate')} type="number" />
        </div>
        <SaveBtn onClick={saveSettings} saved={saved} />
      </Section>

      {/* PDF Settings */}
      <Section title="PDF Bill Settings">
        <div className="space-y-3">
          <Field label="Payment Note (PDF mein bold red)" k="paymentNote" {...f('paymentNote')} />
          <div>
            <label className="text-xs text-slate-400 block mb-1">Terms & Conditions</label>
            <textarea rows={3} value={form.termsText}
              onChange={e => setForm(p => ({ ...p, termsText: e.target.value }))}
              className="inp resize-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Branch Contacts (har line = ek branch)</label>
            <textarea rows={2} value={form.branchContacts}
              onChange={e => setForm(p => ({ ...p, branchContacts: e.target.value }))}
              className="inp resize-none"
              placeholder="Mr. Alam - 9022517110&#10;Mr. Tanveer - 9664105087" />
          </div>
          <Field label="Business Timing" k="businessTiming" {...f('businessTiming')} placeholder="11 AM to 7 PM" />
          <div className="grid grid-cols-2 gap-2">
            {[
              ['lampingCharge',  'Lamping (₹)'],
              ['loadingCharge',  'Loading/Unloading (₹)'],
              ['deliveryCharge', 'Delivery (₹)'],
              ['biltyCharge',    'Bilty (₹)'],
              ['serviceTax',     'Service Tax (₹)'],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="text-xs text-slate-400 block mb-1">{label}</label>
                <input type="number" value={form[k]} min="0"
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="inp" />
              </div>
            ))}
          </div>
        </div>
        <SaveBtn onClick={saveSettings} saved={saved} />
      </Section>

      {/* Bank & Payment */}
      <Section title="Bank & Payment Details">
        <div className="space-y-3">
          <Field label="Bank Name"       k="bankName"  {...f('bankName')}  placeholder="State Bank of India" />
          <Field label="Account Number"  k="accountNo" {...f('accountNo')} />
          <div>
            <label className="text-xs text-slate-400 block mb-1">IFSC Code</label>
            <input type="text" value={form.ifscCode}
              onChange={e => setForm(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
              style={{ textTransform: 'uppercase' }}
              placeholder="SBIN0001234" className="inp" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="GPay Number"    k="gpayNo"    {...f('gpayNo')}    placeholder="10 digit" />
            <Field label="PhonePe Number" k="phonepeNo" {...f('phonepeNo')} placeholder="10 digit" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">UPI ID (QR code ke liye — PDF mein aayega)</label>
            <input
              type="text"
              value={form.upiId}
              onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))}
              placeholder="e.g. 9022517110@ybl"
              className="inp"
            />
            {form.upiId && (
              <p className="text-xs text-teal-600 mt-1">✓ QR code bills mein auto-generate hoga</p>
            )}
          </div>
        </div>
        <SaveBtn onClick={saveSettings} saved={saved} />
      </Section>

      {/* PIN Change */}
      <Section title="PIN Change Karo">
        <div className="space-y-3">
          {pinMsg && (
            <div className={`text-sm p-3 rounded-xl ${pinMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {pinMsg}
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Purana PIN</label>
            <input type="password" inputMode="numeric" value={oldPIN} maxLength={8}
              onChange={e => setOldPIN(e.target.value.replace(/\D/g, ''))}
              placeholder="••••" className="inp" style={{ letterSpacing: '0.2em', textAlign: 'center' }} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Naya PIN (4+ digits)</label>
            <input type="password" inputMode="numeric" value={newPIN} maxLength={8}
              onChange={e => setNewPIN(e.target.value.replace(/\D/g, ''))}
              placeholder="••••" className="inp" style={{ letterSpacing: '0.2em', textAlign: 'center' }} />
          </div>
          <button onClick={handlePINChange}
            className="w-full min-h-[44px] bg-slate-800 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors">
            <Key size={15} /> PIN Change Karo
          </button>
        </div>
      </Section>

      {/* Cloud Sync */}
      <Section title="Cloud Sync">
        <p className="text-xs text-slate-400 mb-4">Manually sync karo agar auto-sync nahi hua.</p>
        <button
          onClick={async () => { setSyncing(true); await syncWithCloud(); setSyncing(false); setMsg('✅ Sync done!'); setTimeout(() => setMsg(''), 2500) }}
          disabled={syncing}
          className="w-full min-h-[44px] bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </Section>

      {/* Backup */}
      <Section title="Backup & Restore">
        <p className="text-xs text-slate-400 mb-4">Data ka local backup — cloud ke alawa safety net.</p>
        {msg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-xl mb-3">{msg}</div>}
        <div className="flex gap-2">
          <button onClick={backup}
            className="flex-1 min-h-[44px] bg-slate-800 text-white rounded-xl font-medium text-sm hover:bg-slate-900 flex items-center justify-center gap-1.5 transition-colors">
            <Download size={15} /> Backup
          </button>
          <label className="flex-1 min-h-[44px] bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 cursor-pointer flex items-center justify-center gap-1.5 transition-colors">
            <Upload size={15} /> Restore
            <input type="file" accept=".json" onChange={restore} className="hidden" />
          </label>
        </div>
      </Section>

      {/* Logout */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 text-sm mb-2">Account</h2>
        <p className="text-xs text-slate-400 mb-4">App se bahar niklo. Data safe rahega.</p>
        <button onClick={logout}
          className="w-full min-h-[44px] bg-red-500 text-white rounded-xl font-medium text-sm hover:bg-red-600 flex items-center justify-center gap-2 transition-colors">
          <LogOut size={15} /> Logout
        </button>
      </div>
    </div>
  )
}
