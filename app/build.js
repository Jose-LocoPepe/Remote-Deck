#!/usr/bin/env node
/**
 * Compila Deck View a ejecutables autónomos con Bun (no requiere Node/npm).
 *
 *   npm run build          # compila la librería a dist/
 *   bun app/build.js       # genera release/DeckView-*
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
  ['bun-windows-x64', 'DeckView-win.exe'],
  ['bun-darwin-arm64', 'DeckView-mac-arm64'],
  ['bun-darwin-x64', 'DeckView-mac-x64'],
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
  `globalThis.__DECKVIEW_ASSETS = ${JSON.stringify(assets)};\nrequire('./server.js');\n`,
);

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
try {
  for (const [target, name] of TARGETS) {
    if (only && !target.includes(only)) continue;
    console.log(`→ ${name}`);
    execFileSync(
      process.execPath,
      ['build', ENTRY, '--compile', '--minify', '--conditions=module-sync', `--target=${target}`, '--outfile', path.join(OUT, name)],
      { stdio: 'inherit', cwd: ROOT },
    );
  }
} finally {
  fs.rmSync(ENTRY, { force: true });
}
console.log(`\nListo: ${OUT}`);
