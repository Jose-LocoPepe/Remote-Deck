#!/usr/bin/env node
// Prueba de control ACI: empareja y envía una secuencia de mensajes de prueba.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)} ${s}`);
const fmt = (a) => a.map((x) => `${x.type}:${x.value}`).join(' ');
const sessions = new Set();
const proto = SeratoRemoteClient.prototype;
const orig = proto.attachSession;
proto.attachSession = function (s) {
  sessions.add(s);
  s.on('status', (m) => m.address.startsWith('/Status/ACI/') && /play|cue$|keylock/.test(m.address) && log(`RECV ${m.address} ${fmt(m.args)}`));
  return orig.call(this, s);
};
const topics = [...DEFAULT_SUBSCRIPTION_TOPICS, '/Register/Status/ACI/play', '/Register/Status/ACI/cue', '/Register/Status/ACI/keylock'];
const remote = new SeratoRemoteClient({ peerName: 'ACI Control Test', subscribeTopics: topics });
const send = (addr, ...a) => { for (const s of sessions) s.send(osc(addr, ...a)); log(`SENT ${addr} ${fmt(a)}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
remote.on('playhead', ({ deckId, playhead }) => {
  const r = playhead.raw[1];
  const k = `p${deckId}`;
  const playing = r > 0.001;
  if (remote[k] !== playing) { remote[k] = playing; log(`deck ${deckId} ${playing ? 'PLAYING' : 'stopped'}`); }
});
remote.on('paired', async () => {
  await wait(1500);
  log('--- A: /Control/ACI/play f:1 / f:0 (sin deck)');
  send('/Control/ACI/play', arg.f(1)); await wait(2500);
  send('/Control/ACI/play', arg.f(0)); await wait(2500);
  log('--- B: /Control/ACI/play i:1 f:1 (deck index 1)');
  send('/Control/ACI/play', arg.i(1), arg.f(1)); await wait(2500);
  send('/Control/ACI/play', arg.i(1), arg.f(0)); await wait(2500);
  log('--- C: suscribir con deck: /Register/Status/ACI/play i:1');
  send('/Register/Status/ACI/play', arg.i(1)); await wait(1500);
  log('--- fin'); await remote.stop(); process.exit(0);
});
remote.start();
setTimeout(() => process.exit(1), 40000);
