const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// User contract: adapt desktop v0.9 for touch without changing its art or
// automatically substituting the lower-fidelity renderer. These VM checks do
// not claim real GPU/iOS rendering, frame-rate, or browser-layout coverage.
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const baseline = execFileSync('git', ['show', '512428b:index.html'], {
  cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
});
const scriptsOf = source => [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const embeddedAssetSources = source => [...source.matchAll(/<script src="(assets\/embedded\/asset-[^"]+\.js)"><\/script>/g)]
  .map(match => match[1]);
const moduleOf = (source, name) => scriptsOf(source).find(script => script.startsWith(`window.__HD2D_MODULES["${name}"]`));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function loadRuntime(source = html, devicePixelRatio = 3) {
  const context = vm.createContext({
    window: { __HD2D_MODULES: {}, devicePixelRatio }, devicePixelRatio,
    // Silence expected Three.js error output for deliberately missing WebGL.
    console: { log() {}, warn() {}, error() {} },
  });
  for (const name of ['three', 'art', 'animation', 'renderer']) {
    const script = moduleOf(source, name);
    assert.ok(script, `${name} must remain present in the playable artifact`);
    vm.runInContext(script, context);
  }
  return context.window.__HD2D_MODULES;
}

function unavailableWebGLCanvas() {
  const requested = [];
  const canvas = {
    clientWidth: 390, clientHeight: 844, style: {},
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    getContext(kind) {
      requested.push(kind);
      return kind === '2d' ? { setTransform() {} } : null;
    },
  };
  return { canvas, requested };
}

function bootClock({ autoRun = true } = {}) {
  let now = 0, nextId = 0;
  const timers = new Map(), elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) {
      const classes = new Set(id === 'fatal' ? ['hidden'] : []);
      const tag = html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`))?.[0] || '';
      elements.set(id, { hidden: /\shidden(?:\s|=|>)/.test(tag), textContent: '', classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
      } });
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    window: {}, document: { getElementById: getElement },
    location: { protocol: 'https:' }, addEventListener() {},
    setTimeout(fn, delay) { const id = ++nextId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const source = scriptsOf(html).find(script => script.startsWith('window.__HD2D_OFFLINE='));
  assert.ok(source, 'classic boot watchdog must remain available before game startup');
  const start = () => vm.runInContext(source, context);
  if (autoRun) start();
  return {
    get boot() { return context.window.__HD2D_BOOT; }, getElement, start,
    get pendingTimerCount() { return timers.size; },
    advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      now = end;
    },
  };
}

test('all seven embedded PNG assets are byte-identical to desktop v0.9', () => {
  const pngs = source => [...source.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)]
    .map(match => Buffer.from(match[1], 'base64'));
  const chunks = Array.from({ length: 7 }, () => []);
  const assetContext = vm.createContext({ window: { __HD2D_DATA_CHUNKS: chunks } });
  for (const relativePath of embeddedAssetSources(html)) {
    vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), assetContext);
  }
  const before = pngs(baseline), after = chunks.map(parts => Buffer.from(parts.join(''), 'base64'));
  assert.equal(before.length, 7);
  assert.equal(embeddedAssetSources(html).length, 30, 'all immutable asset chunks are referenced');
  assert.equal(after.length, 7, 'no missing, substituted or appended sprite sheets');
  for (let index = 0; index < before.length; index++) {
    assert.equal(after[index].length, before[index].length, `PNG ${index} byte size`);
    assert.equal(hash(after[index]), hash(before[index]), `PNG ${index} SHA-256`);
  }
});

test('desktop art, animation, 3D structures and visual budgets are preserved', () => {
  const current = loadRuntime(), original = loadRuntime(baseline);
  for (const name of ['three', 'art', 'animation']) {
    assert.equal(hash(moduleOf(html, name)), hash(moduleOf(baseline, name)), `${name} module must not be downgraded`);
  }
  for (const method of ['buildZone', 'createActor', 'updateActor', 'updateArchitecture',
    'setAtlas', 'setAnimationAtlases', 'makeParticles', 'setupPost', 'setQuality']) {
    assert.equal(
      current.renderer.WorldRenderer.prototype[method].toString(),
      original.renderer.WorldRenderer.prototype[method].toString(),
      `${method} must retain original desktop visual content/budget`,
    );
  }
});

test('missing WebGL fails explicitly and never silently requests Canvas 2D', () => {
  const { WorldRenderer } = loadRuntime().renderer;
  for (const options of [{}, { quality: 'high' }, { quality: 'low' },
    { compatibilityConfirmed: false }, { compatibilityConfirmed: 'true' }, { compatibilityConfirmed: 1 }]) {
    const { canvas, requested } = unavailableWebGLCanvas();
    assert.throws(() => new WorldRenderer(canvas, options), error => {
      assert.equal(error.code, 'HD2D_WEBGL_UNAVAILABLE');
      assert.ok(error.message.length > 0);
      return true;
    }, `explicit confirmation required for ${JSON.stringify(options)}`);
    assert.ok(requested.includes('webgl2'), 'actual Three.js attempted its WebGL2 context');
    assert.equal(requested.includes('2d'), false, 'failure must not change visual renderer');
  }
});

test('only boolean true confirmation enables actual Canvas compatibility renderer', () => {
  const { WorldRenderer, CanvasFallbackRenderer } = loadRuntime().renderer;
  const { canvas, requested } = unavailableWebGLCanvas();
  const renderer = new WorldRenderer(canvas, { quality: 'high', compatibilityConfirmed: true });
  assert.ok(renderer instanceof CanvasFallbackRenderer);
  assert.ok(requested.includes('2d'));
  const metrics = renderer.getMetrics();
  assert.match(metrics.renderer, /^Canvas 2D fallback/);
  assert.equal(metrics.quality, 'low', 'opted-in fallback must not claim desktop GPU quality');
  assert.equal(metrics.postprocessing, false);
  assert.equal(metrics.shadows, false);
});

test('baseline v0.9 reproduces the silent visual downgrade this regression prevents', () => {
  const { WorldRenderer, CanvasFallbackRenderer } = loadRuntime(baseline).renderer;
  const { canvas, requested } = unavailableWebGLCanvas();
  const renderer = new WorldRenderer(canvas, { quality: 'high' });
  assert.ok(renderer instanceof CanvasFallbackRenderer);
  assert.equal(renderer.getMetrics().quality, 'low');
  assert.ok(requested.includes('webgl2'));
  assert.ok(requested.includes('2d'));
});

test('high-quality settings preserve desktop DPR, shadows, particles and postprocessing intent', () => {
  const modules = loadRuntime(), T = modules.three;
  const renderer = Object.create(modules.renderer.WorldRenderer.prototype);
  const recorded = { sizes: [] };
  Object.assign(renderer, {
    options: { quality: 'low' }, _appliedQuality: 'low', width: 390, height: 844,
    renderer: { setPixelRatio(value) { recorded.pixelRatio = value; }, shadowMap: { enabled: false } },
    sun: { shadow: { mapSize: new T.Vector2(1024, 1024), map: null } },
    particles: { geometry: new T.BufferGeometry() }, materials: new Map(), target: {},
    resize(width, height) { recorded.sizes.push([width, height]); }, getMetrics() { return {}; },
  });
  renderer.setQuality('high');
  assert.equal(recorded.pixelRatio, 1.6);
  assert.equal(renderer.renderer.shadowMap.enabled, true);
  assert.equal(renderer.sun.shadow.mapSize.x, 2048);
  assert.equal(renderer.sun.shadow.mapSize.y, 2048);
  assert.equal(renderer.particles.geometry.drawRange.count, 160);
  assert.equal(renderer.usePost, true);
  assert.equal(renderer.options.quality, 'high');
  assert.deepEqual(recorded.sizes, [[390, 844]]);
});

test('renderer selection and quality code have no mobile user-agent or coarse-pointer branch', () => {
  const source = moduleOf(html, 'renderer');
  assert.doesNotMatch(source, /navigator\.(?:userAgent|maxTouchPoints)|matchMedia\s*\(|\b(?:iPhone|iPad|Android|pointer:coarse|any-pointer:coarse)\b/);
  assert.match(source, /this\.options=\{quality:'high'/);
  assert.match(html, /prefs=\{quality:'high'/);
  // Extra touch-input modules are allowed: exercise syntax, not an exact old count.
  for (const script of scriptsOf(html)) new vm.Script(script);
  assert.doesNotMatch(html, /<script[^>]+type=["']module/);
  assert.equal(embeddedAssetSources(html).length, 30);
  assert.doesNotMatch(html, /<script src="(?!assets\/embedded\/asset-)/,
    'the web build may only load versioned local asset chunks');
});

test('sequential decode progress extends watchdog without falsely failing a slow device', () => {
  const clock = bootClock();
  for (let sheet = 1; sheet <= 6; sheet++) {
    clock.advance(8000); // Each image is inside the existing 15-second load timeout.
    assert.equal(clock.boot.state, 'loading', `sheet ${sheet} is progressing, not stalled`);
    clock.boot.stage(`装入角色动作 · ${sheet} / 6`);
  }
  clock.boot.ready();
  clock.advance(30000);
  assert.equal(clock.boot.state, 'ready');
  assert.equal(clock.getElement('fatal').classList.contains('hidden'), true);
});

test('boot watchdog still fails a stalled stage and new progress does not hide failure', () => {
  const clock = bootClock();
  clock.boot.stage('装入角色动作 · 1 / 6');
  clock.advance(25001);
  assert.equal(clock.boot.state, 'failed');
  assert.equal(clock.getElement('loading').classList.contains('hidden'), true);
  assert.equal(clock.getElement('fatal').classList.contains('hidden'), false);
  clock.boot.stage('unexpected late progress');
  assert.equal(clock.boot.state, 'failed');
});

test('no-script delivery shows launch instructions and first executable script reveals game shell', () => {
  const clock = bootClock({ autoRun: false });
  assert.equal(clock.boot, undefined);
  assert.equal(clock.getElement('game-shell').hidden, true, 'default HTML must hide non-running game UI');
  assert.equal(clock.getElement('launch-help').hidden, false, 'file preview must retain launch instructions');
  const instructions = html.match(/<section id="launch-help"[\s\S]*?<\/section>/)?.[0];
  assert.ok(instructions);
  assert.match(instructions, /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/);
  assert.match(instructions, /href="https:\/\/xuhuanzhi32-svg\.github\.io\/devour-hd2d-mobile\/"/);
  clock.start();
  assert.equal(clock.getElement('game-shell').hidden, false);
  assert.equal(clock.getElement('launch-help').hidden, true);
  assert.equal(clock.boot.state, 'loading');
});

test('late stage notifications cannot rearm watchdog after game is ready', () => {
  const clock = bootClock();
  clock.boot.ready();
  assert.equal(clock.pendingTimerCount, 0);
  clock.boot.stage('late decoder notification');
  assert.equal(clock.pendingTimerCount, 0, 'no new startup timer after successful initialization');
  clock.advance(30000);
  assert.equal(clock.boot.state, 'ready');
  assert.equal(clock.getElement('fatal').classList.contains('hidden'), true);
});
