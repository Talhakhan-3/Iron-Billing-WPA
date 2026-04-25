import Dexie from 'dexie'
import { supabase } from '../lib/supabase'

// ─── DATABASE SCHEMA ─────────────────────────────────────────────────────────
export const db = new Dexie('IronBillingDB_v2')

db.version(1).stores({
  parties:   '++id, remoteId, name, phone, address, synced, updatedAt',
  bills:     '++id, remoteId, billNumber, partyName, date, tons, ratePerTon, total, status, paidAmount, notes, synced, createdAt, updatedAt',
  settings:  'key',
})

// Default settings on first run
db.on('populate', async () => {
  await db.settings.bulkPut([
    { key: 'businessName',    value: 'Iron Transport Co.' },
    { key: 'businessAddress', value: 'Mumbai, Maharashtra' },
    { key: 'businessPhone',   value: '' },
    { key: 'gstin',           value: '' },
    { key: 'currentRate',     value: '52000' },
    { key: 'lastBillNumber',  value: '0' },
  ])
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export async function getNextBillNumber() {
  const s = await db.settings.get('lastBillNumber')
  const next = parseInt(s?.value || '0') + 1
  await db.settings.put({ key: 'lastBillNumber', value: String(next) })
  return next
}

export async function getSettings() {
  const all = await db.settings.toArray()
  const map = {}
  all.forEach(item => { map[item.key] = item.value })
  return map
}

export async function saveSetting(key, value) {
  await db.settings.put({ key, value })
}

// ─── SYNC ENGINE ─────────────────────────────────────────────────────────────
let _syncing = false
let _syncStatus = 'idle' // 'idle' | 'syncing' | 'error'
const _listeners = new Set()

export function onSyncStatus(cb) {
  _listeners.add(cb)
  return () => _listeners.delete(cb)
}

function emitStatus(status) {
  _syncStatus = status
  _listeners.forEach(cb => cb(status))
}

export function getSyncStatus() { return _syncStatus }

export async function syncWithCloud() {
  if (!supabase)       return
  if (_syncing)        return
  if (!navigator.onLine) return

  _syncing = true
  emitStatus('syncing')

  try {
    await _pushParties()
    await _pushBills()
    await _pullParties()
    await _pullBills()
    emitStatus('idle')
  } catch (err) {
    console.error('[Sync] Error:', err)
    emitStatus('error')
  } finally {
    _syncing = false
  }
}

// ── PUSH: Local → Supabase ───────────────────────────────────────────────────
async function _pushParties() {
  const unsync = await db.parties.where('synced').equals(0).toArray()
  for (const p of unsync) {
    const payload = { name: p.name, phone: p.phone || null, address: p.address || null, updated_at: p.updatedAt }
    try {
      if (p.remoteId) {
        const { error } = await supabase.from('parties').update(payload).eq('id', p.remoteId)
        if (!error) await db.parties.update(p.id, { synced: 1 })
      } else {
        const { data, error } = await supabase.from('parties').insert(payload).select('id').single()
        if (!error && data) await db.parties.update(p.id, { synced: 1, remoteId: data.id })
      }
    } catch {}
  }
}

async function _pushBills() {
  const unsync = await db.bills.where('synced').equals(0).toArray()
  for (const b of unsync) {
    const payload = {
      bill_number:  b.billNumber,
      party_name:   b.partyName,
      date:         b.date,
      tons:         b.tons,
      rate_per_ton: b.ratePerTon,
      total:        b.total,
      status:       b.status,
      paid_amount:  b.paidAmount || 0,
      notes:        b.notes || null,
      created_at:   b.createdAt,
      updated_at:   b.updatedAt,
    }
    try {
      if (b.remoteId) {
        const { error } = await supabase.from('bills').update(payload).eq('id', b.remoteId)
        if (!error) await db.bills.update(b.id, { synced: 1 })
      } else {
        const { data, error } = await supabase.from('bills').insert(payload).select('id').single()
        if (!error && data) await db.bills.update(b.id, { synced: 1, remoteId: data.id })
      }
    } catch {}
  }
}

// ── PULL: Supabase → Local (for new devices / cross-device sync) ─────────────
async function _pullParties() {
  const { data, error } = await supabase.from('parties').select('*').order('updated_at', { ascending: false }).limit(1000)
  if (error || !data) return

  for (const r of data) {
    const exists = await db.parties.where('remoteId').equals(r.id).first()
    if (!exists) {
      await db.parties.add({
        remoteId: r.id, name: r.name,
        phone: r.phone || '', address: r.address || '',
        synced: 1, updatedAt: r.updated_at,
      })
    }
  }
}

async function _pullBills() {
  const { data, error } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(2000)
  if (error || !data) return

  for (const r of data) {
    const exists = await db.bills.where('remoteId').equals(r.id).first()
    if (!exists) {
      await db.bills.add({
        remoteId:   r.id,
        billNumber: r.bill_number,
        partyName:  r.party_name,
        date:       r.date,
        tons:       r.tons,
        ratePerTon: r.rate_per_ton,
        total:      r.total,
        status:     r.status,
        paidAmount: r.paid_amount,
        notes:      r.notes || '',
        synced:     1,
        createdAt:  r.created_at,
        updatedAt:  r.updated_at,
      })
    }
  }
}

// ── Auto-sync on app load + when coming back online ──────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online — starting sync...')
    syncWithCloud()
  })
  // Initial sync after 1s (give app time to render first)
  setTimeout(() => syncWithCloud(), 1000)
}