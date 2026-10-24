import Dexie from 'dexie'
import { supabase } from '../lib/supabase'

export const db = new Dexie('IronBillingDB_v2')

db.version(1).stores({
  parties:   '++id, remoteId, name, phone, address, synced, updatedAt',
  bills:     '++id, remoteId, billNumber, partyName, date, weightKg, ratePerKg, total, status, paidAmount, notes, synced, createdAt, updatedAt',
  settings:  'key',
})

db.version(2).stores({
  parties:   '++id, remoteId, name, phone, address, type, synced, updatedAt',
  bills:     '++id, remoteId, billNumber, partyName, consigneeName, date, weightKg, ratePerKg, total, status, paidAmount, notes, vehicleNo, itemDescription, itemSize, paymentMode, bankName, chequeNo, deliveryPoint, synced, createdAt, updatedAt',
  settings:  'key',
})

// Default settings
db.on('populate', async () => {
  await db.settings.bulkPut([
    { key: 'businessName',    value: 'Shree Transport' },
    { key: 'businessAddress', value: 'Mumbai, Maharashtra' },
    { key: 'businessPhone',   value: '' },
    { key: 'gstin',           value: '' },
    { key: 'currentRate',     value: '52' },        // per KG
    { key: 'lastBillNumber',  value: '22100' },
    { key: 'bankName',        value: '' },
    { key: 'accountNo',       value: '' },
    { key: 'ifscCode',        value: '' },
    { key: 'gpayNo',          value: '' },
    { key: 'phonepeNo',       value: '' },
    { key: 'logoBase64',      value: '' },
    { key: 'signatureBase64', value: '' },
    { key: 'upiId',           value: '' },
    { key: 'theme',           value: 'system' },
  ])
})

// ─── HELPERS ───────────────────────────────────────────────────────────
export async function migrateBillNumber() {
  try {
    const s = await db.settings.get('lastBillNumber')
    const current = parseInt(s?.value || '0', 10)
    if (!s || isNaN(current) || current < 22100) {
      await db.settings.put({ key: 'lastBillNumber', value: '22100' })
    }
  } catch (err) {
    console.error('Migration error:', err)
  }
}

/**
 * Preview the next bill number without advancing the counter prematurely.
 * Checks both settings and the highest existing bill in database.
 */
export async function peekNextBillNumber() {
  try {
    const s = await db.settings.get('lastBillNumber')
    const settingNum = parseInt(s?.value || '22100', 10)
    
    // Find highest billNumber in db.bills
    const highestBill = await db.bills.orderBy('billNumber').last()
    const dbHighest = highestBill ? parseInt(highestBill.billNumber, 10) : 0
    
    const base = Math.max(isNaN(settingNum) ? 22100 : settingNum, isNaN(dbHighest) ? 22100 : dbHighest)
    return base + 1
  } catch {
    return 22101
  }
}

/**
 * Commit the newly used bill number into settings
 */
export async function commitBillNumber(usedNumber) {
  try {
    const num = parseInt(usedNumber, 10)
    if (isNaN(num)) return
    const s = await db.settings.get('lastBillNumber')
    const current = parseInt(s?.value || '22100', 10)
    if (isNaN(current) || num > current) {
      await db.settings.put({ key: 'lastBillNumber', value: String(num) })
    }
  } catch (err) {
    console.error('commitBillNumber error:', err)
  }
}

export async function getNextBillNumber() {
  const next = await peekNextBillNumber()
  await commitBillNumber(next)
  return next
}

export async function getSettings() {
  try {
    const all = await db.settings.toArray()
    const map = {}
    all.forEach(item => { map[item.key] = item.value })
    return map
  } catch {
    return {}
  }
}

export async function saveSetting(key, value) {
  await db.settings.put({ key, value })
}

export async function getTotalBillsCount() {
  try {
    return await db.bills.count()
  } catch {
    return 0
  }
}

// ─── PERFORMANCE: get only recent bills (for UI components) ───────────
export async function getRecentBills(limit = 50) {
  return await db.bills
    .orderBy('createdAt')
    .reverse()
    .limit(limit)
    .toArray()
}

export async function getBillsByParty(partyName, limit = 100) {
  const clean = (partyName || '').trim().toLowerCase()
  return await db.bills
    .filter(b => 
      (b.partyName && b.partyName.toLowerCase() === clean) ||
      (b.consigneeName && b.consigneeName.toLowerCase() === clean)
    )
    .reverse()
    .limit(limit)
    .toArray()
}

// ─── SYNC ENGINE ──────────────────────────────────────────────────────
let _syncing = false
let _syncStatus = 'idle'
const _listeners = new Set()

export function onSyncStatus(cb) {
  _listeners.add(cb)
  return () => _listeners.delete(cb)
}

function emitStatus(status) {
  _syncStatus = status
  _listeners.forEach(cb => {
    try { cb(status) } catch (e) { console.error(e) }
  })
}

export function getSyncStatus() { return _syncStatus }

export async function syncWithCloud() {
  if (!supabase) return
  if (_syncing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

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

// ── PUSH local → Supabase ─────────────────────────────────────────────
async function _pushParties() {
  if (!supabase) return
  const unsync = await db.parties.where('synced').equals(0).toArray()
  for (const p of unsync) {
    const payload = {
      name: p.name,
      phone: p.phone || null,
      address: p.address || null,
      type: p.type || 'Consignor',
      updated_at: p.updatedAt || new Date().toISOString()
    }
    try {
      if (p.remoteId) {
        const { error } = await supabase.from('parties').update(payload).eq('id', p.remoteId)
        if (!error) await db.parties.update(p.id, { synced: 1 })
      } else {
        const { data, error } = await supabase.from('parties').insert(payload).select('id').single()
        if (!error && data) await db.parties.update(p.id, { synced: 1, remoteId: data.id })
      }
    } catch { /* offline safe */ }
  }
}

async function _pushBills() {
  if (!supabase) return
  const unsync = await db.bills.where('synced').equals(0).toArray()
  for (const b of unsync) {
    const payload = {
      bill_number:    b.billNumber,
      party_name:     b.partyName,
      consignee_name: b.consigneeName || null,
      date:           b.date,
      weight_kg:      b.weightKg,
      rate_per_kg:    b.ratePerKg,
      total:          b.total,
      status:         b.status,
      paid_amount:    b.paidAmount || 0,
      notes:          b.notes || null,
      vehicle_no:     b.vehicleNo || null,
      item_description: b.itemDescription || null,
      item_size:      b.itemSize || null,
      payment_mode:   b.paymentMode || null,
      bank_name:      b.bankName || null,
      cheque_no:      b.chequeNo || null,
      delivery_point: b.deliveryPoint || null,
      created_at:     b.createdAt,
      updated_at:     b.updatedAt,
    }
    try {
      if (b.remoteId) {
        const { error } = await supabase.from('bills').update(payload).eq('id', b.remoteId)
        if (!error) await db.bills.update(b.id, { synced: 1 })
      } else {
        const { data, error } = await supabase.from('bills').insert(payload).select('id').single()
        if (!error && data) await db.bills.update(b.id, { synced: 1, remoteId: data.id })
      }
    } catch { /* offline safe */ }
  }
}

// ── PULL Supabase → Local ─────────────────────────────────────────────
async function _pullParties() {
  if (!supabase) return
  try {
    const { data, error } = await supabase.from('parties').select('*').order('updated_at', { ascending: false }).limit(1000)
    if (error || !data) return

    for (const r of data) {
      const exists = await db.parties.where('remoteId').equals(r.id).first()
      if (!exists) {
        await db.parties.add({
          remoteId: r.id,
          name: r.name,
          phone: r.phone || '',
          address: r.address || '',
          type: r.type || 'Consignor',
          synced: 1,
          updatedAt: r.updated_at,
        })
      }
    }
  } catch (err) {
    console.warn('[Sync] Pull parties error:', err)
  }
}

async function _pullBills() {
  if (!supabase) return
  try {
    const { data, error } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(2000)
    if (error || !data) return

    for (const r of data) {
      const exists = await db.bills.where('remoteId').equals(r.id).first()
      if (!exists) {
        await db.bills.add({
          remoteId:       r.id,
          billNumber:     r.bill_number,
          partyName:      r.party_name,
          consigneeName:  r.consignee_name || '',
          date:           r.date,
          weightKg:       r.weight_kg,
          ratePerKg:      r.rate_per_kg,
          total:          r.total,
          status:         r.status,
          paidAmount:     r.paid_amount,
          notes:          r.notes || '',
          vehicleNo:      r.vehicle_no || '',
          itemDescription: r.item_description || '',
          itemSize:       r.item_size || '',
          paymentMode:    r.payment_mode || '',
          bankName:       r.bank_name || '',
          chequeNo:       r.cheque_no || '',
          deliveryPoint:  r.delivery_point || '',
          synced:         1,
          createdAt:      r.created_at,
          updatedAt:      r.updated_at,
        })
      }
    }
  } catch (err) {
    console.warn('[Sync] Pull bills error:', err)
  }
}

// Auto-sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncWithCloud()
  })
  setTimeout(() => syncWithCloud(), 1500)
}