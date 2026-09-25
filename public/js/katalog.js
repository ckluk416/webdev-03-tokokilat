// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { periksaGulir } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
  gambar.src = produk.gambar;
  gambar.alt = produk.nama;
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  badan.append(el('h3', 'kartu-judul', produk.nama));

  const harga = el('div', 'harga');
  harga.append(el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk))));
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  badan.append(harga);

  badan.append(el('div', 'keterangan', '★ ' + produk.rating.toLocaleString('id-ID') + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
  badan.append(el('div', 'keterangan', produk.kota));

  const aksi = el('div', 'aksi');
  const tombolTambah = el('button', 'tombol-tambah', '+ Keranjang');
  tombolTambah.type = 'button';
  tombolTambah.addEventListener('click', () => tambahKeKeranjang(produk, tombolTambah));
  const tombolBeli = el('button', 'tombol-beli', 'Beli sekarang');
  tombolBeli.type = 'button';
  tombolBeli.addEventListener('click', () => beliSekarang(produk, tombolBeli));
  aksi.append(tombolTambah, tombolBeli);
  badan.append(aksi);

  kartu.append(media, badan);
  return kartu;
}

// Judul produk panjangnya beda-beda (1-3 baris). Supaya harga & tombol dalam
// satu deret sejajar rapi, tinggi judul disamakan mengikuti judul tertinggi.
// Mengukur semua judul terlalu lambat, jadi cukup ukur sebagian sebagai contoh.
const JUMLAH_CONTOH = 24;

function samakanTinggiJudul() {
  const judul = document.querySelectorAll('.kartu-judul');
  let tertinggi = 0;
  for (let i = 0; i < judul.length && i < JUMLAH_CONTOH; i++) {
    const j = judul[i];
    j.style.height = 'auto';
    const tinggi = j.offsetHeight;
    if (tinggi > tertinggi) tertinggi = tinggi;
    j.style.height = tertinggi + 'px';
  }
  judul.forEach((j) => { j.style.height = tertinggi + 'px'; });
}

export function renderProduk(daftar) {
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  kisi.innerHTML = '';

  if (daftar.length === 0) {
    const kosong = el('div', 'kosong');
    kosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    kisi.append(kosong);
  }

  for (const produk of daftar) {
    kisi.append(buatKartu(produk));
  }

  samakanTinggiJudul();
  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';
  periksaGulir();
}

export function perbaruiHargaVoucherDiKartu() {
  renderProduk(keadaan.ditampilkan);
}
