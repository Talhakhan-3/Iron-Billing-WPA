import * as XLSX from 'xlsx'

export function exportBillsToExcel(bills, filename = 'IronBills') {
  const data = bills.map(b => ({
    'Bill No':         `#${String(b.billNumber).padStart(4,'0')}`,
    'Party Name':      b.partyName,
    'Date':            new Date(b.date).toLocaleDateString('en-IN'),
    'Tons':            b.tons,
    'Rate / Ton (₹)': b.ratePerTon,
    'Total (₹)':      b.total,
    'Status':          b.status,
    'Paid (₹)':       b.paidAmount || (b.status === 'Paid' ? b.total : 0),
    'Balance (₹)':    b.status === 'Partial' ? (b.total - (b.paidAmount || 0)) : 0,
    'Notes':           b.notes || '',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bills')

  ws['!cols'] = [
    {wch:10},{wch:24},{wch:14},{wch:8},{wch:16},{wch:14},
    {wch:10},{wch:14},{wch:12},{wch:24}
  ]

  XLSX.writeFile(wb, `${filename}_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.xlsx`)
}