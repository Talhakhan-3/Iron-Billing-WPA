import { useState, useEffect } from 'react'
import { Save, Download, Upload, RefreshCw } from 'lucide-react'
import { db, syncWithCloud } from '../db/db'

export default function Settings() {
  const [form, setForm] = useState({ 
    businessName: '', 
    businessAddress: '', 
    businessPhone: '', 
    gstin: '', 
    currentRate: '',
    paymentNote: '',
    termsText: '',
    branchContacts: '',
    businessTiming: '',
    lampingCharge: '0',
    loadingCharge: '0',
    deliveryCharge: '0',
    weightCharge: '0',
    biltyCharge: '0',
    serviceTax: '0'
  })
  
  const [saved, setSaved]   = useState(false)
  const [msg, setMsg]       = useState('')
  const [syncing, setSyncing] = useState(false)
  const [logoBase64, setLogoBase64] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    const all = await db.settings.toArray()
    const s = {}
    
    // Logo loading logic from DB
    const logoStored = await db.settings.get('logoBase64')
    if (logoStored?.value) setLogoBase64(logoStored.value)

    all.forEach(i => { s[i.key] = i.value })
    
    setForm({
      businessName:     s.businessName    || '',
      businessAddress:  s.businessAddress || '',
      businessPhone:    s.businessPhone   || '',
      gstin:            s.gstin           || '',
      currentRate:      s.currentRate     || '',
      paymentNote:      s.paymentNote     || 'Payment by Cheque only No Cash accepted.',
      termsText:        s.termsText       || '1. Delivery must be taken within 7 days of booking. No claims after 7 days.\n2. After 30 days company is not responsible for any loss of goods.',
      branchContacts:   s.branchContacts  || '',
      businessTiming:   s.businessTiming  || 'Timing : 11 AM To 7 PM  Customer Care No : ',
      lampingCharge:    s.lampingCharge   || '0',
      loadingCharge:    s.loadingCharge   || '0',
      deliveryCharge:   s.deliveryCharge  || '0',
      weightCharge:     s.weightCharge    || '0',
      biltyCharge:      s.biltyCharge     || '0',
      serviceTax:       s.serviceTax      || '0',
    })
  }

  const saveSettings = async () => {
    try {
      for (const [key, value] of Object.entries(form)) {
        await db.settings.put({ key, value })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert("Error saving settings: " + e.message)
    }
  }

  const backup = async () => {
    const [parties, bills, settings] = await Promise.all([
      db.parties.toArray(), db.bills.toArray(), db.settings.toArray()
    ])
    const blob = new Blob([JSON.stringify({ parties, bills, settings, exportedAt: new Date().toISOString() }, null, 2)], { 
      type: 'application/json' 
    })
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url
    a.download = `IronBilling_Backup_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('✅ Backup download ho gaya!')
    setTimeout(() => setMsg(''), 3000)
  }

  const restore = async e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.bills || !data.parties) return alert('Invalid backup file!')
        if (!window.confirm(`Restore karega:\n${data.parties.length} parties, ${data.bills.length} bills\n\nSure ho?`)) return
        
        await Promise.all([db.parties.clear(), db.bills.clear(), db.settings.clear()])
        if (data.parties.length) await db.parties.bulkAdd(data.parties)
        if (data.bills.length)   await db.bills.bulkAdd(data.bills)
        if (data.settings.length) await db.settings.bulkPut(data.settings)
        
        setMsg('✅ Restore ho gaya! Reload ho raha hai...')
        setTimeout(() => window.location.reload(), 1500)
      } catch (err) { 
        alert('Backup file read nahi hua. Sahi file select karo.') 
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const manualSync = async () => {
    setSyncing(true)
    await syncWithCloud()
    setSyncing(false)
    setMsg('✅ Sync complete!')
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <div className="max-w-lg space-y-4 pb-10">
      <h1 className="text-xl font-bold text-slate-800">Settings</h1>

      {/* Business Information Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Business Information</h2>
        
        <div className="space-y-4">
          {/* Logo Upload Section */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">
              Company Logo (PDF bill mein dikhega)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={async e => {
                const file = e.target.files[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = async ev => {
                  const b64 = ev.target.result
                  setLogoBase64(b64)
                  await db.settings.put({ key: 'logoBase64', value: b64 })
                }
                reader.readAsDataURL(file)
              }}
              className="inp"
            />
            {logoBase64 && (
              <div className="mt-2 flex items-center gap-3">
                <img src={logoBase64} className="h-12 object-contain border border-slate-200 rounded-lg p-1" alt="logo" />
                <button
                  onClick={async () => {
                    if(window.confirm("Logo remove karein?")) {
                      setLogoBase64('')
                      await db.settings.put({ key: 'logoBase64', value: '' })
                    }
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove logo
                </button>
              </div>
            )}
          </div>

          {[
            ['businessName',    'Business Name (PDF mein aayega)'],
            ['businessAddress', 'Address'],
            ['businessPhone',   'Phone Number'],
            ['gstin',           'GSTIN (optional)'],
            ['currentRate',     'Default Iron Rate per Ton (₹)'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-slate-400 block mb-1">{label}</label>
              <input
                type={key === 'currentRate' ? 'number' : 'text'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="inp"
              />
            </div>
          ))}
        </div>
        
        <button onClick={saveSettings}
          className={`w-full min-h-[44px] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-1.5 mt-4 ${
            saved ? 'bg-green-500 text-white' : 'bg-teal-600 text-white hover:bg-teal-700'
          }`}>
          <Save size={15} /> {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* PDF Extra Settings */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">PDF Bill Settings</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Payment Note (Bold red mein aayega)</label>
            <input type="text" value={form.paymentNote}
              onChange={e => setForm(f => ({ ...f, paymentNote: e.target.value }))}
              className="inp" placeholder="Payment by Cheque only No Cash accepted." />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Terms & Conditions (Har line alag condition)</label>
            <textarea rows={3} value={form.termsText}
              onChange={e => setForm(f => ({ ...f, termsText: e.target.value }))}
              className="inp resize-none" />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Branch Contacts (Har branch alag line mein)</label>
            <textarea rows={3} value={form.branchContacts}
              onChange={e => setForm(f => ({ ...f, branchContacts: e.target.value }))}
              className="inp resize-none"
              placeholder="Mr. Alam - 9022517110&#10;Mr. Tanveer - 9664105087" />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Business Timing / Customer Care Line</label>
            <input type="text" value={form.businessTiming}
              onChange={e => setForm(f => ({ ...f, businessTiming: e.target.value }))}
              className="inp" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ['lampingCharge',  'Lamping Charge (Rs.)'],
              ['loadingCharge',  'Loading/Unloading (Rs.)'],
              ['deliveryCharge', 'Delivery Charge (Rs.)'],
              ['weightCharge',   'Weight Charge (Rs.)'],
              ['biltyCharge',    'Bil-ty Charge (Rs.)'],
              ['serviceTax',     'Service Tax (Rs.)'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-slate-400 block mb-1">{label}</label>
                <input type="number" value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="inp" min="0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cloud Sync */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 text-sm mb-2">Cloud Sync</h2>
        <p className="text-xs text-slate-400 mb-4">Supabase ke saath manually sync karo agar auto-sync nahi ho raha.</p>
        <button onClick={manualSync} disabled={syncing}
          className="w-full min-h-[44px] bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 text-sm mb-2">Backup & Restore</h2>
        <p className="text-xs text-slate-400 mb-4">Data ka local backup rakho — cloud ke alawa ek extra safety net.</p>
        {msg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-xl mb-3">{msg}</div>}
        <div className="flex gap-2">
          <button onClick={backup}
            className="flex-1 min-h-[44px] bg-slate-800 text-white rounded-xl font-medium text-sm hover:bg-slate-900 transition-colors flex items-center justify-center gap-1.5">
            <Download size={15} /> Backup
          </button>
          <label className="flex-1 min-h-[44px] bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
            <Upload size={15} /> Restore
            <input type="file" accept=".json" onChange={restore} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  )
}