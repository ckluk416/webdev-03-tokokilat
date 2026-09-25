// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';

const sudahTercatat = new Set();
const impresiTertunda = [];
let pengaturWaktuImpresi = null;

// impresi dikumpulkan lalu dikirim paling sering sekali per detik; tiap panggilan SDK punya biaya tetap
function kirimImpresi() {
  pengaturWaktuImpresi = null;
  if (impresiTertunda.length && window.Lacak) window.Lacak.kirim('impression', { produk: impresiTertunda.splice(0) });
}

// Kartu yang masuk layar (dengan margin 80 px) dimunculkan dan dicatat sebagai impresi.
// IntersectionObserver menghitung perpotongan di luar task gulir, tanpa getBoundingClientRect per kartu.
const pengamatKartu = new IntersectionObserver((entri) => {
  for (const e of entri) {
    if (!e.isIntersecting) continue;
    const kartu = e.target;
    kartu.classList.add('terlihat');
    if (!sudahTercatat.has(kartu.dataset.id)) {
      sudahTercatat.add(kartu.dataset.id);
      impresiTertunda.push(kartu.dataset.id);
    }
  }
  if (impresiTertunda.length && !pengaturWaktuImpresi) pengaturWaktuImpresi = setTimeout(kirimImpresi, 1000);
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

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}
