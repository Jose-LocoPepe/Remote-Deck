// Verifica semántica de cue_point (hot cue), cue y sync_mode en el deck 1.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../dist/remote/index.js');
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)} ${s}`);
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) {
  sessions.add(s);
  s.on('status', (m) => m.address.startsWith('/Status/ACI/') && log(`   RECV ${m.address} ${m.args.map((a) => a.type + ':' + a.value).join(' ')}`));
  return orig.call(this, s);
};
const topics = [...DEFAULT_SUBSCRIPTION_TOPICS, ...['play', 'cue', 'cue_point', 'sync_mode', 'keylock'].map((n) => '/Register/Status/ACI/' + n)];
const remote = new SeratoRemoteClient({ peerName: 'ACI Test 3', port: 52977, subscribeTopics: topics });
let pos = {};
remote.on('playhead', ({ deckId, playhead }) => { pos[deckId] = playhead.raw; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (name, deck, prop, v) => { for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(0), arg.i(deck), arg.i(prop), arg.f(v))); log(`SEND ${name} deck=${deck} prop=${prop} v=${v}`); };
const show = () => log(`   deck1 pos=${pos[1]?.[0]?.toFixed(2)} rate=${pos[1]?.[1]}`);
remote.on('paired', async () => {
  await wait(1500); show();
  log('--- play 2s');
  send('play', 0, 0, 1); await wait(2000); send('play', 0, 0, 0); await wait(500); show();
  log('--- cue_point prop=0 (hot cue 1) press/release');
  send('cue_point', 0, 0, 1); await wait(200); send('cue_point', 0, 0, 0); await wait(800); show();
  log('--- play 2s, then cue press/release');
  send('play', 0, 0, 1); await wait(2000); send('cue', 0, 0, 1); await wait(200); send('cue', 0, 0, 0); await wait(800); show();
  log('--- keylock on/off');
  send('keylock', 0, 0, 1); await wait(1200); send('keylock', 0, 0, 0); await wait(1200);
  log('fin'); await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => { log('timeout'); process.exit(1); }, 45000);
