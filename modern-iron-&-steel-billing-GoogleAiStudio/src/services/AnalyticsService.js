import { db } from '../db/db'

const formatKg = (kg) => `${Number(kg || 0).toLocaleString('en-IN')} KG`

export async function getAnalytics() {
  const lifetimeBillsCount = await db.bills.count()

  // Load bills from the last 6 months (fast & responsive)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoff = sixMonthsAgo.toISOString().split('T')[0]

  let allBills = []
  try {
    allBills = await db.bills
      .filter(b => (b.date && b.date >= cutoff) || (b.createdAt && b.createdAt >= cutoff))
      .toArray()
  } catch (err) {
    allBills = await db.bills.toArray()
  }

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
    try {
      const d = new Date(b.date || b.createdAt)
      return d.getMonth() === m && d.getFullYear() === y
    } catch {
      return false
    }
  }

  const isWeek = (b) => {
    try {
      return new Date(b.date || b.createdAt) >= weekStart
    } catch {
      return false
    }
  }

  const isToday = (b) => (b.date === todayStr || (b.createdAt && b.createdAt.startsWith(todayStr)))

  const thisMonthBills = allBills.filter(b => isMonth(b, thisMon, thisYear))
  const lastMonthBills = allBills.filter(b => isMonth(b, lastMon, lastYear))
  const thisWeekBills  = allBills.filter(b => isWeek(b))
  const todayBills     = allBills.filter(b => isToday(b))

  // Safe decimal aggregators
  const sumRevenue = arr => Math.round(arr.reduce((s, b) => s + Number(b.total || 0), 0) * 100) / 100
  const sumWeight  = arr => Math.round(arr.reduce((s, b) => s + Number(b.weightKg || (b.tons ? b.tons * 1000 : 0) || 0), 0) * 100) / 100

  // Pending Dues
  const unpaid  = allBills.filter(b => b.status === 'Unpaid')
  const partial = allBills.filter(b => b.status === 'Partial')
  const pendingDues = Math.round((
    sumRevenue(unpaid) +
    partial.reduce((s, b) => s + Math.max(0, Number(b.total || 0) - Number(b.paidAmount || 0)), 0)
  ) * 100) / 100

  const pendingBills = [...unpaid, ...partial]
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    .reverse()
    .slice(0, 8)

  // Growth calculation
  const thisRev = sumRevenue(thisMonthBills)
  const lastRev = sumRevenue(lastMonthBills)
  const growth = lastRev === 0 ? (thisRev > 0 ? 100 : 0) : Math.round(((thisRev - lastRev) / lastRev) * 100)

  // Top 5 parties by revenue (this month)
  const partyMap = {}
  thisMonthBills.forEach(b => {
    const name = b.partyName || 'Unknown Party'
    if (!partyMap[name]) partyMap[name] = { revenue: 0, weight: 0, count: 0 }
    partyMap[name].revenue += Number(b.total || 0)
    partyMap[name].weight  += Number(b.weightKg || 0)
    partyMap[name].count   += 1
  })

  const topParties = Object.entries(partyMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, d]) => ({
      name,
      revenue: Math.round(d.revenue * 100) / 100,
      weight: Math.round(d.weight * 100) / 100,
      count: d.count
    }))

  // Last 7 days breakdown
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const ds = d.toISOString().split('T')[0]
    const day = allBills.filter(b => (b.date === ds || (b.createdAt && b.createdAt.startsWith(ds))))
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
      weightFormatted: formatKg(sumWeight(todayBills)),
      tonsFormatted: (sumWeight(todayBills) / 1000).toFixed(3) + ' MT'
    },
    thisWeek: {
      revenue: sumRevenue(thisWeekBills),
      weight: sumWeight(thisWeekBills),
      bills: thisWeekBills.length,
      weightFormatted: formatKg(sumWeight(thisWeekBills)),
      tonsFormatted: (sumWeight(thisWeekBills) / 1000).toFixed(3) + ' MT'
    },
    thisMonth: {
      revenue: thisRev,
      weight: sumWeight(thisMonthBills),
      bills: thisMonthBills.length,
      weightFormatted: formatKg(sumWeight(thisMonthBills)),
      tonsFormatted: (sumWeight(thisMonthBills) / 1000).toFixed(3) + ' MT'
    },
    lastMonth: {
      revenue: lastRev,
      weight: sumWeight(lastMonthBills),
      bills: lastMonthBills.length,
      weightFormatted: formatKg(sumWeight(lastMonthBills)),
      tonsFormatted: (sumWeight(lastMonthBills) / 1000).toFixed(3) + ' MT'
    },
    growth,
    totalBills: lifetimeBillsCount,
    pendingDues,
    pendingCount: unpaid.length + partial.length,
    pendingBills,
    topParties,
    last7,
    recentBills: [...allBills]
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      .reverse()
      .slice(0, 6)
  }
}