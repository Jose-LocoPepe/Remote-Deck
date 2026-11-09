// Vuelca los /Status/ACI de los nombres pedidos tal cual (dirección + args).
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS } = require('../lib/serato/remote/index.js');
const NAMES = process.argv[2].split(',');
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) {
  s.on('status', (m) => NAMES.some((n) => m.address.includes(n)) && console.log(m.address, JSON.stringify(m.args)));
  return orig.call(this, s);
};
const remote = new SeratoRemoteClient({ peerName: 'ACI Dump', port: 52984, subscribeTopics: [...DEFAULT_SUBSCRIPTION_TOPICS, ...NAMES.map((n) => '/Register/Status/ACI/' + n)] });
remote.on('error', () => {});
remote.start(); setTimeout(async () => { await remote.stop(); process.exit(0); }, +process.argv[3] || 8000);
