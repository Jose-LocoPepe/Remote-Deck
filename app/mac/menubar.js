// Ícono de Remote Deck en la barra de menú de macOS (JXA: osascript -l JavaScript).
// Al hacer clic muestra el QR directamente en el menú.
// Uso: osascript -l JavaScript menubar.js <pid-del-servidor> <puerto> <ruta-ícono-barra>
ObjC.import('Cocoa');

function run(argv) {
  const pid = argv[0];
  const port = argv[1] || '8080';
  const iconPath = argv[2];
  const base = 'http://localhost:' + port;
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);

  const open = (url) => $.NSWorkspace.sharedWorkspace.openURL($.NSURL.URLWithString(url));
  const fetchText = (url) => {
    const d = $.NSData.dataWithContentsOfURL($.NSURL.URLWithString(url));
    return d.isNil() ? '' : $.NSString.alloc.initWithDataEncoding(d, $.NSUTF8StringEncoding).js;
  };
  let lanUrl = '';

  const menu = $.NSMenu.alloc.init;
  menu.autoenablesItems = false;
  const qrItem = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent('', null, '');
  const urlItem = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent('Iniciando…', null, '');
  urlItem.enabled = false;

  // Refresca QR y dirección cada vez que se abre el menú (la IP puede cambiar).
  function refresh() {
    const img = $.NSImage.alloc.initWithContentsOfURL($.NSURL.URLWithString(base + '/qr.png?t=' + Date.now()));
    if (!img.isNil()) {
      img.size = $.NSMakeSize(220, 220);
      qrItem.image = img;
    }
    try { lanUrl = JSON.parse(fetchText(base + '/info')).url || lanUrl; } catch (e) {}
    urlItem.title = lanUrl ? 'Escanéalo con el celular · ' + lanUrl.replace('http://', '') : 'Esperando al servidor…';
  }

  ObjC.registerSubclass({
    name: 'RDMenuTarget',
    protocols: ['NSMenuDelegate'],
    methods: {
      'menuWillOpen:': { types: ['void', ['id']], implementation: () => refresh() },
      'copyUrl:': { types: ['void', ['id']], implementation: () => {
        const pb = $.NSPasteboard.generalPasteboard;
        pb.clearContents;
        pb.setStringForType(lanUrl, $.NSPasteboardTypeString);
      } },
      'openApp:': { types: ['void', ['id']], implementation: () => open(base) },
      'quit:': { types: ['void', ['id']], implementation: () => {
        if (pid) $.NSTask.launchedTaskWithLaunchPathArguments('/bin/kill', [pid]);
        app.terminate(null);
      } },
    },
  });
  const target = $.RDMenuTarget.alloc.init;
  menu.delegate = target;

  const add = (title, sel, key) => {
    const it = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(title, sel, key || '');
    it.target = target;
    menu.addItem(it);
  };
  menu.addItem(qrItem);
  menu.addItem(urlItem);
  menu.addItem($.NSMenuItem.separatorItem);
  add('Copiar dirección', 'copyUrl:', 'c');
  add('Abrir Remote Deck en este Mac', 'openApp:', 'o');
  menu.addItem($.NSMenuItem.separatorItem);
  add('Desconectar y salir', 'quit:', '');

  const item = $.NSStatusBar.systemStatusBar.statusItemWithLength($.NSVariableStatusItemLength);
  const icon = iconPath ? $.NSImage.alloc.initWithContentsOfFile(iconPath) : $();
  if (iconPath && !icon.isNil()) {
    icon.size = $.NSMakeSize(18, 18);
    icon.template = true; // se adapta a barra clara/oscura
    item.button.image = icon;
  } else {
    item.button.title = '◉ RD';
  }
  item.button.toolTip = 'Remote Deck';
  item.menu = menu;

  // Si el servidor se cierra solo, quitar también el ícono.
  $.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(3, true, () => {
    const t = $.NSTask.alloc.init;
    t.launchPath = '/bin/kill';
    t.arguments = ['-0', pid];
    t.launch; t.waitUntilExit;
    if (t.terminationStatus !== 0) app.terminate(null);
  });

  // Al abrir: desplegar el menú con el QR (sin abrir el navegador).
  $.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(1.5, false, () => item.button.performClick(null));
  app.run;
}
