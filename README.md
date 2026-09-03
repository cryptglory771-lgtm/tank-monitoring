# Cooling Tank Monitor

PWA pemantau suhu tanki pendingin susu. Data suhu dari ESP32 masuk lewat HiveMQ
Cloud, ditampilkan realtime, disimpan offline di IndexedDB, dan diteruskan jadi
notifikasi walau aplikasi sedang tertutup.

## Arsitektur

```
ESP32 + thermocouple
        │ MQTT/TLS :8883
        ▼
   HiveMQ Cloud
        ├──── WSS :8884 ────► PWA (Next.js)
        │                      ├─ realtime di layar
        │                      └─ Dexie/IndexedDB (riwayat 31 hari, offline)
        │
        └──── MQTT :8883 ───► Worker Node (VPS, hidup terus)
                               └─ Web Push ─► Service Worker ─► notifikasi HP
```

### Kenapa harus ada worker

Ini bagian rencana yang perlu penyesuaian. Service worker PWA **tidak bisa**
menahan koneksi WebSocket MQTT saat aplikasi ditutup — Android dan iOS akan
mematikannya beberapa detik setelah tab hilang. `Periodic Background Sync` juga
tidak menolong: hanya ada di Chrome, minimal beberapa jam sekali, dan tidak
dijamin jalan.

Satu-satunya jalur yang benar-benar sampai ke HP dalam keadaan terkunci adalah
**Web Push**, dan Web Push wajib dikirim dari server. Karena itu ada
`worker/index.ts`: proses Node kecil di VPS yang berlangganan ke broker,
menilai kondisi, lalu mengirim push.

Yang penting, worker dan tampilan memakai **satu file logika yang sama**
(`src/lib/alert-engine.ts`). Apa yang dilihat operator di layar tidak akan
pernah berbeda dari isi notifikasinya.

## Menangani jam pengisian 06:00 dan 17:00

Kenaikan suhu dua kali sehari adalah hal normal, bukan kerusakan. Mesin alert
mengenal empat fase:

| Fase | Kapan | Perlakuan |
|---|---|---|
| `filling` | Di dalam jendela pengisian (default 45 menit sejak 06:00 / 17:00) | Alert suhu tinggi ditahan sepenuhnya |
| `cooling` | Setelah pengisian, dalam masa toleransi (default 150 menit) | Boleh di atas target, tapi lajunya diawasi |
| `normal` | Di luar keduanya | Ambang penuh berlaku |
| `offline` | Tidak ada data > 10 menit | Selalu menang atas fase lain |

Tiga pengaman selama fase `cooling`:

1. **Kompresor mati terdeteksi lebih cepat dari batas waktu.** Setelah 20 menit
   pertama, laju penurunan diukur dengan regresi linier. Kalau lebih lambat dari
   `minCoolingRatePerHour` (default 1 °C/jam), langsung kritis
   (`cooling_stalled`) — tidak perlu menunggu 2,5 jam untuk tahu ada masalah.
2. **Peringatan dini.** Perkiraan waktu sampai target dihitung dari tren. Kalau
   perkiraannya melewati sisa toleransi, keluar peringatan `cooling_timeout`.
3. **Suhu ekstrem tetap kritis.** Melewati `criticalHigh` tetap dilaporkan walau
   masih dalam masa toleransi.

Di luar jadwal, kenaikan mendadak ≥ 1,5 °C dalam 15 menit ditandai
`unscheduled_rise` — biasanya tutup tanki terbuka atau ada pengisian tak terjadwal.

Peredam gangguan: pelanggaran harus bertahan `sustainSeconds` (default 180 detik)
sebelum jadi alert, dan pemulihan pakai histeresis 0,4 °C. Ini yang menghindarkan
notifikasi kedap-kedip saat pengaduk menyala.

## Kontrak topik MQTT

Firmware ESP32 mengirim ke:

```
dairy/tank/{tankId}/telemetry     QoS 1
```

Payload:

```json
{ "t": 3.4, "ts": 1725336000, "rssi": -63 }
```

- `t` — suhu dalam °C (wajib). Nama `temp` atau `temperature` juga diterima.
- `ts` — epoch detik atau milidetik (opsional; kalau kosong dipakai waktu terima).
- `rssi` — opsional.

Payload berupa angka polos (bukan JSON) juga diterima, untuk firmware sederhana.

`{tankId}` harus sama persis dengan **ID perangkat** yang Anda isi saat menambah
tanki di aplikasi.

Sarankan juga pasang Last Will di firmware ke `dairy/tank/{tankId}/status`, walau
deteksi offline di aplikasi sudah berjalan tanpa itu.

## Catatan keamanan

Kredensial MQTT di `NEXT_PUBLIC_*` **terbaca oleh siapa pun** yang membuka aplikasi
— itu sifat aplikasi browser, tidak bisa disembunyikan. Karena itu:

- Buat dua kredensial terpisah di HiveMQ Cloud: satu **read-only** khusus PWA
  (hanya `subscribe` ke `dairy/tank/+/telemetry`), satu untuk worker.
- Jangan pernah memberi izin `publish` pada kredensial PWA.
- Batasi ACL ke prefix topik Anda saja.
- `WORKER_TOKEN` tidak berawalan `NEXT_PUBLIC_`, jadi aman di sisi server.

Kalau nanti aplikasi dipakai lintas peternakan, ganti pola ini: browser tidak
lagi bicara langsung ke broker, melainkan lewat SSE/WebSocket dari server Anda.

## Menjalankan

```bash
npm install
cp .env.example .env

# kunci VAPID untuk Web Push
npx web-push generate-vapid-keys
# salin public key ke NEXT_PUBLIC_VAPID_PUBLIC_KEY, private ke VAPID_PRIVATE_KEY

npm run dev          # aplikasi di http://localhost:3000
npm run worker       # penjaga notifikasi, terminal terpisah
```

Belum punya perangkat? Buka **Tanki → Data contoh**. Aplikasi akan membuat satu
tanki berisi tiga hari data buatan lengkap dengan dua siklus pengisian harian,
cukup untuk menguji tampilan dan menyetel ambang.

## Deploy di VPS (tanpa Docker)

Web app dan alert worker adalah dua proses Node terpisah yang jalan
berdampingan di VPS yang sama — bukan dua layanan berjauhan. `worker/index.ts`
harus selalu menyala (bukan serverless) karena ia menahan koneksi MQTT terus-
menerus; ini sebabnya **worker ini tidak bisa dijalankan di Vercel**, hanya di
VPS/host yang selalu hidup.

### Opsi A — pm2 (disarankan, paling gampang dikelola)

```bash
git clone <repo-anda> /opt/tank-monitoring
cd /opt/tank-monitoring
npm ci && npm run build
cp .env.example .env   # isi semua nilai, lihat bagian "Menjalankan" di atas

npm i -g pm2
mkdir -p logs
pm2 start worker/ecosystem.config.cjs
pm2 save
pm2 startup   # jalankan perintah yang ditampilkan, supaya pm2 otomatis start saat VPS reboot
```

Setelah itu, untuk update ke versi terbaru:

```bash
./scripts/deploy-vps.sh
```

Cek status & log kapan pun dengan `pm2 status`, `pm2 logs tank-alert-worker`.

### Opsi B — systemd (kalau tidak mau bergantung pada pm2)

```bash
sudo useradd --system --home /opt/tank-monitoring tankmon
sudo git clone <repo-anda> /opt/tank-monitoring
cd /opt/tank-monitoring
npm ci && npm run build
sudo cp .env.example .env && sudo nano .env   # isi semua nilai
sudo chown -R tankmon:tankmon /opt/tank-monitoring

sudo cp worker/systemd/tank-web.service worker/systemd/tank-alert-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tank-web tank-alert-worker
```

Update ke versi terbaru: `git pull && npm ci && npm run build && sudo systemctl restart tank-web tank-alert-worker`.

### Nginx + TLS

Letakkan Nginx di depan `tank-web` (port 3000) dengan sertifikat TLS (mis. Certbot).
**HTTPS wajib** — tanpa itu service worker dan Web Push tidak akan aktif. Worker
tidak butuh Nginx sama sekali; ia hanya bicara keluar ke HiveMQ dan ke `tank-web`
lewat `APP_BASE_URL` (isi dengan `http://127.0.0.1:3000` kalau satu VPS yang sama).

Beberapa hal yang perlu dicatat:

- Di iPhone, Web Push hanya jalan setelah aplikasi ditambahkan ke Layar Utama
  lewat menu Bagikan. Aplikasi sudah memberi tahu ini di banner atas.
- `data/store.json` menyimpan konfigurasi tanki dan daftar langganan notifikasi.
  Masukkan ke rutinitas cadangan Anda.
- Worker menyimpan buffer pembacaan di memori saja. Kalau restart, ia sengaja
  menahan alert "tidak terhubung" selama beberapa menit pertama supaya tidak
  membangunkan orang tanpa sebab.
- Kalau web app-nya sendiri sudah di-deploy di Vercel (untuk PWA/dashboardnya),
  worker tetap harus jalan di VPS terpisah — arahkan `APP_BASE_URL` di `.env`
  VPS ke URL Vercel tersebut, dan pastikan `WORKER_TOKEN` di kedua tempat sama persis.

## Peta berkas

| Berkas | Isi |
|---|---|
| `src/lib/alert-engine.ts` | Seluruh logika penilaian. Dipakai layar dan worker. |
| `src/lib/db.ts` | Skema Dexie, peringkasan riwayat, retensi 31 hari. |
| `src/lib/mqtt-client.ts` | Koneksi WSS tunggal ke HiveMQ. |
| `src/components/ThermalColumn.tsx` | Kaca duga suhu, elemen utama tiap kartu. |
| `src/components/TankDeck.tsx` | Geser kiri-kanan antar tanki (CSS scroll-snap). |
| `src/app/devices/[id]/page.tsx` | Pengaturan ambang, jadwal isi, dan notifikasi. |
| `worker/index.ts` | Penjaga latar belakang dan pengirim Web Push. |
| `public/sw.js` | Service worker: cache cangkang + penerima push. |

## Volume data

Lima tanki dengan interval 30 detik menghasilkan sekitar 430.000 baris per bulan
— terlalu berat untuk IndexedDB di ponsel. `compactHistory()` berjalan tiap 30
menit: data lebih tua dari 48 jam diringkas jadi satu titik per 5 menit, memakai
**nilai maksimum** tiap slot. Untuk rantai dingin, puncak suhulah yang menentukan
mutu susu; rata-rata justru menyembunyikannya. Hasilnya sekitar 43.000 baris
untuk riwayat sebulan penuh.
