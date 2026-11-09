#!/usr/bin/env node
/**
 * Compila Remote Deck a ejecutables autónomos con Bun (no requiere Node/npm).
 *
 *   npm install
 *   bun app/build.js       # genera release/RemoteDeck-*
 *
 * La interfaz (app/public) se incrusta dentro del binario.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(__dirname, 'public');
const OUT = path.join(ROOT, 'release');
const ENTRY = path.join(__dirname, '.bundle-entry.js');

const TARGETS = [
  ['bun-windows-x64', 'RemoteDeck-win.exe'],
  ['bun-darwin-arm64', 'RemoteDeck-mac-arm64'],
  ['bun-darwin-x64', 'RemoteDeck-mac-x64'],
];

// Incluye app/public completo (con subcarpetas css/ y js/); claves con '/'.
const assets = {};
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else assets[path.relative(PUBLIC, full).split(path.sep).join('/')] = fs.readFileSync(full).toString('base64');
  }
})(PUBLIC);
fs.writeFileSync(
  ENTRY,
  `globalThis.__REMOTEDECK_ASSETS = ${JSON.stringify(assets)};\nrequire('./server.js');\n`,
);

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
try {
  for (const [target, name] of TARGETS) {
    if (only && !target.includes(only)) continue;
    console.log(`→ ${name}`);
    execFileSync(
      process.execPath,
      ['build', ENTRY, '--compile', '--minify', '--conditions=module-sync', `--target=${target}`, '--outfile', path.join(OUT, name),
        ...(target.includes('windows') ? [`--windows-icon=${path.join(__dirname, 'icons', 'app.ico')}`, '--windows-title=Remote Deck'] : [])],
      { stdio: 'inherit', cwd: ROOT },
    );
  }
} finally {
  fs.rmSync(ENTRY, { force: true });
}
// ── RemoteDeck.app: doble clic en el Mac, sin Terminal ──
// El lanzador elige el binario según el chip y abre el QR en el navegador.
if (!only || 'darwin'.includes(only)) {
  const arm = path.join(OUT, 'RemoteDeck-mac-arm64');
  const x64 = path.join(OUT, 'RemoteDeck-mac-x64');
  if (fs.existsSync(arm) && fs.existsSync(x64)) {
    const version = require('../package.json').version;
    const app = path.join(OUT, 'RemoteDeck.app', 'Contents');
    fs.rmSync(path.join(OUT, 'RemoteDeck.app'), { recursive: true, force: true });
    fs.mkdirSync(path.join(app, 'MacOS'), { recursive: true });
    fs.copyFileSync(arm, path.join(app, 'MacOS', 'remote-deck-arm64'));
    fs.copyFileSync(x64, path.join(app, 'MacOS', 'remote-deck-x64'));
    fs.mkdirSync(path.join(app, 'Resources'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'mac', 'menubar.js'), path.join(app, 'Resources', 'menubar.js'));
    fs.copyFileSync(path.join(__dirname, 'icons', 'menubar-icon.png'), path.join(app, 'Resources', 'menubar-icon.png'));
    fs.copyFileSync(path.join(__dirname, 'icons', 'AppIcon.icns'), path.join(app, 'Resources', 'AppIcon.icns'));
    // Lanzador: servidor en segundo plano + ícono en la barra de menú (Mostrar QR / Abrir / Desconectar).
    fs.writeFileSync(path.join(app, 'MacOS', 'RemoteDeck'), [
      '#!/bin/bash',
      'DIR="$(cd "$(dirname "$0")" && pwd)"',
      'BIN="$DIR/remote-deck-x64"',
      '[ "$(uname -m)" = "arm64" ] && BIN="$DIR/remote-deck-arm64"',
      'PORT="${PORT:-8080}"',
      'mkdir -p "$HOME/Library/Logs"',
      'PORT="$PORT" "$BIN" >> "$HOME/Library/Logs/RemoteDeck.log" 2>&1 &',
      'PID=$!',
      'trap "kill $PID 2>/dev/null" EXIT',
      'sleep 1',
      '/usr/bin/osascript -l JavaScript "$DIR/../Resources/menubar.js" "$PID" "$PORT" "$DIR/../Resources/menubar-icon.png"',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(app, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Remote Deck</string>
  <key>CFBundleDisplayName</key><string>Remote Deck</string>
  <key>CFBundleIdentifier</key><string>com.remotedeck.app</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleExecutable</key><string>RemoteDeck</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSLocalNetworkUsageDescription</key><string>Remote Deck se conecta con Serato DJ Pro en tu red local.</string>
  <key>NSBonjourServices</key><array><string>_SeratoIOSRemote._tcp</string></array>
</dict></plist>
`);
    // tar conserva los permisos de ejecución (un .zip hecho en Windows no).
    writeTarGz(path.join(OUT, 'RemoteDeck-mac.tar.gz'), OUT, 'RemoteDeck.app');
    console.log('→ RemoteDeck-mac.tar.gz (contiene RemoteDeck.app)');
  }
}
console.log(`\nListo: ${OUT}`);

// tar.gz mínimo (ustar) con permisos 755: el tar de Windows no admite --mode.
function writeTarGz(outFile, baseDir, rel) {
  const zlib = require('node:zlib');
  const blocks = [];
  const header = (name, size, type) => {
    const h = Buffer.alloc(512);
    h.write(name, 0, 100);
    h.write('0000755\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    h.write(size.toString(8).padStart(11, '0') + '\0', 124);
    h.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136);
    h.fill(' ', 148, 156); h.write(type, 156); h.write('ustar\0' + '00', 257);
    let sum = 0; for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    return h;
  };
  const walk = (r) => {
    const abs = path.join(baseDir, r);
    const name = r.split(path.sep).join('/');
    if (fs.statSync(abs).isDirectory()) {
      blocks.push(header(name + '/', 0, '5'));
      for (const f of fs.readdirSync(abs)) walk(path.join(r, f));
    } else {
      const data = fs.readFileSync(abs);
      blocks.push(header(name, data.length, '0'), data, Buffer.alloc((512 - data.length % 512) % 512));
    }
  };
  walk(rel);
  blocks.push(Buffer.alloc(1024));
  fs.writeFileSync(outFile, zlib.gzipSync(Buffer.concat(blocks)));
}
