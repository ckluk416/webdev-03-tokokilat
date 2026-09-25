// Pencarian, saringan kategori, dan pengurutan.

import { $, el, hargaSetelahDiskon, setelahFrame } from './util.js';
import { keadaan, renderProduk } from './katalog.js';

const saringan = { kata: '', kategori: 'Semua', urut: 'relevan' };
const JEDA_KETIK_MS = 150;

// "Sepatu Lari" == "sepatu  lari" == "SEPATU-LARI"
function normalkan(teks) {
  return teks
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// teks yang dicari dinormalkan sekali per produk, bukan di setiap ketikan
const teksCari = new WeakMap();
function cocok(produk, kunci) {
  let teks = teksCari.get(produk);
  if (teks === undefined) {
    teks = normalkan(produk.nama + ' ' + produk.merek + ' ' + produk.kategori + ' ' + produk.kota);
    teksCari.set(produk, teks);
  }
  return kunci.split(' ').every((k) => teks.includes(k));
}

const PEMBANDING = {
  murah: (a, b) => hargaSetelahDiskon(a) - hargaSetelahDiskon(b),
  mahal: (a, b) => hargaSetelahDiskon(b) - hargaSetelahDiskon(a),
  laris: (a, b) => b.terjual - a.terjual,
  rating: (a, b) => b.rating - a.rating || b.terjual - a.terjual,
};

let kunciTerkirim = '';

export function terapkanSaringan() {
  const kunci = normalkan(saringan.kata);
  let hasil = keadaan.semuaProduk.filter((p) => {
    if (saringan.kategori !== 'Semua' && p.kategori !== saringan.kategori) return false;
    if (kunci && !cocok(p, kunci)) return false;
    return true;
  });
  if (PEMBANDING[saringan.urut]) hasil = hasil.slice().sort(PEMBANDING[saringan.urut]);
  renderProduk(hasil);

  // satu event per kata kunci yang sudah stabil, dikirim setelah hasil tergambar
  if (window.Lacak && kunci && kunci !== kunciTerkirim) {
    kunciTerkirim = kunci;
    const kata = saringan.kata;
    const jumlah = hasil.length;
    setelahFrame(() => window.Lacak.kirim('search', { kata, jumlah }));
  }
}

export function pasangPencarian() {
  const kolom = $('#kolom-cari');
  // Huruf tetap tampil seketika (dikerjakan browser). Penyaringan menunggu jeda ketik, supaya
  // huruf yang segera tertimpa huruf berikutnya tidak memicu render sendiri-sendiri.
  let pengaturWaktu;
  kolom.addEventListener('input', () => {
    clearTimeout(pengaturWaktu);
    pengaturWaktu = setTimeout(() => {
      saringan.kata = kolom.value;
      terapkanSaringan();
    }, JEDA_KETIK_MS);
  });

  $('#pilih-urut').addEventListener('change', (e) => {
    saringan.urut = e.target.value;
    terapkanSaringan();
  });

  const wadah = $('#keping-kategori');
  const kategori = ['Semua', ...new Set(keadaan.semuaProduk.map((p) => p.kategori))];
  for (const nama of kategori) {
    const keping = el('button', 'keping', nama);
    keping.type = 'button';
    keping.setAttribute('aria-pressed', String(nama === 'Semua'));
    keping.addEventListener('click', () => {
      saringan.kategori = nama;
      wadah.querySelectorAll('.keping').forEach((k) => k.setAttribute('aria-pressed', String(k === keping)));
      terapkanSaringan();
    });
    wadah.append(keping);
  }
}
