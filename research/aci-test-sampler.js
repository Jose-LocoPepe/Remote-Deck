// Prueba en vivo: pitch_bend (nudge temporal) y combinaciones del sampler / loops guardados.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');
const NAMES = ['sample_player_slot_play', 'sample_player_slot_stop', 'sample_player_enable', 'slot_loop', 'slot_reloop', 'loop_slot_set', 'pitch_bend_up', 'pitch_bend_down'];
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
remote.on('paired', async () => {
  await wait(2000);
  send('play', 0, 0, 0, 1); await wait(800); rate('start');
  log('=== pitch_bend_up hold 600ms (debería volver a 1.0 al soltar)');
  send('pitch_bend_up', 0, 0, 0, 1); await wait(400); rate('hold'); await wait(200); send('pitch_bend_up', 0, 0, 0, 0); await wait(500); rate('release');
  send('play', 0, 0, 0, 0); await wait(600);
  log('=== sampler: combinaciones (set, deck, prop)');
  for (const [s, d, p] of [[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 0, 0], [3, 0, 0], [0, 4, 0], [1, 1, 0]]) {
    send('sample_player_slot_play', s, d, p, 1); await wait(700);
    send('sample_player_slot_stop', s, d, p, 1); await wait(400);
  }
  log('fin'); await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => { log('timeout'); process.exit(1); }, 60000);
