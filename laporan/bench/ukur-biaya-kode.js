// Microbenchmark biaya komputasi murni (tanpa DOM) untuk mendukung log prediksi.
// Bukan pengganti trace: tidak ada throttling CPU, tidak ada Style/Layout/Paint.
// Jalankan server dulu (`npm start`), lalu: node laporan/bench/ukur-biaya-kode.js

const fs = require('fs');
const path = require('path');

const ASAL = process.env.ASAL || 'http://localhost:3000';
const ULANG = 7;

function median(fn, n = ULANG) {
  const hasil = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    fn();
    hasil.push(performance.now() - t);
  }
  hasil.sort((a, b) => a - b);
  return hasil[n >> 1].toFixed(1) + ' ms';
}

// SDK vendor dimuat apa adanya ke objek window tiruan.
global.window = {
  document: { location: { pathname: '/' } },
  navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 10) Chrome/129', language: 'id-ID', hardwareConcurrency: 8 },
  screen: { width: 412, height: 915, colorDepth: 24 },
};
eval(fs.readFileSync(path.join(__dirname, '../../public/vendor/lacak.min.js'), 'utf8'));

// Salinan logika dari public/js (keranjang.js, harga-promo.js, util.js, pencarian.js).
const hargaSetelahDiskon = (p) => Math.round((p.harga * (100 - p.diskon)) / 100 / 100) * 100;

function buatRiwayatContoh(produk) {
  const riwayat = [];
  const jenis = ['lihat', 'lihat', 'lihat', 'cari', 'keranjang', 'beli'];
  let waktu = Date.parse('2023-01-05T08:00:00+07:00');
  for (let i = 0; i < 9000; i++) {
    const p = produk[(i * 131) % produk.length];
    waktu += 1000 * 60 * (7 + (i % 190));
    riwayat.push({ t: waktu, jenis: jenis[i % jenis.length], id: p.id, nama: p.nama, kategori: p.kategori, harga: p.harga });
  }
  return riwayat;
}

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

function hitungHargaPromo(produk, aturan, denganCekPembulatan) {
  const dasar = hargaSetelahDiskon(produk);
  if (dasar < aturan.minBelanja) return null;
  let potongan = Math.min(Math.round((dasar * aturan.persen) / 100), aturan.maksPotongan);
  if (produk.flashSale) potongan = Math.round(potongan / 2);
  const hargaAkhir = Math.max(dasar - potongan, 100);
  if (denganCekPembulatan) for (let i = 0; i < 40; i++) simulasiCicilan(hargaAkhir + i);
  return { hargaAkhir, cicilan: simulasiCicilan(hargaAkhir) };
}

const normalkan = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const cocok = (p, kunci) => normalkan(p.nama + ' ' + p.merek + ' ' + p.kategori + ' ' + p.kota).includes(kunci);

async function utama() {
  const produk = await (await fetch(ASAL + '/api/produk')).json();
  const riwayat = buatRiwayatContoh(produk);
  const riwayatJson = JSON.stringify(riwayat);
  const kilat1212 = { persen: 12, maksPotongan: 120000, minBelanja: 50000 };
  const opsiRupiah = { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 };
  const pemformat = new Intl.NumberFormat('id-ID', opsiRupiah);

  console.log('Node', process.version, '| produk:', produk.length, '| riwayat contoh:', (riwayatJson.length / 1024).toFixed(0), 'KB JSON');
  console.log('');
  console.log('[SDK] Lacak.kirim, payload kecil          ', median(() => window.Lacak.kirim('search', { kata: 'sepatu', jumlah: 106 })));
  console.log('[SDK] Lacak.kirim, payload + riwayat       ', median(() => window.Lacak.kirim('add_to_cart', { produk: produk[0], keranjang: [], riwayat, sumber: 'web' })));
  console.log('[riwayat] JSON.parse                       ', median(() => JSON.parse(riwayatJson)));
  console.log('[riwayat] JSON.stringify                   ', median(() => JSON.stringify(riwayat)));
  console.log('');
  console.log('[voucher] semua produk, dengan 40x cek     ', median(() => produk.forEach((p) => hitungHargaPromo(p, kilat1212, true)), 5));
  console.log('[voucher] semua produk, tanpa 40x cek      ', median(() => produk.forEach((p) => hitungHargaPromo(p, kilat1212, false)), 5));
  console.log('[voucher] produk yang lolos minBelanja     ', produk.filter((p) => hargaSetelahDiskon(p) >= kilat1212.minBelanja).length);
  console.log('');
  const panggilanRupiah = produk.reduce((n, p) => n + (p.diskon > 0 ? 2 : 1), 0);
  console.log('[render] panggilan formatRupiah per render', panggilanRupiah, '(tanpa voucher)');
  console.log('[render] Intl.NumberFormat baru tiap panggil', median(() => { for (let i = 0; i < panggilanRupiah; i++) new Intl.NumberFormat('id-ID', opsiRupiah).format(i); }, 5));
  console.log('[render] satu Intl.NumberFormat dipakai ulang', median(() => { for (let i = 0; i < panggilanRupiah; i++) pemformat.format(i); }, 5));
  console.log('');
  console.log('[cari] saring 3000 produk, kunci "sepatu"  ', median(() => produk.filter((p) => cocok(p, 'sepatu'))));
  for (const kunci of ['s', 'se', 'sep', 'sepatu']) {
    console.log('[cari] jumlah hasil untuk "' + kunci + '"'.padEnd(10 - kunci.length), produk.filter((p) => cocok(p, kunci)).length);
  }
  console.log('');
  console.log('[kaki] jumlah kategori:', new Set(produk.map((p) => p.kategori)).size, '| jumlah merek:', new Set(produk.map((p) => p.merek)).size);
  console.log('[kartu] produk flashSale (lencana beranimasi):', produk.filter((p) => p.flashSale).length);
}

utama();
