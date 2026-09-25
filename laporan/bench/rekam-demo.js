// Merekam video demo (CPU 4x, viewport 412 x 915) lewat screencast CDP: bagian sebelum dari kode awal dan bagian
// sesudah dari kode akhir. Tiap bagian disimpan sebagai rangkaian frame beserta waktunya, lalu dirakit dengan ffmpeg.
// Pakai: server kode akhir di :3000 dan kode awal di :3001, lalu node laporan/bench/rekam-demo.js <folder-keluar>

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buka, tidur } = require('./cdp-bantu.js');

const KELUAR = process.argv[2];
const FONT = 'C\\:/Windows/Fonts/segoeuib.ttf';

async function rekamBagian(c, nama, judul, langkah) {
  const dir = path.join(KELUAR, nama);
  fs.mkdirSync(dir, { recursive: true });
  const frame = [];
  const terima = (p) => {
    if (p.method !== 'Page.screencastFrame') return;
    const i = frame.length;
    fs.writeFileSync(path.join(dir, String(i).padStart(5, '0') + '.jpg'), Buffer.from(p.params.data, 'base64'));
    frame.push(p.params.metadata.timestamp);
    c.kirim('Page.screencastFrameAck', { sessionId: p.params.sessionId });
  };
  c.dengar(terima);
  await c.kirim('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
  const mulai = Date.now() / 1000;
  await langkah();
  const selesai = Date.now() / 1000;
  // stopScreencast dijawab oleh renderer; pada halaman yang jenuh jawabannya bisa tertunda, jadi tidak ditunggu
  c.kirim('Page.stopScreencast');
  await tidur(500);
  c.berhentiDengar(terima);
  // durasi tiap frame = selisih ke frame berikutnya; frame terakhir ditahan sampai akhir bagian
  const baris = ['ffconcat version 1.0'];
  frame.forEach((t, i) => {
    const berikut = i + 1 < frame.length ? frame[i + 1] : Math.max(selesai, t + 0.1);
    baris.push(`file '${String(i).padStart(5, '0')}.jpg'`, `duration ${Math.max(berikut - t, 0.001).toFixed(3)}`);
  });
  if (frame.length) baris.push(`file '${String(frame.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(path.join(dir, 'daftar.txt'), baris.join('\n'));
  const teks = judul.replace(/:/g, '\\:').replace(/'/g, '');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'daftar.txt'),
    '-vf', `scale=412:916,pad=412:996:0:80:color=0x1a1464,drawtext=fontfile='${FONT}':text='${teks}':fontcolor=white:fontsize=15:x=12:y=16:line_spacing=8`,
    '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(KELUAR, nama + '.mp4')]);
  console.log(nama, frame.length, 'frame,', (selesai - mulai).toFixed(1), 'detik');
}

(async () => {
  const bagian = process.argv[3] || 'semua';
  let c = await buka({ cpu: 4, skala: 1 });
  const klikXY = async (x, y) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) c.kirim('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
  const ketikLambat = async (teks, jeda) => { for (const h of teks) { c.kirim('Input.insertText', { text: h }); await tidur(jeda); } };

  // bagian sebelum memakai Chrome sendiri: pada 4x halaman awal tidak pernah selesai, dan navigasi keluar darinya ikut tertahan
  if (bagian === 'sebelum') {
  await rekamBagian(c, '1-sebelum-muat', 'SEBELUM (kode awal, CPU 4x)\nmemuat halaman, lalu S1 mengetik "sepatu"', async () => {
    c.kirim('Page.navigate', { url: 'http://localhost:3001/?ukur=1' });
    await tidur(30000);
    await klikXY(206, 67);
    await ketikLambat('sepatu', 250);
    await tidur(15000);
  });
  c.tutup();
  process.exit(0);
  }

  // daftar pesanan server dikosongkan supaya lencana Pesanan di video dimulai dari 0
  await fetch('http://localhost:3000/api/pesanan', { method: 'DELETE' });
  // pemuatan pertama menulis data contoh di localStorage; bagian sesudah memakai pemuatan kedua
  await c.kirim('Page.navigate', { url: 'http://localhost:3000/?ukur=1' });
  await tidur(5000);

  await rekamBagian(c, '2-sesudah-s0-s1', 'SESUDAH (kode akhir, CPU 4x)\nmemuat halaman, S1 mengetik lalu menghapus', async () => {
    await c.kirim('Page.navigate', { url: 'http://localhost:3000/?ukur=1' });
    await tidur(6000);
    const cari = await c.pusat('#kolom-cari');
    await klikXY(cari.x, cari.y);
    await ketikLambat('sepatu', 250);
    await tidur(1500);
    for (let i = 0; i < 6; i++) { c.kirim('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }); c.kirim('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }); await tidur(250); }
    await tidur(1500);
  });

  await rekamBagian(c, '3-sesudah-s2-s3', 'SESUDAH (CPU 4x)\nS2 + Keranjang, S3 Beli sekarang 3x cepat', async () => {
    await c.nilai(`window.scrollTo({ top: document.querySelector('#kisi').getBoundingClientRect().top + scrollY - 90, behavior: 'instant' })`);
    await tidur(1500);
    const tambah = await c.pusat('#kisi .kartu .tombol-tambah');
    await klikXY(tambah.x, tambah.y);
    await tidur(2500);
    const beli = await c.pusat('#kisi .kartu:nth-child(2) .tombol-beli');
    for (let i = 0; i < 3; i++) { await klikXY(beli.x, beli.y); await tidur(120); }
    await tidur(3000);
    const pesanan = await c.pusat('#tombol-pesanan');
    await klikXY(pesanan.x, pesanan.y);
    await tidur(2500);
  });

  await rekamBagian(c, '4-sesudah-s4', 'SESUDAH (CPU 4x)\nS4 voucher KILAT1212 sambil mengetik', async () => {
    await c.nilai(`window.scrollTo({ top: 0, behavior: 'instant' })`);
    await tidur(1000);
    const tombol = await c.pusat('#tombol-voucher');
    const cari = await c.pusat('#kolom-cari');
    await klikXY(tombol.x, tombol.y);
    await tidur(300);
    await klikXY(cari.x, cari.y);
    await ketikLambat('sepatu', 200);
    await tidur(4000);
  });

  await rekamBagian(c, '5-sesudah-s5', 'SESUDAH (CPU 4x)\nS5 menggulir daftar produk', async () => {
    await c.nilai(`(() => { const k = document.querySelector('#kolom-cari'); k.value = ''; k.dispatchEvent(new Event('input')); scrollTo({ top: 0, behavior: 'instant' }); })()`);
    await tidur(2000);
    const akhir = Date.now() + 8000;
    while (Date.now() < akhir) { c.kirim('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 206, y: 600, deltaX: 0, deltaY: 90 }); await tidur(50); }
    await tidur(1000);
  });

  c.tutup();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
