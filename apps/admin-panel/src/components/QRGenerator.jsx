import QRCode from 'qrcode.react'

/**
 * QRGenerator - Generate & download QR per table
 */

export default function QRGenerator({ tableId, restaurantId, tableNumber }) {
  const customerAppUrl = import.meta.env.VITE_CUSTOMER_APP_URL || window.location.origin
  const qrValue = `${customerAppUrl}/${restaurantId}/table/${tableNumber || tableId}`

  const downloadQR = () => {
    const qr = document.getElementById(`qr-${tableId}`)
    const link = document.createElement('a')
    link.download = `table-${tableNumber}-qr.png`
    link.href = qr.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="qr-generator">
      <div className="qr-content">
        <h3>Table {tableNumber}</h3>
        <QRCode
          id={`qr-${tableId}`}
          value={qrValue}
          size={256}
          level="H"
          includeMargin
        />
        <button onClick={downloadQR} className="download-btn">
          Download QR
        </button>
      </div>
    </div>
  )
}
