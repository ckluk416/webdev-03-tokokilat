/**
 * ALAT UKUR (bukan bagian dari aplikasi; tidak perlu "diperbaiki").
 * Aktif dengan membuka http://localhost:3000/?ukur=1
 *
 * Menampilkan ringkasan: long task, perkiraan INP, CLS, dan frame lambat.
 * Angka di sini untuk memantau cepat. BUKTI diagnosis tetap harus dari
 * panel Performance di DevTools (flame chart), bukan dari panel ini.
 */
(() => {
  const data = {
    longTask: [],            // durasi (ms)
    interaksi: new Map(),    // interactionId -> { durasi, jenis, target }
    cls: 0, clsSesi: 0, clsTerakhir: 0, clsAwalSesi: 0,
    frameLambat: 0, frameTerburuk: 0,
  };

  const dukung = (jenis) => (PerformanceObserver.supportedEntryTypes || []).includes(jenis);

  if (dukung('longtask')) {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => data.longTask.push(Math.round(e.duration))))
      .observe({ type: 'longtask', buffered: true });
  }

  if (dukung('event')) {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.interactionId) continue;
        const lama = data.interaksi.get(e.interactionId);
        if (!lama || e.duration > lama.durasi) {
          const t = e.target;
          data.interaksi.set(e.interactionId, {
            durasi: Math.round(e.duration),
            jenis: e.name,
            target: t ? (t.id ? '#' + t.id : t.className ? '.' + String(t.className).split(' ')[0] : t.tagName.toLowerCase()) : '?',
            tundaInput: Math.round(e.processingStart - e.startTime),
            proses: Math.round(e.processingEnd - e.processingStart),
            presentasi: Math.round(e.startTime + e.duration - e.processingEnd),
          });
        }
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  }

  if (dukung('layout-shift')) {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        // jendela sesi: jeda < 1 dtk, panjang maks 5 dtk (definisi CLS)
        if (e.startTime - data.clsTerakhir < 1000 && e.startTime - data.clsAwalSesi < 5000) data.clsSesi += e.value;
        else { data.clsSesi = e.value; data.clsAwalSesi = e.startTime; }
        data.clsTerakhir = e.startTime;
        if (data.clsSesi > data.cls) data.cls = data.clsSesi;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }

  let tSebelum = performance.now();
  const pantauFrame = (t) => {
    const selisih = t - tSebelum;
    tSebelum = t;
    if (selisih > 50) { data.frameLambat++; if (selisih > data.frameTerburuk) data.frameTerburuk = Math.round(selisih); }
    requestAnimationFrame(pantauFrame);
  };
  requestAnimationFrame(pantauFrame);

  function ringkas() {
    const durasi = [...data.interaksi.values()].sort((a, b) => b.durasi - a.durasi);
    // INP ~ interaksi terburuk (abaikan 1 terburuk per 50 interaksi)
    const inp = durasi.length ? durasi[Math.min(Math.floor(durasi.length / 50), durasi.length - 1)] : null;
    return {
      waktu: new Date().toISOString(),
      jumlahLongTask: data.longTask.length,
      longTaskTerlama: data.longTask.length ? Math.max(...data.longTask) : 0,
      totalBlokir: data.longTask.reduce((n, d) => n + Math.max(d - 50, 0), 0),
      jumlahInteraksi: durasi.length,
      inp: inp ? inp.durasi : null,
      inpRinci: inp,
      limaInteraksiTerlambat: durasi.slice(0, 5),
      cls: Math.round(data.cls * 1000) / 1000,
      frameLambat: data.frameLambat,
      frameTerburuk: data.frameTerburuk,
    };
  }

  // ---------- tampilan ----------
  const panel = document.createElement('div');
  panel.id = 'alat-ukur';
  panel.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9999;width:268px;max-width:calc(100vw - 20px);padding:10px 12px;border-radius:10px;background:rgba(20,18,43,.94);color:#fff;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;contain:layout paint;';
  panel.innerHTML = '<div id="au-isi"></div><div style="display:flex;gap:6px;margin-top:8px"><button id="au-salin" type="button">Salin JSON</button><button id="au-reset" type="button">Reset</button><button id="au-kecil" type="button">Kecilkan</button></div>';
  let kecil = window.innerWidth < 600; // di layar sempit mulai dalam keadaan kecil
  document.body.append(panel);
  panel.querySelectorAll('button').forEach((b) => { b.style.cssText = 'flex:1;border:0;border-radius:6px;padding:5px;background:#ffd400;color:#14122b;font:inherit;font-weight:700;cursor:pointer'; });

  const warna = (nilai, baik, buruk) => (nilai == null ? '#aaa' : nilai <= baik ? '#5ee0a0' : nilai <= buruk ? '#ffd400' : '#ff6b81');
  const isi = panel.querySelector('#au-isi');
  function gambar() {
    const r = ringkas();
    panel.querySelector('#au-salin').style.display = panel.querySelector('#au-reset').style.display = kecil ? 'none' : '';
    panel.querySelector('#au-kecil').textContent = kecil ? 'Buka alat ukur' : 'Kecilkan';
    if (kecil) {
      isi.innerHTML = `INP <span style="color:${warna(r.inp, 200, 500)}">${r.inp ?? '-'}</span> | CLS <span style="color:${warna(r.cls, 0.1, 0.25)}">${r.cls}</span> | LT <span style="color:${warna(r.longTaskTerlama, 100, 300)}">${r.longTaskTerlama}</span>`;
      return;
    }
    isi.innerHTML =
      `<b>Alat ukur TokoKilat</b><br>` +
      `INP&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <span style="color:${warna(r.inp, 200, 500)}">${r.inp ?? '-'} ms</span> (${r.jumlahInteraksi} interaksi)<br>` +
      `CLS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <span style="color:${warna(r.cls, 0.1, 0.25)}">${r.cls}</span><br>` +
      `Long task : ${r.jumlahLongTask}x, terlama <span style="color:${warna(r.longTaskTerlama, 100, 300)}">${r.longTaskTerlama} ms</span><br>` +
      `Blokir&nbsp;&nbsp;&nbsp;&nbsp;: ${r.totalBlokir} ms total<br>` +
      `Frame &gt;50ms: ${r.frameLambat}x, terburuk ${r.frameTerburuk} ms`;
  }
  setInterval(gambar, 1000);
  gambar();

  panel.querySelector('#au-salin').addEventListener('click', async () => {
    const teks = JSON.stringify(ringkas(), null, 2);
    try { await navigator.clipboard.writeText(teks); } catch { /* abaikan */ }
    console.log('[alat ukur]\n' + teks);
  });
  panel.querySelector('#au-kecil').addEventListener('click', () => { kecil = !kecil; gambar(); });
  panel.querySelector('#au-reset').addEventListener('click', () => {
    data.longTask.length = 0; data.interaksi.clear();
    data.cls = data.clsSesi = 0; data.frameLambat = data.frameTerburuk = 0;
    gambar();
  });

  window.AlatUkur = { ringkas };
})();
