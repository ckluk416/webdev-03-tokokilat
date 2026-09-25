// Meringkas berkas trace (.json atau .json.gz dari panel Performance / ukur-cdp.js) menjadi angka yang dikutip di laporan:
// waktu sibuk main thread, long task terpanjang beserta isinya, total per jenis event, fungsi JavaScript terberat,
// dan jumlah layout paksa (Layout yang terjadi di dalam pemanggilan JavaScript).
// Pakai: node laporan/bench/ringkas-trace.js laporan/trace/sebelum-1x-s2.json.gz [lebih banyak berkas...]

const fs = require('fs');
const zlib = require('zlib');

function baca(berkas) {
  let data = fs.readFileSync(berkas);
  if (berkas.endsWith('.gz')) data = zlib.gunzipSync(data);
  const json = JSON.parse(data.toString('utf8'));
  return Array.isArray(json) ? json : json.traceEvents;
}

function ringkas(berkas) {
  const ev = baca(berkas);
  const namaThread = new Map();
  for (const e of ev) if (e.name === 'thread_name') namaThread.set(e.pid + ':' + e.tid, e.args.name);
  // renderer halaman: CrRendererMain dengan event terbanyak
  const hitung = new Map();
  for (const e of ev) {
    const k = e.pid + ':' + e.tid;
    if (namaThread.get(k) === 'CrRendererMain') hitung.set(k, (hitung.get(k) || 0) + 1);
  }
  const utama = [...hitung.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const di = ev.filter((e) => e.pid + ':' + e.tid === utama && e.ph === 'X' && e.dur);
  const task = di.filter((e) => e.name === 'RunTask').sort((a, b) => a.ts - b.ts);
  const awal = task.length ? task[0].ts : 0;
  const akhir = task.length ? task[task.length - 1].ts + task[task.length - 1].dur : 0;
  const sibuk = task.reduce((n, e) => n + e.dur, 0) / 1000;

  const perJenis = {};
  for (const e of di) if (e.name !== 'RunTask') perJenis[e.name] = (perJenis[e.name] || 0) + e.dur / 1000;

  // FunctionCall membawa nama fungsi dan lokasi berkas
  const perFungsi = {};
  for (const e of di.filter((x) => x.name === 'FunctionCall' && x.args && x.args.data)) {
    const d = e.args.data;
    const k = (d.functionName || '(anonim)') + ' ' + String(d.url || '').split('/').pop() + ':' + (d.lineNumber + 1);
    perFungsi[k] = perFungsi[k] || { kali: 0, ms: 0 };
    perFungsi[k].kali++; perFungsi[k].ms += e.dur / 1000;
  }

  // Layout di dalam FunctionCall/EventDispatch/TimerFire = layout sinkron yang dipaksa JavaScript
  const js = di.filter((x) => x.name === 'FunctionCall' || x.name === 'EventDispatch' || x.name === 'TimerFire' || x.name === 'FireAnimationFrame' || x.name === 'v8.callFunction');
  const layout = di.filter((x) => x.name === 'Layout');
  let layoutPaksa = 0, layoutPaksaMs = 0;
  for (const l of layout) {
    if (js.some((j) => l.ts >= j.ts && l.ts + l.dur <= j.ts + j.dur)) { layoutPaksa++; layoutPaksaMs += l.dur / 1000; }
  }

  const panjang = task.filter((t) => t.dur > 50000).sort((a, b) => b.dur - a.dur);
  const isiTask = (t) => di
    .filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.name !== 'RunTask')
    .sort((a, b) => b.dur - a.dur).slice(0, 5)
    .map((e) => e.name + (e.args && e.args.data && e.args.data.functionName ? '(' + e.args.data.functionName + ')' : '') + ' ' + Math.round(e.dur / 1000) + 'ms');

  // sampel CPU profiler: waktu self dan total per fungsi (setara tab Bottom-up dan Call tree)
  const simpul = new Map();
  const sampel = [];
  for (const e of ev.filter((x) => (x.name === 'ProfileChunk') && x.pid + ':' + x.tid === utama.split(':')[0] + ':' + x.tid && x.args && x.args.data)) {
    const d = e.args.data;
    const profil = d.cpuProfile || {};
    for (const n of profil.nodes || []) simpul.set(n.id, n);
    const deltas = d.timeDeltas || [];
    (profil.samples || []).forEach((id, i) => sampel.push({ id, dt: deltas[i] || 0 }));
  }
  const selfMs = {}, totalMs = {};
  const namaSimpul = (n) => {
    const c = n.callFrame || {};
    const berkasJs = String(c.url || '').split('/').pop();
    return (c.functionName || '(anonim)') + (berkasJs ? ' ' + berkasJs + ':' + (c.lineNumber + 1) : '');
  };
  // durasi sampel = selisih waktu ke sampel berikutnya
  for (let i = 0; i < sampel.length - 1; i++) {
    const ms = sampel[i + 1].dt / 1000;
    let n = simpul.get(sampel[i].id);
    if (!n) continue;
    const self = namaSimpul(n);
    selfMs[self] = (selfMs[self] || 0) + ms;
    const dilihat = new Set();
    while (n) {
      const k = namaSimpul(n);
      if (!dilihat.has(k)) { totalMs[k] = (totalMs[k] || 0) + ms; dilihat.add(k); }
      n = n.parent ? simpul.get(n.parent) : null;
    }
  }
  const milikHalaman = (k) => /\.js:\d+$/.test(k) && !/ukur-cdp|:\d+$/.test(k.replace(/ \S+\.js:\d+$/, ''));
  const teratas = (obj) => Object.entries(obj).filter(([k]) => milikHalaman(k) || /^\((garbage|program)/.test(k))
    .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' ' + Math.round(v) + 'ms');

  return {
    berkas,
    profilerSelf: teratas(selfMs),
    profilerTotal: teratas(totalMs),
    rentangMs: Math.round((akhir - awal) / 1000),
    sibukMs: Math.round(sibuk),
    persenSibuk: Math.round((sibuk / ((akhir - awal) / 1000 || 1)) * 100),
    jumlahTask: task.length,
    longTask: panjang.length,
    longTaskTerpanjang: panjang.slice(0, 3).map((t) => ({ ms: Math.round(t.dur / 1000), pada: Math.round((t.ts - awal) / 1000), isi: isiTask(t) })),
    perJenisMs: Object.fromEntries(Object.entries(perJenis).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, Math.round(v)])),
    fungsiTerberat: Object.entries(perFungsi).sort((a, b) => b[1].ms - a[1].ms).slice(0, 8).map(([k, v]) => k + ' x' + v.kali + ' ' + Math.round(v.ms) + 'ms'),
    layout: layout.length,
    layoutPaksa,
    layoutPaksaMs: Math.round(layoutPaksaMs),
  };
}

for (const b of process.argv.slice(2)) console.log(JSON.stringify(ringkas(b), null, 1));
