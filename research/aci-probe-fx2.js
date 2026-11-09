// Prueba en vivo: biblioteca, carga, FX y volumen del sampler.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');
const NAMES = ['browse_info_selected_index_position','library_scroll','load_track','load_track_feedback','effect_slot_enable','effect_slot_parameter_1','effect_level_1_slot_enable','effect_level_1_slot_parameter_1','effect_bank_beats_multiplier','effect_bank_beats_multiplier_info','effect_select_string_output','effect_bank_mode','sample_player_volume','sample_player_bank_select','effect_scroll','effect_select'];
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)} ${s}`);
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) {
  sessions.add(s);
  s.on('status', (m) => (m.address.includes('FX')) && log(`   RECV ${m.address} ${m.args.map((a) => a.type + ':' + (typeof a.value === 'number' ? +a.value.toFixed?.(3) : a.value)).join(' ')}`));
  return orig.call(this, s);
};
const remote = new SeratoRemoteClient({ peerName: 'ACI UI Test', port: 52982,
  subscribeTopics: [...DEFAULT_SUBSCRIPTION_TOPICS, ...NAMES.map((n) => '/Register/Status/ACI/' + n), ...['FX/Slot/Enabled','FX/Slot/Value','FX/Slot/Effect','FX/Slot/Mode','FX/Slot/BeatsIndex','FX/Slot/DeckAssign','MultiFX/List','MultiFX/Beats','SingleFX/List'].map(n=>'/Register/Status/'+n)] });
remote.on('trackLoaded', (e) => log('   TRACK ' + JSON.stringify(e).slice(0, 120)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (name, set, deck, prop, v) => { for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(set), arg.i(deck), arg.i(prop), arg.f(v))); log(`SEND ${name} ${set} ${deck} ${prop} ${v}`); };
remote.on('error', (e) => log('err ' + e.code));
let done = false;
remote.on('paired', async () => { if (done) return; done = true;
  await wait(3000);
  for (const set of [4]) for (const deck of [0,1]) for (const prop of [0,1,2]) { send('effect_slot_enable',set,deck,prop,1); await wait(400); send('effect_slot_enable',set,deck,prop,0); await wait(300);} log('fin-lib'); await remote.stop(); process.exit(0);
  log('=== FX: slot enable / depth, sets 0..3');
  for (const set of [0, 1, 2, 3]) {
    send('effect_slot_enable', set, 0, 0, 1); await wait(700);
    send('effect_slot_parameter_1', set, 0, 0, 0.8); await wait(700);
    send('effect_slot_enable', set, 0, 0, 0); await wait(500);
  }
  log('=== beats');
  for (const set of [0, 2]) { send('effect_bank_beats_multiplier_step', set, 0, 0, 1); await wait(700); }
  log('=== sampler volume');
  for (const set of [0, 1]) { send('sample_player_volume', set, 0, 0, 0.3); await wait(700); send('sample_player_volume', set, 0, 0, 1); await wait(500); }
  log('fin'); await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => { log('timeout'); process.exit(1); }, 60000);
