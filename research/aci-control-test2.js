// Prueba /Control/ACI/<name> ,iii f con varias combinaciones de enteros.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../dist/remote/index.js');
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)} ${s}`);
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) { sessions.add(s); return orig.call(this, s); };
const remote = new SeratoRemoteClient({ peerName: process.env.PEER_NAME || 'ACI Control Test 2', port: Number(process.env.RPORT) || 0, subscribeTopics: DEFAULT_SUBSCRIPTION_TOPICS, logger: process.env.DEBUG ? { debug: (...a) => log('dbg ' + a.map(String).join(' ')), info: (...a) => log('inf ' + a.map(String).join(' ')), warn: (...a) => log('wrn ' + a.map(String).join(' ')), error: (...a) => log('err ' + a.map(String).join(' ')) } : undefined });
const st = {};
remote.on('playhead', ({ deckId, playhead }) => {
  const p = playhead.raw[1] > 0.001;
  if (st[deckId] !== p) { st[deckId] = p; log(`   deck ${deckId} ${p ? 'PLAYING' : 'stopped'}`); }
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (name, a, b, c) => {
  log(`SEND /Control/ACI/${name} i:${a} i:${b} i:${c} f:1 → f:0`);
  for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(a), arg.i(b), arg.i(c), arg.f(1)));
  await wait(150);
  for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(a), arg.i(b), arg.i(c), arg.f(0)));
  await wait(2500);
};
remote.on('paired', async () => {
  await wait(1500);
  for (const combo of [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0]]) {
    await press('play', ...combo);
    // si algo empezó a sonar, lo detenemos con la misma combinación
    if (Object.values(st).some(Boolean)) { log('   (repito para pausar)'); await press('play', ...combo); }
  }
  log('fin'); await remote.stop(); process.exit(0);
});
remote.on('ready', (i) => log('ready ' + i.instanceName)); remote.on('peerConnected', () => log('peer connected')); remote.on('error', (e) => log('ERR ' + e.message));
remote.start(); setTimeout(() => { log('timeout'); process.exit(1); }, 30000);
