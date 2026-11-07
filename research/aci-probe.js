#!/usr/bin/env node
/**
 * Sondeo ACI: se suscribe a /Register/Status/ACI/<id> (por número y por nombre)
 * y registra todo lo que Serato envía que no sea el stream /Status/ conocido.
 *
 *   npm run build && node research/aci-probe.js
 *
 * Escribe en consola y en research/aci-probe.log.
 * Comandos por teclado (para probar control más adelante):
 *   send /Control/ACI/151 i:0 f:1      → envía un mensaje OSC
 *   mark texto                          → escribe una marca en el log
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');

const NAMES = fs
  .readFileSync(path.join(__dirname, 'aci-control-names-4.0.2.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);
const MAX_ID = Number(process.env.MAX_ID) || 1024;

const topics = [...DEFAULT_SUBSCRIPTION_TOPICS];
for (let i = 0; i < MAX_ID; i++) topics.push(`/Register/Status/ACI/${i}`);
for (const n of NAMES) topics.push(`/Register/Status/ACI/${n}`);

const KNOWN = new Set(DEFAULT_SUBSCRIPTION_TOPICS.map((t) => t.replace('/Register', '')));
const logFile = fs.createWriteStream(path.join(__dirname, 'aci-probe.log'), { flags: 'a' });
const log = (line) => {
  const s = `${new Date().toISOString().slice(11, 23)} ${line}`;
  console.log(s);
  logFile.write(s + '\n');
};
const fmtArgs = (args) =>
  args.map((a) => (a.type === 'b' ? `b:${a.value.toString('hex')}` : `${a.type}:${a.value}`)).join(' ');

const sessions = new Set();
const proto = SeratoRemoteClient.prototype;
const origAttach = proto.attachSession;
proto.attachSession = function (session) {
  sessions.add(session);
  session.on('closed', () => sessions.delete(session));
  session.on('status', (msg) => {
    const base = msg.address;
    if (KNOWN.has(base)) return;
    log(`RECV ${base} ${fmtArgs(msg.args)}`);
  });
  return origAttach.call(this, session);
};

const remote = new SeratoRemoteClient({ peerName: 'ACI Probe', subscribeTopics: topics });
remote.on('ready', (i) => log(`advertised "${i.instanceName}" :${i.port}  (${topics.length} topics)`));
remote.on('paired', (p) => log(`PAIRED ${p.peerName}`));
remote.on('peerDisconnected', () => log('peer disconnected'));
remote.on('error', (e) => log(`ERR ${e.message}`));
remote.on('deckChange', ({ deckId, track }) => log(`deck ${deckId} → ${track?.title ?? '(empty)'}`));
remote.on('loopChange', ({ deckId, loop }) => log(`loop ${deckId} ${JSON.stringify(loop)}`));
remote.start();

const parseArg = (tok) => {
  const [t, ...rest] = tok.split(':');
  const v = rest.join(':');
  if (t === 'i') return arg.i(parseInt(v, 10));
  if (t === 'f') return arg.f(parseFloat(v));
  if (t === 's') return arg.s(v);
  throw new Error(`arg inválido: ${tok}`);
};
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  try {
    if (cmd === 'send') {
      const [address, ...a] = rest;
      const msg = osc(address, ...a.map(parseArg));
      for (const s of sessions) s.send(msg);
      log(`SENT ${address} ${a.join(' ')} → ${sessions.size} streams`);
    } else if (cmd === 'mark') {
      log(`=== ${rest.join(' ')} ===`);
    }
  } catch (e) {
    log(`ERR ${e.message}`);
  }
});
process.on('SIGINT', async () => {
  await remote.stop().catch(() => {});
  process.exit(0);
});
