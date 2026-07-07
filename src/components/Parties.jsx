import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Users, BookOpen, MessageCircle } from 'lucide-react'
import { db, syncWithCloud } from '../db/db'

export default function Parties({ navigate }) {
  const [parties,  setParties]  = useState([])
  const [form,     setForm]     = useState({ name:'', phone:'', address:'', type:'Consignor' })
  const [editId,   setEditId]   = useState(null)
  const [search,   setSearch]   = useState('')
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    const all = await db.parties.orderBy('name').toArray()
    setParties(all)
  }

  const save = async () => {
    if (!form.name.trim()) return alert('Party naam zaroori hai!')
    const now = new Date().toISOString()
    const partyData = { ...form, name: form.name.trim(), synced: 0, updatedAt: now }
    if (editId) {
      await db.parties.update(editId, partyData)
      setEditId(null)
    } else {
      const exists = await db.parties.where('name').equalsIgnoreCase(form.name.trim()).first()
      if (exists) return alert('Ye party pehle se hai!')
      await db.parties.add(partyData)
    }
    setForm({ name:'', phone:'', address:'', type:'Consignor' })
    load()
    syncWithCloud()
  }

  const startEdit = p => {
    setEditId(p.id)
    setForm({ name:p.name, phone:p.phone||'', address:p.address||'', type:p.type||'Consignor' })
  }

  const del = async id => {
    await db.parties.delete(id)
    setDeleteId(null)
    load()
  }

  const filtered = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  // Quick WhatsApp open (no specific message, just open chat)
  const openWhatsApp = (phone) => {
    if (!phone) return alert('Phone number nahi hai is party ka!')
    window.open(`https://wa.me/91${phone.replace(/\D/g,'')}`, '_blank')
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Parties ({parties.length})</h1>
      <div className="grid md:grid-cols-3 gap-4">

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 text-sm mb-3">
            {editId ? 'Party Edit Karo' : 'Naya Party Add Karo'}
          </h2>
          <div className="space-y-2.5">
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Party ka naam *"
              className="inp" />

            <div>
              <label className="text-xs text-slate-400 block mb-1">Party Type</label>
              <div className="flex gap-2">
                {['Consignor','Consignee','Both'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`flex-1 min-h-[40px] py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      form.type === t
                        ? 'border-brand-800 bg-brand-500 text-white'
                        : 'border-slate-200 text-slate-500 hover:border-brand-600'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Phone number (WhatsApp ke liye)"
              className="inp" />

            <textarea value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Address"
              rows={2} className="inp resize-none" />

            <button onClick={save}
              className="w-full min-h-[44px] bg-brand-800 text-white rounded-xl font-medium text-sm hover:bg-brand-900 transition-colors flex items-center justify-center gap-1.5">
              <Plus size={16} /> {editId ? 'Update Party' : 'Add Party'}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm({ name:'', phone:'', address:'', type:'Consignor' }) }}
                className="w-full border border-slate-200 text-slate-500 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <input type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Party search..."
            className="inp mb-4" />

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-300">
              <Users size={40} className="mx-auto mb-2" />
              <div className="text-sm">Koi party nahi mili</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {filtered.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-700 text-sm">{p.name}</div>
                    <div className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.type === 'Consignor' ? 'bg-blue-50 text-blue-600 border border-blue-100'
                        : p.type === 'Consignee' ? 'bg-purple-50 text-purple-600 border border-purple-100'
                        : 'bg-brand-50 text-brand-800 border border-teal-100'
                      }`}>{p.type || 'Consignor'}</span>
                      {p.phone && <span>📞 {p.phone}</span>}
                      {p.address && <span className="truncate">· {p.address}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    {/* Ledger button */}
                    <button onClick={() => navigate('ledger', { partyName: p.name })}
                      title="Party Ledger" className="p-2 text-slate-400 hover:text-brand-800 hover:bg-brand-50 rounded-lg transition-colors">
                      <BookOpen size={14} />
                    </button>
                    {/* WhatsApp quick open */}
                    {p.phone && (
                      <button onClick={() => openWhatsApp(p.phone)}
                        title="WhatsApp" className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <MessageCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => startEdit(p)}
                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleteId(p.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-slate-800 mb-1">Party delete karna hai?</h3>
            <p className="text-slate-500 text-sm mb-5">Party ke purane bills safe rahenge.</p>
            <div className="flex gap-2">
              <button onClick={() => del(deleteId)}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium">Haan</button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
