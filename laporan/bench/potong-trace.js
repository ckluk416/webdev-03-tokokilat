// Memotong berkas trace ke satu rentang waktu (ms relatif terhadap task pertama main thread), supaya panel Performance
// langsung menampilkan bagian yang dibahas. Event metadata (nama proses/thread) dan sampel profiler tetap disertakan.
// Pakai: node laporan/bench/potong-trace.js <masuk.json.gz> <keluar.json.gz> <mulaiMs> <selesaiMs>

const fs = require('fs');
const zlib = require('zlib');

const [masuk, keluar, mulaiMs, selesaiMs] = process.argv.slice(2);
const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(masuk)).toString('utf8'));
const ev = data.traceEvents;
const namaThread = new Map(ev.filter((e) => e.name === 'thread_name').map((e) => [e.pid + ':' + e.tid, e.args.name]));
const utama = ev.filter((e) => e.name === 'RunTask' && namaThread.get(e.pid + ':' + e.tid) === 'CrRendererMain');
const nol = Math.min(...utama.map((e) => e.ts));
const dari = nol + Number(mulaiMs) * 1000;
const sampai = nol + Number(selesaiMs) * 1000;

const tetap = (e) => e.ph === 'M' || e.name === 'TracingStartedInBrowser' || e.name === 'Profile' || e.name === 'ProfileChunk' || e.name === 'TracingSessionIdForRenderer' || e.name === 'SetLayerTreeId';
const dalam = (e) => e.ts >= dari && e.ts + (e.dur || 0) <= sampai;
const hasil = ev.filter((e) => tetap(e) || dalam(e));
fs.writeFileSync(keluar, zlib.gzipSync(JSON.stringify({ ...data, traceEvents: hasil })));
console.log(keluar, hasil.length, 'event dari', ev.length);
