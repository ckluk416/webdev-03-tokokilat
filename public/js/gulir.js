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
  const tinggiLayar = window.innerHeight;
  const impresiBaru = [];
  document.querySelectorAll('.kartu').forEach((kartu) => {
    const kotak = kartu.getBoundingClientRect();
    const masukLayar = kotak.top < tinggiLayar + 80 && kotak.bottom > -80;
    if (masukLayar && !kartu.classList.contains('terlihat')) {
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

export function pasangGulir() {
  window.addEventListener('scroll', periksaGulir);
  window.addEventListener('resize', periksaGulir);

  // Cegah "pull to refresh" tak sengaja di Android ketika pengguna sedang di puncak halaman.
  let yAwal = 0;
  const utama = $('#utama');
  utama.addEventListener('touchstart', (e) => { yAwal = e.touches[0].clientY; }, { passive: false });
  utama.addEventListener('touchmove', (e) => {
    const menarikKeBawah = e.touches[0].clientY > yAwal;
    if (window.scrollY === 0 && menarikKeBawah) e.preventDefault();
    periksaGulir();
  }, { passive: false });
  utama.addEventListener('wheel', () => { periksaGulir(); }, { passive: false });

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}
