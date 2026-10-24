import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Users, BookOpen, MessageCircle, Phone, Search, Building2, X } from 'lucide-react'
import { db, syncWithCloud } from '../db/db'
import { useToast } from './Toast'

export default function Parties({ navigate }) {
  const toast = useToast()

  const [parties, setParties] = useState([])
  const [form, setForm] = useState({ name: '', phone: '', address: '', type: 'Consignor' })
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const all = await db.parties.orderBy('name').toArray()
      setParties(all)
    } catch (e) {
      console.error('Error loading parties:', e)
    }
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Party name is required!')
      return
    }

    try {
      const now = new Date().toISOString()
      const partyData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        type: form.type || 'Consignor',
        synced: 0,
        updatedAt: now,
      }

      if (editId) {
        await db.parties.update(editId, partyData)
        setEditId(null)
        toast.success(`Party "${form.name}" updated successfully.`)
      } else {
        const exists = await db.parties.where('name').equalsIgnoreCase(form.name.trim()).first()
        if (exists) {
          toast.error(`Party "${form.name}" already exists!`)
          return
        }
        await db.parties.add(partyData)
        toast.success(`Party "${form.name}" added successfully.`)
      }

      setForm({ name: '', phone: '', address: '', type: 'Consignor' })
      load()
      syncWithCloud()
    } catch (e) {
      toast.error('Error saving party: ' + e.message)
    }
  }

  const startEdit = (p) => {
    setEditId(p.id)
    setForm({
      name: p.name || '',
      phone: p.phone || '',
      address: p.address || '',
      type: p.type || 'Consignor',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditId(null)
    setForm({ name: '', phone: '', address: '', type: 'Consignor' })
  }

  const del = async (id) => {
    try {
      await db.parties.delete(id)
      setDeleteId(null)
      load()
      toast.success('Party deleted successfully.')
    } catch (e) {
      toast.error('Could not delete party: ' + e.message)
    }
  }

  const filtered = parties.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone && p.phone.includes(search)) ||
      (p.address && p.address.toLowerCase().includes(search.toLowerCase()))
    const matchesType = typeFilter === 'All' || p.type === typeFilter || p.type === 'Both'
    return matchesSearch && matchesType
  })

  const openWhatsApp = (phone) => {
    if (!phone) {
      toast.warning('No phone number saved for this party.')
      return
    }
    window.open(`https://wa.me/91${phone.replace(/\D/g, '')}`, '_blank')
  }

  return (
    <div className="space-y-4 pb-14">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Parties Directory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
              {parties.length} Registered
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage consignors, consignees, transport accounts & ledger balances
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Party Create / Edit Form */}
        <div className="card-base p-5 shadow-sm h-fit">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-1.5">
            <Building2 size={15} className="text-emerald-600" />
            <span>{editId ? 'Edit Party Details' : 'Add New Party'}</span>
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Party / Company Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Jindal Steel Traders"
                className="inp text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Party Role / Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['Consignor', 'Consignee', 'Both'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      form.type === t
                        ? 'bg-emerald-800 border-emerald-800 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Phone Number (WhatsApp)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="10 digit mobile number"
                className="inp text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Address / Location
              </label>
              <textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="City, godown location, yard number..."
                rows={2}
                className="inp text-xs resize-none"
              />
            </div>

            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={save}
                className="w-full min-h-[44px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus size={16} />
                <span>{editId ? 'Update Party Record' : 'Save New Party'}</span>
              </button>

              {editId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Parties List & Search */}
        <div className="md:col-span-2 space-y-3">
          <div className="card-base p-3.5 shadow-sm space-y-2.5">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search party by name, phone, or location..."
                className="inp pl-9 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Type Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {['All', 'Consignor', 'Consignee', 'Both'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    typeFilter === t
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card-base p-12 text-center text-slate-400 dark:text-slate-500 shadow-sm">
              <Users size={38} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No parties found.</p>
              <p className="text-xs mt-1">Add a new party on the left or clear search filters.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filtered.map(p => (
                <div
                  key={p.id}
                  className="card-base p-3.5 shadow-sm hover:border-emerald-500/50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {p.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        p.type === 'Consignor'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : p.type === 'Consignee'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {p.type || 'Consignor'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">
                      {p.phone && <span>📞 {p.phone}</span>}
                      {p.address && <span className="truncate">📍 {p.address}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* View Ledger */}
                    <button
                      onClick={() => navigate('ledger', { partyName: p.name })}
                      title="Open Party Ledger"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold transition-colors"
                    >
                      <BookOpen size={13} />
                      <span className="hidden sm:inline">Ledger</span>
                    </button>

                    {/* Direct WhatsApp */}
                    {p.phone && (
                      <button
                        onClick={() => openWhatsApp(p.phone)}
                        title="Chat on WhatsApp"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50 transition-colors"
                      >
                        <MessageCircle size={15} />
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => startEdit(p)}
                      title="Edit Party"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteId(p.id)}
                      title="Delete Party"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="card-base p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
              Delete Party?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-5">
              This party will be removed from your directory. Existing bills will remain intact.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => del(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-semibold text-xs transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
