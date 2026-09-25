// Keranjang belanja, riwayat penelusuran, dan "Beli sekarang".
// Semua disimpan di localStorage supaya tetap ada walau halaman dimuat ulang.

import { $, el, formatRupiah, hargaSetelahDiskon, salinDalam, setelahFrame, tampilkanToast } from './util.js';

const KUNCI_KERANJANG = 'tk_keranjang';
const KUNCI_RIWAYAT = 'tk_riwayat';

const KONFIG = { maksPerProduk: 99, mataUang: 'IDR', sumber: 'web-flashsale-1212' };

function bacaKeranjang() {
  return JSON.parse(localStorage.getItem(KUNCI_KERANJANG) || '[]');
}
function simpanKeranjang(isi) {
  localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(isi));
}
function bacaRiwayat() {
  return JSON.parse(localStorage.getItem(KUNCI_RIWAYAT) || '[]');
}
function simpanRiwayat(riwayat) {
  localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(riwayat));
}

// Riwayat (sekitar 1,2 MB JSON) dibaca sekali lalu disimpan di memori. Menulisnya kembali ke localStorage
// dilakukan saat browser idle, bukan di dalam task klik.
let riwayatMemori = null;
let simpanDijadwalkan = false;

function ambilRiwayat() {
  if (!riwayatMemori) riwayatMemori = bacaRiwayat();
  return riwayatMemori;
}

function simpanRiwayatNanti() {
  if (simpanDijadwalkan) return;
  simpanDijadwalkan = true;
  const simpan = () => {
    simpanDijadwalkan = false;
    simpanRiwayat(riwayatMemori);
  };
  if ('requestIdleCallback' in window) requestIdleCallback(simpan, { timeout: 2000 });
  else setTimeout(simpan, 200);
}

function catatRiwayat(entri) {
  ambilRiwayat().push(entri);
  simpanRiwayatNanti();
}

// riwayat yang belum sempat tersimpan tetap ditulis bila tab ditutup
window.addEventListener('pagehide', () => {
  if (!simpanDijadwalkan) return;
  simpanDijadwalkan = false;
  simpanRiwayat(riwayatMemori);
});

// Riwayat aktivitas dipakai tim rekomendasi ("Karena kamu melihat...").
// Untuk pengembangan, kita isi dengan data contoh pelanggan lama yang aktif
// sejak 2023 supaya kondisinya mirip pengguna sungguhan.
export function siapkanRiwayatContoh(semuaProduk) {
  if (localStorage.getItem(KUNCI_RIWAYAT)) return;
  const riwayat = [];
  const jenis = ['lihat', 'lihat', 'lihat', 'cari', 'keranjang', 'beli'];
  let waktu = Date.parse('2023-01-05T08:00:00+07:00');
  for (let i = 0; i < 9000; i++) {
    const p = semuaProduk[(i * 131) % semuaProduk.length];
    waktu += 1000 * 60 * (7 + (i % 190));
    riwayat.push({ t: waktu, jenis: jenis[i % jenis.length], id: p.id, nama: p.nama, kategori: p.kategori, harga: p.harga });
  }
  simpanRiwayat(riwayat);
}

const jumlahItem = (isi) => isi.reduce((n, item) => n + item.jumlah, 0);

export function perbaruiLencana(isi = bacaKeranjang()) {
  $('#lencana-keranjang').textContent = jumlahItem(isi);
}

function gambarPanel() {
  const daftar = $('#daftar-keranjang');
  const isi = bacaKeranjang();
  daftar.innerHTML = '';
  let total = 0;
  if (isi.length === 0) daftar.append(el('li', '', 'Keranjang masih kosong. Tambahkan produk dari daftar.'));
  for (const item of isi) {
    total += item.harga * item.jumlah;
    const baris = el('li');
    baris.append(el('span', '', item.nama), el('span', 'jumlah', item.jumlah + ' x ' + formatRupiah(item.harga)));
    const hapus = el('button', 'hapus', 'Hapus dari keranjang');
    hapus.type = 'button';
    hapus.addEventListener('click', () => {
      simpanKeranjang(bacaKeranjang().filter((x) => x.id !== item.id));
      perbaruiLencana();
      gambarPanel();
    });
    baris.append(hapus);
    daftar.append(baris);
  }
  $('#total-keranjang').textContent = formatRupiah(total);
}

export function tambahKeKeranjang(produk, tombol) {
  const keranjang = bacaKeranjang();
  let item = keranjang.find((x) => x.id === produk.id);
  if (item) item.jumlah = Math.min(item.jumlah + 1, KONFIG.maksPerProduk);
  else {
    item = { id: produk.id, nama: produk.nama, harga: hargaSetelahDiskon(produk), jumlah: 1 };
    keranjang.push(item);
  }
  simpanKeranjang(keranjang);

  // Umpan balik lebih dulu. Riwayat dan analitik tidak terlihat pengguna, jadi dikerjakan setelah frame ini tergambar.
  perbaruiLencana(keranjang);
  tombol.textContent = 'Ditambahkan ✓';
  tombol.classList.add('sudah');
  setTimeout(() => {
    tombol.textContent = '+ Keranjang';
    tombol.classList.remove('sudah');
  }, 1500);
  tampilkanToast('Ditambahkan ke keranjang: ' + produk.nama);

  setelahFrame(() => {
    catatRiwayat({ t: Date.now(), jenis: 'keranjang', id: produk.id, nama: produk.nama, kategori: produk.kategori, harga: produk.harga });
    // SDK meng-hash seluruh payload; riwayat 1,2 MB tidak ikut dikirim, cukup ringkasan keranjang.
    window.Lacak.kirim('add_to_cart', {
      produkId: produk.id, nama: produk.nama, harga: item.harga, jumlah: item.jumlah,
      totalItemKeranjang: jumlahItem(keranjang), sumber: KONFIG.sumber,
    });
  });
}

export async function beliSekarang(produk, tombol) {
  const konfig = salinDalam(KONFIG);
  const riwayat = ambilRiwayat();
  riwayat.push({ t: Date.now(), jenis: 'beli', id: produk.id, nama: produk.nama, kategori: produk.kategori, harga: produk.harga });
  window.Lacak.kirim('begin_checkout', { produk, riwayat, sumber: konfig.sumber });
  simpanRiwayatNanti();

  const respons = await fetch('/api/pesanan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produkId: produk.id, nama: produk.nama }),
  });
  const pesanan = await respons.json();

  tombol.textContent = 'Dipesan ✓';
  setTimeout(() => { tombol.textContent = 'Beli sekarang'; }, 1500);
  tampilkanToast('Pesanan ' + pesanan.id + ' dibuat: ' + produk.nama);
  perbaruiLencanaPesanan();
}

export async function perbaruiLencanaPesanan() {
  const respons = await fetch('/api/pesanan');
  const pesanan = await respons.json();
  $('#lencana-pesanan').textContent = pesanan.length;
  return pesanan;
}

export function pasangKeranjang() {
  const panel = $('#panel-keranjang');
  const tombolBuka = $('#tombol-keranjang');
  const buka = (ya) => {
    panel.hidden = !ya;
    tombolBuka.setAttribute('aria-expanded', String(ya));
    if (ya) gambarPanel();
  };
  tombolBuka.addEventListener('click', () => buka(panel.hidden));
  $('#tutup-keranjang').addEventListener('click', () => buka(false));
  $('#kosongkan-keranjang').addEventListener('click', () => {
    simpanKeranjang([]);
    perbaruiLencana();
    gambarPanel();
  });

  $('#tombol-pesanan').addEventListener('click', async () => {
    const pesanan = await perbaruiLencanaPesanan();
    if (pesanan.length === 0) return tampilkanToast('Belum ada pesanan. Tekan "Beli sekarang" pada produk untuk memesan.');
    const terakhir = pesanan.slice(-3).map((p) => p.id + ' (produk #' + p.produkId + ')').join(', ');
    tampilkanToast(pesanan.length + ' pesanan. Terakhir: ' + terakhir);
  });

  perbaruiLencana();
  perbaruiLencanaPesanan();
}
