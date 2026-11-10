#!/usr/bin/env node
/**
 * Deck View — servidor de visualización.
 *
 * Se anuncia a Serato DJ Pro como un "remote" (protocolo Serato Remote),
 * guarda el estado de los decks y lo envía a los navegadores por
 * Server-Sent Events. La interfaz (PWA) vive en ./public.
 *
 *   npm run build && node app/server.js
 *   PORT=8080 PEER_NAME="Deck View" node app/server.js
 */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// Importa solo el protocolo y los lectores de tags (sin SQLite), para que se
// pueda compilar a un ejecutable con Bun (ver app/build.js).
const { SeratoRemoteClient, NUM_REMOTE_DECKS, osc, arg } = require('../dist/remote/index.js');
const { getTrackMetadata } = require('../dist/readers/index.js');

const HTTP_PORT = Number(process.env.PORT) || 8080;
const PEER_NAME = process.env.PEER_NAME || 'Deck View';
const PUBLIC = path.join(__dirname, 'public');
const PLAYHEAD_MIN_MS = 66; // ~15 fps hacia los navegadores

// ── Estado ──────────────────────────────────────────────────────────────────
const state = {
  status: { advertising: false, paired: false, peerName: '' },
  decks: Array.from({ length: NUM_REMOTE_DECKS }, (_, i) => ({
    id: i + 1,
    track: null, // { title, artist, filePath }
    meta: null, // { duration, key, color, cues, loops, overview, baseBpm }
    pos: 0,
    rate: 0,
    bpm: 0,
    loop: {},
  })),
  mixer: { crossfader: null, upfaders: [] },
};

// ── SSE ─────────────────────────────────────────────────────────────────────
const clients = new Set();
function send(res, type, data) {
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}
function broadcast(type, data) {
  for (const res of clients) send(res, type, data);
}

// ── Metadatos del archivo (lo que el protocolo no envía) ────────────────────
const hex = (c) =>
  c ? '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('') : null;

/** Overview de Serato: 240 columnas × 16 bandas → 240 alturas 0..1. */
function overviewToPeaks(buf) {
  if (!buf || buf.length < 16) return null;
  const start = buf.length % 16; // cabecera de versión
  const cols = Math.floor((buf.length - start) / 16);
  const peaks = [];
  let max = 1;
  for (let i = 0; i < cols; i++) {
    let sum = 0;
    for (let j = 0; j < 16; j++) sum += buf[start + i * 16 + j];
    peaks.push(sum);
    if (sum > max) max = sum;
  }
  return peaks.map((p) => +(p / max).toFixed(3));
}

async function loadMeta(filePath) {
  if (!filePath) return null;
  const meta = { duration: null, key: null, color: null, cues: [], loops: [], overview: null, baseBpm: null };
  try {
    const { parseFile } = await import('music-metadata');
    const mm = await parseFile(filePath, { skipCovers: true, duration: true });
    meta.duration = mm.format.duration ?? null;
    meta.key = mm.common.key ?? null;
    meta.baseBpm = mm.common.bpm ?? null;
  } catch {
    /* archivo no accesible (streaming, otra máquina…) */
  }
  try {
    const s = await getTrackMetadata(filePath);
    if (s?.markers) {
      meta.color = hex(s.markers.trackColor);
      meta.cues = s.markers.cuePoints.map((c) => ({
        index: c.index,
        pos: c.position / 1000,
        color: hex(c.color),
        name: c.name || '',
      }));
      meta.loops = s.markers.loops.map((l) => ({
        index: l.index,
        start: l.startPosition / 1000,
        end: l.endPosition / 1000,
        name: l.name || '',
      }));
    }
    if (s?.autotags?.bpm) meta.baseBpm = s.autotags.bpm;
    meta.overview = overviewToPeaks(s?.overview);
  } catch {
    /* sin tags de Serato */
  }
  return meta;
}

// ── Serato ──────────────────────────────────────────────────────────────────
// ── Control (ACI) ───────────────────────────────────────────────────────────
// /Control/ACI/<nombre> ,iiif = (deck_set, deck 0-based, property, valor).
// Ver research/ACI-FINDINGS.md. Solo se permiten estos controles:
const CONTROLS = new Set([
  'play', 'cue', 'cue_point', 'keylock', 'auto_loop_enable',
  'loop_length_half', 'loop_length_double', 'censor', 'reloop',
]);
const sessions = new Set();
const origAttach = SeratoRemoteClient.prototype.attachSession;
SeratoRemoteClient.prototype.attachSession = function (session) {
  sessions.add(session);
  session.on('closed', () => sessions.delete(session));
  return origAttach.call(this, session);
};
// Serato escribe los cues nuevos en el archivo solo al expulsar la pista, así que
// reflejamos de inmediato el hot cue creado desde un pad vacío (colores por defecto
// de Serato). Cuando Serato guarde el archivo, el watcher pone los datos reales.
const DEFAULT_CUE_COLORS = ['#cc0000', '#cc8800', '#0000cc', '#cccc00', '#00cc00', '#cc00cc', '#00cccc', '#8800cc'];
function reflectHotCue(d, index) {
  if (!d?.track || index < 0 || index > 7) return;
  d.meta = d.meta || { duration: null, key: null, color: null, cues: [], loops: [], overview: null, baseBpm: null };
  if (d.meta.cues.some((c) => c.index === index)) return;
  d.meta.cues.push({ index, pos: d.pos, color: DEFAULT_CUE_COLORS[index], name: '' });
  broadcast('deck', d);
}

function sendControl({ deck, name, prop = 0, value = 1 }) {
  if (!CONTROLS.has(name)) throw new Error('control no permitido');
  const d = Number(deck);
  if (!Number.isInteger(d) || d < 1 || d > NUM_REMOTE_DECKS) throw new Error('deck inválido');
  const msg = osc(`/Control/ACI/${name}`, arg.i(0), arg.i(d - 1), arg.i(Number(prop) | 0), arg.f(Number(value) || 0));
  for (const s of sessions) s.send(msg);
  if (name === 'cue_point' && Number(value) === 1) reflectHotCue(state.decks[d - 1], Number(prop) | 0);
  return sessions.size;
}

// Puerto TCP fijo: Bonjour cachea anuncios viejos y Serato se queda intentando
// puertos muertos; con un puerto estable siempre llega a este servidor.
const REMOTE_PORT = Number(process.env.REMOTE_PORT) || 52976;
const remote = new SeratoRemoteClient({ peerName: PEER_NAME, port: REMOTE_PORT });

remote.on('ready', ({ instanceName, port }) => {
  state.status.advertising = true;
  console.log(`Anunciado a Serato como "${instanceName}" (tcp :${port})`);
  broadcast('status', state.status);
});
remote.on('paired', (peer) => {
  state.status.paired = true;
  state.status.peerName = peer.peerName || 'Serato DJ';
  console.log(`Conectado con ${state.status.peerName}`);
  broadcast('status', state.status);
});
remote.on('peerDisconnected', () => {
  state.status.paired = false;
  broadcast('status', state.status);
});

// Serato guarda cues/loops en el archivo de audio tarde (al expulsar o cerrar),
// así que vigilamos los archivos cargados y releemos cuando cambian.
const watched = new Set();
function watchTrackFiles() {
  const wanted = new Set(state.decks.map((d) => d.track?.filePath).filter(Boolean));
  for (const fp of watched) {
    if (!wanted.has(fp)) {
      fs.unwatchFile(fp);
      watched.delete(fp);
    }
  }
  for (const fp of wanted) {
    if (watched.has(fp)) continue;
    watched.add(fp);
    fs.watchFile(fp, { interval: 2000 }, async (cur, prev) => {
      if (cur.mtimeMs === prev.mtimeMs) return;
      const meta = await loadMeta(fp);
      for (const d of state.decks) {
        if (d.track?.filePath === fp) {
          d.meta = meta;
          broadcast('deck', d);
        }
      }
    });
  }
}

remote.on('deckChange', async ({ deckId, track }) => {
  const d = state.decks[deckId - 1];
  if (!d) return;
  const loaded = track && track.valid !== false && (track.title || track.filePath);
  d.track = loaded ? { title: track.title || '', artist: track.artist || '', filePath: track.filePath || '' } : null;
  d.meta = null;
  broadcast('deck', d);
  watchTrackFiles();
  if (d.track?.filePath) {
    const fp = d.track.filePath;
    const meta = await loadMeta(fp);
    if (d.track?.filePath === fp) {
      d.meta = meta;
      broadcast('deck', d);
    }
  }
});

const lastSent = new Map();
remote.on('playhead', ({ deckId, playhead }) => {
  const d = state.decks[deckId - 1];
  if (!d) return;
  const [pos, rate, bpm] = playhead.raw;
  const wasPlaying = d.rate > 0.001;
  d.pos = pos;
  d.rate = rate;
  d.bpm = bpm;
  const now = Date.now();
  const playingChanged = wasPlaying !== rate > 0.001;
  if (playingChanged || now - (lastSent.get(deckId) || 0) >= PLAYHEAD_MIN_MS) {
    lastSent.set(deckId, now);
    broadcast('playhead', { id: deckId, pos, rate, bpm, t: now });
  }
});

remote.on('loopChange', ({ deckId, loop }) => {
  const d = state.decks[deckId - 1];
  if (!d) return;
  d.loop = loop;
  broadcast('loop', { id: deckId, loop });
});

remote.on('mixerChange', ({ mixer }) => {
  state.mixer = { crossfader: mixer.crossfader ?? null, upfaders: [...mixer.upfaders] };
  broadcast('mixer', state.mixer);
});

remote.on('error', (err) => console.warn('serato:', err.message));

// ── HTTP ────────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/control' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1000) req.destroy(); });
    req.on('end', () => {
      try {
        const n = sendControl(JSON.parse(body || '{}'));
        res.writeHead(n ? 204 : 503).end();
      } catch (e) {
        res.writeHead(400).end(e.message);
      }
    });
    return;
  }
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    send(res, 'snapshot', { ...state, t: Date.now() });
    clients.add(res);
    const ka = setInterval(() => res.write(': ka\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ka);
      clients.delete(res);
    });
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403).end();
    return;
  }
  const embedded = globalThis.__DECKVIEW_ASSETS;
  if (embedded) {
    const data = embedded[rel];
    if (!data) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(Buffer.from(data, 'base64'));
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('\nDeck View listo. Abre en el navegador:');
  console.log(`  http://localhost:${HTTP_PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  http://${a.address}:${HTTP_PORT}`);
    }
  }
  console.log('');
  remote.start().catch((e) => {
    console.error('No se pudo iniciar el remote:', e);
    process.exit(1);
  });
});

const shutdown = async () => {
  await remote.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
