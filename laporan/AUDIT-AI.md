# Audit usulan perbaikan dari AI

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki
minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama.
Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak
menggantikan dua temuan wajib.

Alat AI yang dipakai: ....  Branch atau commit tempat usulan diterapkan: ....

---

## A-01: [judul singkat]

- **Tiket yang diminta diperbaiki:** TK-....
- **Prompt yang diberikan (ringkas):** ....
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** ....
- **Jenis masalah pada usulan:** pilih satu atau lebih
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [ ] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [ ] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:** angka dan tangkapan layar trace sebelum dan sesudah usulan AI diterapkan.
- **Mengapa AI bisa keliru di sini:** informasi apa yang tidak dimilikinya? (petunjuk: AI membaca kode, Anda membaca trace)
- **Perbaikan yang benar menurut tim:** ....

---

## Refleksi (maks. 200 kata)
Untuk jenis pekerjaan apa AI paling membantu di tugas ini, dan di mana Anda harus paling waspada?
