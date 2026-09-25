// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast } from './util.js';

// Flash sale berakhir tengah malam nanti (waktu perangkat).
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

// menulis teks hanya bila nilainya berubah; menulis nilai yang sama tetap membuat layout kotor
function tulis(elemen, teks) {
  if (elemen.textContent !== teks) elemen.textContent = teks;
}

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik'), senti = $('#hm-senti');

  // Angka perseratus detik berganti 100 kali per detik. Bila ditulis dari JavaScript, tiap frame perlu
  // style, layout, dan paint di main thread. Di sini angkanya berupa strip 99 sampai 00 yang digeser
  // animasi CSS steps(100) selama 1 detik (dijalankan compositor), jadi JavaScript cukup bekerja sekali per detik.
  const strip = document.createElement('i');
  strip.className = 'senti-strip';
  strip.textContent = Array.from({ length: 100 }, (_, i) => duaDigit(99 - i)).join('\n');
  senti.replaceChildren(strip);
  senti.setAttribute('aria-hidden', 'true');

  const perbarui = () => {
    const sisa = Math.max(akhir - Date.now(), 0);
    // fase animasi disamakan dengan sisa milidetik pada detik ini, sekali per detik, supaya tidak bergeser
    // dari angka detik (waktu mulai animasi CSS bergantung pada kapan style pertama kali dihitung)
    const animasi = strip.getAnimations()[0];
    if (animasi) animasi.currentTime = 1000 - (sisa % 1000);
    tulis(jam, duaDigit(Math.floor(sisa / 3600000)));
    tulis(menit, duaDigit(Math.floor((sisa % 3600000) / 60000)));
    tulis(detik, duaDigit(Math.floor((sisa % 60000) / 1000)));
    // garis di bawah angka menyusut mengikuti sisa waktu; transform tidak perlu layout
    garis.style.transform = 'scaleX(' + sisa / (akhir - awal + 1) + ')';
    if (sisa > 0) {
      setTimeout(perbarui, (sisa % 1000) + 1); // tepat setelah pergantian detik berikutnya
    } else {
      strip.classList.add('berhenti');
    }
  };
  perbarui();
}

// Teks berjalan digerakkan animasi CSS pada transform, yang dijalankan compositor.
// JavaScript hanya menghitung jarak dan durasi (kecepatan 100 px per detik, sama dengan sebelumnya).
function pasangTeksBerjalan() {
  const teks = $('#berjalan-teks');
  const atur = () => {
    const lebarWadah = teks.parentElement.offsetWidth;
    teks.style.setProperty('--mulai-berjalan', lebarWadah + 'px');
    teks.style.animationDuration = (lebarWadah + teks.offsetWidth) / 100 + 's';
  };
  atur();
  let dijadwalkan = false;
  window.addEventListener('resize', () => {
    if (dijadwalkan) return;
    dijadwalkan = true;
    requestAnimationFrame(() => { dijadwalkan = false; atur(); });
  }, { passive: true });
}

// Tempat banner sudah ada di HTML dengan tinggi yang dicadangkan, jadi isinya datang tanpa menggeser kisi.
async function pasangBannerPromo() {
  const banner = $('#promo-banner');
  let promo;
  try {
    const respons = await fetch('/api/promo');
    if (!respons.ok) throw new Error('status ' + respons.status);
    promo = await respons.json();
  } catch {
    banner.replaceChildren(el('p', 'promo-memuat', 'Info promo belum bisa dimuat. Voucher KILAT1212 tetap bisa dipakai di kolom voucher.'));
    banner.removeAttribute('aria-busy');
    return;
  }

  const teks = el('div');
  teks.append(el('h2', '', promo.judul), el('p', '', promo.isi));
  const tombol = el('button', '', promo.tombol);
  tombol.type = 'button';
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    if (window.Lacak) window.Lacak.kirim('promo_click', { judul: promo.judul });
  });
  banner.replaceChildren(teks, tombol);
  banner.removeAttribute('aria-busy');
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
