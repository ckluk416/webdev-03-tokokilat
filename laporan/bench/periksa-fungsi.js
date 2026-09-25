// Click-through fungsional dengan input asli (CDP Input.*) di viewport 412 x 915: tiap kontrol diklik satu per satu,
// akibatnya dicek, galat konsol dicatat, dan tangkapan layar disimpan ke laporan/gambar/.
// Pakai: npm start (terminal lain), lalu node laporan/bench/periksa-fungsi.js

const path = require('path');
const { buka, tidur } = require('./cdp-bantu.js');

const ASAL = process.env.ASAL || 'http://localhost:3000';
const DIR_GAMBAR = path.join(__dirname, '..', 'gambar');
const hasil = [];
const catat = (kontrol, lolos, bukti) => { hasil.push({ kontrol, lolos, bukti }); console.log((lolos ? 'LOLOS' : 'GAGAL') + ' | ' + kontrol + ' | ' + bukti); };

(async () => {
  const c = await buka();
  const n = (e) => c.nilai(e);
  const teks = (sel) => n(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
  await fetch(ASAL + '/api/pesanan', { method: 'DELETE' });

  // pemuatan pertama menulis data contoh; pengujian memakai pemuatan kedua
  await c.kirim('Page.navigate', { url: ASAL + '/' });
  await tidur(3000);
  // pencatat event SDK: membungkus Lacak.kirim di halaman uji, berkas SDK tidak diubah
  await c.kirim('Page.addScriptToEvaluateOnNewDocument', { source: `window.__eventSdk = []; Object.defineProperty(window, 'Lacak', { configurable: true, set(v) { const asli = v.kirim; v.kirim = (e, p) => { window.__eventSdk.push(e); return asli(e, p); }; Object.defineProperty(window, 'Lacak', { value: v, writable: true, configurable: true }); } });` });
  await c.kirim('Page.navigate', { url: ASAL + '/' });
  await tidur(400);
  await c.foto(path.join(DIR_GAMBAR, '01-banner-memuat.png'));
  const tempatBanner = await teks('#promo-banner');
  await tidur(3500);
  const judulBanner = await teks('#promo-banner h2');
  catat('banner promo', /Memuat promo/.test(tempatBanner) && judulBanner.length > 0, `awal "${tempatBanner.trim()}", lalu terisi "${judulBanner}"`);
  await c.foto(path.join(DIR_GAMBAR, '02-halaman-412.png'));

  // hitung mundur dan animasi
  const senti1 = await teks('#hm-senti'); await tidur(130); const senti2 = await teks('#hm-senti');
  catat('hitung mundur', senti1 !== senti2, `angka perseratus detik berubah ${senti1} -> ${senti2}, jam ${await teks('#hm-jam')}`);
  const anim = await n(`({ berjalan: document.querySelector('#berjalan-teks').getAnimations().map((a) => a.animationName), lencana: document.querySelectorAll('.lencana-kilat').length, animLencana: document.querySelector('.lencana-kilat') ? document.querySelector('.lencana-kilat').getAnimations({ subtree: true }).length : 0 })`);
  catat('teks berjalan dan lencana kilat', anim.berjalan.includes('berjalan') && anim.animLencana >= 2, `animasi teks: ${anim.berjalan.join(',')}; ${anim.lencana} lencana di DOM, ${anim.animLencana} animasi per lencana`);

  // tautan lompat (keyboard)
  await c.tombol('Tab', 'Tab', 9);
  const fokus1 = await n(`document.activeElement.className + '|' + getComputedStyle(document.activeElement).left`);
  await c.tombol('Enter', 'Enter', 13, '\r');
  await tidur(800);
  catat('tautan "Langsung ke daftar produk"', /lompat\|8px/.test(fokus1) && (await n('location.hash')) === '#kisi', `Tab pertama memfokus tautan (${fokus1}), Enter ke ${await n('location.hash')}`);
  await n(`scrollTo(0, 0)`); await tidur(600);

  // pencarian
  await c.klik('#kolom-cari');
  await c.ketik('sepatu');
  await tidur(900);
  const ringkasCari = await teks('#ringkasan');
  const judulPertama = await teks('#kisi .kartu .kartu-judul');
  catat('kolom cari "sepatu"', /^106 produk/.test(ringkasCari) && /sepatu/i.test(judulPertama), `${ringkasCari}; kartu pertama "${judulPertama}"`);
  await c.foto(path.join(DIR_GAMBAR, '03-cari-sepatu.png'));
  await n(`document.querySelector('#kolom-cari').select()`);
  await c.ketik('zzqx');
  await tidur(900);
  catat('pencarian tanpa hasil', /^0 produk/.test(await teks('#ringkasan')) && (await teks('.kosong')).includes('tidak ditemukan'), `${await teks('#ringkasan')}; pesan "${(await teks('.kosong strong'))}"`);
  await c.foto(path.join(DIR_GAMBAR, '04-cari-kosong.png'));
  await n(`document.querySelector('#kolom-cari').select()`);
  await c.tombol('Backspace', 'Backspace', 8);
  await tidur(900);
  catat('mengosongkan kolom cari', /^3\.000 produk/.test(await teks('#ringkasan')), await teks('#ringkasan'));

  // kategori dan urutan
  const produk = await (await fetch(ASAL + '/api/produk')).json();
  const jumlahElektronik = produk.filter((p) => p.kategori === 'Elektronik').length;
  await c.klik('#keping-kategori .keping:nth-child(' + ((await n(`[...document.querySelectorAll('#keping-kategori .keping')].findIndex((k) => k.textContent === 'Elektronik')`)) + 1) + ')');
  await tidur(500);
  const ringkasKat = await teks('#ringkasan');
  catat('keping kategori "Elektronik"', ringkasKat.startsWith(jumlahElektronik.toLocaleString('id-ID') + ' produk') && (await n(`[...document.querySelectorAll('.keping')].filter((k) => k.getAttribute('aria-pressed') === 'true').map((k) => k.textContent).join()`)) === 'Elektronik', `${ringkasKat} (data server: ${jumlahElektronik}), aria-pressed hanya pada Elektronik`);
  await c.klik('#pilih-urut');
  await tidur(300);
  await c.tombol('ArrowDown', 'ArrowDown', 40);
  await c.tombol('Enter', 'Enter', 13, '\r');
  await tidur(600);
  const urut = await n(`[...document.querySelectorAll('#kisi .harga-kini')].slice(0, 8).map((e) => Number(e.textContent.replace(/\\D/g, '')))`);
  const naik = urut.every((v, i) => i === 0 || urut[i - 1] <= v);
  catat('urutkan "Harga terendah"', (await n(`document.querySelector('#pilih-urut').value`)) === 'murah' && naik, `nilai select ${await n(`document.querySelector('#pilih-urut').value`)}, 8 harga pertama naik: ${urut.join(', ')}`);
  await c.klik('#keping-kategori .keping:first-child');
  await tidur(500);
  // kembali ke "Paling relevan"; produk termurah berada di bawah minimum belanja voucher
  await n(`document.querySelector('#pilih-urut').focus()`);
  await c.tombol('ArrowUp', 'ArrowUp', 38);
  await tidur(600);

  // voucher tidak dikenal, lalu KILAT1212
  await c.klik('#kolom-voucher');
  await n(`document.querySelector('#kolom-voucher').select()`);
  await c.ketik('abc');
  await c.klik('#tombol-voucher');
  await tidur(500);
  catat('voucher tidak dikenal', /tidak dikenal/.test(await teks('#toast')), await teks('#toast'));
  await n(`document.querySelector('#kolom-voucher').select()`);
  await c.ketik('KILAT1212');
  await n(`window.__progresTerlihat = 0; (function f() { if (!document.querySelector('#progres').hidden) window.__progresTerlihat++; requestAnimationFrame(f); })()`);
  await c.klik('#tombol-voucher');
  await tidur(60);
  await c.foto(path.join(DIR_GAMBAR, '05-progres-voucher.png'));
  await tidur(2500);
  const toastVoucher = await teks('#toast');
  const frameProgres = await n('window.__progresTerlihat');
  const jumlahVoucher = await n(`document.querySelectorAll('#kisi .harga-voucher').length`);
  catat('tombol "Pakai voucher" KILAT1212', /Voucher KILAT1212 dipakai di 2\.264 produk/.test(toastVoucher) && frameProgres > 0 && jumlahVoucher > 0, `${toastVoucher}; progres tampil di ${frameProgres} frame; ${jumlahVoucher} kartu terender menampilkan harga voucher`);
  await n(`document.querySelector('#kisi .harga-voucher').scrollIntoView({ block: 'center' })`);
  await tidur(700);
  await c.foto(path.join(DIR_GAMBAR, '06-harga-voucher.png'));

  // keranjang
  const keranjangAwal = Number(await teks('#lencana-keranjang'));
  await c.klik('#kisi .kartu .tombol-tambah');
  await tidur(250);
  const teksTambah = await teks('#kisi .kartu .tombol-tambah');
  await tidur(400);
  catat('tombol "+ Keranjang"', Number(await teks('#lencana-keranjang')) === keranjangAwal + 1 && /Ditambahkan/.test(teksTambah), `lencana ${keranjangAwal} -> ${await teks('#lencana-keranjang')}, tombol "${teksTambah}", toast "${await teks('#toast')}"`);

  // beli sekarang tiga kali cepat
  const tBeli = await c.pusat('#kisi .kartu:nth-child(2) .tombol-beli');
  // semua keadaan tombol dicatat di halaman, supaya hasilnya tidak bergantung pada kapan skrip ini membaca
  await n(`(() => { const b = document.querySelector('#kisi .kartu:nth-child(2) .tombol-beli'); window.__keadaanBeli = []; new MutationObserver(() => window.__keadaanBeli.push(b.textContent + ' [aria-busy=' + b.getAttribute('aria-busy') + ']')).observe(b, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] }); })()`);
  await tidur(300);
  for (let i = 0; i < 3; i++) {
    c.kirim('Input.dispatchMouseEvent', { type: 'mousePressed', x: tBeli.x, y: tBeli.y, button: 'left', clickCount: 1 });
    c.kirim('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tBeli.x, y: tBeli.y, button: 'left', clickCount: 1 });
    await tidur(100);
  }
  await c.foto(path.join(DIR_GAMBAR, '07-memproses-pesanan.png'));
  await tidur(2500);
  const keadaanBeli = (await n('window.__keadaanBeli')).filter((k, i, a) => i === 0 || k !== a[i - 1]);
  const pesanan = await (await fetch(ASAL + '/api/pesanan')).json();
  catat('tombol "Beli sekarang" 3 klik cepat', pesanan.length === 1 && keadaanBeli.some((k) => /Memproses pesanan \[aria-busy=true\]/.test(k)), `${pesanan.length} pesanan di server; keadaan tombol: ${keadaanBeli.join(' -> ')}; lencana pesanan ${await teks('#lencana-pesanan')}`);
  await c.klik('#tombol-pesanan');
  await tidur(600);
  catat('tombol "Pesanan"', /^1 pesanan/.test(await teks('#toast')), await teks('#toast'));

  // panel keranjang
  await c.klik('#tombol-keranjang');
  await tidur(400);
  const panelTerbuka = await n(`!document.querySelector('#panel-keranjang').hidden`);
  const fokusPanel = await n('document.activeElement.id');
  const isiPanel = await n(`document.querySelectorAll('#daftar-keranjang li').length`);
  await c.foto(path.join(DIR_GAMBAR, '08-panel-keranjang.png'));
  catat('tombol "Keranjang" (buka panel)', panelTerbuka && fokusPanel === 'tutup-keranjang', `panel terbuka, fokus di #${fokusPanel}, ${isiPanel} baris, total ${await teks('#total-keranjang')}`);
  await c.klik('#daftar-keranjang .hapus');
  await tidur(300);
  catat('tombol "Hapus dari keranjang"', (await n(`document.querySelectorAll('#daftar-keranjang .hapus').length`)) === isiPanel - 1, `baris tersisa ${await n(`document.querySelectorAll('#daftar-keranjang li').length`)}, lencana ${await teks('#lencana-keranjang')}`);
  await c.klik('#tutup-keranjang');
  await tidur(300);
  catat('tombol "Tutup" panel', await n(`document.querySelector('#panel-keranjang').hidden`) && (await n('document.activeElement.id')) === 'tombol-keranjang', `panel tertutup, fokus kembali ke #${await n('document.activeElement.id')}`);
  await c.klik('#tombol-keranjang');
  await tidur(300);
  await c.klik('#kosongkan-keranjang');
  await tidur(300);
  catat('tombol "Kosongkan keranjang"', (await teks('#lencana-keranjang')) === '0' && /masih kosong/.test(await teks('#daftar-keranjang')), `lencana ${await teks('#lencana-keranjang')}, isi "${(await teks('#daftar-keranjang')).trim()}"`);
  await c.tombol('Escape', 'Escape', 27);
  await tidur(300);
  catat('Escape menutup panel', await n(`document.querySelector('#panel-keranjang').hidden`), `panel hidden=${await n(`document.querySelector('#panel-keranjang').hidden`)}, fokus #${await n('document.activeElement.id')}`);

  // banner promo
  await c.klik('#promo-banner button');
  await tidur(400);
  catat('tombol "Lihat syarat promo"', /Syarat promo/.test(await teks('#toast')), await teks('#toast'));

  // gulir jauh: kartu bertambah, tombol "Ke atas"
  const kartuAwal = await n(`document.querySelectorAll('#kisi .kartu').length`);
  for (let i = 0; i < 40; i++) { await c.kirim('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 206, y: 500, deltaX: 0, deltaY: 400 }); await tidur(60); }
  await tidur(1200);
  const kartuAkhir = await n(`document.querySelectorAll('#kisi .kartu').length`);
  const keAtasTampil = await n(`!document.querySelector('#ke-atas').hidden`);
  const gambarDiminta = await n(`performance.getEntriesByType('resource').filter((r) => r.name.includes('/img/p/')).length`);
  catat('gulir daftar produk', kartuAkhir > kartuAwal && keAtasTampil, `kartu dirender ${kartuAwal} -> ${kartuAkhir} saat digulir; tombol "Ke atas" tampil; ${gambarDiminta} gambar diminta sejauh ini`);
  await c.foto(path.join(DIR_GAMBAR, '09-gulir.png'));
  await c.klik('#ke-atas');
  await tidur(1500);
  catat('tombol "Ke atas"', (await n('scrollY')) === 0 && (await n('document.activeElement.className')) === 'merek-toko', `scrollY ${await n('scrollY')}, fokus pindah ke .${await n('document.activeElement.className')}`);

  // semua produk terjangkau: gulir sampai habis
  await n(`(async () => { for (let i = 0; i < 400 && document.querySelectorAll('#kisi .kartu').length < 3000; i++) { scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 30)); } })()`);
  await tidur(1500);
  catat('semua produk terjangkau dengan menggulir', (await n(`document.querySelectorAll('#kisi .kartu').length`)) === 3000, `${await n(`document.querySelectorAll('#kisi .kartu').length`)} kartu setelah digulir sampai bawah; kaki: ${await n(`document.querySelectorAll('#merek-populer li').length`)} merek, ${await n(`document.querySelectorAll('#kategori-terkait li').length`)} kategori terkait`);

  // fokus terlihat: mulai dari kolom cari, Tab ke kontrol berikutnya
  await n(`document.querySelector('#kolom-cari').focus()`);
  await c.tombol('Tab', 'Tab', 9);
  const fokus = await n(`(() => { const e = document.activeElement, g = getComputedStyle(e); return { el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : ''), outline: g.outlineStyle + ' ' + g.outlineWidth + ' ' + g.outlineColor, border: g.borderColor }; })()`);
  catat('fokus keyboard terlihat', /solid/.test(fokus.outline), `elemen fokus ${fokus.el}: outline ${fokus.outline}, border ${fokus.border}`);

  const eventSdk = [...new Set(await n('window.__eventSdk'))];
  const wajib = ['page_view', 'search', 'impression', 'add_to_cart', 'begin_checkout', 'apply_voucher', 'promo_click'];
  catat('event SDK tetap terkirim', wajib.every((e) => eventSdk.includes(e)), 'terkirim: ' + eventSdk.join(', '));
  catat('galat konsol', c.galat.length === 0, c.galat.length ? c.galat.join(' || ') : 'tidak ada galat');

  require('fs').writeFileSync(path.join(__dirname, '..', 'hasil', 'periksa-fungsi.json'), JSON.stringify(hasil, null, 2));
  console.log(hasil.filter((h) => !h.lolos).length ? 'ADA YANG GAGAL' : 'semua lolos');
  c.tutup();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
