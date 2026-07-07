import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { Zap, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { loginWithPIN, hasPIN } = useAuth()
  const [pin, setPin]       = useState('')
  const [show, setShow]     = useState(false)
  const [err, setErr]       = useState('')
  const [loading, setLoad]  = useState(false)
  const isFirst = !hasPIN()

  const submit = async () => {
    if (pin.length < 4) return setErr('PIN kam se kam 4 digits ka hona chahiye')
    setLoad(true); setErr('')
    try {
      const res = await loginWithPIN(pin)
      if (res.firstTime) { /* AuthContext sets user — App re-renders */ }
    } catch (e) {
      setErr(e.message)
    }
    setLoad(false)
  }

  const handleKey = e => { if (e.key === 'Enter') submit() }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f8fafc', padding: '16px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '36px 32px',
        width: '100%', maxWidth: '360px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: '#1a3a2a', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 12px'
          }}>
            <Zap size={26} color="#fff" fill="#fff" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111' }}>Iron Billing</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Shree Transport</div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Lock size={14} color="#1a3a2a" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a3a2a' }}>
              {isFirst ? 'Naya PIN Set Karo' : 'PIN Daalo'}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '22px' }}>
            {isFirst
              ? 'Pehli baar — apna PIN choose karo (4+ digits). Yaad rakhna!'
              : 'App access karne ke liye apna PIN daalo'}
          </p>
        </div>

        {/* PIN Input */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g,'')); setErr('') }}
            onKeyDown={handleKey}
            placeholder="••••"
            maxLength={8}
            autoFocus
            className="inp"
            style={{ fontSize: '22px', letterSpacing: '0.3em', textAlign: 'center', paddingRight: '44px' }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'
            }}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {err && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '8px 12px', fontSize: '12px', color: '#dc2626', marginBottom: '12px'
          }}>
            {err}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading || pin.length < 4}
          style={{
            width: '100%', minHeight: '48px', background: '#1a3a2a', color: '#fff',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600',
            cursor: 'pointer', opacity: (loading || pin.length < 4) ? 0.5 : 1,
            transition: 'opacity 0.15s'
          }}
        >
          {loading ? 'Checking...' : isFirst ? 'PIN Set Karo & Enter Karo' : 'Enter'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#cbd5e1', marginTop: '16px' }}>
          Data sirf is device pe save hota hai
        </p>
      </div>
    </div>
  )
}
