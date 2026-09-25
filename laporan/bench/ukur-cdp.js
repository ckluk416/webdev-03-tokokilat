// Menjalankan skenario uji baku (TUGAS.md bagian 7) secara otomatis lewat Chrome DevTools Protocol.
// Profil Chrome baru (setara Incognito, tanpa ekstensi), viewport 412 x 915, tiap skenario diulang dan dilaporkan median.
// Pakai: npm start (terminal lain), lalu CPU=4 node laporan/bench/ukur-cdp.js <label> [jumlahUlang] [S0,S1,...] [--trace] [--gambar-penuh]
//
// Metrik tidak dibaca lewat Runtime.evaluate, karena pada halaman awal main thread hampir selalu penuh dan evaluate bisa tertahan
// berdetik-detik. Sebagai gantinya, skrip kecil yang dipasang sejak dokumen dibuat mengirim entri mentah (event timing, long task,
// layout shift, jeda antar-frame) lewat binding CDP. INP, CLS, long task, dan frame lambat dihitung di sini untuk jendela waktu
// tiap skenario, dengan aturan yang sama dengan public/alat/ukur.js.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ASAL = process.env.ASAL || 'http://localhost:3000';
const CPU = Number(process.env.CPU || 4);
const PORT_DEBUG = 9333;
const argumen = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const label = argumen[0] || 'uji';
const ULANG = Number(argumen[1]) || 3;
const PILIHAN = argumen[2] ? argumen[2].split(',') : ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const DENGAN_TRACE = process.argv.includes('--trace');
const TUNGGU_GAMBAR_PENUH = process.argv.includes('--gambar-penuh');
const DIR_HASIL = path.join(__dirname, '..', 'hasil');
const DIR_TRACE = path.join(__dirname, '..', 'trace');
const log = (...a) => { if (process.env.DEBUG) console.log(' ', ...a); };

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (arr) => { const a = arr.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[(a.length - 1) >> 1] : null; };

// ---------- skrip yang disuntikkan ke halaman ----------
const SKRIP_HALAMAN = `(() => {
  const antre = [];
  const kirim = (e) => antre.push(e);
  const epoch = (t) => performance.timeOrigin + t;
  const po = (type, fn, opsi = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true, ...opsi }); } catch (e) {} };
  po('event', (e) => { if (e.interactionId) kirim({ k: 'ev', id: e.interactionId, t: epoch(e.startTime), d: e.duration, n: e.name }); }, { durationThreshold: 16 });
  po('longtask', (e) => kirim({ k: 'lt', t: epoch(e.startTime), d: e.duration }));
  po('layout-shift', (e) => kirim({ k: 'ls', t: epoch(e.startTime), v: e.value, input: e.hadRecentInput }));
  let sebelum = 0;
  const frame = (t) => { if (sebelum && t - sebelum > 50) kirim({ k: 'fr', t: epoch(t), d: t - sebelum }); sebelum = t; requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  // progres voucher: lebar/skala yang ada saat frame dibuat
  let progresTerakhir = null;
  const pantauProgres = () => {
    const wadah = document.getElementById('progres'), isi = document.getElementById('progres-isi');
    if (wadah && isi && !wadah.hidden) { const nilai = isi.style.width + '|' + isi.style.transform; if (nilai !== progresTerakhir) { progresTerakhir = nilai; kirim({ k: 'pg', t: Date.now(), v: nilai }); } }
    else if (wadah && wadah.hidden && progresTerakhir !== null) { progresTerakhir = null; kirim({ k: 'pg-selesai', t: Date.now() }); }
    requestAnimationFrame(pantauProgres);
  };
  requestAnimationFrame(pantauProgres);
  setInterval(() => {
    const q = (s) => document.querySelector(s);
    const keadaan = {
      t: Date.now(),
      siap: !!(window.AlatUkur && q('#kisi .kartu') && q('.promo-banner h2')),
      keranjang: q('#lencana-keranjang') ? q('#lencana-keranjang').textContent : null,
      pesanan: q('#lencana-pesanan') ? q('#lencana-pesanan').textContent : null,
      cari: q('#kolom-cari') ? q('#kolom-cari').value : null,
      y: Math.round(scrollY),
      ringkasan: q('#ringkasan') ? q('#ringkasan').textContent : null,
      toast: q('#toast') ? q('#toast').textContent : null,
    };
    const isi = antre.splice(0);
    try { window.__lapor(JSON.stringify({ keadaan, isi })); } catch (e) { antre.unshift(...isi); }
  }, 250);
})();`;

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
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, gagal) => this.tunggu.set(id, { ok, gagal }));
  }
  on(method, fn) { if (!this.pendengar.has(method)) this.pendengar.set(method, []); this.pendengar.get(method).push(fn); }
  off(method) { this.pendengar.delete(method); }
}

// data yang dikirim halaman
const catatan = { entri: [], keadaan: null };
function terimaLaporan(p) {
  if (p.name !== '__lapor') return;
  const { keadaan, isi } = JSON.parse(p.payload);
  catatan.keadaan = keadaan;
  catatan.entri.push(...isi);
}

async function tungguKeadaan(syarat, batasMs = 90000) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    if (catatan.keadaan && catatan.keadaan.t > mulai && syarat(catatan.keadaan)) return catatan.keadaan;
    await tidur(200);
  }
  return catatan.keadaan;
}

async function nilai(s, ekspresi) {
  const t0 = Date.now();
  const r = await s.kirim('Runtime.evaluate', { expression: ekspresi, awaitPromise: true, returnByValue: true });
  log('evaluate', Date.now() - t0, 'ms', ekspresi.slice(0, 50));
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

function hitungMetrik(dari, sampai) {
  const di = (e) => e.t >= dari && e.t <= sampai;
  const interaksi = new Map();
  for (const e of catatan.entri.filter((x) => x.k === 'ev' && di(x))) {
    const lama = interaksi.get(e.id);
    if (!lama || e.d > lama.d) interaksi.set(e.id, e);
  }
  const durasi = [...interaksi.values()].sort((a, b) => b.d - a.d);
  const inp = durasi.length ? durasi[Math.min(Math.floor(durasi.length / 50), durasi.length - 1)] : null;
  const lt = catatan.entri.filter((x) => x.k === 'lt' && di(x)).map((x) => x.d);
  const fr = catatan.entri.filter((x) => x.k === 'fr' && di(x)).map((x) => x.d);
  let cls = 0, sesi = 0, akhir = -Infinity, awalSesi = 0;
  for (const e of catatan.entri.filter((x) => x.k === 'ls' && !x.input && di(x)).sort((a, b) => a.t - b.t)) {
    if (e.t - akhir < 1000 && e.t - awalSesi < 5000) sesi += e.v; else { sesi = e.v; awalSesi = e.t; }
    akhir = e.t; cls = Math.max(cls, sesi);
  }
  return {
    inp: inp ? Math.round(inp.d) : null,
    jumlahInteraksi: durasi.length,
    longTaskTerlama: lt.length ? Math.round(Math.max(...lt)) : 0,
    jumlahLongTask: lt.length,
    totalBlokir: Math.round(lt.reduce((n, d) => n + Math.max(d - 50, 0), 0)),
    frameLambat: fr.length,
    frameTerburuk: fr.length ? Math.round(Math.max(...fr)) : 0,
    cls: Math.round(cls * 1000) / 1000,
  };
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
  return nilai(s, `(() => { const e = document.querySelector(${JSON.stringify(selektor)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
}

async function metrikPerforma(s) {
  const { metrics } = await s.kirim('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { task: m.TaskDuration * 1000, skrip: m.ScriptDuration * 1000, layout: m.LayoutDuration * 1000, gaya: m.RecalcStyleDuration * 1000, jumlahLayout: m.LayoutCount };
}
const selisih = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, Math.round(b[k] - a[k])]));

async function muat(s, { reload = false } = {}) {
  const t0 = Date.now();
  catatan.entri = []; catatan.keadaan = null;
  if (reload) await s.kirim('Page.reload', { ignoreCache: true });
  else await s.kirim('Page.navigate', { url: ASAL + '/?ukur=1' });
  const k = await tungguKeadaan((x) => x.siap, 120000);
  log('muat siap dalam', Date.now() - t0, 'ms', k && k.siap);
  return t0;
}

async function mulaiTrace(s, denganLayar) {
  const kategori = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.timeline.stack', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'blink.user_timing', 'loading', 'latencyInfo', 'devtools.timeline.async', 'blink.console', 'disabled-by-default-layout_shift.debug'];
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
  return path.relative(path.join(__dirname, '..', '..'), berkas).split(path.sep).join('/');
}

// ---------- skenario ----------

async function S0(s, rekam) {
  await muat(s);
  await tidur(3000);
  // Network hanya aktif selama S0; bila aktif terus, buffer respons DevTools ikut membebani pemuatan berikutnya
  await s.kirim('Network.enable', { maxTotalBufferSize: 0, maxResourceBufferSize: 0 });
  const gambar = new Map();
  s.on('Network.requestWillBeSent', (p) => { if (p.request.url.includes('/img/p/')) gambar.set(p.requestId, { mulai: p.timestamp, selesai: null }); });
  s.on('Network.loadingFinished', (p) => { const g = gambar.get(p.requestId); if (g) g.selesai = p.timestamp; });
  if (rekam) await mulaiTrace(s, true);
  const t0 = await muat(s, { reload: true });
  const sisa = 10000 - (Date.now() - t0);
  if (sisa > 0) await tidur(sisa);
  const berkasTrace = rekam ? await hentikanTrace(s, 'S0') : null;
  await tungguKeadaan((k) => k.t > t0 + 11000, 60000);
  const m = hitungMetrik(t0, t0 + 10000);
  const semua = [...gambar.values()];
  const hasil = {
    cls: m.cls,
    longTaskTerlama: m.longTaskTerlama,
    permintaanGambar10dtk: semua.length,
    gambarSelesai10dtk: semua.filter((g) => g.selesai).length,
  };
  if (TUNGGU_GAMBAR_PENUH) {
    const mulaiPertama = Math.min(...semua.map((g) => g.mulai));
    for (let i = 0; i < 600 && [...gambar.values()].some((g) => !g.selesai); i++) await tidur(500);
    const akhir = [...gambar.values()];
    hasil.permintaanGambarTotal = akhir.length;
    hasil.gambarTerakhirSelesaiDtk = Math.round((Math.max(...akhir.map((g) => g.selesai || 0)) - mulaiPertama) * 10) / 10;
  }
  s.off('Network.requestWillBeSent'); s.off('Network.loadingFinished');
  await s.kirim('Network.disable');
  return { hasil, berkasTrace };
}

async function siapkan(s, fn) {
  await muat(s);
  await tidur(3000);
  if (fn) await fn();
  await tidur(800);
}

async function jalankan(s, nama, rekam, badan) {
  const m0 = await metrikPerforma(s);
  if (rekam) await mulaiTrace(s, nama === 'S4');
  const t0 = Date.now();
  const ekstra = await badan();
  const t1 = Date.now();
  await tidur(1500);
  // entri dari halaman bisa terlambat bila main thread sibuk; tunggu laporan yang dibuat setelah skenario selesai
  await tungguKeadaan((k) => k.t > t1 + 1000, 60000);
  const berkasTrace = rekam ? await hentikanTrace(s, nama) : null;
  const perf = selisih(m0, await metrikPerforma(s));
  const m = hitungMetrik(t0, t1);
  return { hasil: { ...m, taskMs: perf.task, skripMs: perf.skrip, layoutMs: perf.layout, gayaMs: perf.gaya, jumlahLayout: perf.jumlahLayout, durasiDtk: Math.round((t1 - t0) / 100) / 10, ...ekstra }, berkasTrace };
}

const keKisi = (s) => async () => {
  await nilai(s, `window.scrollTo(0, document.querySelector('#kisi').getBoundingClientRect().top + scrollY - 90)`);
  await tidur(1500);
};

const SKENARIO = {
  S0,

  S1: async (s, rekam) => {
    await siapkan(s);
    const c = await pusat(s, '#kolom-cari');
    await klik(s, c.x, c.y); await tidur(1500);
    return jalankan(s, 'S1', rekam, async () => {
      for (const h of 'sepatu') { ketik(s, h); await tidur(250); }
      await tungguKeadaan((k) => k.cari === 'sepatu', 30000);
      await tidur(1500);
      for (let i = 0; i < 6; i++) { hapus(s); await tidur(250); }
      await tungguKeadaan((k) => k.cari === '', 30000);
      await tidur(1500);
      return {};
    });
  },

  S2: async (s, rekam) => {
    await siapkan(s, keKisi(s));
    const c = await pusat(s, '#kisi .kartu .tombol-tambah');
    const sebelum = Number(catatan.keadaan.keranjang);
    return jalankan(s, 'S2', rekam, async () => {
      await klik(s, c.x, c.y);
      await tungguKeadaan((k) => Number(k.keranjang) > sebelum, 20000);
      await tidur(1000);
      return { tambahanKeranjang: Number(catatan.keadaan.keranjang) - sebelum };
    });
  },

  S3: async (s, rekam) => {
    await fetch(ASAL + '/api/pesanan', { method: 'DELETE' });
    await siapkan(s, keKisi(s));
    const c = await pusat(s, '#kisi .kartu .tombol-beli');
    return jalankan(s, 'S3', rekam, async () => {
      for (let i = 0; i < 3; i++) { klikTanpaTunggu(s, c.x, c.y); await tidur(150); }
      await tidur(5000);
      const pesanan = await (await fetch(ASAL + '/api/pesanan')).json();
      return { jumlahPesanan: pesanan.length };
    });
  },

  S4: async (s, rekam) => {
    await siapkan(s);
    const tombol = await pusat(s, '#tombol-voucher');
    const cari = await pusat(s, '#kolom-cari');
    return jalankan(s, 'S4', rekam, async () => {
      const mulai = Date.now();
      await klik(s, tombol.x, tombol.y);
      await tidur(300);
      klikTanpaTunggu(s, cari.x, cari.y);
      for (const h of 'sepatu') { await tidur(200); ketik(s, h); }
      // selesai ditandai toast "Voucher ... dipakai"; progres awal bisa tidak pernah tergambar, jadi tidak bisa dipakai sebagai penanda
      const k = await tungguKeadaan((x) => /^Voucher /.test(x.toast || ''), 90000);
      const selesaiPada = k && /^Voucher /.test(k.toast || '') ? k.t : null;
      await tungguKeadaan((x) => x.cari === 'sepatu', 20000);
      await tidur(1500);
      const pg = catatan.entri.filter((e) => e.k === 'pg' && e.t >= mulai);
      return { framePenampilProgres: pg.length, durasiVoucherMs: selesaiPada ? selesaiPada - mulai : null };
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
      await tidur(300);
      return { posisiGulir: catatan.keadaan.y };
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
  const peramban = new Sesi(versi.webSocketDebuggerUrl);
  await peramban.siap;

  // tiap putaran memakai tab baru; renderer yang dipakai ulang untuk banyak navigasi ternyata makin lambat dari putaran ke putaran
  let tabLama = null;
  async function tabBaru() {
    if (tabLama) { tabLama.s.ws.close(); await peramban.kirim('Target.closeTarget', { targetId: tabLama.id }); await tidur(1000); }
    const { targetId } = await peramban.kirim('Target.createTarget', { url: 'about:blank' });
    const s = new Sesi(`ws://127.0.0.1:${PORT_DEBUG}/devtools/page/${targetId}`);
    await s.siap;
    s.on('Runtime.bindingCalled', terimaLaporan);
    for (const d of ['Page', 'Runtime', 'Performance']) await s.kirim(d + '.enable');
    await s.kirim('Runtime.addBinding', { name: '__lapor' });
    await s.kirim('Page.addScriptToEvaluateOnNewDocument', { source: SKRIP_HALAMAN });
    await s.kirim('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
    await s.kirim('Emulation.setCPUThrottlingRate', { rate: CPU });
    await s.kirim('Page.bringToFront');
    tabLama = { s, id: targetId };
    return s;
  }

  // pemuatan pertama menulis data contoh ke localStorage; semua skenario memakai pemuatan sesudahnya (protokol langkah 4)
  await muat(await tabBaru());
  await tidur(3000);

  const laporan = { label, waktu: new Date().toISOString(), chrome: versi.Browser, cpu: os.cpus()[0].model.trim(), inti: os.cpus().length, ramGB: Math.round(os.totalmem() / 2 ** 30), throttlingCPU: CPU + 'x', viewport: '412x915', ulang: ULANG, skenario: {} };
  for (const nama of PILIHAN) {
    const putaran = [];
    for (let i = 0; i < ULANG; i++) {
      const { hasil } = await SKENARIO[nama](await tabBaru(), false);
      putaran.push(hasil);
      console.log(label, nama, 'putaran', i + 1, JSON.stringify(hasil));
    }
    const kunci = Object.keys(putaran[0]).filter((k) => typeof putaran[0][k] === 'number');
    const med = Object.fromEntries(kunci.map((k) => [k, median(putaran.map((p) => p[k]))]));
    laporan.skenario[nama] = { median: med, putaran };
    if (DENGAN_TRACE) {
      const { hasil, berkasTrace } = await SKENARIO[nama](await tabBaru(), true);
      laporan.skenario[nama].trace = berkasTrace;
      laporan.skenario[nama].hasilSaatTrace = hasil;
      console.log(label, nama, 'trace', berkasTrace);
    }
  }

  fs.mkdirSync(DIR_HASIL, { recursive: true });
  const berkas = path.join(DIR_HASIL, label + '.json');
  let lama = {};
  if (fs.existsSync(berkas)) lama = JSON.parse(fs.readFileSync(berkas, 'utf8'));
  laporan.skenario = { ...(lama.skenario || {}), ...laporan.skenario };
  fs.writeFileSync(berkas, JSON.stringify(laporan, null, 2));
  console.log('tersimpan', path.relative(process.cwd(), berkas));

  peramban.ws.close();
  chrome.kill();
  process.exit(0);
}

utama().catch((e) => { console.error(e); process.exit(1); });
