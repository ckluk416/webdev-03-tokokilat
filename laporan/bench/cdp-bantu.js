// pembantu CDP kecil untuk pemeriksaan manual: buka Chrome, emulasi 412x915, jalankan fungsi uji
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function buka({ lebar = 412, tinggi = 915, cpu = 1 } = {}) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'tokokilat-profil-'));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--remote-debugging-port=9334', `--user-data-dir=${profil}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-allow-origins=*', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
  let target; for (let i = 0; i < 40 && !target; i++) { await tidur(250); try { target = (await (await fetch('http://127.0.0.1:9334/json/list')).json()).find((t) => t.type === 'page'); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const tunggu = new Map(); const pendengar = [];
  ws.onmessage = (m) => { const p = JSON.parse(m.data); if (p.id && tunggu.has(p.id)) { tunggu.get(p.id)(p.error ? { error: p.error } : p.result); tunggu.delete(p.id); } else if (p.method) pendengar.forEach((f) => f(p)); };
  const kirim = (method, params = {}) => new Promise((r) => { const i = ++id; tunggu.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const galat = [];
  pendengar.push((p) => {
    if (p.method === 'Runtime.exceptionThrown') galat.push(p.params.exceptionDetails.exception ? p.params.exceptionDetails.exception.description : p.params.exceptionDetails.text);
    if (p.method === 'Runtime.consoleAPICalled' && p.params.type === 'error') galat.push(p.params.args.map((a) => a.value || a.description).join(' '));
    if (p.method === 'Log.entryAdded' && p.params.entry.level === 'error') galat.push(p.params.entry.text + ' ' + (p.params.entry.url || ''));
  });
  for (const d of ['Page', 'Runtime', 'Log']) await kirim(d + '.enable');
  await kirim('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: 2, mobile: true });
  await kirim('Emulation.setCPUThrottlingRate', { rate: cpu });
  const nilai = async (e) => { const r = await kirim('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception || {}).description); return r.result.value; };
  const pusat = (sel) => nilai(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const klik = async (sel) => { const c = await pusat(sel); if (!c) throw new Error('tidak ada ' + sel); await tidur(300); for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await kirim('Input.dispatchMouseEvent', { type, x: c.x, y: c.y, button: 'left', clickCount: 1 }); };
  const tombol = async (key, code, vk, text) => { await kirim('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, text }); await kirim('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }); };
  const ketik = async (teks) => { for (const h of teks) { await kirim('Input.insertText', { text: h }); await tidur(80); } };
  const foto = async (berkas, opsi = {}) => { const r = await kirim('Page.captureScreenshot', { format: 'png', ...opsi }); fs.mkdirSync(path.dirname(berkas), { recursive: true }); fs.writeFileSync(berkas, Buffer.from(r.data, 'base64')); return berkas; };
  const tutup = () => { ws.close(); chrome.kill(); };
  return { kirim, nilai, pusat, klik, tombol, ketik, foto, tutup, galat, tidur };
}
module.exports = { buka, tidur };
