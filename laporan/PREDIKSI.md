# log prediksi

aturan: satu entri per masalah. bagian sebelum perbaikan harus di-commit sebelum commit perbaikannya. bagian sesudah perbaikan diisi setelah pengukuran ulang. jangan menyunting bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## catatan sumber angka

ada tiga jenis angka di log ini.

1. angka skenario (INP, long task, frame lebih dari 50 ms, CLS, jumlah pesanan, permintaan gambar) diambil dengan laporan/bench/ukur-cdp.js: Chrome 153 dengan profil baru tanpa ekstensi, viewport 412 x 915, tiap skenario 3 kali, dilaporkan median. hasil mentahnya ada di laporan/hasil/sebelum-1x.json.
2. angka trace (fungsi dominan, layout paksa, long task terpanjang) diambil dari satu rekaman trace tambahan per skenario di laporan/trace/sebelum-1x-*.json.gz, diringkas dengan laporan/bench/ringkas-trace.js. berkas trace bisa dibuka di panel Performance.
3. angka microbenchmark berasal dari laporan/bench/ukur-biaya-kode.js (Node v24.15.0, tanpa DOM, tanpa throttling). angka ini hanya mengukur biaya JavaScript murni.

penyimpangan dari protokol: baseline diukur tanpa CPU throttling (1x), bukan 4x. pada 4x, halaman awal belum juga siap setelah 120 detik di laptop ini (AMD Ryzen 5 7535HS, 12 thread, 23 GB RAM, tersambung listrik), baik dengan 3.000 produk maupun dengan npm run start:ringan (1.500 produk). penyebabnya terlihat di trace S6: tanpa throttling pun main thread sudah sibuk 96% saat halaman diam, jadi pada 4x main thread tidak sempat kosong. karena itu perbandingan sebelum dan sesudah memakai 1x dengan 3.000 produk, dan hasil akhir juga diukur pada 4x untuk dicocokkan dengan target di TUGAS.md.

hasil microbenchmark yang dipakai berulang:

| operasi | biaya (Node, tanpa throttling) |
|---|---|
| Lacak.kirim dengan payload kecil | sekitar 13 sampai 15 ms |
| Lacak.kirim dengan payload berisi riwayat 9.000 entri (sekitar 1.200 KB JSON) | sekitar 88 sampai 105 ms |
| JSON.parse / JSON.stringify riwayat | sekitar 7 ms / sekitar 6,5 ms |
| voucher KILAT1212 untuk 3.000 produk, dengan 40x simulasiCicilan tambahan | sekitar 1.045 ms |
| voucher yang sama, tanpa 40x simulasiCicilan tambahan | sekitar 40 sampai 44 ms |
| 4.335 panggilan formatRupiah (jumlah per render penuh), Intl.NumberFormat baru tiap panggil | sekitar 310 ms |
| 4.335 panggilan dengan satu Intl.NumberFormat yang dipakai ulang | sekitar 5 sampai 6 ms |
| penyaringan 3.000 produk dengan kunci "sepatu" | sekitar 8 sampai 9 ms |

biaya Lacak.kirim yang tetap sekitar 13 ms walau payload kecil berasal dari fungsi fingerprint di SDK (software development kit): fungsi itu mengulang hash 2.000.000 kali di setiap panggilan, dan hasilnya tidak disimpan (terbaca di lacak.min.js, konstanta F=2000000). berkas SDK tidak boleh diubah, jadi yang bisa diatur adalah berapa kali, kapan, dan dengan data apa SDK dipanggil.

baseline per skenario (median 3 kali, 1x, 3.000 produk):

| skenario | INP | long task terlama | frame > 50 ms | lainnya |
|---|---|---|---|---|
| S0 | - | 2.267 ms | - | CLS 0,137; 3.000 permintaan gambar dalam 10 detik, 322 selesai; gambar terakhir selesai detik ke-94,7 |
| S1 | 6.032 ms | 4.949 ms | 25 | 12 interaksi |
| S2 | 200 ms | 146 ms | 9 | keranjang bertambah 1 |
| S3 | 288 ms | 142 ms | 29 | 3 pesanan dari 3 klik |
| S4 | 4.336 ms | 3.470 ms | 38 | 0 frame menampilkan progres; voucher selesai 8.943 ms setelah klik |
| S5 | - | 346 ms | 28 | - |
| S6 | - | 150 ms | 56 | main thread sibuk 96% (trace) |

---

## P-01: "+ Keranjang" mengerjakan tugas berat sebelum memberi umpan balik

tiket terkait: TK-1044 (skenario S2)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): INP (Interaction to Next Paint) S2 200 ms, long task terlama 146 ms. di trace sebelum-1x-s2, task klik berdurasi 194 ms. di call tree, tambahKeKeranjang memakan 87 ms, dan 72 ms di antaranya ada di k (Lacak.kirim) dari lacak.min.js: fungsi t (signature payload) 48 ms dan f (fingerprint) 17 ms. sisa task klik adalah layout 36 ms. teks "Ditambahkan" baru bisa tergambar setelah seluruh task itu selesai.
- dugaan mekanisme: tambahKeKeranjang berjalan dalam satu task: bacaRiwayat mem-parse riwayat 9.000 entri, Lacak.kirim('add_to_cart') menerima seluruh keranjang dan riwayat sehingga SDK men-stringify lalu meng-hash sekitar 1.200 KB teks 12 kali, lalu simpanRiwayat men-stringify lagi dan menulis ke localStorage secara sinkron. perubahan teks tombol dan lencana baru ditulis di akhir task, sehingga rendering opportunity pertama yang bisa menggambarnya ada setelah semua pekerjaan itu selesai. pada ponsel yang lebih lambat (setara 4x) task yang sama diperkirakan sekitar 4 kali lebih panjang, cukup lama untuk membuat pengguna menekan lagi. komentar Rudi "Data sudah aman tersimpan, baru tampilan diperbarui" menjelaskan urutan ini.
- rencana perubahan:
  1. umpan balik visual lebih dulu: perbarui lencana dan tombol di awal handler, lalu serahkan sisa pekerjaan ke task berikutnya setelah frame tergambar (requestAnimationFrame lalu setTimeout(0)).
  2. payload add_to_cart dibuat ringkas: id, nama, harga, jumlah, total item keranjang, dan sumber. riwayat tidak ikut dikirim.
  3. riwayat dibaca dari localStorage sekali, disimpan di memori, lalu ditulis balik saat browser idle (requestIdleCallback dengan timeout), dengan penulisan paksa saat pagehide.
- prediksi terukur: bagian JavaScript di task klik turun dari 87 ms menjadi di bawah 10 ms, karena yang tersisa hanya penulisan teks dan kelas. INP S2 diperkirakan turun dari 200 ms menjadi sekitar 100 sampai 150 ms, bukan lebih rendah, karena main thread masih sibuk dengan timer promo.js (P-08) sehingga input delay dan presentation delay tetap ada. setelah P-08, INP S2 diperkirakan di bawah 100 ms. task susulan (SDK dengan payload kecil, sekitar 13 ms menurut microbenchmark) terjadi setelah frame umpan balik. efek samping yang mungkin: bila tab ditutup tanpa pagehide (misalnya proses dimatikan), penulisan riwayat yang menunggu idle bisa hilang; tim data menerima event dengan konteks lebih sedikit dari sebelumnya.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - tetap mengirim riwayat, tetapi di requestIdleCallback: interaksi jadi responsif, tetapi task idle sekitar 72 ms pada 1x (sekitar 4 kali lipat di ponsel lambat) tetap menjadi long task dan bisa menunda interaksi berikutnya.
  - memindahkan pemanggilan SDK ke Web Worker: window.Lacak terikat ke window dan berkas SDK tidak boleh diubah, jadi tidak praktis.
  - membatasi riwayat ke N entri terakhir: mengurangi biaya parse dan stringify, tetapi mengubah data milik tim rekomendasi. perlu persetujuan tim itu, jadi tidak diambil sepihak.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-02: "Beli sekarang" tidak mencegah pesanan ganda

tiket terkait: TK-1052 (skenario S3)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): tiga klik cepat menghasilkan 3 pesanan di ketiga putaran (dicek lewat GET /api/pesanan). INP S3 288 ms. di trace sebelum-1x-s3, task klik pertama 221 ms; beliSekarang memakan 243 ms untuk tiga klik, 192 ms di antaranya di Lacak.kirim.
- dugaan mekanisme: ada dua masalah yang saling memperparah. pertama, bagian sinkron beliSekarang sama beratnya dengan P-01 (parse riwayat, SDK dengan riwayat, stringify), jadi tombol tidak berubah selama task itu. kedua, tidak ada penanda "sedang diproses": setelah await fetch, tombol tetap aktif dan klik berikutnya menjalankan handler dari awal. server menambahkan jeda 350 ms per pesanan. klik kedua dan ketiga masuk antrean task input, dijalankan setelah task sebelumnya selesai, dan masing-masing memulai POST sendiri.
- rencana perubahan:
  1. penanda per produk (Set id produk yang sedang dipesan). klik saat penanda aktif diabaikan.
  2. saat klik: tombol langsung diberi aria-disabled="true" dan aria-busy="true", teks menjadi "Memproses pesanan", baru kemudian fetch. tombol aktif lagi setelah respons atau galat. atribut disabled tidak dipakai karena tombol yang disabled keluar dari urutan fokus, sehingga fokus keyboard bisa berpindah ke body.
  3. menangani galat jaringan dengan try/catch dan toast yang menjelaskan pesanan belum terkirim.
  4. bagian riwayat dan SDK mengikuti pola P-01 (payload ringkas, dikerjakan setelah frame).
- prediksi terukur: jumlah pesanan dari tiga klik cepat turun dari 3 menjadi tepat 1. INP S3 turun dari 288 ms ke kisaran yang sama dengan S2 setelah P-01 (sekitar 100 sampai 150 ms sebelum P-08). efek samping yang mungkin: pengguna yang memang ingin membeli dua kali harus menunggu sekitar 350 ms sampai tombol aktif lagi; karena memakai aria-disabled, klik tetap sampai ke handler dan penjaga di JavaScript yang harus menolaknya, jadi bila penjaga itu salah, pesanan ganda bisa muncul lagi.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - idempotency key di header: cara yang lebih kuat, tetapi server.js tidak boleh diubah dan server tidak membacanya.
  - debounce klik: tetap bisa lolos bila jeda antarklik lebih panjang dari jendela debounce, dan tidak memberi tahu pengguna bahwa pesanan sedang diproses.
  - atribut disabled: browser menolak klik tanpa bantuan JavaScript, tetapi fokus keyboard hilang dari tombol selama pesanan diproses.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-03: perhitungan voucher async tetap memblokir satu task penuh

tiket terkait: TK-1057 (skenario S4)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): INP S4 4.336 ms, long task terlama 3.470 ms. di ketiga putaran, 0 frame menampilkan panel progres, dan toast "Voucher ... dipakai" muncul 8.943 ms setelah klik. di trace sebelum-1x-s4, task klik berdurasi 4.263 ms dan 4.052 ms di antaranya adalah satu blok "Run Microtasks" tanpa frame di dalamnya. di call tree, terapkanVoucher memakan 4.017 ms: simulasiCicilan 1.024 ms (self) dan perbaruiHargaVoucherDiKartu 2.931 ms (render ulang seluruh kisi).
- dugaan mekanisme: hitungHargaPromo ditandai async, tetapi tidak menunggu apa pun, jadi Promise yang dikembalikannya sudah terpenuhi. await pada Promise seperti itu hanya menjadwalkan lanjutan sebagai microtask. antrean microtask dikuras habis sebelum event loop boleh mengambil rendering opportunity, sehingga 3.000 iterasi berjalan sebagai satu rangkaian tanpa kesempatan render. itu sebabnya progres tidak tergambar sama sekali (0 frame di ketiga putaran), cocok dengan keluhan "menghitung 0% lalu tiba-tiba selesai". beban hitungnya berasal dari baris for (let i = 0; i < 40; i++) simulasiCicilan(hargaAkhir + i): hasilnya dibuang, tetapi menurut microbenchmark memakan sekitar 1.045 ms, sementara tanpa baris itu perhitungan hanya sekitar 40 ms. guliran juga ikut tertahan karena listener wheel dan touchmove non-passive di #utama (lihat P-07) membuat compositor menunggu main thread. setelah loop, perbaruiHargaVoucherDiKartu merender ulang seluruh kisi (lihat P-04 dan P-05). ketikan di kolom cari selama perhitungan menambah render ulang lagi, sehingga toast baru muncul hampir 9 detik setelah klik.
- rencana perubahan:
  1. menghapus 40 panggilan simulasiCicilan yang hasilnya tidak dipakai. aturan bisnis tetap: potongan, batas maksimum, minimum belanja, setengah potongan untuk flash sale, dan satu simulasiCicilan(hargaAkhir) yang hasilnya dikembalikan.
  2. memecah loop menjadi potongan berbatas waktu (sekitar 8 ms per potongan) dan menyerahkan kendali ke event loop di antara potongan dengan scheduler.yield() bila tersedia, dengan setTimeout(0) sebagai cadangan. di antara potongan ada task baru, jadi browser bisa menggambar progres dan memproses ketikan.
  3. menolak klik "Pakai voucher" kedua selama perhitungan masih berjalan.
- prediksi terukur: jumlah frame yang menampilkan progres naik dari 0 menjadi paling sedikit 5. bagian perhitungan voucher tidak lagi menjadi long task (tiap potongan sekitar 8 ms). long task terlama S4 dan INP S4 belum akan turun ke target sebelum P-05, karena render ulang kisi di akhir perhitungan dan saat mengetik tetap sekitar 2 sampai 3 detik per render. setelah P-05, INP S4 diperkirakan di bawah 200 ms dan waktu sampai toast turun dari 8.943 ms menjadi di bawah 1 detik. efek samping yang mungkin: total waktu perhitungan sedikit lebih panjang karena jeda antarpotongan; bila pengguna mengetik di kolom cari saat perhitungan berjalan, kisi bisa dirender sebelum harga voucher lengkap, lalu diperbarui lagi di akhir.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - Web Worker: main thread bebas sepenuhnya, tetapi perlu menyalin data 3.000 produk (sekitar 700 KB) ke worker dan memisahkan logika voucher ke berkas tersendiri. setelah baris 40x dihapus, perhitungan tinggal sekitar 40 ms tanpa throttling, jadi dugaan saya pemecahan per potongan sudah cukup.
  - mempertahankan 40x simulasi dan hanya memecah loop: progres tergambar, tetapi total waktu tetap sekitar 1 detik pada 1x (sekitar 4 detik di ponsel lambat) dan baterai terkuras untuk hasil yang dibuang.
  - requestAnimationFrame untuk jeda: menurut MDN, callback-nya berjalan tepat sebelum frame, jadi pekerjaan berat di dalamnya justru menunda frame itu.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-04: formatRupiah membuat Intl.NumberFormat baru di setiap panggilan

tiket terkait: TK-1041 (S1), juga TK-1057 (render akhir S4)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): di trace sebelum-1x-s1 (12 interaksi mengetik dan menghapus), formatRupiah memakan 1.145 ms self time. di trace sebelum-1x-s0, satu render awal 3.000 kartu memanggilnya dengan total 272 ms.
- dugaan mekanisme: renderProduk memanggil formatRupiah sekali atau dua kali per kartu (4.335 panggilan untuk 3.000 produk). tiap panggilan membangun Intl.NumberFormat baru. microbenchmark: sekitar 310 ms untuk 4.335 panggilan, dibanding sekitar 5 sampai 6 ms bila satu objek dipakai ulang, jadi hampir seluruh biayanya ada pada pembuatan objek, bukan pada pemformatan. angka 272 ms di trace cocok dengan angka microbenchmark itu. ini biaya JavaScript murni di dalam task input, sebelum style dan layout.
- rencana perubahan: membuat satu Intl.NumberFormat di tingkat modul util.js dan memakainya ulang.
- prediksi terukur: formatRupiah di trace S1 turun dari 1.145 ms menjadi di bawah 30 ms. INP S1 turun sekitar 100 ms per render penuh, tetapi masih jauh di atas target sampai P-05. efek samping: tidak ada yang diharapkan, keluaran format identik.
- alternatif yang dipertimbangkan dan alasan tidak dipilih: memformat manual dengan toLocaleString dan awalan "Rp": dugaan saya toLocaleString dengan opsi juga membangun pemformat di setiap panggilan (belum diukur), dan ada risiko beda format (spasi tak terputus setelah "Rp").

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-05: render ulang kisi membuat ulang semua kartu dan memaksa layout sinkron

tiket terkait: TK-1041 (S1), TK-1057 (render akhir S4), TK-1081 (permintaan gambar ulang)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): INP S1 6.032 ms, long task terlama 4.949 ms. di trace sebelum-1x-s1, renderProduk memakan 11.125 ms total, dengan samakanTinggiJudul 6.033 ms self, periksaGulir 1.549 ms self, dan buatKartu 2.692 ms total. ada 365 layout yang terjadi di dalam JavaScript (layout paksa) dengan total 5.446 ms. di trace sebelum-1x-s0, render awal (mulai) memakan 2.652 ms, sedangkan respons /api/produk hanya 199 ms.
- dugaan mekanisme:
  1. huruf "s" cocok dengan 2.897 produk, "se" dengan 1.179, "sep" dengan 145 (microbenchmark). tiap ketikan menghapus kisi (innerHTML = '') lalu membuat ulang semua kartu yang cocok.
  2. samakanTinggiJudul menulis style.height = 'auto', lalu membaca offsetHeight, lalu menulis tinggi lagi, bergantian 24 kali. tiap pembacaan setelah penulisan memaksa layout sinkron atas seluruh kisi (layout thrashing). setelah itu tinggi ditulis ke semua judul.
  3. periksaGulir di akhir memanggil getBoundingClientRect untuk semua kartu, dan menulis classList serta minHeight pada kartu yang terlihat di sela pembacaan, jadi layout paksa terjadi lagi untuk tiap kartu terlihat.
  4. kartu baru berarti elemen img baru. server mengirim Cache-Control: no-store, jadi tiap render ulang meminta ulang gambar dari server (lihat P-10).
  5. tambahan: samakanTinggiJudul hanya mengukur 24 judul pertama, sedangkan judul lain diberi tinggi yang sama dengan overflow: hidden. judul yang lebih panjang dari contoh akan terpotong.
- rencana perubahan:
  1. menyamakan tinggi judul per deret dengan CSS subgrid (grid-template-rows: subgrid pada kartu), lalu menghapus samakanTinggiJudul. perataan dikerjakan mesin layout dalam satu lintasan, tanpa pembacaan dari JavaScript.
  2. render bertahap: render sekitar 40 kartu pertama, sisanya ditambahkan per 40 saat elemen sentinel di ujung kisi mendekati layar (IntersectionObserver). semua produk tetap terjangkau dengan menggulir, dan #ringkasan tetap menampilkan jumlah hasil yang benar.
  3. menyimpan elemen kartu per id produk dan memakainya ulang saat render berikutnya, sehingga elemen img tidak dibuat ulang. saat voucher dipakai, hanya bagian harga pada kartu yang sudah dibuat yang diperbarui.
- prediksi terukur: INP S1 turun dari 6.032 ms menjadi di bawah 200 ms, dan long task terlama S1 dari 4.949 ms menjadi di bawah 100 ms. samakanTinggiJudul hilang dari trace, dan layout paksa dari katalog.js menjadi 0. efek samping yang mungkin: fitur "Cari di halaman" (Ctrl+F) browser tidak menemukan produk yang belum dirender; guliran cepat ke bawah memunculkan jeda singkat saat potongan berikutnya dibuat; bar progres baca di header mengikuti panjang kisi yang sudah dirender, bukan seluruh daftar; memori naik sedikit karena kartu disimpan.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - content-visibility: auto dengan contain-intrinsic-size pada kartu: layout dan paint kartu di luar layar dilewati, tetapi pembuatan ribuan node DOM di JavaScript tetap terjadi tiap ketikan.
  - virtualisasi penuh (hanya kartu terlihat yang ada di DOM): paling hemat, tetapi rumit untuk kisi dengan jumlah kolom yang berubah per lebar layar, dan mengganggu urutan Tab.
  - tinggi judul tetap tiga baris (min-height): lebih sederhana dari subgrid, tetapi menambah ruang kosong di kartu yang judulnya satu baris dan tetap memotong judul yang lebih dari tiga baris.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-06: pencarian dan SDK berjalan penuh di setiap huruf

tiket terkait: TK-1041 (S1)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): S1 menghasilkan 12 interaksi (6 huruf diketik, 6 dihapus), dan di trace sebelum-1x-s1 tiap task input berisi terapkanSaringan lengkap dengan render. menurut kode, Lacak.kirim('search') dipanggil untuk tiap kata kunci yang tidak kosong, yaitu 11 kali dalam S1.
- dugaan mekanisme: listener input menjalankan terapkanSaringan secara sinkron untuk tiap huruf, termasuk huruf yang sebentar lagi ditimpa huruf berikutnya. tiap panggilan SDK menjalankan hash fingerprint 2.000.000 iterasi (sekitar 13 ms menurut microbenchmark). karena task input berikutnya menunggu task sebelumnya selesai, ketikan menumpuk dan huruf tampil terlambat.
- rencana perubahan:
  1. nilai input tetap tampil seketika (dikerjakan browser). penyaringan dan render dijalankan setelah jeda ketik 150 ms (debounce).
  2. Lacak.kirim('search') dikirim sekali per kata kunci yang sudah stabil, setelah hasil tergambar.
  3. teks cari tiap produk dinormalkan sekali lalu disimpan, bukan di setiap ketikan.
- prediksi terukur: jumlah render dan panggilan SDK untuk S1 turun dari 12 render dan 11 panggilan menjadi 2 sampai 4. INP S1 di bawah 200 ms bila digabung dengan P-04 dan P-05. efek samping: hasil pencarian muncul sekitar 150 ms setelah berhenti mengetik; data analitik search tidak lagi memuat kata kunci parsial seperti "se" dan "sep".
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - tanpa debounce, hanya mengandalkan P-04 dan P-05: tiap huruf tetap memicu render dan SDK.
  - membatalkan render yang tertinggal dengan requestAnimationFrame: hanya menggabungkan ketikan dalam satu frame (sekitar 16 ms). skenario S1 mengetik dengan jeda 250 ms per huruf, jadi cara ini tidak menggabungkan apa pun.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-07: listener gulir non-passive dan periksaGulir memeriksa semua kartu per event

tiket terkait: TK-1063 (S5), juga guliran yang tertahan di TK-1057

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): frame lebih dari 50 ms selama S5: 28 per 10 detik, long task terlama 346 ms. di trace sebelum-1x-s5, periksaGulir memakan 2.121 ms self dan 3.967 ms total, dengan 146 layout paksa (1.948 ms). long task terpanjang (419 ms) berisi listener wheel di gulir.js yang memanggil periksaGulir. dalam 10 detik ada 54 event wheel dan 28 event scroll yang di-dispatch ke JavaScript.
- dugaan mekanisme:
  1. touchstart, touchmove, dan wheel di #utama didaftarkan dengan passive: false. menurut penjelasan MDN tentang passive listener, compositor tidak bisa menggulir sendiri dan harus menunggu main thread memutuskan apakah preventDefault dipanggil. bila main thread sedang sibuk (misalnya timer 10 ms di P-08), guliran ikut tertahan.
  2. periksaGulir terpasang di tiga event sekaligus, jadi bisa berjalan dua sampai tiga kali per gerakan. tiap kali, fungsi ini membaca getBoundingClientRect dari 3.000 kartu dan menulis classList/style di sela pembacaan, sehingga terjadi layout paksa berulang.
  3. bar-gulir diubah lewat width, yang memicu layout.
  4. efek kartu muncul menganimasikan margin-top, properti layout, sehingga tiap frame animasi menjalankan layout ulang untuk kisi.
- rencana perubahan:
  1. pencegahan pull-to-refresh diganti overscroll-behavior-y: none pada elemen root, lalu listener touchstart, touchmove, dan wheel dihapus.
  2. satu listener scroll passive, digabung per frame dengan requestAnimationFrame, hanya untuk bayangan header, tombol "Ke atas", dan bar progres.
  3. bar progres memakai transform: scaleX(). tinggi dokumen dibaca ulang hanya saat ukuran berubah (ResizeObserver) atau kisi dirender.
  4. kartu muncul dan impresi dideteksi dengan IntersectionObserver (margin 80 px seperti sebelumnya). impresi dikumpulkan dan dikirim ke SDK paling sering sekali per detik.
  5. efek kartu muncul memakai opacity dan transform: translateY() yang bisa dikerjakan compositor.
- prediksi terukur: periksaGulir di trace S5 turun dari 2.121 ms menjadi di bawah 50 ms, dan layout paksa dari gulir.js menjadi 0. frame lebih dari 50 ms pada S5 turun dari 28, tetapi belum ke target sebelum P-08, karena timer promo.js masih membuat main thread sibuk. setelah P-08, frame lebih dari 50 ms pada S5 paling banyak 2 per 10 detik. efek samping: impresi tercatat sedikit terlambat (sampai 1 detik); overscroll-behavior juga menonaktifkan efek pantul di puncak halaman, bukan hanya pull-to-refresh.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - tetap memakai listener scroll dengan throttle: jumlah panggilan turun, tetapi tiap panggilan tetap membaca ribuan kotak.
  - mempertahankan touchmove untuk pull-to-refresh tetapi passive: true: menurut MDN, preventDefault diabaikan pada listener passive, jadi fitur itu tidak berfungsi lagi.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-08: timer 10 ms dan animasi properti non-compositor saat halaman diam

tiket terkait: TK-1070 (S6), juga TK-1063 (S5)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): frame lebih dari 50 ms selama S6: 56 per 10 detik, long task 57 kali. di trace sebelum-1x-s6, main thread sibuk 11.273 ms dari 11.700 ms (96%). isinya layout 3.406 ms, PrePaint 3.223 ms, dan dua callback setInterval di promo.js (baris 22 dan 38) masing-masing sekitar 935 ms. event "Timer Fired" hanya 10 per detik, padahal interval diminta 10 ms (100 per detik), karena tiap task timer lebih lama dari intervalnya.
- dugaan mekanisme:
  1. hitung mundur: setInterval 10 ms menulis empat teks, lalu membaca wadah.offsetWidth sehingga memaksa layout sinkron, lalu menulis width garis yang memicu layout lagi di frame berikutnya.
  2. teks berjalan: setInterval 10 ms lain yang membaca offsetWidth dan menulis left. left adalah properti layout, jadi layout dan paint berjalan di main thread.
  3. .lencana-kilat (272 produk) menganimasikan top dan box-shadow tanpa henti. menurut artikel web.dev tentang animasi berperforma tinggi, yang dapat dianimasikan compositor hanya transform dan opacity, jadi dugaan saya tiap frame animasi ini menjalankan style, layout, dan paint di main thread. angka PrePaint 3.223 ms di S6 cocok dengan dugaan ini.
- rencana perubahan:
  1. hitung mundur digerakkan requestAnimationFrame. teks hanya ditulis bila nilainya berubah. garis memakai transform: scaleX(sisa / durasi) dengan transform-origin: left, diperbarui sekali per detik, tanpa membaca offsetWidth. menurut MDN, callback requestAnimationFrame berhenti dipanggil saat tab tidak terlihat.
  2. teks berjalan memakai @keyframes pada transform: translateX(). lebar teks dibaca sekali saat awal (dan saat resize) untuk menentukan durasi, dengan kecepatan yang sama (100 px per detik).
  3. lencana kilat menganimasikan transform untuk gerak naik turun, dan denyut dibuat dengan ::after yang dianimasikan transform: scale() dan opacity.
  4. perilaku prefers-reduced-motion yang sudah ada dipertahankan dan diperluas ke teks berjalan.
- prediksi terukur: callback timer dari promo.js selama S6 turun dari sekitar 10 per detik menjadi 0. frame lebih dari 50 ms S6 turun dari 56 menjadi paling banyak 2 per 10 detik. waktu sibuk main thread di S6 turun dari 96% menjadi di bawah 20%. tidak sampai nol, karena angka perseratus detik tetap ditulis sekitar 60 kali per detik; dugaan saya biayanya kecil (satu penulisan teks, layout kecil, dan paint kecil per frame). efek samping: angka perseratus detik berubah per frame, bukan per 10 ms (secara visual sama pada layar 60 Hz); lencana dengan ::after menambah satu elemen semu per kartu kilat.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - angka perseratus detik dianimasikan murni dengan CSS (strip angka 00 sampai 99 yang digeser translateY dengan steps(100)): main thread bisa benar-benar diam, tetapi strip bisa tidak sinkron dengan detik dan pembaca layar tidak bisa membacanya. dicoba bila target S6 meleset.
  - menurunkan interval ke 100 ms: jumlah task turun, tetapi layout paksa dan animasi left tetap ada.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-09: banner promo dan gambar tanpa ukuran menimbulkan layout shift

tiket terkait: TK-1078 (S0)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): CLS (Cumulative Layout Shift) S0 0,137 di ketiga putaran. di trace sebelum-1x-s0, layout shift yang dihitung (skor 0,137, tanpa input) terjadi saat banner muncul: #alat turun dari y 451 ke 723 dan #kisi ikut turun. respons /api/promo dikirim server setelah jeda 1.800 ms, tetapi baru selesai diproses di detik ke-8,4 karena main thread sibuk, sehingga banner muncul saat pengguna sudah melihat kisi.
- dugaan mekanisme:
  1. pasangBannerPromo menunggu /api/promo, lalu menyisipkan banner di awal #utama. banner muncul di atas kisi yang sudah tergambar, sehingga seluruh kisi turun. pengguna yang sedang menekan kartu teratas pada saat itu mengenai tombol banner. layout shift ini tidak didahului input, jadi terhitung ke CLS. penyebabnya waktu penyisipan, bukan kesengajaan agar iklan diklik seperti dugaan di tiket.
  2. elemen img kartu tidak punya width dan height, dan CSS memakai height: auto. sebelum gambar tiba, browser belum tahu tingginya; setelah tiba, gambar menjadi persegi dan kartu di bawahnya terdorong. di trace ini pergeseran dari gambar tidak muncul sebagai layout shift terpisah, dugaan saya karena kartu berada di bawah layar saat gambar tiba.
  3. efek kartu muncul menganimasikan margin-top 16 px ke 0, yang ikut menggeser posisi elemen.
- rencana perubahan:
  1. tempat banner disiapkan sejak HTML awal dengan tinggi minimum yang sesuai isi banner di viewport 412 px, berisi teks "Memuat promo 12.12…" selama menunggu, lalu diisi saat data datang. bila permintaan gagal, tempat itu berisi pesan galat yang tingginya sama.
  2. atribut width="480" height="480" pada elemen img supaya browser menghitung rasio aspek sebelum gambar tiba.
  3. efek kartu muncul memakai transform (sama dengan P-07). menurut definisi CLS di web.dev, perubahan transform tidak dihitung sebagai layout shift.
- prediksi terukur: CLS S0 turun dari 0,137 menjadi di bawah 0,05. sisa yang mungkin muncul berasal dari selisih tinggi tempat banner dengan isi aslinya bila teks banner membungkus berbeda di lebar lain. efek samping: ada area bertuliskan "Memuat promo 12.12…" selama sekitar 1,8 detik pertama.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - menaruh banner di bawah kisi atau sebagai elemen position: fixed: tidak menggeser apa pun, tetapi mengubah posisi fitur promo yang diminta tim marketing.
  - menampilkan banner setelah interaksi pengguna: layout shift setelah input tidak dihitung CLS, tetapi tetap mengganggu pengguna, jadi hanya memindahkan masalah dari metrik.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....

---

## P-10: semua gambar produk diminta sekaligus saat muat

tiket terkait: TK-1081 (S0)

tanggal dan hash commit entri ini: 25-09-2026, ....

### sebelum perbaikan

- yang teramati di trace (baseline): S0 mengirim 3.000 permintaan /img/p/*.svg dalam 10 detik pertama, dan hanya 322 yang selesai dalam 10 detik itu. gambar terakhir selesai pada detik ke-94,7 (median 3 kali). rata-rata tiap SVG 1.102 byte menurut trace, jadi satu kali muat halaman menarik sekitar 3,2 MB gambar.
- dugaan mekanisme: renderProduk membuat 3.000 elemen img tanpa loading="lazy", jadi browser meminta semuanya segera, berurutan sesuai DOM. server meniru CDN (content delivery network) dengan jeda 60 sampai 300 ms per gambar (sekitar 180 ms rata-rata menurut rumus di server.js). server lokal ini memakai HTTP/1.1, dan menurut dokumentasi Chrome batas koneksi paralel ke satu host adalah 6, jadi dugaan kasar waktu sampai gambar terakhir selesai sekitar 3.000 / 6 x 180 ms, yaitu sekitar 90 detik. hasil ukur 94,7 detik cocok dengan perkiraan ini. gambar kartu yang terlihat setelah guliran cepat berada di ujung antrean, sehingga kotak abu-abu tampil lama. render ulang (P-05) meminta ulang semuanya karena no-store. jeda per gambar memang dari server, tetapi antrean ribuan permintaan berasal dari klien, jadi dugaan "servernya lemot" di tiket hanya benar sebagian.
- rencana perubahan:
  1. loading="lazy" dan decoding="async" pada elemen img kartu.
  2. render bertahap dan pemakaian ulang kartu dari P-05, sehingga elemen img tidak dibuat ulang.
  3. atribut width dan height dari P-09, yang juga dibutuhkan agar lazy loading memperkirakan posisi gambar dengan benar.
- prediksi terukur: permintaan gambar dalam 10 detik pertama S0 turun dari 3.000 menjadi di bawah 60 (kartu terlihat ditambah jarak ambang lazy loading Chrome), dan semua gambar yang diminta selesai dalam 10 detik itu. efek samping: saat guliran sangat cepat, gambar baru diminta ketika mendekati layar, jadi kotak abu-abu masih bisa muncul sesaat, tetapi antreannya pendek.
- alternatif yang dipertimbangkan dan alasan tidak dipilih:
  - IntersectionObserver buatan sendiri untuk memuat gambar: kendali jarak ambang lebih baik, tetapi loading="lazy" sudah menyediakannya tanpa JavaScript tambahan.
  - meminta tim backend menambah server atau mengganti header cache: tidak dalam kewenangan tim ini (server.js tidak boleh diubah), dan jumlah permintaan tetap ribuan.

### sesudah perbaikan

- hash commit perbaikan: ....
- hasil ukur (median 3 kali): ....
- prediksi vs kenyataan: ....
- efek samping yang muncul: ....
