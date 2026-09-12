const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
class Element {
  constructor() { this.value = '0'; this.events = {}; this.children = []; this.classList = { toggle() {} }; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this[name] = value; }
  append(...children) { this.children.push(...children); children.forEach((el, i) => { el.nextElementSibling = children[i + 1]; }); }
  play() { return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(name) { delete this[name]; }
  getAttribute(name) { return this[name] || null; }
  load() {}
}
function setup() {
  const elements = new Map();
  const requests = [];
  const initial = { position: 20, duration: 240, playing: false, speed: 1, volumes: { bass: 1 }, audio_connected: true };
  const context = vm.createContext({
    document: { body: new Element(), querySelector: (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, createElement: () => new Element() },
    performance: { now: () => 0 }, AbortSignal, console,
    Audio: Element,
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    fetch: async (path, options) => {
      requests.push({ path, options });
      if (options.method) return new Promise((resolve) => { requests.at(-1).resolve = (state) => resolve({ ok: true, json: async () => state }); });
      return { ok: true, json: async () => initial };
    },
  });
  vm.runInContext(fs.readFileSync(`${__dirname}/../app.js`, 'utf8'), context);
  return { context, elements, requests, initial, run: (code) => vm.runInContext(code, context) };
}
const flush = () => new Promise(setImmediate);
test('resume reconnects the decoder cleared by pause', async () => {
  const app = setup(); await flush();
  app.run('audioWanted = true; audio.src = "/api/audio/live.mp3"; audio.paused = false');
  app.elements.get('#pause').events.click(); await flush();
  app.requests.at(-1).resolve({ ...app.initial, playing: false }); await flush();
  assert.equal(app.elements.get('#audio').getAttribute('src'), null);
  app.elements.get('#play').events.click(); await flush();
  assert.match(app.elements.get('#audio').src, /live.mp3/);
  app.requests.at(-1).resolve({ ...app.initial, playing: true }); await flush();
});
test('seek keeps the selected position through stale polls and commits seconds', async () => {
  const app = setup(); await flush();
  const slider = app.elements.get('#position');
  slider.value = '90'; slider.events.input(); slider.events.change(); await flush();
  const request = app.requests.at(-1);
  assert.equal(request.path, '/api/transport/seek');
  assert.equal(JSON.parse(request.options.body).position, 90);
  await app.run('poll()');
  assert.equal(slider.value, '90');
  request.resolve({ ...app.initial, position: 90 }); await flush();
  assert.equal(Number(slider.value), 90);
});

test('genre button applies its preset in one request', async () => {
  const app = setup(); await flush();
  // GET requests resolve immediately from the fixture, so explicitly render a
  // representative button to exercise the same binding path used by the API.
  await app.run(`(async () => {
    const original = api;
    api = async (path, options = {}) => path === '/api/genres'
      ? [{ id: 'rock', label: 'Rock' }]
      : original(path, options);
    await loadGenres();
  })()`);
  const button = app.elements.get('#genres').children.at(-1);
  button.events.click(); await flush();
  assert.equal(app.requests.at(-1).path, '/api/genres/rock');
  app.requests.at(-1).resolve({ ...app.initial, genre: 'rock' }); await flush();
  assert.equal(button['aria-pressed'], 'true');
});
test('playing shows restart and sends the restart action; paused shows play', async () => {
  const app = setup(); await flush();
  app.run(`render(${JSON.stringify({ ...app.initial, playing: true })})`);
  const play = app.elements.get('#play');
  assert.equal(play['aria-label'], 'Restart from beginning');
  play.events.click(); await flush();
  assert.equal(app.requests.at(-1).path, '/api/transport/restart');
  assert.equal(play.disabled, true);
  app.requests.at(-1).resolve({ ...app.initial, position: 0, playing: true }); await flush();
  app.run(`render(${JSON.stringify(app.initial)})`);
  assert.equal(play['aria-label'], 'Play');
  assert.equal(app.elements.get('#pause').disabled, true);
});
test('tempo preview survives polling until its change is acknowledged', async () => {
  const app = setup(); await flush();
  const slider = app.elements.get('#speed');
  slider.value = '1.25'; slider.events.input();
  await app.run('poll()');
  assert.equal(slider.value, '1.25');
  slider.events.change(); await flush();
  app.requests.at(-1).resolve({ ...app.initial, speed: 1.25 }); await flush();
  assert.equal(Number(slider.value), 1.25);
});
test('failed commands show feedback and restore usable controls', async () => {
  const app = setup(); await flush();
  await app.run("mutate(async () => { throw new Error('Network lost'); })");
  assert.match(app.elements.get('#message').textContent, /Network lost/);
  assert.equal(app.elements.get('#play').disabled, false);
});
