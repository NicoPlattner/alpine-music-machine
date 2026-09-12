const $ = (selector) => document.querySelector(selector);
const stemsElement = $('#stems');
const position = $('#position');
const speed = $('#speed');
let audio = $('#audio');
let state = null;
let backendOnline = false;
let receivedAt = 0;
let revision = 0;
let pending = 0;
let queue = Promise.resolve();
let audioWanted = false;
let audioAttempt = 0;
const editing = new Set();
const timers = new Map();
const stemInputs = new Map();
const genreButtons = new Map();

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    ...options,
  });
  if (!response.ok) {
    let detail;
    try { detail = (await response.json()).detail; } catch { /* Use HTTP status. */ }
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status}). Please try again.`);
  }
  return response.json();
}

function setMessage(text, isError = false) {
  $('#message').textContent = text;
  $('#message').classList.toggle('error', isError);
}

function updateControls() {
  const available = backendOnline && state?.audio_connected;
  $('#engine-status').classList.toggle('ready', Boolean(available));
  $('#engine-label').textContent = !backendOnline ? 'Backend offline · retrying' : available ? 'Engine online' : 'Waiting for audio engine';
  const restarting = state?.playing;
  $('#play').textContent = restarting ? '↺' : '▶';
  $('#play').setAttribute('aria-label', restarting ? 'Restart from beginning' : 'Play');
  $('#play').title = restarting ? 'Restart from beginning' : 'Play';
  $('#play').disabled = !available || pending > 0;
  $('#pause').disabled = !available || !state?.playing || pending > 0;
  position.disabled = !available || !state?.duration;
  speed.disabled = !available;
  $('#reset').disabled = !available || pending > 0;
  for (const input of stemInputs.values()) input.disabled = !available;
  for (const button of genreButtons.values()) button.disabled = !available || pending > 0;
  $('#connect').disabled = !available && !audioWanted;
  $('#playback-status').textContent = pending ? 'Applying changes…' : !state ? 'Connecting…' : state.playing ? 'Playing' : state.duration && state.position >= state.duration ? 'Finished' : state.position > 0 ? 'Paused' : 'Ready to play';
}

function render(next) {
  state = next;
  receivedAt = performance.now();
  backendOnline = true;
  $('#genre-status').textContent = next.genre ? `${genreButtons.get(next.genre)?.textContent || next.genre} preset` : 'Custom mix';
  for (const [genre, button] of genreButtons) {
    button.classList.toggle('active', genre === next.genre);
    button.setAttribute('aria-pressed', String(genre === next.genre));
  }
  position.max = next.duration || 1;
  $('#duration').textContent = formatTime(next.duration);
  if (!editing.has('speed')) {
    speed.value = next.speed;
    $('#speed-value').textContent = `${next.speed.toFixed(2)}×`;
  }
  for (const [name, volume] of Object.entries(next.volumes)) {
    if (!stemInputs.has(name)) {
      const item = document.createElement('div');
      item.className = 'stem';
      const label = document.createElement('label');
      const input = document.createElement('input');
      const output = document.createElement('output');
      label.textContent = name;
      label.htmlFor = input.id = `stem-${name}`;
      input.type = 'range';
      input.min = 0;
      input.max = 1.5;
      input.step = 0.01;
      item.append(label, input, output);
      stemsElement.append(item);
      stemInputs.set(name, input);
      bindSlider(input, `volume:${name}`, (value) => { output.textContent = `${Math.round(value * 100)}%`; },
        async (value) => {
          const next = await api(`/api/stems/${encodeURIComponent(name)}/volume`, { method: 'PUT', body: JSON.stringify({ volume: value }) });
          return next;
        });
    }
    if (!editing.has(`volume:${name}`)) {
      const input = stemInputs.get(name);
      input.value = volume;
      input.nextElementSibling.textContent = `${Math.round(volume * 100)}%`;
    }
  }
  updateControls();
  drawPosition();
}

async function loadGenres() {
  try {
    const genres = await api('/api/genres');
    for (const genre of genres) {
      const button = document.createElement('button');
      button.className = 'genre';
      button.textContent = genre.label;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => mutate(async () => {
        const next = await api(`/api/genres/${encodeURIComponent(genre.id)}`, { method: 'PUT' });
        return next;
      }, `${genre.label} sound applied.`));
      $('#genres').append(button);
      genreButtons.set(genre.id, button);
    }
    if (state) render(state);
  } catch (error) {
    setMessage(`Could not load genre presets: ${error.message}`, true);
  }
}

// Serialize mutations, and discard polls started before an interaction. Keep
// slider previews until their newest value has been acknowledged by the API.
function mutate(action, success = '') {
  revision++;
  pending++;
  updateControls();
  const result = queue.then(async () => {
    try {
      const next = await action();
      render(next);
      setMessage(success);
      return next;
    } catch (error) {
      setMessage(`Could not apply change: ${error.message}`, true);
      return null;
    } finally {
      pending--;
      revision++;
      updateControls();
    }
  });
  queue = result;
  return result;
}

function bindSlider(input, key, preview, save) {
  let version = 0;
  let dirty = false;
  const commit = () => {
    clearTimeout(timers.get(key));
    timers.delete(key);
    if (!dirty) return;
    dirty = false;
    const currentVersion = version;
    const value = Number(input.value);
    mutate(() => save(value)).then(() => {
      if (version === currentVersion) {
        editing.delete(key);
        if (state) render(state);
      }
    });
  };
  input.addEventListener('input', () => {
    revision++;
    version++;
    dirty = true;
    editing.add(key);
    preview(Number(input.value));
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(commit, 120));
  });
  input.addEventListener('change', commit);
}

function drawPosition() {
  if (!state || editing.has('position')) return;
  const elapsed = backendOnline && state.playing ? (performance.now() - receivedAt) / 1000 * state.speed : 0;
  const value = Math.min(state.duration || Infinity, state.position + elapsed);
  position.value = value;
  $('#elapsed').textContent = formatTime(value);
  position.setAttribute('aria-valuetext', `${formatTime(value)} of ${formatTime(state.duration)}`);
}
setInterval(drawPosition, 100);

// A seek is committed on release (including keyboard changes), never per pixel.
position.addEventListener('input', () => {
  seekVersion++;
  revision++;
  editing.add('position');
  $('#elapsed').textContent = formatTime(position.value);
  position.setAttribute('aria-valuetext', `${formatTime(position.value)} of ${formatTime(state?.duration)}`);
});
let seekVersion = 0;
position.addEventListener('change', () => {
  const value = Number(position.value);
  const version = ++seekVersion;
  editing.add('position');
  mutate(() => api('/api/transport/seek', { method: 'PUT', body: JSON.stringify({ position: value }) }),
    `Moved to ${formatTime(value)}. Live audio may take a moment to catch up.`).then((next) => {
    if (version === seekVersion) {
      editing.delete('position');
      if (next && audioWanted) connectAudio(true);
      drawPosition();
    }
  });
});
position.addEventListener('pointercancel', () => { editing.delete('position'); drawPosition(); });

bindSlider(speed, 'speed', (value) => { $('#speed-value').textContent = `${value.toFixed(2)}×`; },
  async (value) => {
    const next = await api('/api/transport/speed', { method: 'PUT', body: JSON.stringify({ speed: value }) });
    return next;
  });

function audioStatus(text, connected = false) {
  $('#audio-status').textContent = text;
  $('#connect').textContent = audioWanted ? 'Disconnect audio' : 'Connect live audio';
  $('#connect').classList.toggle('connected', connected);
  $('#connect').setAttribute('aria-pressed', String(audioWanted));
}

async function connectAudio(fast = false) {
  const attempt = ++audioAttempt;
  audioWanted = true;
  audioStatus(fast ? 'Applying edit…' : 'Prebuffering 3 seconds…');
  // A live stream has no shared media timeline. Mixing two connections creates
  // audible echoes and comb filtering, so always retire the old decoder first.
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  const next = audio;
  next.preload = 'auto';
  next.volume = 1;
  next.src = `/api/audio/live.mp3?prebuffer=${fast ? 0.35 : 3}&t=${Date.now()}`;
  try {
    await next.play();
    if (attempt !== audioAttempt) return;
    audio = next;
    audioStatus('Audio connected', true);
  } catch (error) {
    if (attempt !== audioAttempt) return;
    audioWanted = false;
    audioStatus('Audio disconnected');
    setMessage(`Could not start audio: ${error.message}`, true);
  }
}
audio.addEventListener('waiting', () => { if (audioWanted) audioStatus('Buffering audio…'); });
audio.addEventListener('stalled', () => { if (audioWanted) audioStatus('Audio stalled · reconnect to retry'); });
audio.addEventListener('playing', () => { if (audioWanted) audioStatus('Live audio connected', true); });
audio.addEventListener('error', () => {
  if (!audioWanted) return;
  audioAttempt++;
  audioWanted = false;
  audioStatus('Audio interrupted · reconnect to retry');
});
$('#connect').addEventListener('click', () => {
  if (!audioWanted) { connectAudio(); return; }
  audioAttempt++;
  audioWanted = false;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  audioStatus('Audio disconnected');
});

$('#play').addEventListener('click', () => {
  const restart = state.playing;
  if (!audioWanted) connectAudio(); // Start inside the browser's user gesture.
  mutate(() => api(restart ? '/api/transport/restart' : '/api/transport/play', { method: 'POST' }))
    .then((next) => { if (next && audioWanted && (restart || !audio.src)) connectAudio(true); });
});
$('#pause').addEventListener('click', () => {
  // Stop immediately and throw away already-buffered MP3 frames. The engine's
  // short gain ramp still prevents a click in the encoded stream.
  if (audioWanted) {
    audioAttempt++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audioStatus('Audio paused');
  }
  mutate(() => api('/api/transport/pause', { method: 'POST' }), 'Paused. Buffered audio may continue briefly.');
});
$('#reset').addEventListener('click', () => {
  // Cancel unsent level changes so they cannot undo the reset afterwards.
  for (const name of stemInputs.keys()) {
    const key = `volume:${name}`;
    clearTimeout(timers.get(key));
    editing.delete(key);
  }
  mutate(async () => {
    for (const name of stemInputs.keys()) {
      await api(`/api/stems/${encodeURIComponent(name)}/volume`, { method: 'PUT', body: JSON.stringify({ volume: 1 }) });
    }
    return api('/api/state');
  }, 'All stem levels reset to 100%.');
});

async function poll() {
  const started = revision;
  try {
    const next = await api('/api/state');
    if (started === revision && !pending) render(next);
  } catch (error) {
    if (started === revision && !pending) {
      backendOnline = false;
      updateControls();
    }
  }
  setTimeout(poll, 1000);
}
updateControls();
loadGenres();
poll();
