/**
 * Server pengembangan TokoKilat.
 * Tanpa dependensi: cukup `npm start` lalu buka http://localhost:3000
 *
 * Server ini mensimulasikan backend & CDN gambar (termasuk latensi jaringan).
 * Anggap server ini milik tim lain: TIDAK termasuk ruang lingkup tugas.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const JUMLAH_PRODUK = Number(process.env.JUMLAH_PRODUK) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---------- data produk (deterministik, supaya hasil ukur bisa dibandingkan) ---------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KATEGORI = {
  'Elektronik': ['Earphone Bluetooth', 'Power Bank 20000mAh', 'Smartwatch', 'Speaker Portabel', 'Kabel Data Fast Charging', 'Lampu LED Pintar', 'Mouse Wireless', 'Keyboard Mekanikal', 'Kipas Angin Portable', 'Webcam Full HD'],
  'Fashion Pria': ['Kemeja Flanel', 'Kaos Polos Katun Combed 30s', 'Celana Chino', 'Jaket Bomber', 'Sepatu Sneakers', 'Sandal Gunung', 'Topi Baseball', 'Ikat Pinggang Kulit', 'Batik Lengan Panjang', 'Celana Jogger'],
  'Fashion Wanita': ['Gamis Syari', 'Hijab Segi Empat Voal', 'Blouse Rayon', 'Rok Plisket', 'Tas Selempang', 'Flat Shoes', 'Cardigan Rajut', 'Dress Midi', 'Kulot Highwaist', 'Tunik Batik'],
  'Rumah Tangga': ['Rak Sepatu Susun', 'Sprei Katun Jepang', 'Panci Set Anti Lengket', 'Dispenser Air', 'Gantungan Baju Lipat', 'Toples Kedap Udara Set', 'Keset Anti Slip', 'Lampu Tidur Sensor', 'Tempat Bumbu Putar', 'Jemuran Lipat Aluminium'],
  'Kecantikan': ['Serum Niacinamide', 'Sunscreen SPF 50', 'Lip Tint', 'Micellar Water', 'Masker Wajah Sheet', 'Cushion Foundation', 'Parfum Eau de Toilette', 'Sabun Cuci Muka', 'Body Lotion Whitening', 'Toner Exfoliating'],
  'Olahraga': ['Matras Yoga', 'Dumbbell Set', 'Sepatu Lari', 'Jersey Sepeda', 'Botol Minum 1 Liter', 'Raket Bulutangkis', 'Tali Skipping', 'Celana Training', 'Sarung Tangan Gym', 'Tas Olahraga'],
  'Makanan & Minuman': ['Kopi Arabika Gayo 250g', 'Keripik Tempe Pedas', 'Sambal Bawang Botol', 'Teh Hijau Celup', 'Madu Hutan Murni', 'Granola Panggang', 'Cokelat Bubuk Premium', 'Abon Sapi Asli', 'Kurma Sukari 1kg', 'Mie Instan Sehat'],
  'Ibu & Bayi': ['Popok Bayi Celana', 'Botol Susu Anti Kolik', 'Gendongan Hipseat', 'Tisu Basah Bayi', 'Baju Bayi Set', 'Mainan Edukasi Balok', 'Stroller Lipat', 'Selimut Bayi Bulu', 'Breast Pump Elektrik', 'Minyak Telon Plus'],
};
const RENTANG_HARGA = {
  'Elektronik': [25000, 2500000], 'Fashion Pria': [35000, 450000], 'Fashion Wanita': [35000, 480000],
  'Rumah Tangga': [15000, 900000], 'Kecantikan': [12000, 350000], 'Olahraga': [20000, 1200000],
  'Makanan & Minuman': [9900, 250000], 'Ibu & Bayi': [15000, 1200000],
};
const MEREK = ['Sagara', 'Lumina', 'Arunika', 'Bimasakti', 'Kirana', 'Nusaraya', 'Tirta', 'Garda', 'Pelita', 'Samudra', 'Cakra', 'Mentari'];
const VARIAN = ['', '', 'Original', 'Premium', 'Edisi Terbatas', 'Bisa COD', 'Best Seller', 'Paket Hemat Isi 2', 'Ready Stock Siap Kirim Hari Ini'];
const VARIAN_BARANG = ['Warna Hitam', 'Warna Navy', 'Warna Sage', 'Ukuran Jumbo', 'Garansi Resmi 1 Tahun', 'Import Berkualitas'];
const TANPA_VARIAN_BARANG = ['Makanan & Minuman', 'Kecantikan'];
const KOTA = ['Jakarta Barat', 'Bandung', 'Surabaya', 'Medan', 'Makassar', 'Yogyakarta', 'Semarang', 'Denpasar', 'Palembang', 'Balikpapan', 'Tangerang', 'Bekasi'];

function buatProduk(n) {
  const acak = mulberry32(1212);
  const pilih = (arr) => arr[Math.floor(acak() * arr.length)];
  const namaKategori = Object.keys(KATEGORI);
  const daftar = [];
  for (let i = 1; i <= n; i++) {
    const kategori = pilih(namaKategori);
    const jenis = pilih(KATEGORI[kategori]);
    const merek = pilih(MEREK);
    const pilihanVarian = TANPA_VARIAN_BARANG.includes(kategori) ? VARIAN : VARIAN.concat(VARIAN_BARANG);
    const v1 = pilih(pilihanVarian);
    let v2 = acak() < 0.35 ? pilih(pilihanVarian) : '';
    if (v2 === v1) v2 = '';
    const nama = [merek, jenis, v1, v2].filter(Boolean).join(' ');
    const [hargaMin, hargaMaks] = RENTANG_HARGA[kategori];
    const dasar = Math.round((hargaMin + Math.pow(acak(), 2) * (hargaMaks - hargaMin)) / 100) * 100;
    const flash = acak() < 0.08;
    const diskon = flash ? 30 + Math.floor(acak() * 50) : (acak() < 0.4 ? 5 + Math.floor(acak() * 25) : 0);
    daftar.push({
      id: i,
      nama,
      merek,
      kategori,
      harga: dasar,
      diskon,
      flashSale: flash,
      rating: Math.round((3.6 + acak() * 1.4) * 10) / 10,
      terjual: Math.floor(Math.pow(acak(), 2) * 12000),
      stok: 1 + Math.floor(acak() * 250),
      kota: pilih(KOTA),
      gambar: `/img/p/${i}.svg`,
    });
  }
  return daftar;
}

const PRODUK = buatProduk(JUMLAH_PRODUK);
const PRODUK_JSON = JSON.stringify(PRODUK);
const PESANAN = [];

/* ---------- gambar produk (placeholder SVG, meniru CDN dengan latensi) ---------- */

const WARNA_KATEGORI = {
  'Elektronik': ['#1f3c88', '#dfe7fb'], 'Fashion Pria': ['#3d405b', '#e4e5ee'], 'Fashion Wanita': ['#a4336b', '#fbe3ee'],
  'Rumah Tangga': ['#2a6f57', '#dcf1e9'], 'Kecantikan': ['#b3541e', '#fdebdc'], 'Olahraga': ['#0b6e99', '#d9f0fa'],
  'Makanan & Minuman': ['#7a5c00', '#fbf1cf'], 'Ibu & Bayi': ['#5b3fa0', '#ebe4fa'],
};

function svgProduk(p) {
  const [tua, muda] = WARNA_KATEGORI[p.kategori] || ['#333', '#eee'];
  const r = mulberry32(p.id * 7919);
  const bentuk = [];
  for (let i = 0; i < 5; i++) {
    const x = Math.round(r() * 480), y = Math.round(r() * 480), s = 60 + Math.round(r() * 160);
    bentuk.push(i % 2
      ? `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${tua}" opacity="${(0.06 + r() * 0.12).toFixed(2)}"/>`
      : `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="18" fill="${tua}" opacity="${(0.06 + r() * 0.12).toFixed(2)}" transform="rotate(${Math.round(r() * 60)} ${x} ${y})"/>`);
  }
  const inisial = p.nama.split(' ').slice(1, 3).map((k) => k[0]).join('').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
<rect width="480" height="480" fill="${muda}"/>${bentuk.join('')}
<text x="240" y="262" font-family="Verdana,Arial,sans-serif" font-size="120" font-weight="700" text-anchor="middle" fill="${tua}">${inisial}</text>
<text x="240" y="330" font-family="Verdana,Arial,sans-serif" font-size="26" text-anchor="middle" fill="${tua}" opacity=".75">${p.merek}</text>
</svg>`;
}

/* ---------- util http ---------- */

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const tunda = (ms) => new Promise((r) => setTimeout(r, ms));

function kirim(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function bacaBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try {
    if (p === '/api/produk') {
      await tunda(180);
      return kirim(res, 200, PRODUK_JSON, { 'Content-Type': MIME['.json'] });
    }

    if (p === '/api/promo') {
      await tunda(1800); // layanan promo memang lambat; bukan ruang lingkup tugas
      return kirim(res, 200, JSON.stringify({
        judul: 'Gratis ongkir se-Indonesia, tanpa minimum belanja',
        isi: 'Khusus 12.12, pakai voucher KILAT1212 untuk potongan tambahan sampai Rp120.000.',
        tombol: 'Lihat syarat promo',
      }), { 'Content-Type': MIME['.json'] });
    }

    if (p === '/api/pesanan' && req.method === 'POST') {
      const body = await bacaBody(req);
      await tunda(350);
      const pesanan = { id: 'TK-' + String(PESANAN.length + 1).padStart(5, '0'), produkId: body.produkId, nama: body.nama, waktu: new Date().toISOString() };
      PESANAN.push(pesanan);
      console.log(`[pesanan] ${pesanan.id} produk #${pesanan.produkId} (${PESANAN.length} total)`);
      return kirim(res, 201, JSON.stringify(pesanan), { 'Content-Type': MIME['.json'] });
    }
    if (p === '/api/pesanan' && req.method === 'GET') {
      return kirim(res, 200, JSON.stringify(PESANAN), { 'Content-Type': MIME['.json'] });
    }
    if (p === '/api/pesanan' && req.method === 'DELETE') {
      PESANAN.length = 0;
      return kirim(res, 204, '');
    }

    const mGambar = p.match(/^\/img\/p\/(\d+)\.svg$/);
    if (mGambar) {
      const produk = PRODUK[Number(mGambar[1]) - 1];
      if (!produk) return kirim(res, 404, 'tidak ada');
      await tunda(60 + (produk.id * 37) % 240); // latensi CDN 60-300 ms
      return kirim(res, 200, svgProduk(produk), { 'Content-Type': MIME['.svg'] });
    }

    // berkas statis
    let berkas = path.normalize(path.join(PUBLIC_DIR, p === '/' ? 'index.html' : p));
    if (!berkas.startsWith(PUBLIC_DIR)) return kirim(res, 403, 'terlarang');
    fs.readFile(berkas, (err, data) => {
      if (err) return kirim(res, 404, 'tidak ditemukan');
      kirim(res, 200, data, { 'Content-Type': MIME[path.extname(berkas)] || 'application/octet-stream' });
    });
  } catch (e) {
    console.error(e);
    kirim(res, 500, 'galat server');
  }
});

server.listen(PORT, () => {
  console.log(`TokoKilat berjalan di http://localhost:${PORT}  (${JUMLAH_PRODUK} produk)`);
  console.log(`Mode ukur: http://localhost:${PORT}/?ukur=1`);
});
