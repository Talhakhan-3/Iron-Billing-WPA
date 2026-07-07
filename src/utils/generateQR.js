import QRCode from 'qrcode'

/**
 * UPI payment QR generate karo
 */
export async function generateUPIQR({ upiId, name, amount, billNumber, note }) {
  if (!upiId) return null

  const upiString = [
    `upi://pay`,
    `?pa=${encodeURIComponent(upiId)}`,
    `&pn=${encodeURIComponent(name || 'Shree Transport')}`,
    amount ? `&am=${Number(amount).toFixed(2)}` : '',
    `&cu=INR`,
    `&tn=${encodeURIComponent(`Bill #${billNumber || ''} ${note || ''}`)}`,
  ].join('')

  try {
    return await QRCode.toDataURL(upiString, {
      width: 180,
      margin: 1,
      color: { dark: '#1a3a2a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch (err) {
    console.error('QR generation error:', err)
    return null
  }
}
