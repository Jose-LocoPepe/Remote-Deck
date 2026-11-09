// Envía cada control con distintos deck_set/deck y marca en el log de Serato cuál da error.
const { SeratoRemoteClient, DEFAULT_SUBSCRIPTION_TOPICS, osc, arg } = require('../lib/serato/remote/index.js');
const fs = require('fs'), path = require('path');
const LOGDIR = path.join(process.env.USERPROFILE, 'Music/_Serato_/Logs');
const logf = path.join(LOGDIR, fs.readdirSync(LOGDIR).filter((f) => f.endsWith('.log')).sort().pop());
const TESTS = JSON.parse(process.argv[2]); // [[name, value], ...]
const sessions = new Set();
const proto = SeratoRemoteClient.prototype, orig = proto.attachSession;
proto.attachSession = function (s) { sessions.add(s); return orig.call(this, s); };
const remote = new SeratoRemoteClient({ peerName: 'ACI Grid', port: 52983, subscribeTopics: DEFAULT_SUBSCRIPTION_TOPICS });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
remote.on('error', () => {});
let done = false;
remote.on('paired', async () => { if (done) return; done = true;
  await wait(2500);
  for (const [name, v] of TESTS) for (const set of [0, 1, 2, 3, 4, 5]) for (const deck of [0, 1]) {
    const before = fs.statSync(logf).size;
    for (const s of sessions) s.send(osc(`/Control/ACI/${name}`, arg.i(set), arg.i(deck), arg.i(0), arg.f(v)));
    await wait(450);
    const fd = fs.openSync(logf, 'r'); const len = fs.statSync(logf).size - before; const b = Buffer.alloc(Math.max(0, len)); fs.readSync(fd, b, 0, len, before); fs.closeSync(fd);
    const t = b.toString().split('\n').filter((l) => /ACI|key|inject/i.test(l)).map((l) => l.replace(/^.*\]\s*/, '')).join(' | ');
    console.log(`${name.padEnd(36)} set=${set} deck=${deck}  ${t || 'OK(sin error)'}`);
  }
  await remote.stop(); process.exit(0);
});
remote.start(); setTimeout(() => process.exit(1), 120000);
