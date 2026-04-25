import { db } from '../db/db'

// ─── MAIN ANALYTICS FUNCTION ─────────────────────────────────────────────────
export async function getAnalytics() {
  const allBills = await db.bills.toArray()
  const now = new Date()

  // ── Date helpers ────────────────────────────────────────────────────────────
  const thisYear  = now.getFullYear()
  const thisMon   = now.getMonth()
  const lastMon   = thisMon === 0 ? 11 : thisMon - 1
  const lastYear  = thisMon === 0 ? thisYear - 1 : thisYear
  const todayStr  = now.toISOString().split('T')[0]

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  // ── Filter helpers ──────────────────────────────────────────────────────────
  const isMonth  = (b, m, y) => { const d = new Date(b.date); return d.getMonth() === m && d.getFullYear() === y }
  const isWeek   = (b) => new Date(b.date) >= weekStart
  const isToday  = (b) => b.date === todayStr

  // ── Grouped bills ───────────────────────────────────────────────────────────
  const thisMonthBills = allBills.filter(b => isMonth(b, thisMon, thisYear))
  const lastMonthBills = allBills.filter(b => isMonth(b, lastMon, lastYear))
  const thisWeekBills  = allBills.filter(b => isWeek(b))
  const todayBills     = allBills.filter(b => isToday(b))

  // ── Aggregators ─────────────────────────────────────────────────────────────
  const sum  = arr => arr.reduce((s, b) => s + Number(b.total), 0)
  const tons = arr => arr.reduce((s, b) => s + Number(b.tons),  0)

  // ── Pending dues ─────────────────────────────────────────────────────────────
  const unpaid  = allBills.filter(b => b.status === 'Unpaid')
  const partial = allBills.filter(b => b.status === 'Partial')
  const pendingDues = sum(unpaid) + partial.reduce((s, b) => s + (Number(b.total) - Number(b.paidAmount || 0)), 0)
  const pendingBills = [...unpaid, ...partial]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)

  // ── Revenue growth % ─────────────────────────────────────────────────────────
  const thisRev = sum(thisMonthBills)
  const lastRev = sum(lastMonthBills)
  const growth  = lastRev === 0 ? (thisRev > 0 ? 100 : 0) : Math.round(((thisRev - lastRev) / lastRev) * 100)

  // ── Top 5 parties this month ──────────────────────────────────────────────────
  const partyMap = {}
  thisMonthBills.forEach(b => {
    if (!partyMap[b.partyName]) partyMap[b.partyName] = { tons: 0, revenue: 0, bills: 0 }
    partyMap[b.partyName].tons    += Number(b.tons)
    partyMap[b.partyName].revenue += Number(b.total)
    partyMap[b.partyName].bills   += 1
  })
  const topParties = Object.entries(partyMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, d]) => ({ name, ...d }))

  // ── Last 7 days chart data ────────────────────────────────────────────────────
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const ds = d.toISOString().split('T')[0]
    const day = allBills.filter(b => b.date === ds)
    return {
      date: ds,
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      revenue: sum(day),
      tons: tons(day),
      bills: day.length,
    }
  })

  return {
    today:     { revenue: sum(todayBills),    tons: tons(todayBills),    bills: todayBills.length },
    thisWeek:  { revenue: sum(thisWeekBills),  tons: tons(thisWeekBills),  bills: thisWeekBills.length },
    thisMonth: { revenue: thisRev,             tons: tons(thisMonthBills), bills: thisMonthBills.length },
    lastMonth: { revenue: lastRev,             tons: tons(lastMonthBills), bills: lastMonthBills.length },
    growth,
    totalBills: allBills.length,
    pendingDues,
    pendingCount: unpaid.length + partial.length,
    pendingBills,
    topParties,
    last7,
    recentBills: [...allBills].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
  }
}