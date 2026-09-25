// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';

const sudahTercatat = new Set();
const impresiTertunda = [];
let pengaturWaktuImpresi = null;

// Impresi dikumpulkan lalu dikirim paling sering sekali per 5 detik. Satu panggilan SDK di ponsel lambat bisa
// mendekati 100 ms (hash fingerprint di SDK), jadi makin jarang dipanggil, makin sedikit long task saat menggulir.
const JEDA_IMPRESI_MS = 5000;
function kirimImpresi() {
  pengaturWaktuImpresi = null;
  if (impresiTertunda.length && window.Lacak) window.Lacak.kirim('impression', { produk: impresiTertunda.splice(0) });
}
// impresi yang belum terkirim tetap dikirim saat halaman ditinggalkan
window.addEventListener('pagehide', kirimImpresi);

// Kartu yang masuk layar (dengan margin 80 px) dimunculkan dan dicatat sebagai impresi.
// IntersectionObserver menghitung perpotongan di luar task gulir, tanpa getBoundingClientRect per kartu.
const pengamatKartu = new IntersectionObserver((entri) => {
  for (const e of entri) {
    const kartu = e.target;
    // penanda di-layar dipakai CSS untuk menjeda animasi lencana kilat di kartu yang sedang tidak terlihat
    kartu.classList.toggle('di-layar', e.isIntersecting);
    if (!e.isIntersecting) continue;
    kartu.classList.add('terlihat');
    if (!sudahTercatat.has(kartu.dataset.id)) {
      sudahTercatat.add(kartu.dataset.id);
      impresiTertunda.push(kartu.dataset.id);
    }
    // kartu tanpa lencana kilat tidak perlu diamati lagi: IntersectionObserver menghitung ulang semua target di setiap frame
    if (!kartu.querySelector('.lencana-kilat')) pengamatKartu.unobserve(kartu);
  }
  if (impresiTertunda.length && !pengaturWaktuImpresi) pengaturWaktuImpresi = setTimeout(kirimImpresi, JEDA_IMPRESI_MS);
}, { rootMargin: '80px 0px' });

export function amatiKartu(kartu) {
  pengamatKartu.observe(kartu);
}

let tinggiGulir = 0;
let perluUkur = true;
let dijadwalkan = false;

function perbaruiTampilan() {
  dijadwalkan = false;
  // dibaca paling banyak sekali per frame, dan hanya bila ukuran dokumen mungkin berubah
  if (perluUkur) {
    tinggiGulir = document.documentElement.scrollHeight - window.innerHeight;
    perluUkur = false;
  }
  const y = window.scrollY;
  $('#kepala').classList.toggle('melayang', y > 8);
  $('#ke-atas').hidden = y < 900;
  $('#bar-gulir').style.transform = 'scaleX(' + (tinggiGulir > 0 ? Math.min(y / tinggiGulir, 1) : 0) + ')';
}

// Dipanggil saat gulir, saat ukuran berubah, dan setelah kisi dirender. Pekerjaan digabung per frame.
export function periksaGulir() {
  if (dijadwalkan) return;
  dijadwalkan = true;
  requestAnimationFrame(perbaruiTampilan);
}

export function pasangGulir() {
  window.addEventListener('scroll', periksaGulir, { passive: true });
  window.addEventListener('resize', () => { perluUkur = true; periksaGulir(); }, { passive: true });
  // tinggi dokumen berubah saat kisi atau banner bertambah; ResizeObserver memberi tahu setelah layout selesai
  new ResizeObserver(() => { perluUkur = true; periksaGulir(); }).observe(document.body);

  // Pull to refresh tak sengaja di Android dicegah dengan overscroll-behavior di CSS, bukan dengan
  // listener touchmove non-passive yang membuat compositor menunggu main thread di setiap guliran.

  // tombol ini disembunyikan begitu halaman kembali ke atas; fokus dipindah ke logo supaya tidak hilang ke body
  $('#ke-atas').addEventListener('click', () => {
    window.scrollTo({ top: 0 });
    $('.merek-toko').focus({ preventScroll: true });
  });
}
