import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { Zap, Lock, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function Login() {
  const { loginWithPIN, hasPIN } = useAuth()
  const [pin, setPin] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoad] = useState(false)
  const isFirst = !hasPIN()

  const submit = async () => {
    if (pin.length < 4) {
      setErr('PIN must be at least 4 digits')
      return
    }
    setLoad(true)
    setErr('')
    try {
      await loginWithPIN(pin)
    } catch (e) {
      setErr(e.message || 'Incorrect PIN. Please try again.')
    } finally {
      setLoad(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') submit()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Top right theme toggle */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="card-base p-7 sm:p-8 w-full max-w-sm shadow-xl animate-fade-in">
        {/* Logo and Brand */}
        <div className="text-center mb-6">
          <div className="w-13 h-13 rounded-2xl bg-emerald-800 flex items-center justify-center mx-auto mb-3 text-white shadow-lg shadow-emerald-950/20">
            <Zap size={28} fill="currentColor" />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Iron Billing
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Heavy Transport & Bilty Management
          </p>
        </div>

        {/* Security Title */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={15} className="text-emerald-700 dark:text-emerald-400" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isFirst ? 'Set Up Master PIN' : 'Enter Security PIN'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isFirst
              ? 'First time setup: Choose a 4-8 digit security PIN for this device.'
              : 'Enter your security PIN to access billing records.'}
          </p>
        </div>

        {/* PIN Input */}
        <div className="relative mb-3">
          <input
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            value={pin}
            onChange={e => {
              setPin(e.target.value.replace(/\D/g, ''))
              setErr('')
            }}
            onKeyDown={handleKey}
            placeholder="••••"
            maxLength={8}
            autoFocus
            className="inp text-2xl tracking-[0.3em] text-center font-mono pr-11 py-2.5"
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        {/* Error notice */}
        {err && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs p-2.5 rounded-xl mb-3 font-medium animate-fade-in">
            {err}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={submit}
          disabled={loading || pin.length < 4}
          className="w-full min-h-[48px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-40 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <KeyRound size={16} />
              <span>{isFirst ? 'Set PIN & Enter' : 'Unlock Application'}</span>
            </>
          )}
        </button>

        {/* Offline Safety Footnote */}
        <div className="flex items-center justify-center gap-1.5 mt-5 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck size={13} />
          <span>Offline-first · Data secured on this device</span>
        </div>
      </div>
    </div>
  )
}
