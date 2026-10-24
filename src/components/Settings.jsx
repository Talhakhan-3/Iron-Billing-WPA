import { useState, useEffect } from 'react'
import {
  Save, Download, Upload, RefreshCw, LogOut, Key, Building2,
  Receipt, CreditCard, ShieldCheck, Moon, Sun, Check, AlertCircle, FileText
} from 'lucide-react'
import { db, syncWithCloud, getSettings } from '../db/db'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useToast } from './Toast'
import ThemeToggle from './ThemeToggle'

export default function Settings() {
  const { logout, changePIN, isPINMode } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('business')
  const [form, setForm] = useState({
    businessName: '', businessAddress: '', businessPhone: '', gstin: '', currentRate: '52',
    lastBillNumber: '22100',
    paymentNote: '', termsText: '', branchContacts: '', businessTiming: '',
    lampingCharge: '0', loadingCharge: '0', deliveryCharge: '0',
    biltyCharge: '0', serviceTax: '0',
    bankName: '', accountNo: '', ifscCode: '', gpayNo: '', phonepeNo: '', upiId: '',
  })

  const [saved, setSaved] = useState(false)
  const [logoBase64, setLogo] = useState('')
  const [signatureBase64, setSignature] = useState('')
  const [oldPIN, setOldPIN] = useState('')
  const [newPIN, setNewPIN] = useState('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const all = await db.settings.toArray()
      const s = {}
      all.forEach(i => { s[i.key] = i.value })

      if (s.logoBase64) setLogo(s.logoBase64)
      if (s.signatureBase64) setSignature(s.signatureBase64)

      setForm({
        businessName:    s.businessName    || 'Shree Transport',
        businessAddress: s.businessAddress || 'Mumbai, Maharashtra',
        businessPhone:   s.businessPhone   || '',
        gstin:           s.gstin           || '',
        currentRate:     s.currentRate     || '52',
        lastBillNumber:  s.lastBillNumber  || '22100',
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
    } catch (e) {
      console.error('Error loading settings', e)
    }
  }

  const saveSettings = async () => {
    try {
      for (const [key, value] of Object.entries(form)) {
        await db.settings.put({ key, value: String(value) })
      }
      if (logoBase64) await db.settings.put({ key: 'logoBase64', value: logoBase64 })
      if (signatureBase64) await db.settings.put({ key: 'signatureBase64', value: signatureBase64 })

      setSaved(true)
      toast.success('Settings saved successfully!')
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      toast.error('Error saving settings: ' + e.message)
    }
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setLogo(ev.target?.result || '')
      toast.info('Logo updated. Click Save Settings to persist.')
    }
    reader.readAsDataURL(file)
  }

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setSignature(ev.target?.result || '')
      toast.info('Signature updated. Click Save Settings to persist.')
    }
    reader.readAsDataURL(file)
  }

  const backup = async () => {
    try {
      const [parties, bills, settings] = await Promise.all([
        db.parties.toArray(), db.bills.toArray(), db.settings.toArray()
      ])
      const blob = new Blob(
        [JSON.stringify({ parties, bills, settings, exportedAt: new Date().toISOString() }, null, 2)],
        { type: 'application/json' }
      )
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `IronBilling_Backup_${new Date().toISOString().split('T')[0]}.json`
      })
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Backup file downloaded successfully.')
    } catch (e) {
      toast.error('Backup failed: ' + e.message)
    }
  }

  const restore = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target?.result)
        if (!data.bills || !data.parties) {
          toast.error('Invalid backup JSON format!')
          return
        }

        if (window.confirm(`Restore ${data.parties.length} parties and ${data.bills.length} bills? Current data will be replaced.`)) {
          await Promise.all([db.parties.clear(), db.bills.clear(), db.settings.clear()])
          if (data.parties.length)  await db.parties.bulkAdd(data.parties)
          if (data.bills.length)    await db.bills.bulkAdd(data.bills)
          if (data.settings.length) await db.settings.bulkPut(data.settings)
          toast.success('Backup restored successfully! Reloading...')
          setTimeout(() => window.location.reload(), 1200)
        }
      } catch (err) {
        toast.error('Could not restore backup file: ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handlePINChange = () => {
    try {
      if (newPIN.length < 4) {
        toast.error('New PIN must be at least 4 digits.')
        return
      }
      changePIN(oldPIN, newPIN)
      setOldPIN('')
      setNewPIN('')
      toast.success('Security PIN changed successfully!')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const triggerCloudSync = async () => {
    setSyncing(true)
    try {
      await syncWithCloud()
      toast.success('Cloud sync completed.')
    } catch (e) {
      toast.error('Sync error: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings & Profile</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure company details, rates, invoice numbers, and security
          </p>
        </div>

        <button
          onClick={saveSettings}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-white transition-all shadow-sm ${
            saved ? 'bg-emerald-600' : 'bg-emerald-800 hover:bg-emerald-900'
          }`}
        >
          <Save size={14} />
          <span>{saved ? 'Saved!' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto border border-slate-200 dark:border-slate-700/60">
        {[
          { id: 'business', label: 'Company Profile', Icon: Building2 },
          { id: 'billing',  label: 'Billing & Charges', Icon: Receipt },
          { id: 'bank',     label: 'Bank & UPI',       Icon: CreditCard },
          { id: 'security', label: 'Security & Backup', Icon: ShieldCheck },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ─── TAB 1: Company Profile ────────────────────────────────────────── */}
      {activeTab === 'business' && (
        <div className="card-base p-5 shadow-sm space-y-4 animate-fade-in">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Business / Transport Name
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
              placeholder="e.g. Shree Transport"
              className="inp text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Registered Address
            </label>
            <input
              type="text"
              value={form.businessAddress}
              onChange={e => setForm(f => ({ ...f, businessAddress: e.target.value }))}
              placeholder="City, State, Pin Code"
              className="inp text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Customer Care / Phone
              </label>
              <input
                type="text"
                value={form.businessPhone}
                onChange={e => setForm(f => ({ ...f, businessPhone: e.target.value }))}
                placeholder="Mobile number"
                className="inp text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={form.gstin}
                onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                placeholder="27AAAAA0000A1Z5"
                className="inp text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Default Freight Rate (₹/KG)
            </label>
            <input
              type="number"
              value={form.currentRate}
              onChange={e => setForm(f => ({ ...f, currentRate: e.target.value }))}
              placeholder="52"
              className="inp text-xs"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Auto-filled as initial rate when creating new bills.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Company Logo (Printed on Bilty)
            </label>
            <div className="flex items-center gap-3">
              {logoBase64 && (
                <img src={logoBase64} alt="Company Logo" className="h-10 max-w-[120px] object-contain border p-1 rounded bg-white" />
              )}
              <label className="cursor-pointer px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <span>Upload Logo Image</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              {logoBase64 && (
                <button
                  type="button"
                  onClick={() => setLogo('')}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove Logo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Billing & Invoice Config ─────────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="card-base p-5 shadow-sm space-y-4 animate-fade-in">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Next Bill Number Counter
            </label>
            <input
              type="number"
              value={form.lastBillNumber}
              onChange={e => setForm(f => ({ ...f, lastBillNumber: e.target.value }))}
              placeholder="22100"
              className="inp text-xs font-mono font-bold"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The next generated bill will be #{parseInt(form.lastBillNumber || '0') + 1}.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Terms & Conditions (Printed on Invoice)
            </label>
            <textarea
              value={form.termsText}
              onChange={e => setForm(f => ({ ...f, termsText: e.target.value }))}
              rows={3}
              className="inp text-xs resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Branch Contacts (Optional)
            </label>
            <textarea
              value={form.branchContacts}
              onChange={e => setForm(f => ({ ...f, branchContacts: e.target.value }))}
              placeholder="Branch 1: 9820000000&#10;Branch 2: 9830000000"
              rows={2}
              className="inp text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Lamping (₹)</label>
              <input
                type="number"
                value={form.lampingCharge}
                onChange={e => setForm(f => ({ ...f, lampingCharge: e.target.value }))}
                className="inp text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Loading (₹)</label>
              <input
                type="number"
                value={form.loadingCharge}
                onChange={e => setForm(f => ({ ...f, loadingCharge: e.target.value }))}
                className="inp text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Bilty Fee (₹)</label>
              <input
                type="number"
                value={form.biltyCharge}
                onChange={e => setForm(f => ({ ...f, biltyCharge: e.target.value }))}
                className="inp text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Service Tax (₹)</label>
              <input
                type="number"
                value={form.serviceTax}
                onChange={e => setForm(f => ({ ...f, serviceTax: e.target.value }))}
                className="inp text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: Bank & Digital Payments ─────────────────────────────────── */}
      {activeTab === 'bank' && (
        <div className="card-base p-5 shadow-sm space-y-4 animate-fade-in">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Bank Name
            </label>
            <input
              type="text"
              value={form.bankName}
              onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
              placeholder="State Bank of India / HDFC"
              className="inp text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={form.accountNo}
                onChange={e => setForm(f => ({ ...f, accountNo: e.target.value }))}
                placeholder="A/C Number"
                className="inp text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                value={form.ifscCode}
                onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                placeholder="SBIN0001234"
                className="inp text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              UPI ID (For dynamic Payment QR code)
            </label>
            <input
              type="text"
              value={form.upiId}
              onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))}
              placeholder="e.g. shreetransport@okhdfcbank"
              className="inp text-xs font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Used to generate instant UPI QR codes on bilty and in WhatsApp reminders.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                GPay Mobile Number
              </label>
              <input
                type="text"
                value={form.gpayNo}
                onChange={e => setForm(f => ({ ...f, gpayNo: e.target.value }))}
                placeholder="GPay number"
                className="inp text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                PhonePe Mobile Number
              </label>
              <input
                type="text"
                value={form.phonepeNo}
                onChange={e => setForm(f => ({ ...f, phonepeNo: e.target.value }))}
                placeholder="PhonePe number"
                className="inp text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Digital Signature (Authorised Signatory)
            </label>
            <div className="flex items-center gap-3">
              {signatureBase64 && (
                <img src={signatureBase64} alt="Signature" className="h-10 max-w-[120px] object-contain border p-1 rounded bg-white" />
              )}
              <label className="cursor-pointer px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <span>Upload Signature Image</span>
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>
              {signatureBase64 && (
                <button
                  type="button"
                  onClick={() => setSignature('')}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove Signature
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: Security, Theme & Backup ───────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-4 animate-fade-in">
          {/* Theme Preference */}
          <div className="card-base p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
              Application Theme
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Appearance</div>
                <div className="text-xs text-slate-400">Choose between light, dark, or system preference</div>
              </div>
              <ThemeToggle showLabel={true} />
            </div>
          </div>

          {/* Change PIN (if in PIN mode) */}
          {isPINMode && (
            <div className="card-base p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                Change Security PIN
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  value={oldPIN}
                  onChange={e => setOldPIN(e.target.value.replace(/\D/g, ''))}
                  placeholder="Current PIN"
                  maxLength={8}
                  className="inp text-xs font-mono"
                />
                <input
                  type="password"
                  value={newPIN}
                  onChange={e => setNewPIN(e.target.value.replace(/\D/g, ''))}
                  placeholder="New PIN (4+ digits)"
                  maxLength={8}
                  className="inp text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handlePINChange}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Update PIN
              </button>
            </div>
          )}

          {/* Offline Backup & Restore */}
          <div className="card-base p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
              Data Backup & Restore
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Download your full database (bills, parties, settings) as a portable JSON file or restore from a previous backup.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={backup}
                className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Download size={15} />
                <span>Download Complete Backup</span>
              </button>

              <label className="flex items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-center">
                <Upload size={15} />
                <span>Restore from JSON File</span>
                <input type="file" accept=".json" onChange={restore} className="hidden" />
              </label>
            </div>

            {/* Direct Project Codebase ZIP Download */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Export Final Codebase ZIP</div>
                <div className="text-[11px] text-slate-400">Download clean production-ready archive of this complete application</div>
              </div>
              <a
                href="/iron-billing-modernized.zip"
                download="iron-billing-modernized.zip"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Download size={13} />
                <span>Download .ZIP</span>
              </a>
            </div>
          </div>

          {/* Cloud Sync & Logout */}
          <div className="card-base p-5 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Session Security</div>
              <div className="text-xs text-slate-400">Lock the application or sign out</div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-colors"
            >
              <LogOut size={14} />
              <span>Lock / Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Save Bar */}
      <div className="pt-2">
        <button
          type="button"
          onClick={saveSettings}
          className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Save size={16} />
          <span>Save All Settings</span>
        </button>
      </div>
    </div>
  )
}
