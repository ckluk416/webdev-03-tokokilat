# TokoKilat - halaman Flash Sale 12.12

Repositori awal untuk tugas **Operasi Penyelamatan Flash Sale 12.12**. Deskripsi tugas ada di [`TUGAS.md`](TUGAS.md).

## Menjalankan

Butuh Node.js 18 atau lebih baru. Tidak ada dependensi yang perlu dipasang.

```bash
npm start
```

Lalu buka:

- `http://localhost:3000/` untuk halaman toko
- `http://localhost:3000/?ukur=1` untuk halaman toko dengan alat ukur (INP, CLS, long task, frame lambat)

Varian jumlah produk, bila laptop Anda terlalu lemah atau terlalu kuat:

```bash
npm run start:ringan   # 1.500 produk
npm run start:berat    # 5.000 produk
```

Setiap pesanan dari tombol "Beli sekarang" dicetak di terminal server, sehingga pesanan ganda mudah terlihat.
Pesanan hanya disimpan di memori dan hilang saat server dimatikan.

## Struktur

```
server.js              server pengembangan: API produk, promo, pesanan, dan gambar   (JANGAN DIUBAH)
public/
  index.html
  css/toko.css
  js/
    main.js            titik masuk
    katalog.js         data produk dan kisi kartu
    pencarian.js       cari, saring kategori, urutkan
    keranjang.js       keranjang, riwayat aktivitas, "Beli sekarang"
    harga-promo.js     voucher dan simulasi cicilan
    promo.js           hitung mundur, teks berjalan, banner promo
    gulir.js           perilaku saat halaman digulir, pencatatan impresi
    kategori.js        isi bagian kaki halaman
    util.js            fungsi bantu
  vendor/lacak.min.js  SDK analitik pihak ketiga                                      (JANGAN DIUBAH)
  alat/ukur.js         alat ukur untuk tugas                                          (JANGAN DIUBAH)
laporan/               templat PREDIKSI.md, LAPORAN.md, AUDIT-AI.md
```

## Mengatur ulang keadaan

- Data keranjang dan riwayat ada di `localStorage`. Untuk memulai dari nol, pakai jendela Incognito baru
  atau hapus lewat DevTools: Application, Storage, Clear site data.
- Untuk menghapus daftar pesanan tanpa mematikan server: `curl -X DELETE http://localhost:3000/api/pesanan`

## Merekam trace

DevTools, panel Performance, atur CPU ke "4x slowdown", tekan Record, lakukan satu skenario, Stop.
Simpan lewat ikon unduh ("Save trace"). Berkas trace bisa dibuka kembali di panel yang sama.
Protokol lengkap ada di `TUGAS.md` bagian 7.
