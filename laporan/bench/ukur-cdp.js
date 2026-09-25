// Menjalankan skenario uji baku (TUGAS.md bagian 7) secara otomatis lewat Chrome DevTools Protocol.
// Profil Chrome baru (setara Incognito, tanpa ekstensi), CPU 4x slowdown, viewport 412 x 915, tiap skenario 3 kali, dilaporkan median.
// Pakai: npm start (terminal lain), lalu node laporan/bench/ukur-cdp.js <label> [jumlahUlang] [skenario,...] [--trace]

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ASAL = process.env.ASAL || 'http://localhost:3000';
const PORT_DEBUG = 9333;
const label = process.argv[2] || 'uji';
const ULANG = Number(process.argv[3]) || 3;
const PILIHAN = (process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4].split(',') : ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
const DENGAN_TRACE = process.argv.includes('--trace');
const TUNGGU_GAMBAR_PENUH = process.argv.includes('--gambar-penuh');
const DIR_HASIL = path.join(__dirname, '..', 'hasil');
const DIR_TRACE = path.join(__dirname, '..', 'trace');

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (arr) => { const a = arr.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[(a.length - 1) >> 1] : null; };

class Sesi {
  constructor(url) {
    this.id = 0; this.tunggu = new Map(); this.pendengar = new Map();
    this.ws = new WebSocket(url);
    this.siap = new Promise((ok, gagal) => { this.ws.onopen = ok; this.ws.onerror = gagal; });
    this.ws.onmessage = (m) => {
      const pesan = JSON.parse(m.data);
      if (pesan.id && this.tunggu.has(pesan.id)) {
        const { ok, gagal } = this.tunggu.get(pesan.id); this.tunggu.delete(pesan.id);
        pesan.error ? gagal(new Error(pesan.error.message)) : ok(pesan.result);
      } else if (pesan.method) (this.pendengar.get(pesan.method) || []).forEach((fn) => fn(pesan.params));
    };
  }
  kirim(method, params = {}) {
    const id = ++this.id;
    if (process.env.DEBUG > 1) console.log('  >', method);
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, gagal) => this.tunggu.set(id, { ok, gagal }));
  }
  on(method, fn) { if (!this.pendengar.has(method)) this.pendengar.set(method, []); this.pendengar.get(method).push(fn); }
  off(method) { this.pendengar.delete(method); }
}

async function nilai(s, ekspresi) {
  const r = await s.kirim('Runtime.evaluate', { expression: ekspresi, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function klik(s, x, y) {
  await s.kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await s.kirim('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await s.kirim('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
// tanpa menunggu ack, supaya klik beruntun tetap cepat walau main thread sibuk
function klikTanpaTunggu(s, x, y) {
  s.kirim('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  s.kirim('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
function ketik(s, huruf) {
  const kode = huruf.toUpperCase().charCodeAt(0);
  s.kirim('Input.dispatchKeyEvent', { type: 'keyDown', key: huruf, code: 'Key' + huruf.toUpperCase(), text: huruf, windowsVirtualKeyCode: kode });
  s.kirim('Input.dispatchKeyEvent', { type: 'keyUp', key: huruf, code: 'Key' + huruf.toUpperCase(), windowsVirtualKeyCode: kode });
}
function hapus(s) {
  s.kirim('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  s.kirim('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
}

async function pusat(s, selektor) {
  return nilai(s, `(() => { const e = document.querySelector(${JSON.stringify(selektor)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), atas: r.top, bawah: r.bottom }; })()`);
}

async function metrikPerforma(s) {
  const { metrics } = await s.kirim('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { task: m.TaskDuration * 1000, skrip: m.ScriptDuration * 1000, layout: m.LayoutDuration * 1000, gaya: m.RecalcStyleDuration * 1000, jumlahLayout: m.LayoutCount };
}
const selisih = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, Math.round(b[k] - a[k])]));

async function muat(s, tunggu = true) {
  const t0 = Date.now();
  await s.kirim('Page.navigate', { url: ASAL + '/?ukur=1' });
  if (!tunggu) return;
  // tunggu kisi dan banner promo muncul, lalu beri waktu halaman tenang
  for (let i = 0; i < 120; i++) {
    await tidur(500);
    try {
      const siap = await nilai(s, `!!(window.AlatUkur && document.querySelector('#kisi .kartu') && document.querySelector('.promo-banner'))`);
      if (siap) break;
    } catch { /* halaman sedang berpindah */ }
  }
  if (process.env.DEBUG) console.log('  muat siap dalam', Date.now() - t0, 'ms');
  await tidur(4000);
}

async function resetUkur(s) {
  await nilai(s, `document.querySelector('#au-reset').click()`);
}

async function mulaiTrace(s, denganLayar) {
  const kategori = ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.timeline.stack', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'blink.user_timing', 'loading', 'latencyInfo', 'devtools.timeline.async', 'disabled-by-default-devtools.timeline.invalidationTracking', 'blink.console', 'disabled-by-default-layout_shift.debug'];
  if (denganLayar) kategori.push('disabled-by-default-devtools.screenshot');
  await s.kirim('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { includedCategories: kategori, excludedCategories: ['*'], recordMode: 'recordAsMuchAsPossible' } });
}
async function hentikanTrace(s, nama) {
  const selesai = new Promise((ok) => s.on('Tracing.tracingComplete', ok));
  await s.kirim('Tracing.end');
  const { stream } = await selesai;
  s.off('Tracing.tracingComplete');
  const potongan = [];
  for (;;) {
    const r = await s.kirim('IO.read', { handle: stream, size: 1 << 20 });
    potongan.push(r.base64Encoded ? Buffer.from(r.data, 'base64') : Buffer.from(r.data));
    if (r.eof) break;
  }
  await s.kirim('IO.close', { handle: stream });
  fs.mkdirSync(DIR_TRACE, { recursive: true });
  const berkas = path.join(DIR_TRACE, `${label}-${nama.toLowerCase()}.json.gz`);
  fs.writeFileSync(berkas, zlib.gzipSync(Buffer.concat(potongan)));
  return path.relative(path.join(__dirname, '..', '..'), berkas);
}

// ---------- skenario ----------

async function S0(s, rekam) {
  const gambar = new Map(); let t0 = 0;
  s.on('Network.requestWillBeSent', (p) => { if (p.request.url.includes('/img/p/')) gambar.set(p.requestId, { mulai: p.timestamp, selesai: null }); });
  s.on('Network.loadingFinished', (p) => { const g = gambar.get(p.requestId); if (g) g.selesai = p.timestamp; });
  s.on('Page.frameStartedLoading', () => { if (!t0) t0 = Date.now() / 1000; });
  if (rekam) await mulaiTrace(s, true);
  const awal = Date.now();
  await s.kirim('Page.reload', { ignoreCache: true });
  await tidur(10000);
  let ringkas = null;
  try { ringkas = await nilai(s, 'window.AlatUkur && window.AlatUkur.ringkas()'); } catch { /* belum siap */ }
  const berkasTrace = rekam ? await hentikanTrace(s, 'S0') : null;
  const semua = [...gambar.values()];
  const mulaiPertama = Math.min(...semua.map((g) => g.mulai));
  const hasil = {
    cls: ringkas ? ringkas.cls : null,
    permintaanGambar10dtk: semua.length,
    gambarSelesai10dtk: semua.filter((g) => g.selesai).length,
    longTaskTerlama: ringkas ? ringkas.longTaskTerlama : null,
  };
  if (TUNGGU_GAMBAR_PENUH) {
    for (let i = 0; i < 400 && semua.some((g) => !g.selesai); i++) await tidur(500);
    const semuaAkhir = [...gambar.values()];
    hasil.permintaanGambarTotal = semuaAkhir.length;
    hasil.gambarTerakhirSelesaiDtk = Math.round((Math.max(...semuaAkhir.map((g) => g.selesai || 0)) - mulaiPertama) * 10) / 10;
  }
  s.off('Network.requestWillBeSent'); s.off('Network.loadingFinished'); s.off('Page.frameStartedLoading');
  void awal; void t0;
  return { hasil, berkasTrace };
}

async function siapkan(s, fn) {
  await muat(s);
  if (fn) await fn();
  await tidur(800);
  await resetUkur(s);
  await tidur(300);
}

async function jalankan(s, nama, rekam, badan) {
  const m0 = await metrikPerforma(s);
  if (rekam) await mulaiTrace(s, nama === 'S4');
  const ekstra = await badan();
  await tidur(nama === 'S4' ? 500 : 2500);
  const berkasTrace = rekam ? await hentikanTrace(s, nama) : null;
  const r = await nilai(s, 'window.AlatUkur.ringkas()');
  const perf = selisih(m0, await metrikPerforma(s));
  return { hasil: { inp: r.inp, longTaskTerlama: r.longTaskTerlama, jumlahLongTask: r.jumlahLongTask, frameLambat: r.frameLambat, frameTerburuk: r.frameTerburuk, cls: r.cls, taskMs: perf.task, skripMs: perf.skrip, layoutMs: perf.layout, gayaMs: perf.gaya, jumlahLayout: perf.jumlahLayout, ...ekstra }, berkasTrace };
}

const SKENARIO = {
  S0: async (s, rekam) => { await muat(s); return S0(s, rekam); },

  S1: async (s, rekam) => {
    await siapkan(s);
    const c = await pusat(s, '#kolom-cari');
    await klik(s, c.x, c.y); await tidur(600); await resetUkur(s);
    return jalankan(s, 'S1', rekam, async () => {
      for (const h of 'sepatu') { ketik(s, h); await tidur(250); }
      await tidur(1500);
      for (let i = 0; i < 6; i++) { hapus(s); await tidur(250); }
      await tidur(1500);
      return { nilaiAkhir: await nilai(s, `document.querySelector('#kolom-cari').value`) };
    });
  },

  S2: async (s, rekam) => {
    await siapkan(s, async () => { await nilai(s, `window.scrollTo(0, document.querySelector('#kisi').getBoundingClientRect().top + scrollY - 70)`); await tidur(1500); });
    const c = await pusat(s, '#kisi .kartu .tombol-tambah');
    const sebelum = await nilai(s, `document.querySelector('#lencana-keranjang').textContent`);
    return jalankan(s, 'S2', rekam, async () => {
      await klik(s, c.x, c.y);
      await tidur(1500);
      return { lencanaSebelum: Number(sebelum), lencanaSesudah: Number(await nilai(s, `document.querySelector('#lencana-keranjang').textContent`)) };
    });
  },

  S3: async (s, rekam) => {
    await fetch(ASAL + '/api/pesanan', { method: 'DELETE' });
    await siapkan(s, async () => { await nilai(s, `window.scrollTo(0, document.querySelector('#kisi').getBoundingClientRect().top + scrollY - 70)`); await tidur(1500); });
    const c = await pusat(s, '#kisi .kartu .tombol-beli');
    return jalankan(s, 'S3', rekam, async () => {
      for (let i = 0; i < 3; i++) { klikTanpaTunggu(s, c.x, c.y); await tidur(120); }
      await tidur(4000);
      const pesanan = await (await fetch(ASAL + '/api/pesanan')).json();
      return { jumlahPesanan: pesanan.length, lencanaPesanan: Number(await nilai(s, `document.querySelector('#lencana-pesanan').textContent`)) };
    });
  },

  S4: async (s, rekam) => {
    await siapkan(s);
    const tombol = await pusat(s, '#tombol-voucher');
    const cari = await pusat(s, '#kolom-cari');
    // pencatat progres per frame: lebar yang benar-benar ada saat frame dibuat
    await nilai(s, `(() => { window.__progres = { lebar: [], mulai: 0, selesai: 0 };
      const isi = document.querySelector('#progres-isi'), wadah = document.querySelector('#progres');
      const catat = () => { if (!wadah.hidden) { const l = isi.style.width; const a = window.__progres.lebar; if (a[a.length - 1] !== l) a.push(l); } requestAnimationFrame(catat); };
      requestAnimationFrame(catat);
      new MutationObserver(() => { if (wadah.hidden && window.__progres.mulai) window.__progres.selesai = performance.now(); }).observe(wadah, { attributes: true });
      document.querySelector('#tombol-voucher').addEventListener('click', () => { window.__progres.mulai = performance.now(); }, { capture: true });
    })()`);
    return jalankan(s, 'S4', rekam, async () => {
      await klik(s, tombol.x, tombol.y);
      await tidur(300);
      klikTanpaTunggu(s, cari.x, cari.y);
      for (const h of 'sepatu') { await tidur(200); ketik(s, h); }
      for (let i = 0; i < 120; i++) { await tidur(500); if (await nilai(s, 'window.__progres.selesai > 0')) break; }
      await tidur(2000);
      const p = await nilai(s, 'window.__progres');
      return { framePenampilProgres: p.lebar.length, durasiVoucherMs: Math.round(p.selesai - p.mulai), nilaiCari: await nilai(s, `document.querySelector('#kolom-cari').value`), jumlahHargaVoucher: await nilai(s, `document.querySelectorAll('.harga-voucher').length`) };
    });
  },

  S5: async (s, rekam) => {
    await siapkan(s);
    return jalankan(s, 'S5', rekam, async () => {
      const akhir = Date.now() + 10000;
      while (Date.now() < akhir) {
        s.kirim('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 206, y: 600, deltaX: 0, deltaY: 90 });
        await tidur(50);
      }
      return { posisiGulir: await nilai(s, 'Math.round(scrollY)') };
    });
  },

  S6: async (s, rekam) => {
    await siapkan(s);
    return jalankan(s, 'S6', rekam, async () => { await tidur(10000); return {}; });
  },
};

async function utama() {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'tokokilat-profil-'));
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT_DEBUG}`, `--user-data-dir=${profil}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--remote-allow-origins=*', '--window-size=520,1080', 'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await tidur(250);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT_DEBUG}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* chrome belum siap */ }
  }
  const versi = await (await fetch(`http://127.0.0.1:${PORT_DEBUG}/json/version`)).json();
  if (process.env.DEBUG) console.log('target', target && target.webSocketDebuggerUrl);
  const s = new Sesi(target.webSocketDebuggerUrl);
  await s.siap;
  for (const d of ['Page', 'Runtime', 'Network', 'Performance']) await s.kirim(d + '.enable');
  await s.kirim('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  await s.kirim('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU || 4) });

  // pemuatan pertama menulis data contoh ke localStorage, lalu dimuat ulang sekali (protokol langkah 4)
  await muat(s);

  const laporan = { label, waktu: new Date().toISOString(), chrome: versi.Browser, cpu: os.cpus()[0].model, inti: os.cpus().length, ramGB: Math.round(os.totalmem() / 2 ** 30), throttling: '4x', viewport: '412x915', ulang: ULANG, skenario: {} };
  for (const nama of PILIHAN) {
    const putaran = [];
    for (let i = 0; i < ULANG; i++) {
      const { hasil } = await SKENARIO[nama](s, false);
      putaran.push(hasil);
      console.log(label, nama, 'putaran', i + 1, JSON.stringify(hasil));
    }
    const kunci = Object.keys(putaran[0]).filter((k) => typeof putaran[0][k] === 'number');
    const med = Object.fromEntries(kunci.map((k) => [k, median(putaran.map((p) => p[k]))]));
    laporan.skenario[nama] = { median: med, putaran };
    if (DENGAN_TRACE) {
      const { berkasTrace } = await SKENARIO[nama](s, true);
      laporan.skenario[nama].trace = berkasTrace;
      console.log(label, nama, 'trace', berkasTrace);
    }
  }

  fs.mkdirSync(DIR_HASIL, { recursive: true });
  const berkas = path.join(DIR_HASIL, label + '.json');
  let lama = {};
  if (fs.existsSync(berkas)) lama = JSON.parse(fs.readFileSync(berkas, 'utf8'));
  laporan.skenario = { ...(lama.skenario || {}), ...laporan.skenario };
  fs.writeFileSync(berkas, JSON.stringify(laporan, null, 2));
  console.log('tersimpan', berkas);

  s.ws.close();
  chrome.kill();
  process.exit(0);
}

utama().catch((e) => { console.error(e); process.exit(1); });
