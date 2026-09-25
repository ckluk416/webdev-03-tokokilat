# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: [judul singkat masalah]

**Tiket terkait:** TK-....
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** durasi, di track apa, fungsi apa yang dominan di bottom-up.
- **Dugaan mekanisme:** jelaskan memakai istilah event loop (task, microtask, rendering opportunity)
  atau tahap pipeline (JS, Style, Layout, Paint, Composite).
- **Rencana perubahan:** ....
- **Prediksi terukur:** "Setelah perubahan, [metrik] turun dari ... menjadi sekitar ..., karena ...".
  Sertakan juga prediksi efek samping: apa yang mungkin menjadi *lebih buruk*?
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** ....

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....
