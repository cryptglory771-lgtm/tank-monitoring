#!/usr/bin/env bash
# Deploy/update di VPS: tarik kode terbaru, install dependensi, build, lalu
# restart proses lewat pm2. Jalankan dari root project (mis. /opt/tank-monitoring).
#
# Pakai:
#   ./scripts/deploy-vps.sh
#
# Prasyarat sekali di awal (lihat README bagian "Deploy di VPS"):
#   npm i -g pm2
#   pm2 start worker/ecosystem.config.cjs
#   pm2 save && pm2 startup

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> git pull"
git pull --ff-only

echo "==> npm ci"
npm ci

echo "==> build web app"
npm run build

if command -v pm2 >/dev/null 2>&1; then
  echo "==> pm2 reload"
  pm2 reload worker/ecosystem.config.cjs --update-env
else
  echo "pm2 tidak ditemukan. Kalau pakai systemd, restart manual:"
  echo "  sudo systemctl restart tank-web tank-alert-worker"
fi

echo "==> selesai"
