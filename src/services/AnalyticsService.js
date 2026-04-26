import { db } from '../db/db'

const formatKg = (kg) => `${Number(kg || 0).toLocaleString('en-IN')} KG`

export async function getAnalytics() {
  // 🔥 OPTIMIZATION: only load last 6 months (reduces memory & CPU)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoff = sixMonthsAgo.toISOString().split('T')[0]

  const allBills = await db.bills
    .where('date')
    .aboveOrEqual(cutoff)   // uses indexed 'date' -> fast
    .toArray()

  const now = new Date()
  const thisYear  = now.getFullYear()
  const thisMon   = now.getMonth()
  const lastMon   = thisMon === 0 ? 11 : thisMon - 1
  const lastYear  = thisMon === 0 ? thisYear - 1 : thisYear
  const todayStr  = now.toISOString().split('T')[0]

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const isMonth = (b, m, y) => {
    const d = new Date(b.date)
    return d.getMonth() === m && d.getFullYear() === y
  }
  const isWeek = (b) => new Date(b.date) >= weekStart
  const isToday = (b) => b.date === todayStr

  const thisMonthBills = allBills.filter(b => isMonth(b, thisMon, thisYear))
  const lastMonthBills = allBills.filter(b => isMonth(b, lastMon, lastYear))
  const thisWeekBills  = allBills.filter(b => isWeek(b))
  const todayBills     = allBills.filter(b => isToday(b))

  // aggregators using weightKg (instead of tons)
  const sumRevenue = arr => arr.reduce((s, b) => s + Number(b.total), 0)
  const sumWeight  = arr => arr.reduce((s, b) => s + Number(b.weightKg || 0), 0)

  // pending dues
  const unpaid  = allBills.filter(b => b.status === 'Unpaid')
  const partial = allBills.filter(b => b.status === 'Partial')
  const pendingDues = sumRevenue(unpaid) +
    partial.reduce((s, b) => s + (Number(b.total) - Number(b.paidAmount || 0)), 0)

  const pendingBills = [...unpaid, ...partial]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)

  // revenue growth %
  const thisRev = sumRevenue(thisMonthBills)
  const lastRev = sumRevenue(lastMonthBills)
  const growth = lastRev === 0 ? (thisRev > 0 ? 100 : 0) : Math.round(((thisRev - lastRev) / lastRev) * 100)

  // top 5 parties by revenue (this month)
  const partyMap = {}
  thisMonthBills.forEach(b => {
    if (!partyMap[b.partyName]) partyMap[b.partyName] = { revenue: 0, weight: 0, count: 0 }
    partyMap[b.partyName].revenue += Number(b.total)
    partyMap[b.partyName].weight  += Number(b.weightKg || 0)
    partyMap[b.partyName].count   += 1
  })
  const topParties = Object.entries(partyMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, d]) => ({ name, ...d }))

  // last 7 days (daily data)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const ds = d.toISOString().split('T')[0]
    const day = allBills.filter(b => b.date === ds)
    return {
      date: ds,
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      revenue: sumRevenue(day),
      weight: sumWeight(day),
      bills: day.length,
    }
  })

  return {
    today: {
      revenue: sumRevenue(todayBills),
      weight: sumWeight(todayBills),
      bills: todayBills.length,
      weightFormatted: formatKg(sumWeight(todayBills))
    },
    thisWeek: {
      revenue: sumRevenue(thisWeekBills),
      weight: sumWeight(thisWeekBills),
      bills: thisWeekBills.length,
      weightFormatted: formatKg(sumWeight(thisWeekBills))
    },
    thisMonth: {
      revenue: thisRev,
      weight: sumWeight(thisMonthBills),
      bills: thisMonthBills.length,
      weightFormatted: formatKg(sumWeight(thisMonthBills))
    },
    lastMonth: {
      revenue: lastRev,
      weight: sumWeight(lastMonthBills),
      bills: lastMonthBills.length,
      weightFormatted: formatKg(sumWeight(lastMonthBills))
    },
    growth,
    totalBills: allBills.length,
    pendingDues,
    pendingCount: unpaid.length + partial.length,
    pendingBills,
    topParties,
    last7,
    recentBills: [...allBills]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
  }
}