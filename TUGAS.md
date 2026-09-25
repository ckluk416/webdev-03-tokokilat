# Operasi Penyelamatan Flash Sale 12.12

Tugas problem solving untuk materi **Browser sebagai Runtime: Event Loop dan Rendering Pipeline**
Karakteristik kualitas yang disorot (ISO/IEC 25010:2023): **Performance efficiency** dan **Interaction capability**

| | |
|---|---|
| Mata kuliah | `[isi nama mata kuliah]` |
| Bentuk | Tim 3-4 orang, ditambah sesi debugging langsung per individu |
| Durasi | 3 minggu kalender (perkiraan usaha 16-24 jam per tim) |
| Tenggat | `[isi tanggal]` |

---

## 1. Skenario

Anda baru bergabung sebagai performance engineer di **TokoKilat**, toko online yang sedang bersiap
menghadapi Harbolnas 12.12. Halaman flash sale sudah jadi dan semua fiturnya "berfungsi".
Masalahnya, data lapangan menunjukkan sebagian besar pembeli memakai HP Android kelas bawah,
dan di perangkat itu halaman ini nyaris tidak bisa dipakai. Keluhan menumpuk di customer service,
konversi turun, dan ada kasus pesanan ganda yang harus di-refund.

Developer sebelumnya (Rudi) sudah pindah tim. Ia meninggalkan kode, beberapa komentar, dan
satu catatan serah terima. Tidak ada yang tahu persis di mana masalahnya. Anda punya waktu tiga minggu.

Tugas Anda **bukan** menulis ulang aplikasi. Tugas Anda menemukan penyebab setiap keluhan,
membuktikannya dengan data, memperbaikinya, dan membuktikan lagi bahwa perbaikannya berhasil.

## 2. Capaian pembelajaran

Setelah menyelesaikan tugas ini Anda mampu:

1. Menjelaskan perilaku halaman web memakai model event loop (task, microtask, rendering opportunity)
   dan rendering pipeline (JavaScript, Style, Layout, Paint, Composite).
2. Membaca rekaman panel Performance di DevTools dan memetakan gejala yang dirasakan pengguna
   ke tahap pipeline atau antrean tugas yang menjadi penyebabnya.
3. Memilih dan mengevaluasi teknik perbaikan berdasarkan pengukuran, termasuk menimbang trade-off.
4. Menghubungkan masalah performa dengan sub-karakteristik interaction capability
   (operability, user error protection, inclusivity, user engagement) secara sebab-akibat.
5. Menilai secara kritis usulan perbaikan yang dihasilkan AI.

## 3. Menjalankan aplikasi

Lihat `README.md`. Singkatnya: `npm start`, lalu buka `http://localhost:3000/?ukur=1`.

## 4. Tiket keluhan

Ini satu-satunya informasi masalah yang Anda terima. Tiket ditulis pelanggan, bukan engineer:
ada yang akurat, ada yang berlebihan, ada yang salah menebak penyebab.

**TK-1041, Bu Wulan, Android entry-level**
> Saya ketik "sepatu" di kolom cari, hurufnya munculnya telat-telat, kadang HP seperti hang.
> Akhirnya saya cari di toko sebelah.

**TK-1044, Pak Anton, Android 3 tahun**
> Pencet "+ Keranjang" tidak ada reaksi apa-apa. Saya pencet lagi, pencet lagi. Tahu-tahu isi
> keranjang sudah 3. Tolong diperbaiki, saya kira tombolnya rusak.

**TK-1052, Mbak Sari**
> SAYA CUMA BELI SATU. Kenapa tagihannya tiga pesanan?? Saya pencet "Beli sekarang", diam saja,
> ya saya pencet lagi. Minta refund.

**TK-1057, Mas Dimas**
> Masukin voucher KILAT1212, layarnya beku lama banget. Ada tulisan "menghitung 0%" terus
> tiba-tiba langsung selesai. Saya kira aplikasinya crash. Sempat mau scroll juga tidak bisa.

**TK-1063, Bu Ningsih**
> Scroll daftar barangnya patah-patah, tidak enak dilihat. Di aplikasi lain lancar kok.

**TK-1070, Pak Yusuf**
> Baru buka halaman flash sale 5 menit HP sudah panas dan baterai turun cepat, padahal saya
> cuma melihat-lihat, belum pencet apa-apa.

**TK-1078, Kak Rara**
> Mau pencet barang yang paling atas, eh halamannya loncat turun sendiri, yang kepencet malah
> iklan promo. Ini sengaja ya biar iklannya diklik?

**TK-1081, Pak Hendra**
> Gambar barangnya lama sekali munculnya, kotak abu-abu semua, apalagi kalau saya scroll cepat ke
> bawah. Kuota saya juga cepat habis padahal cuma buka satu halaman. Internet saya lancar buat
> YouTube, jadi pasti servernya yang lemot.

### Catatan serah terima dari Rudi

> Hai, selamat bergabung. Beberapa dugaan saya, belum sempat dicek semua:
>
> 1. Biang kerok utamanya hampir pasti loop bersarang di `kategori.js`. Itu O(n²) dan ada
>    `querySelectorAll` di dalam loop. Saya sudah tandai dengan TODO. Kerjakan itu dulu.
> 2. API produk kita lambat, makanya halaman terasa berat. Minta tim backend tambah server.
> 3. `urutkanGelembung` di `util.js` itu bubble sort. Ganti dengan quicksort biar kencang.
> 4. Perhitungan voucher sudah saya buat `async`, jadi harusnya aman dan tidak memblokir.
> 5. Kayaknya SDK analitik dari vendor agak berat, tapi kata marketing wajib ada dan tidak boleh disentuh.
>
> Semoga membantu. -- Rudi

Perlakukan catatan ini seperti dugaan rekan kerja pada umumnya: mungkin benar, mungkin tidak.
**Ukur dulu.**

## 5. Aturan main

1. **Berkas yang tidak boleh diubah:** `server.js`, `public/vendor/`, `public/alat/`.
   Anggap server milik tim lain dan SDK milik vendor. *Cara, waktu, dan isi data* saat Anda memanggil
   SDK boleh diubah, asalkan setiap event (`page_view`, `search`, `impression`, `add_to_cart`,
   `begin_checkout`, `apply_voucher`, `promo_click`) tetap terkirim dengan informasi yang masuk akal.
2. **Tanpa framework, library, atau bundler.** Hanya platform web (HTML, CSS, JavaScript, Web API).
   Tujuannya supaya mekanisme browser terlihat langsung.
3. **Semua produk tetap ada.** Seluruh produk harus tetap bisa ditemukan lewat pencarian dan
   dijangkau dengan menggulir, dan jumlah hasil yang ditampilkan harus benar. *Cara menampilkannya*
   boleh Anda ubah.
4. **Fitur tidak boleh dihapus.** Hitung mundur, teks promo berjalan, penanda produk kilat,
   banner promo, efek kartu muncul, riwayat aktivitas, aturan bisnis voucher (termasuk simulasi
   cicilan), keranjang, dan "Beli sekarang" harus tetap ada dan benar. Bentuk visualnya boleh
   disesuaikan bila ada alasan yang dapat Anda pertanggungjawabkan.
5. **Setiap perubahan harus bisa dijelaskan mekanismenya.** "Setelah diganti jadi lebih cepat"
   bukan penjelasan. "Penulisan `X` membuat layout kotor sehingga pembacaan `Y` memaksa layout
   sinkron di setiap iterasi" adalah penjelasan.
6. **Riwayat Git adalah barang bukti.** Commit kecil dan bermakna. Hipotesis di `laporan/PREDIKSI.md`
   harus di-commit **sebelum** commit perbaikan yang bersangkutan (lihat bagian 8).

## 6. Kebijakan penggunaan AI

AI (asisten chat maupun coding agent) **boleh dipakai dan harus dinyatakan**. Perlakukan AI sebagai
junior engineer yang rajin tapi belum pernah melihat trace Anda: usulannya harus Anda periksa.

Konsekuensinya:

- Kode perbaikan yang dihasilkan AI tidak bernilai apa-apa tanpa bukti pengukuran dan penjelasan
  mekanisme dari Anda sendiri.
- Audit terhadap usulan AI adalah **bagian wajib** tugas ini (`laporan/AUDIT-AI.md`, lihat bagian 8).
- 40% nilai berasal dari sesi langsung tanpa AI (bagian 10). Persiapan terbaiknya adalah benar-benar
  membaca flame chart Anda sendiri selama tiga minggu ini.

## 7. Protokol pengukuran

Agar hasil antar tim dan antar waktu bisa dibandingkan, semua angka di laporan diambil dengan cara ini:

1. Chrome versi stabil terbaru, **jendela Incognito**, tanpa ekstensi, tab lain ditutup, laptop tersambung listrik.
2. DevTools terbuka, device toolbar aktif dengan viewport **412 x 915**.
3. Panel Performance, pengaturan **CPU: 4x slowdown**. Jaringan tanpa throttling.
4. Buka `http://localhost:3000/?ukur=1`, tunggu halaman tenang, **muat ulang sekali**, baru mulai
   mengukur. (Pemuatan pertama di Incognito menulis data contoh ke localStorage.)
5. Setiap skenario diulang **3 kali**, laporkan **median**. Tekan "Reset" di alat ukur sebelum tiap skenario.
6. Catat spesifikasi laptop. Bila pada 4x halaman sama sekali tidak bisa dipakai di laptop Anda,
   gunakan `npm run start:ringan` dan tuliskan itu dengan jelas di laporan. Bandingkan hanya
   angka sebelum dan sesudah **dari mesin dan konfigurasi yang sama**.

Alat ukur di pojok kiri bawah hanya untuk memantau cepat. **Bukti diagnosis harus berupa rekaman
panel Performance** (flame chart main thread, ringkasan bottom-up, track Interactions, Layout Shifts, Frames).

### Skenario uji baku

| Kode | Langkah | Terkait tiket |
|---|---|---|
| S0 | Muat halaman, diam 10 detik. Amati juga panel Network: jumlah permintaan gambar dan kapan gambar terakhir selesai | TK-1078, TK-1081 |
| S1 | Ketik `sepatu` huruf demi huruf, lalu hapus semuanya | TK-1041 |
| S2 | Tekan "+ Keranjang" pada satu produk, satu kali | TK-1044 |
| S3 | Tekan "Beli sekarang" tiga kali secepat mungkin pada satu produk, lalu periksa lencana "Pesanan" dan log terminal server | TK-1052 |
| S4 | Tekan "Pakai voucher" dengan kode `KILAT1212`; selama perhitungan berjalan, coba ketik di kolom cari | TK-1057 |
| S5 | Gulir daftar produk terus-menerus selama 10 detik | TK-1063 |
| S6 | Diam 10 detik tanpa menyentuh apa pun, setelah halaman selesai dimuat | TK-1070 |

### Target setelah perbaikan (pada protokol di atas)

| Metrik | Target |
|---|---|
| INP pada S1, S2, S3, S4 | <= 200 ms |
| Long task selama interaksi (S1-S5) | tidak ada yang > 100 ms |
| S3: jumlah pesanan dari tiga klik cepat | tepat 1, dan pengguna tahu pesanannya sedang diproses |
| S4: progres perhitungan | tergambar bertahap; kolom cari tetap responsif selama perhitungan |
| CLS pada S0 | <= 0,1 |
| S5 dan S6: frame > 50 ms | paling banyak 2 per 10 detik |
| S6: aktivitas main thread saat diam | mendekati nol; animasi yang tersisa berjalan di compositor |
| S0: permintaan gambar | sebanding dengan kartu yang terlihat di layar, bukan ribuan |

Target adalah arah, bukan harga mati. Target yang meleset dengan analisis yang jujur dan tajam
lebih berharga daripada target yang tercapai tanpa bisa dijelaskan.

## 8. Alur kerja dan luaran

**Minggu 1: reproduksi dan diagnosis.** Rekam baseline seluruh skenario. Untuk tiap tiket, tentukan
di mana waktu habis: antrean task atau microtask, atau tahap pipeline yang mana. Beri anotasi pada
tangkapan layar flame chart. Tentukan juga dugaan Rudi mana yang benar dan mana yang keliru, dengan angka.

**Minggu 2: prediksi, lalu perbaikan.** Sebelum menyentuh kode untuk suatu masalah, tulis hipotesis
di `laporan/PREDIKSI.md` dan commit. Baru kemudian perbaiki, dan ukur ulang. Prediksi yang meleset
tidak mengurangi nilai; prediksi yang ditulis setelah hasil diketahui, iya.

**Minggu 3: audit AI, trade-off, laporan.** Minta sebuah AI memperbaiki minimal dua tiket
(boleh di branch terpisah), lalu uji usulannya dengan protokol pengukuran. Temukan **minimal dua**
usulan yang salah, tidak lengkap, menimbulkan regresi, atau memperbaiki sesuatu yang ternyata tidak
berpengaruh. Buktikan dengan trace.

| Luaran | Keterangan |
|---|---|
| Repositori Git | Hasil perbaikan beserta riwayat commit |
| `laporan/PREDIKSI.md` | Log hipotesis, di-commit sebelum perbaikan terkait |
| `laporan/LAPORAN.md` | Laporan audit sebelum dan sesudah, maksimal setara 6 halaman, mengikuti templat |
| `laporan/AUDIT-AI.md` | Audit usulan AI, mengikuti templat |
| Berkas trace | Minimal 3 pasang sebelum dan sesudah (ekspor dari panel Performance), simpan di `laporan/trace/` atau tautan penyimpanan awan |
| Video demo | Maksimal 3 menit, direkam dengan CPU 4x slowdown, menunjukkan S1-S5 sebelum dan sesudah |
| Sesi langsung | Lihat bagian 10 |

## 9. Penilaian

| Komponen | Bobot | Yang dinilai |
|---|---|---|
| Diagnosis dan bukti trace | 20% | Ketepatan akar masalah, pemetaan ke event loop atau tahap pipeline, kualitas anotasi, pembedaan antara penyebab nyata dan dugaan keliru |
| Perbaikan dan capaian metrik | 20% | Ketepatan teknik, capaian target, tidak ada fitur hilang, tidak ada regresi |
| Log prediksi dan analisis trade-off | 10% | Ketajaman hipotesis, kejujuran membandingkan prediksi dengan hasil, alternatif yang dipertimbangkan beserta harganya |
| Audit usulan AI | 10% | Kemampuan menemukan dan membuktikan kelemahan usulan AI |
| Sesi debugging langsung dan tanya jawab | 40% | Individu. Lihat bagian 10 |

Kaitan dengan kualitas perangkat lunak harus muncul di laporan: untuk tiap masalah, sebutkan
sub-karakteristik **performance efficiency** (time behaviour, resource utilization, capacity) dan
**interaction capability** (operability, user error protection, user engagement, inclusivity,
self-descriptiveness) yang terdampak, dan jelaskan hubungan sebab-akibatnya.

## 10. Sesi debugging langsung (individu, 40%)

Dilaksanakan di kelas atau lab setelah tenggat. Setiap mahasiswa:

1. Menerima versi TokoKilat yang sudah diperbaiki, **ditambah satu masalah baru** yang belum pernah
   dilihat, beserta satu kalimat keluhan pengguna.
2. Mendapat 20 menit dengan Chrome DevTools saja (tanpa AI, tanpa internet) untuk menemukan penyebab
   dan mengusulkan perbaikan.
3. Menjelaskan secara lisan selama 5-10 menit: apa yang terlihat di trace, mengapa itu terjadi
   menurut model event loop dan rendering pipeline, serta apa perbaikannya dan apa harganya.
   Dosen juga akan menanyakan bagian mana pun dari repositori tim Anda.

Yang dinilai adalah cara Anda menalar dari bukti, bukan kecepatan mengetik perbaikan.

## 11. Integritas akademik

Diskusi konsep antar tim dianjurkan. Berbagi kode perbaikan, trace, atau laporan antar tim tidak
diperbolehkan. Penggunaan AI yang tidak dinyatakan diperlakukan sebagai pelanggaran. Setiap anggota
harus sanggup menjelaskan seluruh isi repositori timnya.
