// Prueba en vivo: pitch_bend (nudge temporal) y combinaciones del sampler / loops guardados.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');
const NAMES = ['codfather_st','codfather_st_solo','codfather_ac','codfather_in','stems_all_set_state','stems_playing'];
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)} ${s}`);
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) {
  sessions.add(s);
  s.on('status', (m) => m.address.startsWith('/Status/ACI/') && NAMES.some((n) => m.address.endsWith('/' + n)) && log(`   RECV ${m.address.slice(12)} ${m.args.map((a) => a.type + ':' + a.value).join(' ')}`));
  return orig.call(this, s);
};
const remote = new SeratoRemoteClient({ peerName: 'ACI Sampler Test', port: 52980,
  subscribeTopics: [...DEFAULT_SUBSCRIPTION_TOPICS, ...NAMES.map((n) => '/Register/Status/ACI/' + n)] });
let ph = {};
remote.on('playhead', ({ deckId, playhead }) => { ph[deckId] = playhead.raw; });
remote.on('loopChange', ({ deckId, loop }) => log(`   loop deck ${deckId} ${JSON.stringify(loop)}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (name, set, deck, prop, v) => { for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(set), arg.i(deck), arg.i(prop), arg.f(v))); log(`SEND ${name} set=${set} deck=${deck} prop=${prop} v=${v}`); };
const rate = (l) => log(`   [${l}] rate=${ph[1]?.[1]?.toFixed(4)}`);
remote.on('error', (e) => log('err ' + e.code));
let done = false;
remote.on('paired', async () => { if (done) return; done = true;
  await wait(2500); send('play', 0, 0, 0, 1); await wait(1500);
  for (const n of ['codfather_st', 'codfather_st_solo']) for (const p of [0, 1, 2, 3]) {
    log(`=== ${n} stem ${p}`); send(n, 0, 0, p, 1); await wait(1500); send(n, 0, 0, p, 0); await wait(1500);
  }
  send('play', 0, 0, 0, 0); log('fin'); await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => { log('timeout'); process.exit(1); }, 90000);
