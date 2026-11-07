/**
 * Direcciones de la red local y código QR para conectar el celular.
 */
const os = require('node:os');
const QRCode = require('qrcode');

/** IPv4 de la red local, priorizando las típicas de Wi-Fi/LAN (192.168.x, 10.x). */
function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // 172.16–31.x suele ser una red virtual (WSL, Hyper-V, Docker)
      const virtual = /^172\.(1[6-9]|2\d|3[01])\./.test(a.address) || /vEthernet|WSL|Docker|VirtualBox|VMware/i.test(name);
      const score = a.address.startsWith('192.168.') ? 0 : a.address.startsWith('10.') ? 1 : virtual ? 3 : 2;
      out.push({ address: a.address, name, score });
    }
  }
  return out.sort((x, y) => x.score - y.score);
}

function primaryUrl(port) {
  const best = lanAddresses()[0];
  return `http://${best ? best.address : 'localhost'}:${port}`;
}

function qrSvg(text) {
  return QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#0b0c0f', light: '#ffffff' } });
}

/**
 * QR para la consola, al estilo Expo: solo caracteres de bloque Unicode, sin
 * códigos de color ANSI (que la consola clásica de Windows no siempre entiende).
 * Cada carácter dibuja dos filas de módulos (▀ ▄ █). Se dibuja "en negativo"
 * (módulo oscuro = espacio) porque las consolas suelen tener fondo oscuro.
 */
function qrTerminal(text) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const size = modules.size;
  const margin = 2;
  const dark = (x, y) => x >= 0 && y >= 0 && x < size && y < size && modules.get(y, x);
  const lines = [];
  for (let y = -margin; y < size + margin; y += 2) {
    let line = '  ';
    for (let x = -margin; x < size + margin; x++) {
      const top = !dark(x, y); // claro = bloque relleno
      const bottom = !dark(x, y + 1);
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** En Windows, pone la consola en UTF-8 para que se vean los bloques del QR. */
function enableUtf8Console() {
  if (process.platform !== 'win32' || !process.stdout.isTTY) return;
  try {
    require('node:child_process').execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    /* sin chcp: se intenta igual */
  }
}

/** Abre una URL en el navegador por defecto del sistema. */
function openBrowser(url) {
  const { spawn } = require('node:child_process');
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  } catch {
    /* sin navegador disponible: queda el QR de la consola */
  }
}

module.exports = { lanAddresses, primaryUrl, qrSvg, qrTerminal, enableUtf8Console, openBrowser };
