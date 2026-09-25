// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';

const sudahTercatat = new Set();

export function periksaGulir() {
  const kepala = $('#kepala');
  const bar = $('#bar-gulir');
  const keAtas = $('#ke-atas');

  const y = window.scrollY;
  kepala.classList.toggle('melayang', y > 8);
  keAtas.hidden = y < 900;

  const tinggiDokumen = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = (tinggiDokumen > 0 ? (y / tinggiDokumen) * 100 : 0) + '%';

  // Kartu yang masuk layar dimunculkan dengan animasi, dan dicatat sebagai impresi.
  // Kartu yang sudah pernah "terlihat" tidak perlu diukur lagi tiap event
  // scroll -- dengan ribuan kartu di katalog, mengukur ulang semuanya di
  // setiap event scroll (termasuk yang sudah pasti tampil) memaksa reflow
  // berkali-kali per detik dan bikin scroll patah-patah.
  const tinggiLayar = window.innerHeight;
  const impresiBaru = [];
  document.querySelectorAll('.kartu:not(.terlihat)').forEach((kartu) => {
    const kotak = kartu.getBoundingClientRect();
    const masukLayar = kotak.top < tinggiLayar + 80 && kotak.bottom > -80;
    if (masukLayar) {
      kartu.classList.add('terlihat');
      kartu.style.minHeight = Math.round(kotak.height) + 'px'; // cegah kartu "mengempis" saat animasi
    }
    if (masukLayar && !sudahTercatat.has(kartu.dataset.id)) {
      sudahTercatat.add(kartu.dataset.id);
      impresiBaru.push(kartu.dataset.id);
    }
  });

  if (impresiBaru.length && window.Lacak) window.Lacak.kirim('impression', { produk: impresiBaru });
}

// periksaGulir() melakukan querySelectorAll + getBoundingClientRect, yang
// memaksa reflow. Peristiwa scroll/wheel bisa menembak puluhan kali per
// detik, jauh lebih sering daripada frame layar (~60fps) -- menjalankan
// periksaGulir() di tiap peristiwa itulah yang bikin scroll patah-patah.
// Di sini kita kumpulkan jadi maksimal sekali per frame lewat requestAnimationFrame.
function jadwalkanPeriksaGulir() {
  if (jadwalkanPeriksaGulir.terjadwal) return;
  jadwalkanPeriksaGulir.terjadwal = true;
  requestAnimationFrame(() => {
    jadwalkanPeriksaGulir.terjadwal = false;
    periksaGulir();
  });
}

export function pasangGulir() {
  window.addEventListener('scroll', jadwalkanPeriksaGulir, { passive: true });
  window.addEventListener('resize', jadwalkanPeriksaGulir, { passive: true });

  // Cegah "pull to refresh" tak sengaja di Android ketika pengguna sedang di puncak halaman.
  let yAwal = 0;
  const utama = $('#utama');
  utama.addEventListener('touchstart', (e) => { yAwal = e.touches[0].clientY; }, { passive: false });
  utama.addEventListener('touchmove', (e) => {
    const menarikKeBawah = e.touches[0].clientY > yAwal;
    if (window.scrollY === 0 && menarikKeBawah) e.preventDefault();
    jadwalkanPeriksaGulir();
  }, { passive: false });
  // Listener ini tidak pernah memanggil preventDefault, jadi harus passive
  // supaya browser bisa langsung menggulir di compositor thread tanpa
  // menunggu JS selesai jalan dulu (penyebab utama gulir terasa patah-patah).
  utama.addEventListener('wheel', () => { jadwalkanPeriksaGulir(); }, { passive: true });

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}
