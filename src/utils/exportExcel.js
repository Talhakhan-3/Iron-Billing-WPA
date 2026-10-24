import * as XLSX from 'xlsx'

export function exportBillsToExcel(bills, filename = 'IronBills') {
  const data = bills.map(b => {
    const weightKg  = Number(b.weightKg || (b.tons ? b.tons * 1000 : 0))
    const ratePerKg = Number(b.ratePerKg || (b.ratePerTon ? b.ratePerTon / 1000 : 0))
    const paid      = b.status === 'Paid' ? Number(b.total) : Number(b.paidAmount || 0)
    const balance   = b.status === 'Partial' ? Number(b.total) - paid
                    : b.status === 'Unpaid'  ? Number(b.total) : 0
    return {
      'Bill No':          `#${String(b.billNumber).padStart(5,'0')}`,
      'Date':             new Date(b.date).toLocaleDateString('en-IN'),
      'Consignor (From)': b.partyName,
      'Consignee (To)':   b.consigneeName || '',
      'Item':             b.itemDescription || 'Iron / Loha',
      'Vehicle No':       b.vehicleNo || '',
      'Weight (KG)':      weightKg,
      'Rate ₹/KG':        ratePerKg,
      'Total (₹)':        Number(b.total),
      'Status':           b.status,
      'Paid (₹)':         paid,
      'Balance (₹)':      balance,
      'Payment Mode':     b.paymentMode || '',
      'Notes':            b.notes || '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bills')

  ws['!cols'] = [
    {wch:10},{wch:12},{wch:26},{wch:26},{wch:16},{wch:14},
    {wch:12},{wch:12},{wch:14},{wch:10},{wch:12},{wch:12},{wch:14},{wch:24}
  ]

  const dateTag = new Date().toLocaleDateString('en-IN').replace(/\//g,'-')
  XLSX.writeFile(wb, `${filename}_${dateTag}.xlsx`)
}

// Party-wise ledger export
export function exportPartyLedger(partyName, bills) {
  let running = 0
  const data = bills.map(b => {
    const paid    = b.status === 'Paid' ? Number(b.total) : Number(b.paidAmount || 0)
    const balance = Number(b.total) - paid
    running += balance
    return {
      'Bill No':    `#${String(b.billNumber).padStart(5,'0')}`,
      'Date':       new Date(b.date).toLocaleDateString('en-IN'),
      'Item':       b.itemDescription || 'Iron / Loha',
      'Weight KG':  Number(b.weightKg || 0),
      'Total (₹)':  Number(b.total),
      'Paid (₹)':   paid,
      'Balance (₹)':balance,
      'Running Due':running,
      'Status':     b.status,
    }
  })

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, partyName.slice(0,30))
  ws['!cols'] = [{wch:10},{wch:12},{wch:16},{wch:11},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10}]
  const dateTag = new Date().toLocaleDateString('en-IN').replace(/\//g,'-')
  XLSX.writeFile(wb, `Ledger_${partyName}_${dateTag}.xlsx`)
}
