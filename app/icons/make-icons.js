#!/usr/bin/env node
/**
 * Genera los íconos a partir de los SVG de esta carpeta:
 *   AppIcon.icns (macOS), app.ico (Windows), menubar-icon.png (barra de menú),
 *   y los PNG de la PWA en app/public.
 * Requiere @resvg/resvg-js (npm i -D @resvg/resvg-js).
 */
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const dir = __dirname;
const pub = path.join(dir, '..', 'public');
const appSvg = fs.readFileSync(path.join(dir, 'app-icon.svg'), 'utf8');
// Versión a sangre completa (sin el margen de macOS) para la PWA y Windows
const fullSvg = appSvg.replace('viewBox="0 0 1024 1024"', 'viewBox="100 100 824 824"');
const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

// macOS .icns: entradas PNG (ic07=128, ic08=256, ic09=512, ic10=1024, ic11=32@2x, ic12=64@2x, ic13=256@2x, ic14=512@2x)
const icnsTypes = [['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]];
const chunks = icnsTypes.map(([t, s]) => {
  const data = png(appSvg, s);
  const h = Buffer.alloc(8); h.write(t, 0, 'ascii'); h.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([h, data]);
});
const body = Buffer.concat(chunks);
const head = Buffer.alloc(8); head.write('icns', 0, 'ascii'); head.writeUInt32BE(body.length + 8, 4);
fs.writeFileSync(path.join(dir, 'AppIcon.icns'), Buffer.concat([head, body]));

// Windows .ico con entradas PNG
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const imgs = icoSizes.map((s) => png(s <= 32 ? fullSvg : appSvg.replace('viewBox="0 0 1024 1024"', 'viewBox="60 60 904 904"'), s));
const ico = Buffer.alloc(6 + 16 * imgs.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(imgs.length, 4);
let off = ico.length;
imgs.forEach((d, i) => {
  const e = 6 + i * 16, s = icoSizes[i];
  ico.writeUInt8(s >= 256 ? 0 : s, e); ico.writeUInt8(s >= 256 ? 0 : s, e + 1);
  ico.writeUInt16LE(1, e + 4); ico.writeUInt16LE(32, e + 6);
  ico.writeUInt32LE(d.length, e + 8); ico.writeUInt32LE(off, e + 12); off += d.length;
});
fs.writeFileSync(path.join(dir, 'app.ico'), Buffer.concat([ico, ...imgs]));

// Barra de menú: plantilla 18pt @2x
fs.writeFileSync(path.join(dir, 'menubar-icon.png'), png(fs.readFileSync(path.join(dir, 'menubar-icon.svg'), 'utf8'), 36));

// PWA
fs.writeFileSync(path.join(pub, 'icon-180.png'), png(fullSvg, 180));
fs.writeFileSync(path.join(pub, 'icon-512.png'), png(fullSvg, 512));
fs.writeFileSync(path.join(pub, 'icon.svg'), fullSvg);
fs.writeFileSync(path.join(dir, 'preview.png'), png(appSvg, 512));
console.log('íconos listos');
