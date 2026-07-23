#!/bin/bash
# Aktif/nonaktifkan Cloudflare Turnstile sementara tanpa menyentuh site/secret
# key asli di .env — cuma menambah/menghapus baris flag TURNSTILE_DISABLED.
# Berguna saat butuh testing login/registrasi lewat curl/skrip yang tidak bisa
# menyelesaikan challenge widget Turnstile di browser sungguhan.
#
# Pemakaian:
#   ./scripts/toggle-turnstile.sh off   # nonaktifkan sementara
#   ./scripts/toggle-turnstile.sh on    # aktifkan kembali
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env

case "${1:-}" in
  off)
    if grep -q '^TURNSTILE_DISABLED=' "$ENV_FILE"; then
      sed -i 's/^TURNSTILE_DISABLED=.*/TURNSTILE_DISABLED=true/' "$ENV_FILE"
    else
      echo 'TURNSTILE_DISABLED=true' >> "$ENV_FILE"
    fi
    echo "Turnstile dinonaktifkan sementara (widget & verifikasi server keduanya skip)."
    ;;
  on)
    sed -i '/^TURNSTILE_DISABLED=/d' "$ENV_FILE"
    echo "Turnstile diaktifkan kembali."
    ;;
  *)
    echo "Pemakaian: $0 on|off" >&2
    exit 1
    ;;
esac

pm2 restart jhd26-registrasi-absensi
