// Prueba en vivo: sync, nudge, stems, sampler y loops guardados (deck 1).
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');
const NAMES = ['sync', 'sync_off', 'pitch_nudge_up', 'pitch_nudge_down', 'stems', 'vocals', 'drums', 'melody', 'all_stems', 'stem_fx',
  'sample_player_slot_play', 'sample_player_slot_stop', 'slot_loop', 'slot_reloop', 'loop_slot_set', 'play'];
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)} ${s}`);
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) {
  sessions.add(s);
  s.on('status', (m) => m.address.startsWith('/Status/ACI/') && log(`   RECV ${m.address.slice(12)} ${m.args.map((a) => a.type + ':' + a.value).join(' ')}`));
  return orig.call(this, s);
};
const remote = new SeratoRemoteClient({ peerName: 'ACI Perf Test', port: 52979,
  subscribeTopics: [...DEFAULT_SUBSCRIPTION_TOPICS, ...NAMES.map((n) => '/Register/Status/ACI/' + n)] });
let ph = {};
remote.on('playhead', ({ deckId, playhead }) => { ph[deckId] = playhead.raw; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (name, set, deck, prop, v) => { for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(set), arg.i(deck), arg.i(prop), arg.f(v))); log(`SEND ${name} set=${set} deck=${deck} prop=${prop} v=${v}`); };
const show = (l) => log(`   [${l}] d1 pos=${ph[1]?.[0]?.toFixed(2)} rate=${ph[1]?.[1]?.toFixed(4)} bpm=${ph[1]?.[2]?.toFixed(2)}`);
remote.on('paired', async () => {
  await wait(2000);
  log('=== play deck 1'); send('play', 0, 0, 0, 1); await wait(1500); show('playing');
  log('=== pitch_nudge_up hold 600ms'); send('pitch_nudge_up', 0, 0, 0, 1); await wait(300); show('during'); await wait(300); send('pitch_nudge_up', 0, 0, 0, 0); await wait(300); show('after');
  log('=== sync on'); send('sync', 0, 0, 0, 1); await wait(1200); show('sync1'); send('sync', 0, 0, 0, 0); await wait(1200); show('sync0');
  log('=== vocals off/on'); send('vocals', 0, 0, 0, 0); await wait(1500); send('vocals', 0, 0, 0, 1); await wait(1200);
  log('=== stems toggle'); send('stems', 0, 0, 0, 1); await wait(1200); send('stems', 0, 0, 0, 0); await wait(1200);
  log('=== sampler slot 1 (deck_set 0 / 1)'); send('sample_player_slot_play', 0, 0, 0, 1); await wait(800); send('sample_player_slot_play', 1, 0, 0, 1); await wait(800);
  send('sample_player_slot_stop', 1, 0, 0, 1); await wait(500);
  log('=== pause'); send('play', 0, 0, 0, 0); await wait(800);
  log('fin'); await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => { log('timeout'); process.exit(1); }, 60000);
