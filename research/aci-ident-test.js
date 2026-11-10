// Prueba formatos de identificador ACI con deck y registra qué responde Serato.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../dist/remote/index.js');
const VARIANTS = ['play/1', 'play/2', 'play:1', '1/play', 'deck/1/play', 'Deck/1/play', 'play.1', 'play[1]', 'play_1', 'play?deck=1', 'play@1', 'play#1'];
const log = (s) => console.log(s);
const fmt = (a) => a.map((x) => `${x.type}:${x.value}`).join(' ');
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) { sessions.add(s); s.on('status', (m) => m.address.startsWith('/Status/ACI/') && log(`RECV ${m.address} ${fmt(m.args)}`)); return orig.call(this, s); };
const topics = [...DEFAULT_SUBSCRIPTION_TOPICS, ...VARIANTS.map((v) => `/Register/Status/ACI/${v}`)];
const remote = new SeratoRemoteClient({ peerName: 'ACI Ident Test', subscribeTopics: topics });
remote.on('paired', async () => {
  await new Promise((r) => setTimeout(r, 1000));
  for (const s of sessions) { s.send(osc('/Register/Status/ACI/play', arg.i(1))); s.send(osc('/Register/Status/ACI/play', arg.s('1'))); }
  log('sent arg variants');
  await new Promise((r) => setTimeout(r, 2000));
  await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => process.exit(1), 20000);
