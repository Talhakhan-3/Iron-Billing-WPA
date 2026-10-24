import { generateUPIQR } from './generateQR'

/**
 * Returns formatted currency string
 */
export const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Generates the complete HTML for the Invoice / Transport Bilty
 */
export async function buildInvoiceHtml(bill, settings = {}) {
  // ----- SETTINGS FIELDS -----
  const biz          = settings.businessName    || 'Shree Transport'
  const addr         = settings.businessAddress || 'Mumbai, Maharashtra'
  const ph           = settings.businessPhone   || ''
  const gst          = settings.gstin           || ''
  const branches     = settings.branchContacts  || ''
  const timing       = settings.businessTiming  || ''
  const logoBase64   = settings.logoBase64      || ''
  const terms        = settings.termsText       ||
    '1. Delivery of goods must be taken within 7 days of booking. No claims after 7 days.\n2. After 30 days company is not responsible for any loss of goods.\n3. Payment by Cheque only — No Cash accepted.'

  // Extra charges from settings
  const lampingCharge  = parseFloat(settings.lampingCharge  || 0)
  const loadingCharge  = parseFloat(settings.loadingCharge  || 0)
  const deliveryCharge = parseFloat(settings.deliveryCharge || 0)
  const biltyCharge    = parseFloat(settings.biltyCharge    || 0)
  const serviceTax     = parseFloat(settings.serviceTax     || 0)
  const totalCharges   = lampingCharge + loadingCharge + deliveryCharge + biltyCharge + serviceTax

  // Bank & payment details from settings
  const bankNameSetting   = settings.bankName  || ''
  const accountNo         = settings.accountNo || ''
  const ifscCode          = settings.ifscCode  || ''
  const gpayNo            = settings.gpayNo    || ''
  const phonepeNo         = settings.phonepeNo || ''
  const signatureBase64   = settings.signatureBase64 || ''
  const upiId             = settings.upiId           || ''

  // ----- BILL FIELDS (with fallbacks for legacy data) -----
  const weightKg        = Number(bill.weightKg || (bill.tons ? bill.tons * 1000 : 0))
  const ratePerKg       = Number(bill.ratePerKg || (bill.ratePerTon ? bill.ratePerTon / 1000 : 0))
  const itemDescription = bill.itemDescription || 'Iron / Loha'
  const itemSize        = bill.itemSize || ''
  const vehicleNo       = bill.vehicleNo || ''
  const consigneeName   = bill.consigneeName || ''
  const paymentMode     = bill.paymentMode || (bill.status === 'Paid' ? 'Cash' : bill.status)
  const chequeNo        = bill.chequeNo || '—'

  // Bank name on bill (if cheque was used) otherwise fallback to settings bank name
  const billBankName = (paymentMode === 'Cheque' && bill.bankName) ? bill.bankName : bankNameSetting

  // ----- TOTALS -----
  const adjustments    = bill.adjustments || []
  const adjustTotal    = adjustments.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
  const freightAmt     = (weightKg * ratePerKg)
  const totalBillAmt   = Number(bill.total || (freightAmt + adjustTotal))
  const grandTotal     = totalBillAmt + totalCharges

  const dateStr = new Date(bill.date || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  const billNo  = `#${String(bill.billNumber || '').padStart(5, '0')}`
  const paidAmt = bill.status === 'Paid'    ? totalBillAmt
                : bill.status === 'Partial' ? Number(bill.paidAmount || 0) : 0
  const balance = bill.status === 'Partial' ? Math.max(0, totalBillAmt - paidAmt)
                : bill.status === 'Unpaid'  ? totalBillAmt : 0

  // QR generate karo (after balance is calculated)
  let qrDataUrl = null
  if (upiId) {
    try {
      qrDataUrl = await generateUPIQR({
        upiId,
        name:       biz,
        amount:     balance > 0 ? balance : totalBillAmt,
        billNumber: bill.billNumber,
        note:       `${biz} Bill #${bill.billNumber}`,
      })
    } catch (e) {
      console.warn('QR generation skipped', e)
    }
  }

  // Item description with size/grade
  const itemDesc = itemSize ? `${itemDescription} (${itemSize})` : itemDescription

  // Formatting for HTML sections
  const termLines   = terms.split('\n').filter(Boolean).map(t => `<li>${t.trim()}</li>`).join('')
  const branchHTML  = branches
    ? branches.split('\n').filter(Boolean).map(b =>
        `<div class="bi"><div class="dot"></div><span>${b.trim()}</span></div>`
      ).join('')
    : (ph ? `<div class="bi"><div class="dot"></div><span>Mob: ${ph}</span></div>` : '')

  // Logo handling
  const logoSrc = logoBase64
    ? `<img src="${logoBase64}" class="logo-img" alt="${biz}"/>`
    : `<div class="biz-text">${biz.toUpperCase()}</div>`

  // Bank details section
  const ownerBankDetails = (bankNameSetting && accountNo) ? `
    <div class="bnk">
      <div class="bh">Payment / Bank Details</div>
      <div class="brow">
        <span><strong>Bank:</strong> ${bankNameSetting}</span>
        <span><strong>A/C:</strong> ${accountNo}</span>
        <span><strong>IFSC:</strong> ${ifscCode}</span>
        ${gpayNo ? `<span><strong>GPay:</strong> ${gpayNo}</span>` : ''}
        ${phonepeNo ? `<span><strong>PhonePe:</strong> ${phonepeNo}</span>` : ''}
      </div>
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${billNo} — ${bill.partyName || ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 11px; background: #fff; color: #111; padding: 0; }
  .invoice { max-width: 800px; margin: 0 auto; border: 1.5px solid #2d6a4f; background: #fff; }

  /* HEADER */
  .hdr { display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 14px 20px 10px; border-bottom: 2.5px solid #1a3a2a; gap: 16px; background: #fdfdfd; }
  .logo-img { max-height: 58px; max-width: 180px; object-fit: contain; display: block; }
  .biz-text { font-size: 20px; font-weight: 800; color: #1a3a2a; letter-spacing: 0.04em; }
  .tagline { font-size: 8.5px; letter-spacing: 0.08em; color: #555; margin-top: 2px; text-transform: uppercase; font-weight: 600; }
  .hdr-r { text-align: right; border-left: 1.5px solid #cbd5e1; padding-left: 16px; }
  .inv-title { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; color: #1a3a2a; text-transform: uppercase; }
  .co-meta { font-size: 9px; color: #475569; margin-top: 4px; line-height: 1.7; }
  .co-meta strong { color: #0f172a; }

  /* META BAR */
  .meta-bar { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #cbd5e1; background: #f8fafc; }
  .mc { padding: 7px 18px; }
  .mc:first-child { border-right: 1px solid #cbd5e1; }
  .ml { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; }
  .mv { font-weight: 800; color: #1a3a2a; font-size: 13px; margin-top: 1px; }

  /* PARTY */
  .party { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #cbd5e1; }
  .pb { padding: 9px 18px; }
  .pb:first-child { border-right: 1px solid #cbd5e1; }
  .sl { font-size: 8.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #2d6a4f; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 5px; }
  .pn { font-size: 13px; font-weight: 700; color: #0f172a; }
  .pd { font-size: 10px; color: #475569; margin-top: 2px; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a3a2a; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; padding: 7px 10px; text-align: left; }
  th.r, td.r { text-align: right; }
  th.c, td.c { text-align: center; }
  td { padding: 7px 10px; font-size: 10.5px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  .item-row:nth-child(even) { background: #fafafa; }

  /* TOTALS BOX */
  .summary-wrap { display: grid; grid-template-columns: 1.1fr 1fr; border-bottom: 1.5px solid #1a3a2a; background: #fdfdfd; }
  .sum-left { padding: 10px 16px; border-right: 1px solid #cbd5e1; font-size: 9.5px; line-height: 1.8; color: #334155; }
  .sum-right table { width: 100%; }
  .sum-right td { padding: 5px 12px; font-size: 10px; border-bottom: 1px solid #e2e8f0; }
  .grand-row td { font-size: 12.5px; font-weight: 800; color: #1a3a2a; background: #f0fdf4; border-top: 1.5px solid #2d6a4f; }

  /* SIGNATURE & QR */
  .sig-qr-row { display: grid; grid-template-columns: 1.2fr 0.9fr 1.2fr; border-bottom: 1px solid #cbd5e1; padding: 12px 18px 8px; gap: 14px; background: #fff; }
  .sb { text-align: center; }
  .sig-note { font-size: 8.5px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .sig-line { border-bottom: 1px solid #475569; height: 38px; margin-bottom: 4px; }
  .sig-cap { font-size: 8.5px; color: #64748b; font-weight: 600; }
  .qr-box { padding: 4px; border: 1px dashed #94a3b8; border-radius: 6px; background: #f8fafc; }

  /* TERMS & BANK */
  .trm { padding: 8px 18px; border-bottom: 1px solid #cbd5e1; background: #f8fafc; }
  .tt { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #1a3a2a; margin-bottom: 3px; }
  .tl2 { font-size: 8px; color: #475569; margin-left: 14px; line-height: 1.5; }
  .bnk { padding: 8px 18px; border-bottom: 1px solid #cbd5e1; background: #fdfdfd; font-size: 9px; }
  .bh { font-size: 8.5px; font-weight: 800; color: #1a3a2a; text-transform: uppercase; margin-bottom: 3px; }
  .brow { display: flex; flex-wrap: wrap; gap: 14px; color: #334155; }

  /* FOOTER */
  .br { padding: 6px 18px; display: flex; justify-content: space-between; font-size: 8px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .ftr { padding: 6px 18px; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; background: #fafafa; }

  @media print {
    body { padding: 0 !important; background: #fff !important; }
    .invoice { border: 1px solid #000 !important; max-width: 100% !important; }
  }
</style>
</head>
<body>
<div class="invoice">

  <!-- HEADER -->
  <div class="hdr">
    <div>
      ${logoSrc}
      <div class="tagline">Iron, Steel & Heavy Goods Transport / Invoicing</div>
    </div>
    <div class="hdr-r">
      <div class="inv-title">Bilty / Tax Invoice</div>
      <div class="co-meta">
        ${addr ? `<div>${addr}</div>` : ''}
        ${ph ? `<div><strong>Phone:</strong> ${ph}</div>` : ''}
        ${gst ? `<div><strong>GSTIN:</strong> ${gst}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- META BAR -->
  <div class="meta-bar">
    <div class="mc">
      <div class="ml">Bill / Bilty No</div>
      <div class="mv">${billNo}</div>
    </div>
    <div class="mc">
      <div class="ml">Bill Date</div>
      <div class="mv">${dateStr}</div>
    </div>
  </div>

  <!-- PARTIES -->
  <div class="party">
    <div class="pb">
      <div class="sl">Consignor (From Party)</div>
      <div class="pn">${bill.partyName || '—'}</div>
      ${bill._partyPhone ? `<div class="pd">📞 ${bill._partyPhone}</div>` : ''}
    </div>
    <div class="pb">
      <div class="sl">Consignee (To Party)</div>
      <div class="pn">${consigneeName || '—'}</div>
    </div>
  </div>

  <!-- ITEM TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width: 40px;" class="c">Sr.</th>
        <th>Description of Goods</th>
        <th class="c">Vehicle No</th>
        <th class="r">Weight (KG)</th>
        <th class="r">Weight (Tons)</th>
        <th class="r">Rate (₹/KG)</th>
        <th class="r">Freight (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="item-row">
        <td class="c">1</td>
        <td>
          <strong>${itemDesc}</strong>
          ${bill.notes ? `<div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Note: ${bill.notes}</div>` : ''}
        </td>
        <td class="c font-mono"><strong>${vehicleNo || '—'}</strong></td>
        <td class="r"><strong>${weightKg.toLocaleString('en-IN')}</strong> KG</td>
        <td class="r">${(weightKg / 1000).toFixed(3)} MT</td>
        <td class="r">₹${ratePerKg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="r"><strong>${fmtINR(freightAmt)}</strong></td>
      </tr>

      ${adjustments.map((adj, i) => `
        <tr class="item-row">
          <td class="c">${i + 2}</td>
          <td colspan="5">${adj.label || 'Adjustment Line Item'}</td>
          <td class="r">${parseFloat(adj.amount) >= 0 ? '+' : ''}${fmtINR(adj.amount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- TOTALS & SUMMARY -->
  <div class="summary-wrap">
    <div class="sum-left">
      <div><strong>Payment Mode:</strong> ${paymentMode || 'Cash'} ${chequeNo && chequeNo !== '—' ? `(Chq: ${chequeNo})` : ''}</div>
      <div><strong>Payment Status:</strong> <strong>${bill.status || 'Unpaid'}</strong></div>
      ${billBankName ? `<div><strong>Bank:</strong> ${billBankName}</div>` : ''}
      ${paidAmt > 0 ? `<div><strong>Paid Amount:</strong> ${fmtINR(paidAmt)}</div>` : ''}
      ${balance > 0 ? `<div style="color: #b91c1c; font-weight: 700;"><strong>Balance Outstanding:</strong> ${fmtINR(balance)}</div>` : ''}
    </div>
    <div class="sum-right">
      <table>
        <tr>
          <td>Freight Amount</td>
          <td class="r">${fmtINR(freightAmt)}</td>
        </tr>
        ${adjustTotal !== 0 ? `
          <tr>
            <td>Adjustments / Extra</td>
            <td class="r">${adjustTotal >= 0 ? '+' : ''}${fmtINR(adjustTotal)}</td>
          </tr>
        ` : ''}
        ${totalCharges > 0 ? `
          <tr>
            <td>Handling / Tax Charges</td>
            <td class="r">+${fmtINR(totalCharges)}</td>
          </tr>
        ` : ''}
        <tr class="grand-row">
          <td><strong>GRAND TOTAL</strong></td>
          <td class="r"><strong>${fmtINR(grandTotal)}</strong></td>
        </tr>
      </table>
    </div>
  </div>

  <!-- SIGNATURES & QR CODE -->
  <div class="sig-qr-row">
    <div class="sb">
      <div class="sig-note">Consignor Acknowledgement</div>
      <div class="sig-line"></div>
      <div class="sig-cap">Receiver's Signature &amp; Stamp</div>
    </div>

    ${qrDataUrl ? `
      <div class="sb qr-box">
        <div class="sig-note">Scan to Pay (UPI)</div>
        <img src="${qrDataUrl}" style="width: 76px; height: 76px; display: block; margin: 3px auto 0;" alt="UPI QR"/>
        <div style="font-size: 7.5px; color: #555; text-align: center; margin-top: 2px;">${upiId}</div>
        ${balance > 0
          ? `<div style="font-size: 8px; font-weight: 800; color: #b91c1c; text-align: center;">Due: ${fmtINR(balance)}</div>`
          : `<div style="font-size: 8px; color: #2d6a4f; text-align: center; font-weight: 700;">Full Paid</div>`
        }
      </div>
    ` : '<div class="sb"></div>'}

    <div class="sb">
      <div class="sig-note">For ${biz}</div>
      ${signatureBase64
        ? `<div style="height: 38px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;">
             <img src="${signatureBase64}" style="max-height: 36px; max-width: 130px; object-fit: contain;" alt="Signature"/>
           </div>`
        : `<div class="sig-line"></div>`
      }
      <div class="sig-cap">Authorised Signatory</div>
    </div>
  </div>

  <!-- TERMS & CONDITIONS -->
  <div class="trm">
    <div class="tt">Terms &amp; Conditions</div>
    <ul class="tl2">${termLines}</ul>
  </div>

  ${ownerBankDetails}

  <!-- BRANCHES & TIMING -->
  <div class="br">
    <div class="bcs">${branchHTML}</div>
    ${timing ? `<div class="tm">${timing}</div>` : ''}
  </div>

  <!-- FOOTER -->
  <div class="ftr">
    <span>Computer-generated invoice — no signature required.</span>
    <span>Customer Care: <strong>${ph || '—'}</strong></span>
    <span>Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  </div>

</div>
</body>
</html>`
}

/**
 * Universal print method: uses invisible iframe if available, or window fallback.
 * Completely immune to popup blocking!
 */
export async function printInvoiceSafely(bill, settings = {}) {
  const html = await buildInvoiceHtml(bill, settings)

  // Look for existing print iframe or create one
  let iframe = document.getElementById('iron-billing-print-frame')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = 'iron-billing-print-frame'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument
  if (doc) {
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (err) {
        console.warn('Iframe print error, trying fallback', err)
      }
    }, 400)
    return true
  }

  // Fallback for isolated window
  try {
    const win = window.open('', '_blank')
    if (win) {
      win.document.open()
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 500)
      return true
    }
  } catch (err) {
    console.warn('window.open blocked', err)
  }

  return false
}

/**
 * Backward compatibility alias
 */
export async function generateBillPDF(bill, settings = {}) {
  return await printInvoiceSafely(bill, settings)
}