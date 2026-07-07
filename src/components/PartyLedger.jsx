import { useState, useEffect } from 'react'
import { ArrowLeft, Download, MessageCircle, Phone, TrendingDown } from 'lucide-react'
import { db } from '../db/db'
import { exportPartyLedger } from '../utils/exportExcel'

const fmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtD = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

const STATUS_STYLE = {
  Paid:    'bg-green-100 text-green-700',
  Unpaid:  'bg-red-100 text-red-700',
  Partial: 'bg-amber-100 text-amber-700',
}

export default function PartyLedger({ partyName, navigate }) {
  const [party,    setParty]    = useState(null)
  const [bills,    setBills]    = useState([])
  const [settings, setSettings] = useState({})
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { load() }, [partyName])

  const load = async () => {
    setLoading(true)
    const [allBills, allSettings, partyRecord] = await Promise.all([
      db.bills.where('partyName').equalsIgnoreCase(partyName).reverse().sortBy('date'),
      db.settings.toArray(),
      db.parties.filter(p => p.name.toLowerCase() === partyName.toLowerCase()).first(),
    ])
    const sMap = {}
    allSettings.forEach(s => { sMap[s.key] = s.value })
    setSettings(sMap)
    setParty(partyRecord || { name: partyName })
    // Sort newest first
    setBills([...allBills].sort((a, b) => new Date(b.date) - new Date(a.date)))
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px' }}>
      <div style={{ width:'24px', height:'24px', border:'2px solid #1a3a2a', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
    </div>
  )

  const totalBilled  = bills.reduce((s, b) => s + Number(b.total), 0)
  const totalPaid    = bills.reduce((s, b) => {
    if (b.status === 'Paid')    return s + Number(b.total)
    if (b.status === 'Partial') return s + Number(b.paidAmount || 0)
    return s
  }, 0)
  const totalDue     = totalBilled - totalPaid
  const unpaidBills  = bills.filter(b => b.status !== 'Paid')

  // WhatsApp reminder for all unpaid bills
  const sendReminder = () => {
    const bizName = settings.businessName || 'Shree Transport'
    const ph      = party?.phone || ''
    const lines   = unpaidBills.slice(0, 5).map(b => {
      const due = b.status === 'Partial'
        ? Number(b.total) - Number(b.paidAmount || 0)
        : Number(b.total)
      return `  • Bill #${String(b.billNumber).padStart(5,'0')} (${fmtD(b.date)}) — Due: ${fmt(due)}`
    })
    const msg = [
      `*${bizName}* — Payment Reminder`,
      ``,
      `Dear *${partyName}*,`,
      ``,
      `Aapke account mein kuch outstanding bills hain:`,
      ...lines,
      unpaidBills.length > 5 ? `  ...aur ${unpaidBills.length - 5} bills` : '',
      ``,
      `*Total Baki: ${fmt(totalDue)}*`,
      ``,
      `Please jald se jald payment clear karein.`,
      `Dhanyawad 🙏`,
    ].filter(l => l !== undefined).join('\n')

    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // WhatsApp reminder for single bill
  const sendSingleReminder = (bill) => {
    const bizName = settings.businessName || 'Shree Transport'
    const ph      = party?.phone || ''
    const due     = bill.status === 'Partial'
      ? Number(bill.total) - Number(bill.paidAmount || 0)
      : Number(bill.total)
    const msg = [
      `*${bizName}* — Payment Reminder`,
      ``,
      `Dear *${partyName}*,`,
      ``,
      `Bill #${String(bill.billNumber).padStart(5,'0')} dated ${fmtD(bill.date)} ka payment pending hai.`,
      ``,
      `Bill Amount : ${fmt(bill.total)}`,
      bill.status === 'Partial' ? `Paid       : ${fmt(bill.paidAmount || 0)}` : '',
      `*Due Amount : ${fmt(due)}*`,
      ``,
      `Please clear karein. Dhanyawad 🙏`,
    ].filter(Boolean).join('\n')

    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <button onClick={() => navigate('parties')}
          style={{ padding:'8px', borderRadius:'10px', border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center' }}>
          <ArrowLeft size={16} color="#475569" />
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize:'18px', fontWeight:'700', color:'#0f172a', margin:0 }}>{partyName}</h1>
          <p style={{ fontSize:'12px', color:'#94a3b8', margin:0 }}>Party Ledger</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {party?.phone && (
            <a href={`tel:${party.phone}`}
              style={{ padding:'8px', borderRadius:'10px', border:'1px solid #e2e8f0', background:'#fff', display:'flex', alignItems:'center', color:'#475569' }}>
              <Phone size={15} />
            </a>
          )}
          <button onClick={() => exportPartyLedger(partyName, [...bills].reverse())}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', borderRadius:'10px', background:'#166534', color:'#fff', border:'none', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
        {[
          { label:'Total Billed',  value: fmt(totalBilled),  color:'#1a3a2a', bg:'#f0fdf4' },
          { label:'Total Paid',    value: fmt(totalPaid),    color:'#166534', bg:'#dcfce7' },
          { label:'Total Due',     value: fmt(totalDue),     color:'#991b1b', bg:'#fee2e2' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:'12px', padding:'12px', border:`1px solid ${c.bg}` }}>
            <div style={{ fontSize:'11px', color:c.color, opacity:0.7, marginBottom:'4px' }}>{c.label}</div>
            <div style={{ fontSize:'14px', fontWeight:'700', color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* WhatsApp reminder for ALL pending (only if dues > 0) */}
      {totalDue > 0 && (
        <button onClick={sendReminder}
          style={{
            width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
            gap:'8px', padding:'13px', borderRadius:'12px',
            background:'#25d366', color:'#fff', border:'none',
            fontSize:'13px', fontWeight:'600', cursor:'pointer', marginBottom:'16px'
          }}>
          <MessageCircle size={16} />
          WhatsApp Reminder Bhejo — {fmt(totalDue)} due
        </button>
      )}

      {/* Bills list */}
      {bills.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 16px', color:'#94a3b8' }}>
          <TrendingDown size={36} style={{ margin:'0 auto 8px', opacity:0.3 }} />
          <div style={{ fontSize:'14px' }}>Is party ka koi bill nahi</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {bills.map(b => {
            const paid    = b.status === 'Paid' ? Number(b.total) : Number(b.paidAmount || 0)
            const due     = Number(b.total) - paid
            return (
              <div key={b.id} style={{
                background:'#fff', borderRadius:'12px', padding:'14px',
                border:'1px solid #e2e8f0',
                borderLeft: due > 0 ? '3px solid #ef4444' : '3px solid #22c55e'
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'2px' }}>
                      <span style={{ fontSize:'11px', fontFamily:'monospace', color:'#94a3b8' }}>
                        #{String(b.billNumber).padStart(5,'0')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[b.status]}`}>
                        {b.status}
                      </span>
                    </div>
                    <div style={{ fontSize:'12px', color:'#64748b', marginTop:'2px' }}>
                      {fmtD(b.date)}
                      {b.weightKg ? ` · ${Number(b.weightKg).toLocaleString('en-IN')} KG` : ''}
                      {b.vehicleNo ? ` · ${b.vehicleNo}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:'12px' }}>
                    <div style={{ fontWeight:'700', fontSize:'14px', color:'#0f172a' }}>{fmt(b.total)}</div>
                    {due > 0 && (
                      <div style={{ fontSize:'11px', color:'#dc2626', fontWeight:'600' }}>
                        Baki: {fmt(due)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reminder button per bill (only for unpaid/partial) */}
                {b.status !== 'Paid' && (
                  <button onClick={() => sendSingleReminder(b)}
                    style={{
                      marginTop:'10px', width:'100%', display:'flex', alignItems:'center',
                      justifyContent:'center', gap:'6px', padding:'8px',
                      borderRadius:'8px', background:'#dcfce7', color:'#166534',
                      border:'1px solid #bbf7d0', fontSize:'12px', fontWeight:'500', cursor:'pointer'
                    }}>
                    <MessageCircle size={13} /> Reminder Bhejo
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
