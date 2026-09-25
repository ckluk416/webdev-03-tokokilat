// Membuka potongan trace di panel Performance DevTools (frontend bawaan Chrome yang disajikan port remote debugging)
// lalu menyimpan tangkapan layarnya, dengan keterangan di bagian atas gambar.
// Pakai: node laporan/bench/foto-flamechart.js <trace.json.gz> <keluar.png> "<keterangan>"

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buka, tidur } = require('./cdp-bantu.js');

const [berkasTrace, keluar, keterangan = ''] = process.argv.slice(2);

(async () => {
  // server kecil dengan CORS supaya frontend DevTools boleh mengambil berkas trace
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/octet-stream' });
    fs.createReadStream(berkasTrace).pipe(res);
  }).listen(8123);

  const c = await buka({ lebar: 1600, tinggi: 900, mobile: false, skala: 1 });
  const url = (process.env.HALAMAN_DT || 'http://127.0.0.1:9334/devtools/trace_app.html') + '?loadTimelineFromURL=' + encodeURIComponent('http://127.0.0.1:8123/' + path.basename(berkasTrace));
  // CSP frontend DevTools hanya mengizinkan koneksi ke dirinya sendiri; untuk alat lokal ini CSP dilewati
  await c.kirim('Page.setBypassCSP', { enabled: true });
  await c.kirim('Page.navigate', { url });
  // tunggu panel Performance selesai memuat dan menggambar trace
  for (let i = 0; i < 60; i++) {
    await tidur(1000);
    const siap = await c.nilai(`(() => { try { return document.body.innerText.includes('Summary') || document.body.innerText.includes('Bottom-up'); } catch (e) { return false; } })()`).catch(() => false);
    if (siap && i > 4) break;
  }
  await tidur(3000);
  // tutup popup pintasan keyboard yang muncul saat panel pertama kali dibuka
  for (let i = 0; i < 2; i++) await c.tombol('Escape', 'Escape', 27);
  await tidur(500);
  if (keterangan) {
    await c.nilai(`(() => { const d = document.createElement('div'); d.textContent = ${JSON.stringify(keterangan)}; d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#1a1464;color:#fff;font:600 16px/1.45 system-ui,sans-serif;padding:10px 14px;white-space:pre-wrap;border-bottom:3px solid #ffd400'; document.body.append(d); })()`).catch(() => {});
    await tidur(300);
  }
  await c.foto(keluar);
  console.log('tersimpan', keluar, c.galat.length ? 'galat: ' + c.galat.slice(0, 3).join(' | ') : '');
  c.tutup();
  server.close();
  process.exit(0);
})();
