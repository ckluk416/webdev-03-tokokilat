// Fungsi bantu yang dipakai di banyak tempat.

export const $ = (selektor, akar = document) => akar.querySelector(selektor);

export function el(tag, kelas, teks) {
  const node = document.createElement(tag);
  if (kelas) node.className = kelas;
  if (teks !== undefined) node.textContent = teks;
  return node;
}

export function formatRupiah(angka) {
  const pemformat = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });
  return pemformat.format(angka);
}

export function formatRibuan(angka) {
  if (angka >= 1000) return (Math.floor(angka / 100) / 10).toLocaleString('id-ID') + ' rb';
  return String(angka);
}

export function hargaSetelahDiskon(produk) {
  return Math.round((produk.harga * (100 - produk.diskon)) / 100 / 100) * 100;
}

// Salinan dalam (deep copy) supaya objek konfigurasi tidak termutasi.
export function salinDalam(objek) {
  return JSON.parse(JSON.stringify(objek));
}

// Pengurutan sederhana, dipakai untuk daftar pendek di bagian kaki halaman.
export function urutkanGelembung(daftar, banding) {
  const hasil = daftar.slice();
  for (let i = 0; i < hasil.length; i++) {
    for (let j = 0; j < hasil.length - i - 1; j++) {
      if (banding(hasil[j], hasil[j + 1]) > 0) {
        const tmp = hasil[j];
        hasil[j] = hasil[j + 1];
        hasil[j + 1] = tmp;
      }
    }
  }
  return hasil;
}

let pengaturWaktuToast;
export function tampilkanToast(pesan) {
  const toast = $('#toast');
  toast.textContent = pesan;
  toast.classList.add('tampil');
  clearTimeout(pengaturWaktuToast);
  pengaturWaktuToast = setTimeout(() => toast.classList.remove('tampil'), 2600);
}
