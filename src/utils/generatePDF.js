export async function generateBillPDF(bill, settings = {}) {

  const biz          = settings.businessName    || 'Shree Transport'
  const addr         = settings.businessAddress || 'Mumbai, Maharashtra'
  const ph           = settings.businessPhone   || ''
  const gst          = settings.gstin           || ''
  const branches     = settings.branchContacts  || ''
  const timing       = settings.businessTiming  || ''
  const logoBase64   = settings.logoBase64      || ''
  const terms        = settings.termsText       ||
    '1. Delivery of goods must be taken within 7 days of booking. No claims after 7 days.\n2. After 30 days company is not responsible for any loss of goods.\n3. Payment by Cheque only — No Cash accepted.'

  const lampingCharge  = parseFloat(settings.lampingCharge  || 0)
  const loadingCharge  = parseFloat(settings.loadingCharge  || 0)
  const deliveryCharge = parseFloat(settings.deliveryCharge || 0)
  const biltyCharge    = parseFloat(settings.biltyCharge    || 0)
  const serviceTax     = parseFloat(settings.serviceTax     || 0)
  const totalCharges   = lampingCharge + loadingCharge + deliveryCharge + biltyCharge + serviceTax
  const grandTotal     = Number(bill.total) + totalCharges

  const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const dateStr = new Date(bill.date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  const billNo  = `#${String(bill.billNumber).padStart(5, '0')}`
  const paidAmt = bill.status === 'Paid'    ? Number(bill.total)
                : bill.status === 'Partial' ? Number(bill.paidAmount || 0) : 0
  const balance = bill.status === 'Partial' ? Number(bill.total) - Number(bill.paidAmount || 0)
                : bill.status === 'Unpaid'  ? Number(bill.total) : 0

  // Bill-level variable fields
  const deliveryPoint = bill.deliveryPoint || ''
  const paymentMode   = bill.paymentMode   || (bill.status === 'Paid' ? 'Cash' : bill.status)
  const bankName      = bill.bankName      || '—'
  const chequeNo      = bill.chequeNo      || '—'

  const termLines   = terms.split('\n').map(t => `<li>${t.trim()}</li>`).join('')
  const branchHTML  = branches
    ? branches.split('\n').map(b =>
        `<div class="bi"><div class="dot"></div><span>${b.trim()}</span></div>`
      ).join('')
    : `<div class="bi"><div class="dot"></div><span>Mob: ${ph}</span></div>`

  // Logo: data URL directly usable as src
  const logoSrc = logoBase64
    ? `<img src="${logoBase64}" class="logo-img" alt="${biz}"
         onerror="this.style.display='none';document.getElementById('biz-text').style.display='block'"/>`
    : ''
  const bizFallback = !logoBase64
    ? `<div id="biz-text" style="font-size:22px;font-weight:900;color:#1a3a2a;letter-spacing:0.05em;">${biz.toUpperCase()}</div>`
    : `<div id="biz-text" style="display:none;font-size:22px;font-weight:900;color:#1a3a2a;letter-spacing:0.05em;">${biz.toUpperCase()}</div>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${billNo} — ${bill.partyName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;background:#fff;color:#111;padding:0;}
  .invoice{max-width:794px;margin:0 auto;border:1px solid #999;}

  /* HEADER */
  .hdr{display:grid;grid-template-columns:1fr auto;align-items:center;padding:16px 22px 12px;border-bottom:2.5px solid #1a3a2a;gap:16px;}
  .logo-img{height:62px;width:auto;display:block;}
  .tagline{font-size:8px;letter-spacing:0.1em;color:#666;margin-top:3px;text-transform:uppercase;}
  .hdr-r{text-align:right;border-left:1.5px solid #999;padding-left:18px;}
  .inv-title{font-size:13px;font-weight:700;letter-spacing:0.08em;color:#1a3a2a;text-transform:uppercase;}
  .co-meta{font-size:9px;color:#555;margin-top:5px;line-height:1.8;}
  .co-meta strong{color:#111;}

  /* META BAR */
  .meta-bar{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #999;background:#f9f9f9;}
  .mc{padding:8px 18px;}
  .mc:first-child{border-right:1px solid #999;}
  .ml{font-size:8px;color:#666;text-transform:uppercase;letter-spacing:0.07em;}
  .mv{font-weight:700;color:#1a3a2a;font-size:13px;margin-top:1px;}

  /* PARTY */
  .party{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #999;}
  .pb{padding:10px 18px;}
  .pb:first-child{border-right:1px solid #999;}
  .sl{font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2d6a4f;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:6px;}
  .pn{font-size:13px;font-weight:700;}
  .pd{font-size:10px;color:#555;margin-top:2px;}
  .bl{border-bottom:1px dashed #bbb;min-height:15px;margin-top:4px;}

  /* TRANSPORT */
  .tg{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid #999;background:#f9f9f9;}
  .tc{padding:6px 10px;border-right:1px solid #ccc;}
  .tc:last-child{border-right:none;}
  .tl{font-size:7.5px;color:#666;text-transform:uppercase;letter-spacing:0.07em;}
  .tv{font-size:9.5px;font-weight:600;margin-top:2px;border-bottom:1px dashed #bbb;min-height:14px;padding-bottom:2px;}

  /* TABLE */
  .tw{border-bottom:1px solid #999;}
  table{width:100%;border-collapse:collapse;font-size:10.5px;}
  thead tr{background:#1a3a2a;color:#fff;}
  thead th{padding:7px 9px;text-align:left;font-size:8.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.15);}
  thead th:last-child{border-right:none;}
  .r{text-align:right;} .c{text-align:center;}
  tbody tr{border-bottom:1px solid #ddd;}
  tbody tr:nth-child(even){background:#f9f9f9;}
  tbody td{padding:7px 9px;border-right:1px solid #ddd;vertical-align:middle;}
  tbody td:last-child{border-right:none;}
  .sno{color:#777;font-size:10px;}
  .desc{font-weight:600;}
  .er td{color:#ddd;}

  /* BOTTOM */
  .bot{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #999;}
  .cc{border-right:1px solid #999;}
  .ch{padding:5px 14px;background:#f9f9f9;border-bottom:1px solid #ddd;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2d6a4f;}
  .cr{display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #eee;font-size:10px;}
  .cr:last-child{border-bottom:none;}
  .clb{color:#555;}
  .cvl{font-weight:600;}
  .sc{padding:12px 14px;display:flex;flex-direction:column;justify-content:center;gap:4px;}
  .sr{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;padding:4px 0;border-bottom:1px dashed #ddd;}
  .sr:last-child{border-bottom:none;}
  .sr.gd{border:1.5px solid #1a3a2a;padding:6px 9px;background:#f9f9f9;margin-top:6px;}
  .sr.gd .lb{font-weight:700;font-size:11px;color:#1a3a2a;}
  .sr.gd .vl{font-weight:700;font-size:14px;color:#1a3a2a;}
  .sr.ba .lb{font-weight:700;color:#b91c1c;}
  .sr.ba .vl{font-weight:700;color:#b91c1c;}
  .lb{color:#555;font-size:9.5px;}
  .vl{font-weight:600;}
  .pv{font-weight:600;color:#15803d;}

  /* REMARKS */
  .rmk{padding:7px 18px;border-bottom:1px solid #999;display:flex;gap:8px;font-size:10px;background:#f9f9f9;}
  .rl{color:#555;font-weight:700;text-transform:uppercase;font-size:8px;letter-spacing:0.08em;flex-shrink:0;padding-top:1px;}
  .rt{font-style:italic;}

  /* SIG */
  .sig{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #999;}
  .sb{padding:12px 18px;}
  .sb:first-child{border-right:1px solid #999;}
  .sn{font-size:8.5px;color:#555;margin-bottom:4px;}
  .sln{border-bottom:1px solid #111;margin-top:28px;}
  .sc2{font-size:8px;color:#555;margin-top:3px;text-transform:uppercase;letter-spacing:0.07em;}
  .sr2{text-align:right;}

  /* TERMS */
  .trm{padding:9px 18px;border-bottom:1px solid #999;}
  .tt{font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;}
  .tl2{list-style:none;color:#555;font-size:9.5px;line-height:1.9;}
  .tl2 li::before{content:"• ";color:#2d6a4f;font-weight:700;}

  /* BRANCH */
  .br{background:#1a3a2a;color:rgba(255,255,255,0.9);padding:7px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:5px;font-size:8.5px;}
  .bcs{display:flex;gap:18px;flex-wrap:wrap;}
  .bi{display:flex;align-items:center;gap:5px;}
  .dot{width:5px;height:5px;border-radius:50%;background:#4ade80;flex-shrink:0;}
  .tm{font-size:8.5px;color:rgba(255,255,255,0.7);}

  /* FOOTER */
  .ftr{padding:6px 18px;border-top:1px solid #ccc;display:flex;justify-content:space-between;font-size:8.5px;color:#555;}
  .cc2{font-weight:700;color:#2d6a4f;}

  @media print{
    html,body{background:#fff !important;}
    @page{margin:0;size:A4 portrait;}
    .invoice{border:none;max-width:100%;}
    *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  }
</style>
</head>
<body>
<div class="invoice">

  <div class="hdr">
    <div>
      ${logoSrc}
      ${bizFallback}
      <div class="tagline">Trusted Logistics &amp; Transport Solutions</div>
    </div>
    <div class="hdr-r">
      <div class="inv-title">Transport Tax Invoice</div>
      <div class="co-meta">
        <strong>Address :</strong> ${addr}<br>
        <strong>Mob :</strong> ${ph}
        ${gst ? `&nbsp;|&nbsp;<strong>GSTIN :</strong> ${gst}` : ''}
      </div>
    </div>
  </div>

  <div class="meta-bar">
    <div class="mc">
      <div class="ml">Invoice No.</div>
      <div class="mv">${billNo}</div>
    </div>
    <div class="mc">
      <div class="ml">Invoice Date</div>
      <div class="mv">${dateStr}</div>
    </div>
  </div>

  <div class="party">
    <div class="pb">
      <div class="sl">Bill To (Consignor)</div>
      <div class="pn">${bill.partyName}</div>
      <div class="bl" style="margin-top:6px;">&nbsp;</div>
      <div class="bl">&nbsp;</div>
    </div>
    <div class="pb">
      <div class="sl">Ship To (Delivery Point)</div>
      ${deliveryPoint
        ? `<div class="pd" style="margin-top:4px;">${deliveryPoint}</div>`
        : `<div class="bl" style="margin-top:4px;">&nbsp;</div><div class="bl">&nbsp;</div><div class="bl">&nbsp;</div>`
      }
    </div>
  </div>

  <div class="tg">
    <div class="tc"><div class="tl">Vehicle No.</div><div class="tv">&nbsp;</div></div>
    <div class="tc"><div class="tl">LR / GR No.</div><div class="tv">&nbsp;</div></div>
    <div class="tc"><div class="tl">Booking Point</div><div class="tv">&nbsp;</div></div>
    <div class="tc"><div class="tl">Destination</div><div class="tv">&nbsp;</div></div>
    <div class="tc"><div class="tl">E-way Bill No.</div><div class="tv">&nbsp;</div></div>
  </div>

  <div class="tw">
    <table>
      <thead>
        <tr>
          <th style="width:34px">S.No.</th>
          <th>Description</th>
          <th class="c" style="width:44px">Qty</th>
          <th class="c" style="width:40px">Unit</th>
          <th class="c" style="width:62px">Weight</th>
          <th class="r" style="width:80px">Rate (₹)</th>
          <th class="r" style="width:80px">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="sno c">1</td>
          <td class="desc">Iron / Loha (Transport)</td>
          <td class="c">1</td>
          <td class="c">Pcs</td>
          <td class="c">${bill.tons} Ton${bill.tons > 1 ? 's' : ''}</td>
          <td class="r">${fmt(bill.ratePerTon)}</td>
          <td class="r">${fmt(bill.total)}</td>
        </tr>
        <tr class="er"><td class="c sno">2</td><td>&nbsp;</td><td></td><td></td><td></td><td class="r">—</td><td class="r">—</td></tr>
        <tr class="er"><td class="c sno">3</td><td>&nbsp;</td><td></td><td></td><td></td><td class="r">—</td><td class="r">—</td></tr>
      </tbody>
    </table>
  </div>

  <div class="bot">
    <div class="cc">
      <div class="ch">Additional Charges</div>
      <div class="cr"><span class="clb">Loading / Unloading</span><span class="cvl">${fmt(loadingCharge)}</span></div>
      <div class="cr"><span class="clb">Delivery Charges</span><span class="cvl">${fmt(deliveryCharge)}</span></div>
      <div class="cr"><span class="clb">Lamping Material</span><span class="cvl">${fmt(lampingCharge)}</span></div>
      <div class="cr"><span class="clb">Bilty Charges</span><span class="cvl">${fmt(biltyCharge)}</span></div>
      <div class="cr"><span class="clb">Service Tax (Consignor)</span><span class="cvl">${fmt(serviceTax)}</span></div>
      <div class="cr"><span class="clb">Payment Mode</span><span class="cvl" style="color:#2d6a4f">${paymentMode}</span></div>
      <div class="cr"><span class="clb">Bank Name</span><span class="cvl">${bankName}</span></div>
      <div class="cr"><span class="clb">Cheque No.</span><span class="cvl">${chequeNo}</span></div>
    </div>
    <div class="sc">
      <div class="sr"><span class="lb">Sub Total</span><span class="vl">${fmt(bill.total)}</span></div>
      <div class="sr"><span class="lb">Total Charges</span><span class="vl">${fmt(totalCharges)}</span></div>
      <div class="sr gd"><span class="lb">Grand Total</span><span class="vl">${fmt(grandTotal)}</span></div>
      <div class="sr" style="margin-top:5px;"><span class="lb">Paid Amount</span><span class="pv">${fmt(paidAmt)}</span></div>
      <div class="sr ba"><span class="lb">Balance Due</span><span class="vl">${fmt(balance)}</span></div>
    </div>
  </div>

  ${bill.notes ? `
  <div class="rmk">
    <span class="rl">Remarks :</span>
    <span class="rt">${bill.status === 'Partial' ? `Partial payment received. ${fmt(balance)} balance pending. ` : ''}${bill.notes}</span>
  </div>` : ''}

  <div class="sig">
    <div class="sb">
      <div class="sn">Consignor Acknowledgement</div>
      <div class="sln"></div>
      <div class="sc2">Receiver's Signature &amp; Stamp</div>
    </div>
    <div class="sb sr2">
      <div class="sn">For ${biz}</div>
      <div class="sln"></div>
      <div class="sc2">Authorised Signatory</div>
    </div>
  </div>

  <div class="trm">
    <div class="tt">Terms &amp; Conditions</div>
    <ul class="tl2">${termLines}</ul>
  </div>

  <div class="br">
    <div class="bcs">${branchHTML}</div>
    ${timing ? `<div class="tm">${timing}</div>` : ''}
  </div>

  <div class="ftr">
    <span>Computer-generated invoice — no signature required.</span>
    <span>Customer Care : <span class="cc2">${ph}</span></span>
    <span>Generated : ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
  </div>

</div>
<script>
  // Auto print only — no dark mode
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 600);
  });
</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  } else {
    alert('Popup blocked! Browser mein popup allow karo phir dobara try karo.')
  }
}