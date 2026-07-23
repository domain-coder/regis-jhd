const QRCode = require('qrcode');

function generateQrDataUrl(token) {
  return QRCode.toDataURL(token, { margin: 1, width: 300 });
}

module.exports = { generateQrDataUrl };
