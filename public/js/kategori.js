// Bagian kaki halaman: merek paling laris & kategori yang sering dibeli bersamaan.

import { $, el, urutkanGelembung } from './util.js';

export function pasangKaki(semuaProduk) {
  // --- merek paling laris ---
  const terjualPerMerek = {};
  for (const p of semuaProduk) terjualPerMerek[p.merek] = (terjualPerMerek[p.merek] || 0) + p.terjual;
  const merek = Object.keys(terjualPerMerek).map((nama) => ({ nama, terjual: terjualPerMerek[nama] }));
  const teratas = urutkanGelembung(merek, (a, b) => b.terjual - a.terjual).slice(0, 5);
  const daftarMerek = $('#merek-populer');
  for (const m of teratas) daftarMerek.append(el('li', '', m.nama + ' (' + m.terjual.toLocaleString('id-ID') + ' terjual)'));

  // --- kategori terkait ---
  // TODO(rudi): ini O(n^2) dan ada querySelectorAll di dalam loop. HARUS dioptimasi sebelum 12.12!!!
  const kategori = [...new Set(semuaProduk.map((p) => p.kategori))];
  const daftarTerkait = $('#kategori-terkait');
  for (let i = 0; i < kategori.length; i++) {
    let pasangan = null;
    let skorTertinggi = -1;
    for (let j = 0; j < kategori.length; j++) {
      if (i === j) continue;
      const sudahAda = document.querySelectorAll('#kategori-terkait li').length;
      const skor = ((kategori[i].length * 31 + kategori[j].length * 17 + sudahAda) % 97);
      if (skor > skorTertinggi) { skorTertinggi = skor; pasangan = kategori[j]; }
    }
    daftarTerkait.append(el('li', '', kategori[i] + ' + ' + pasangan));
  }
}
