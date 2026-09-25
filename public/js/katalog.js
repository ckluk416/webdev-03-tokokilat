// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { amatiKartu, periksaGulir } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

// Kartu dirender bertahap: potongan pertama langsung, sisanya saat sentinel di ujung kisi mendekati layar.
const UKURAN_POTONGAN = 16;
let jumlahDirender = 0;

// Elemen kartu disimpan per id dan dipakai ulang antar-render, sehingga <img> tidak dibuat (dan diunduh) ulang.
const simpananKartu = new Map(); // id produk -> { kartu, harga, produk }

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

function isiHarga(harga, produk) {
  const kini = el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk)));
  harga.replaceChildren(kini);
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  harga.dataset.voucher = hargaVoucher || '';
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
  // hanya gambar yang mendekati layar yang diminta; sisanya menunggu digulir.
  // loading harus diisi sebelum src: begitu src diisi, browser langsung memutuskan cara memuat gambar itu.
  gambar.loading = 'lazy';
  gambar.decoding = 'async';
  // ukuran intrinsik gambar dari CDN (480 x 480): browser mencadangkan ruang persegi sebelum gambar tiba
  gambar.width = 480;
  gambar.height = 480;
  gambar.alt = produk.nama;
  gambar.src = produk.gambar;
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  badan.append(el('h3', 'kartu-judul', produk.nama));

  const harga = el('div', 'harga');
  isiHarga(harga, produk);
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
  simpananKartu.set(produk.id, { kartu, harga, produk });
  amatiKartu(kartu);
  return kartu;
}

function ambilKartu(produk) {
  const tersimpan = simpananKartu.get(produk.id);
  if (!tersimpan) return buatKartu(produk);
  const voucher = String(keadaan.hargaVoucher.get(produk.id) || '');
  if (tersimpan.harga.dataset.voucher !== voucher) isiHarga(tersimpan.harga, produk);
  return tersimpan.kartu;
}

let sentinel;
let pengamatSentinel;

function tambahPotongan() {
  const daftar = keadaan.ditampilkan;
  if (jumlahDirender >= daftar.length) return;
  const akhir = Math.min(jumlahDirender + UKURAN_POTONGAN, daftar.length);
  const potongan = document.createDocumentFragment();
  for (let i = jumlahDirender; i < akhir; i++) potongan.append(ambilKartu(daftar[i]));
  jumlahDirender = akhir;
  $('#kisi').append(potongan);
  // observe ulang: bila sentinel masih dekat layar setelah potongan ditambahkan, callback terpanggil lagi
  pengamatSentinel.unobserve(sentinel);
  if (jumlahDirender < daftar.length) pengamatSentinel.observe(sentinel);
  periksaGulir();
}

function siapkanSentinel() {
  if (sentinel) return;
  sentinel = el('div', 'kisi-sentinel');
  sentinel.setAttribute('aria-hidden', 'true');
  $('#kisi').after(sentinel);
  pengamatSentinel = new IntersectionObserver((entri) => {
    if (entri.some((e) => e.isIntersecting)) tambahPotongan();
  }, { rootMargin: '0px 0px 1200px 0px' });
}

export function renderProduk(daftar) {
  siapkanSentinel();
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  jumlahDirender = 0;
  kisi.replaceChildren();

  if (daftar.length === 0) {
    const kosong = el('div', 'kosong');
    kosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    kisi.append(kosong);
  }

  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';
  tambahPotongan();
}

// Hanya kartu yang pernah dibuat yang diperbarui; kartu lain memakai harga voucher saat pertama dibuat.
export function perbaruiHargaVoucherDiKartu() {
  for (const { harga, produk } of simpananKartu.values()) {
    const voucher = String(keadaan.hargaVoucher.get(produk.id) || '');
    if (harga.dataset.voucher !== voucher) isiHarga(harga, produk);
  }
}
