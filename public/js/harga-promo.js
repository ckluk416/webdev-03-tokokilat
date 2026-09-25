// Voucher: menghitung harga promo untuk setiap produk.
// Aturan promo bertingkat + simulasi cicilan ditentukan tim bisnis.

import { $, hargaSetelahDiskon, jedaKeBrowser, tampilkanToast } from './util.js';
import { keadaan, perbaruiHargaVoucherDiKartu } from './katalog.js';

const VOUCHER = {
  KILAT1212: { persen: 12, maksPotongan: 120000, minBelanja: 50000 },
  HEMAT50: { persen: 5, maksPotongan: 50000, minBelanja: 0 },
};

// batas kerja per potongan sebelum menyerahkan kendali ke browser
const ANGGARAN_POTONGAN_MS = 8;

// Cicilan 0% sampai 24 bulan: cari tenor dengan angsuran paling ringan yang
// masih memenuhi batas minimal angsuran per bulan dari mitra pembiayaan.
function simulasiCicilan(harga) {
  let terbaik = { tenor: 1, angsuran: harga };
  for (let tenor = 1; tenor <= 24; tenor++) {
    let sisa = harga;
    let angsuran = Math.ceil(harga / tenor / 100) * 100;
    for (let bulan = 1; bulan <= tenor; bulan++) {
      const biayaAdmin = Math.round(sisa * 0.0005 * Math.log2(bulan + 1));
      sisa = sisa - angsuran + biayaAdmin;
      if (sisa < 0) sisa = 0;
    }
    angsuran += Math.ceil(sisa / tenor);
    if (angsuran >= 25000 && angsuran < terbaik.angsuran) terbaik = { tenor, angsuran };
  }
  return terbaik;
}

// Sinkron: fungsi ini tidak menunggu apa pun, jadi async tidak membuatnya berhenti memblokir.
// 40 simulasi tambahan ("cek kestabilan pembulatan") dihapus karena hasilnya tidak pernah dipakai.
function hitungHargaPromo(produk, aturan) {
  const dasar = hargaSetelahDiskon(produk);
  if (dasar < aturan.minBelanja) return null;
  let potongan = Math.min(Math.round((dasar * aturan.persen) / 100), aturan.maksPotongan);
  if (produk.flashSale) potongan = Math.round(potongan / 2); // flash sale hanya dapat setengah
  const hargaAkhir = Math.max(dasar - potongan, 100);
  const cicilan = simulasiCicilan(hargaAkhir);
  return { hargaAkhir, cicilan };
}

let sedangMenghitung = false;

async function terapkanVoucher(kode) {
  const aturan = VOUCHER[kode];
  if (!aturan) {
    tampilkanToast('Kode voucher "' + kode + '" tidak dikenal. Coba KILAT1212.');
    return;
  }
  if (sedangMenghitung) return;
  sedangMenghitung = true;

  const tombol = $('#tombol-voucher');
  const progres = $('#progres');
  const isi = $('#progres-isi');
  const teks = $('#progres-teks');
  tombol.setAttribute('aria-busy', 'true');
  progres.hidden = false;
  isi.style.transform = 'scaleX(0)';

  const semua = keadaan.semuaProduk;
  const total = semua.length;
  keadaan.hargaVoucher.clear();

  // Dipecah per potongan berbatas waktu. Di antara potongan ada task baru,
  // sehingga progres sempat tergambar dan ketikan di kolom cari sempat diproses.
  let i = 0;
  while (i < total) {
    const batas = performance.now() + ANGGARAN_POTONGAN_MS;
    do {
      const hasil = hitungHargaPromo(semua[i], aturan);
      if (hasil) keadaan.hargaVoucher.set(semua[i].id, hasil.hargaAkhir);
      i++;
    } while (i < total && performance.now() < batas);
    const persen = Math.round((i / total) * 100);
    isi.style.transform = 'scaleX(' + i / total + ')';
    teks.textContent = 'Menghitung harga promo… ' + persen + '% (' + i + ' dari ' + total + ' produk)';
    await jedaKeBrowser();
  }

  perbaruiHargaVoucherDiKartu();
  progres.hidden = true;
  tombol.removeAttribute('aria-busy');
  sedangMenghitung = false;
  tampilkanToast('Voucher ' + kode + ' dipakai di ' + keadaan.hargaVoucher.size.toLocaleString('id-ID') + ' produk.');
  if (window.Lacak) window.Lacak.kirim('apply_voucher', { kode, jumlah: keadaan.hargaVoucher.size });
}

export function pasangVoucher() {
  const kolom = $('#kolom-voucher');
  $('#tombol-voucher').addEventListener('click', () => terapkanVoucher(kolom.value.trim().toUpperCase()));
  kolom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') terapkanVoucher(kolom.value.trim().toUpperCase());
  });
}
