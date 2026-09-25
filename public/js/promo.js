// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast } from './util.js';

// Flash sale berakhir tengah malam nanti (waktu perangkat).
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

// Sebelumnya kedua fungsi di bawah pakai setInterval(fn, 10) -- jalan 100x
// per detik selama-lamanya, tiap kali menulis textContent/style DAN membaca
// offsetWidth (memaksa reflow), walau pengguna cuma diam melihat-lihat.
// Itu yang bikin HP cepat panas dan baterai boros. Sekarang dipindah ke
// requestAnimationFrame (nyala mengikuti kecepatan layar, otomatis berhenti
// saat tab tidak aktif) dan lebar elemen dibaca sekali saja lalu disimpan,
// bukan dibaca ulang di setiap tick.

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const wadah = $('#hitung-mundur');
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik'), senti = $('#hm-senti');

  let lebarPenuh = wadah.offsetWidth;
  window.addEventListener('resize', () => { lebarPenuh = wadah.offsetWidth; });

  function perbarui() {
    const sisa = Math.max(akhir - Date.now(), 0);
    jam.textContent = duaDigit(Math.floor(sisa / 3600000));
    menit.textContent = duaDigit(Math.floor((sisa % 3600000) / 60000));
    detik.textContent = duaDigit(Math.floor((sisa % 60000) / 1000));
    senti.textContent = duaDigit(Math.floor((sisa % 1000) / 10));

    // garis di bawah angka menyusut mengikuti sisa waktu
    garis.style.width = Math.round(lebarPenuh * (sisa / (akhir - awal + 1))) + 'px';

    if (sisa > 0) requestAnimationFrame(perbarui);
  }
  requestAnimationFrame(perbarui);
}

function pasangTeksBerjalan() {
  const teks = $('#berjalan-teks');
  let lebarWadah = teks.parentElement.offsetWidth;
  let lebarTeks = teks.offsetWidth;
  window.addEventListener('resize', () => {
    lebarWadah = teks.parentElement.offsetWidth;
    lebarTeks = teks.offsetWidth;
  });

  let x = lebarWadah;
  function perbarui() {
    x -= 1;
    if (x < -lebarTeks) x = lebarWadah;
    teks.style.left = x + 'px';
    requestAnimationFrame(perbarui);
  }
  requestAnimationFrame(perbarui);
}

async function pasangBannerPromo() {
  const respons = await fetch('/api/promo');
  const promo = await respons.json();

  const banner = el('section', 'promo-banner');
  const teks = el('div');
  teks.append(el('h2', '', promo.judul), el('p', '', promo.isi));
  const tombol = el('button', '', promo.tombol);
  tombol.type = 'button';
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    if (window.Lacak) window.Lacak.kirim('promo_click', { judul: promo.judul });
  });
  banner.append(teks, tombol);

  $('#utama').prepend(banner);
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
