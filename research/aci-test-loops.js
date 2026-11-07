// Prueba: auto loop por tamaño (auto_loop_specific_length / roll) con property = índice.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)} ${s}`);
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) { sessions.add(s); return orig.call(this, s); };
const remote = new SeratoRemoteClient({ peerName: 'ACI Loop Test', port: 52981, subscribeTopics: DEFAULT_SUBSCRIPTION_TOPICS });
let ready = false;
remote.on('loopChange', ({ deckId, loop }) => ready && deckId === 1 && log(`   loop ${JSON.stringify(loop)}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (name, prop, v) => { for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(0), arg.i(0), arg.i(prop), arg.f(v))); log(`SEND ${name} prop=${prop} v=${v}`); };
remote.on('paired', async () => {
  await wait(2000); ready = true;
  send('play', 0, 1); await wait(500);
  for (const p of [0, 3, 5]) {
    send('auto_loop_specific_length', p, 1); await wait(250); send('auto_loop_specific_length', p, 0); await wait(900);
    send('auto_loop_enable', 0, 0); await wait(600);
  }
  log('--- roll');
  send('auto_loop_roll_specific_length', 2, 1); await wait(700); send('auto_loop_roll_specific_length', 2, 0); await wait(700);
  send('play', 0, 0);
  log('fin'); await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => { log('timeout'); process.exit(1); }, 40000);
