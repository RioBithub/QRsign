# QRsign

Simple document authenticity verifier untuk PPT/PDF/DOCX/XLSX berbasis QR + SHA-256.

## Alur
1. Admin membuat record dokumen.
2. Sistem menghasilkan Document ID + verification URL + QR PNG.
3. QR ditempel ke dokumen.
4. File final di-upload.
5. Server menghitung SHA-256 dan mengunci record sebagai FINAL.
6. Penerima scan QR untuk melihat file resmi dan membandingkan SHA-256 file lokalnya.

> Ini bukan tanda tangan elektronik tersertifikasi. Sistem ini memverifikasi integritas file terhadap file resmi yang disimpan di server.

## Stack
- Node.js
- Express
- JSON metadata
- Local file upload
- QR Code
- SHA-256
- PM2

## Environment

```env
NODE_ENV=production
PORT=3105
APP_BASE_URL=https://qrsign.aruraharja.co.id
ADMIN_KEY=GANTI_DENGAN_SECRET_PANJANG
MAX_FILE_MB=50
```

## Quick start

```bash
npm ci
cp .env.example .env
npm start
```

Aplikasi listen hanya di `127.0.0.1:3105`, jadi production harus lewat reverse proxy Nginx/Hestia.

## Data
- Metadata: `data/documents.json`
- File final: `uploads/`

Folder upload dan `.env` tidak masuk Git.

## Update production

```bash
cd /home/aru/web/qrsign.aruraharja.co.id/nodeapp
git pull
npm ci --omit=dev
pm2 restart qrsign --update-env
```

## Health check

```bash
curl http://127.0.0.1:3105/health
```
