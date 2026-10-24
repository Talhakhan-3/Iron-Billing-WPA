import { useState, useEffect } from 'react'
import { Printer, Download, MessageCircle, X, Check, Eye } from 'lucide-react'
import { buildInvoiceHtml, printInvoiceSafely } from '../utils/generatePDF'

export default function PrintInvoiceModal({ bill, settings, onClose }) {
  const [htmlContent, setHtmlContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true
    const prepare = async () => {
      setLoading(true)
      try {
        const html = await buildInvoiceHtml(bill, settings)
        if (isMounted) setHtmlContent(html)
      } catch (err) {
        console.error('Invoice build error:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    prepare()
    return () => { isMounted = false }
  }, [bill, settings])

  const handlePrint = () => {
    printInvoiceSafely(bill, settings)
  }

  const handleDownload = () => {
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Invoice_${String(bill.billNumber || '').padStart(5, '0')}_${(bill.partyName || 'Iron').replace(/[^a-zA-Z0-9]/g, '_')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShareWhatsApp = () => {
    const s = settings || {}
    const msg = [
      `*${s.businessName || 'Iron Billing'}* — Invoice #${String(bill.billNumber).padStart(5, '0')}`,
      ``,
      `Date    : ${new Date(bill.date).toLocaleDateString('en-IN')}`,
      `From    : ${bill.partyName}`,
      `To      : ${bill.consigneeName || '—'}`,
      `Item    : ${bill.itemDescription}${bill.itemSize ? ` (${bill.itemSize})` : ''}`,
      `Vehicle : ${bill.vehicleNo || '—'}`,
      `Weight  : ${Number(bill.weightKg || 0).toLocaleString('en-IN')} KG (${(Number(bill.weightKg || 0)/1000).toFixed(3)} MT)`,
      `Rate    : ₹${Number(bill.ratePerKg || 0).toLocaleString('en-IN')}/KG`,
      `*Total  : ₹${Number(bill.total || 0).toLocaleString('en-IN')}*`,
      `Status  : ${bill.status}`,
    ].filter(Boolean).join('\n')

    const ph = bill._partyPhone || ''
    const url = ph
      ? `https://wa.me/91${ph.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm no-print animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-800 dark:text-emerald-300">
              <Eye size={17} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Invoice #{String(bill.billNumber).padStart(5, '0')} Preview
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {bill.partyName} → {bill.consigneeName || 'Direct'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs transition-colors shadow-sm"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleDownload}
              title="Download HTML"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-medium text-xs transition-colors"
            >
              <Download size={14} />
              <span>Download</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              title="Share on WhatsApp"
              className="p-1.5 rounded-xl bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors"
            >
              <MessageCircle size={16} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex justify-center items-start">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-2" />
              Rendering invoice...
            </div>
          ) : (
            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-slate-300 w-full max-w-3xl">
              <iframe
                title="Invoice Preview"
                srcDoc={htmlContent}
                className="w-full h-[680px] border-none block"
              />
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Tip: You can choose "Save as PDF" directly in the print dialog.</span>
          <button onClick={onClose} className="hover:text-slate-800 dark:hover:text-white font-medium">
            Close Preview (Esc)
          </button>
        </div>

      </div>
    </div>
  )
}
