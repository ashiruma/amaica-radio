// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — PLAYER.JS  v8.4
//  Fixed: direct Icecast fetch (no proxies), iOS audio scratch,
//         always-on listener count, snapshot logger for admin.
// ═══════════════════════════════════════════════════════════════

const STREAM_URL = () => window.APP_CONFIG?.STREAM_URL || 'https://s40.myradiostream.com:23535/listen.mp3';
const POLL_MS = () => window.APP_CONFIG?.POLL_MS || 30000;

const ENDPOINTS = [
  { url: 'https://s40.myradiostream.com:23535/status-json.xsl', type: 'icecast' },
  { url: 'https://s40.myradiostream.com:23535/stats?json=1', type: 'shoutcast' },
  { url: 'https://s40.myradiostream.com:23535/stats', type: 'xml' },
];

const audio = new Audio();
audio.preload = 'none';

// Detect iOS Safari
const _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// crossOrigin breaks non-CORS streams on iOS, fine on other browsers
if (!_isIOS) audio.crossOrigin = 'anonymous';

// disableRemotePlayback disables AirPlay on iOS — keep it only for non-iOS
if (!_isIOS && 'disableRemotePlayback' in audio) audio.disableRemotePlayback = true;

let isPlaying = false;
let metaInterval = null;

window.isPlaying = () => isPlaying;

// ── TOGGLE PLAY / PAUSE ──────────────────────────────────────────
window.toggleRadio = async function () {
  const playBtn = document.getElementById('play-btn');
  const playIcon = playBtn?.querySelector('.material-symbols-outlined');
  const orbBtn = document.getElementById('main-orb-btn');
  const orbIcon = document.getElementById('orb-icon');
  const orbWrap = orbBtn?.closest('.orb-wrap');
  const miniIcons = document.querySelectorAll('.mini-play .material-symbols-outlined, #main-play');
  const statusEls = document.querySelectorAll('#player-status, .mp-sub, #player-status-bar, #connect-status');
  const pulseDot = document.querySelector('.pulse-dot');
  const ring = document.getElementById('pulse-ring');
  const noa = document.querySelector('.now-on-air');
  const playBtnClean = document.querySelector('.play-main-clean');

  [playBtnClean, orbBtn].forEach(b => {
    if (!b) return;
    b.classList.add('animate-click');
    setTimeout(() => b.classList.remove('animate-click'), 400);
  });

  if (!isPlaying) {
    if (playIcon) { playIcon.textContent = 'sync'; playIcon.classList.add('rotating'); }
    if (orbIcon) { orbIcon.textContent = 'sync'; orbIcon.classList.add('rotating'); }
    miniIcons.forEach(i => { i.textContent = 'sync'; i.classList.add('rotating'); });
    statusEls.forEach(el => { if (el) el.textContent = 'Connecting…'; });

    try {
      // iOS needs src set fresh each time, no cache-bust on some streams
      if (_isIOS) {
        audio.src = STREAM_URL();
      } else {
        audio.src = `${STREAM_URL()}?t=${Date.now()}`;
      }
      const playPromise = audio.play();
      if (playPromise !== undefined) await playPromise;

      if (playIcon) { playIcon.textContent = 'pause_circle'; playIcon.classList.remove('rotating'); }
      if (orbIcon) { orbIcon.textContent = 'pause'; orbIcon.classList.remove('rotating'); }
      miniIcons.forEach(i => { i.textContent = 'pause'; i.classList.remove('rotating'); });

      if (orbBtn) orbBtn.classList.add('playing');
      if (orbWrap) orbWrap.classList.add('playing');
      if (pulseDot) pulseDot.classList.add('active');
      if (ring) ring.style.animationPlayState = 'running';
      if (noa) noa.classList.add('playing');
      if (playBtnClean) playBtnClean.classList.add('active-playing');

      setPlayVisuals(true);

      // iOS-safe: reconnect if lag > 8s, never seek
      const _latencyCheck = setInterval(() => {
        if (!isPlaying) { clearInterval(_latencyCheck); return; }
        if (audio.buffered.length > 0) {
          const lag = audio.buffered.end(audio.buffered.length - 1) - audio.currentTime;
          if (lag > 8) {
            const vol = audio.volume;
            audio.src = _isIOS ? STREAM_URL() : `${STREAM_URL()}?t=${Date.now()}`;
            audio.volume = vol;
            audio.play().catch(() => { });
          }
        }
      }, 10000);

      startInteractiveSync();
      if (window.showToast) showToast('Live Sync Active', 'timer');
      if (typeof sbEarnPoints === 'function') sbEarnPoints(5, 'Tuned in');
      if (window.startListenSession) startListenSession();
      if (window._lastListenDay !== new Date().toDateString() && window.saveLocal) saveLocal();
      if (window.updateDailyStreak) updateDailyStreak();
      if (window.updateFireMeter) updateFireMeter(3);
      if (navigator.vibrate) navigator.vibrate(20);

    } catch (err) {
      console.error('Stream error:', err);
      if (window.showToast) showToast('Connection blocked — try the browser link', 'wifi_off');
      statusEls.forEach(el => { if (el) el.textContent = 'Stream blocked'; });
      _resetRadioUI();
    }

  } else {
    audio.pause();
    audio.src = '';
    isPlaying = false;
    if (playBtnClean) playBtnClean.classList.remove('active-playing');
    _resetRadioUI();
    stopInteractiveSync();
    if (window.endListenSession) endListenSession();
  }
};

// ── RESET UI ─────────────────────────────────────────────────────
function _resetRadioUI() {
  const playIcon = document.getElementById('play-btn')?.querySelector('.material-symbols-outlined');
  const orbBtn = document.getElementById('main-orb-btn');
  const orbIcon = document.getElementById('orb-icon');
  const orbWrap = orbBtn?.closest('.orb-wrap');
  const miniIcons = document.querySelectorAll('.mini-play .material-symbols-outlined, #main-play');
  const statusEls = document.querySelectorAll('#player-status, .mp-sub, #player-status-bar, #connect-status');
  const pulseDot = document.querySelector('.pulse-dot');
  const ring = document.getElementById('pulse-ring');
  const noa = document.querySelector('.now-on-air');

  if (playIcon) { playIcon.textContent = 'play_arrow'; playIcon.classList.remove('rotating'); }
  if (orbIcon) { orbIcon.textContent = 'play_arrow'; orbIcon.classList.remove('rotating'); }
  if (orbBtn) orbBtn.classList.remove('playing');
  if (orbWrap) orbWrap.classList.remove('playing');
  miniIcons.forEach(i => { i.textContent = 'play_arrow'; i.classList.remove('rotating'); });
  statusEls.forEach(el => { if (el) el.textContent = '98.7 FM — Tap to play'; });
  if (pulseDot) pulseDot.classList.remove('active');
  if (ring) ring.style.animationPlayState = 'paused';
  if (noa) noa.classList.remove('playing');
  setPlayVisuals(false);
}

// ── VISUALS ──────────────────────────────────────────────────────
function setPlayVisuals(playing) {
  document.querySelector('.player-art')?.classList.toggle('is-spinning', playing);
  document.getElementById('mini-player')?.classList.toggle('playing', playing);
  const nop = document.getElementById('noa-orb-pulse');
  const ag = document.getElementById('player-art-glow');
  if (nop) nop.style.animationPlayState = playing ? 'running' : 'paused';
  if (ag) ag.style.animationPlayState = playing ? 'running' : 'paused';
  const bar = document.getElementById('noa-bar-fill');
  if (bar) { bar.classList.toggle('live-stream', playing); if (!playing) bar.style.width = '0'; }
  const ring = document.getElementById('pulse-ring');
  if (ring) ring.style.animationPlayState = playing ? 'running' : 'paused';
  document.querySelectorAll('.wave-bar').forEach((b, i) => {
    if (playing) {
      b.style.background = 'var(--c-primary)';
      b.style.animation = `wave ${0.5 + Math.random()}s ease-in-out infinite alternate`;
      b.style.animationDelay = `${i * 0.05}s`;
    } else {
      b.style.background = 'var(--c-surface-highest)';
      b.style.animation = 'none';
      b.style.height = '4px';
    }
  });
  document.getElementById('main-content')?.classList.toggle('fire-active', playing);
}

window.handleListenNow = function () {
  if (window.navigateTo) navigateTo('player');
  if (!isPlaying) toggleRadio();
};
window.setVolume = function (v) { audio.volume = v / 100; };

// ── LISTENER COUNT ────────────────────────────────────────────────
function applyListenerCount(count) {
  if (count == null || count < 0) return;
  window._liveListeners = count;
  window._hasRealListenerData = true;
  const fmt = count.toLocaleString();
  document.querySelectorAll('.listener-count-el').forEach(el => {
    if (el.textContent === fmt) return;
    el.style.opacity = '0.3';
    setTimeout(() => { el.textContent = fmt; el.style.opacity = '1'; }, 220);
  });
  const ev = document.getElementById('ev-listeners');
  if (ev) ev.textContent = fmt + ' listening';
  const peak = document.getElementById('peak-count');
  if (peak) {
    const prev = parseInt(peak.textContent.replace(/,/g, '')) || 0;
    if (count > prev) peak.textContent = fmt;
  }
  _logListenerSnapshot(count);
}

// ── STATION POLLING — direct fetch, no proxy ──────────────────────
async function syncStationData() {
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep.url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) continue;
      const text = await res.text();
      let count = null;

      if (ep.type === 'icecast') {
        const d = JSON.parse(text);
        const src = d?.icestats?.source;
        const sources = Array.isArray(src) ? src : (src ? [src] : []);
        const mount = sources.find(s => s.listenurl?.includes('/stream') || sources.length === 1) || sources[0];
        if (mount) {
          count = parseInt(mount.listeners ?? 0, 10);
          const raw = mount.title || mount.server_name || '';
          if (raw.trim()) applyNowPlaying(raw.trim());
        }
      } else if (ep.type === 'shoutcast') {
        const d = JSON.parse(text);
        const src = d.streams?.[0] || d;
        count = parseInt(src.uniquelisteners ?? src.currentlisteners ?? src.listeners ?? 0, 10);
        const raw = src.songtitle || src.title || src.currentsong || '';
        if (raw.trim()) applyNowPlaying(raw.trim());
      } else if (ep.type === 'xml') {
        const match = text.match(/<CURRENTLISTENERS>(\d+)<\/CURRENTLISTENERS>/i);
        if (match) count = parseInt(match[1], 10);
      }

      if (count !== null && !isNaN(count)) {
        applyListenerCount(count);
        return; // success — stop trying other endpoints
      }
    } catch (e) {
      console.warn('[player] poll failed:', ep.url, e.message || e);
    }
  }
}

function applyNowPlaying(raw) {
  const dash = raw.indexOf(' - ');
  const artist = dash > -1 ? raw.slice(0, dash).trim() : '';
  const title = dash > -1 ? raw.slice(dash + 3).trim() : raw;
  // Only update song display, not show name — show name comes from schedule
  const st = document.getElementById('stream-song-title'); if (st) st.textContent = title;
  if (artist) {
    const hh = document.getElementById('hero-show-host'); if (hh) hh.textContent = 'with ' + artist;
    const ph = document.getElementById('player-show-host'); if (ph) ph.textContent = artist;
  }
  if (isPlaying) {
    const ps = document.getElementById('player-status'); if (ps) ps.textContent = artist || '98.7 FM · Live';
    const psb = document.getElementById('player-status-bar'); if (psb) psb.textContent = artist ? `Now playing: ${artist}` : 'Live on 98.7 FM';
    const cs = document.getElementById('connect-status'); if (cs) cs.textContent = '● Connected — Live 98.7 FM';
  }
}

function startInteractiveSync() {
  syncStationData();
  clearInterval(metaInterval);
  metaInterval = setInterval(syncStationData, 15000);
}
function stopInteractiveSync() {
  clearInterval(metaInterval);
  metaInterval = setInterval(syncStationData, POLL_MS());
}

// ── ALWAYS-ON BACKGROUND POLL ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.listener-count-el').forEach(el => { el.textContent = '—'; });
  const hwb = document.getElementById('hero-wave-bg');
  if (hwb && !hwb.children.length) {
    for (let i = 0; i < 40; i++) {
      const b = document.createElement('div');
      b.classList.add('wave-bar');
      Object.assign(b.style, {
        width: '4px', background: 'var(--c-primary)', opacity: '1',
        animationDelay: (Math.random() * -1.2) + 's',
        animationDuration: (0.7 + Math.random() * 0.9) + 's'
      });
      hwb.appendChild(b);
    }
  }
  setTimeout(() => {
    syncStationData();
    metaInterval = setInterval(syncStationData, POLL_MS());
  }, 1000);
});

// ── LISTEN BONUS ──────────────────────────────────────────────────
setInterval(() => {
  if (!isPlaying) return;
  if (typeof sbEarnPoints === 'function') sbEarnPoints(10, 'Listening bonus');
  window._listenMins = (window._listenMins || 0) + 1;
  if (window.saveLocal) saveLocal();
  const lm = document.getElementById('profile-listen-mins');
  if (lm) lm.textContent = window._listenMins;
  if (window.updateFireMeter) updateFireMeter(1);
}, 60000);

// ── AUDIO ERRORS ─────────────────────────────────────────────────
audio.addEventListener('error', () => {
  if (!isPlaying) return;
  isPlaying = false;
  _resetRadioUI();
  if (window.showToast) showToast('Stream connection lost', 'wifi_off');
});

audio.addEventListener('stalled', () => {
  if (!isPlaying) return;
  if (window.showToast) showToast('Buffering…', 'sync');
  setTimeout(() => {
    if (!isPlaying) return;
    const vol = audio.volume;
    audio.src = `${STREAM_URL()}?t=${Date.now()}`;
    audio.volume = vol;
    audio.play().catch(() => { });
  }, 3000);
});

// ── LISTENER SNAPSHOT LOGGER ──────────────────────────────────────
function _logListenerSnapshot(count) {
  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const show = (window.getCurrentShow?.()?.name) || document.getElementById('hero-show-title')?.textContent?.trim() || 'On Air';
    const logKey = 'amaica_lstn_' + now.toISOString().slice(0, 10);
    let log;
    try { log = JSON.parse(localStorage.getItem(logKey) || '[]'); } catch { log = []; }
    const last = log[log.length - 1];
    if (last && (now - new Date(last.ts)) < 120000) return;
    log.push({ ts: now.toISOString(), time: timeStr, show, count });
    if (log.length > 400) log.splice(0, log.length - 400);
    localStorage.setItem(logKey, JSON.stringify(log));
    _updateShowSummary(now.toDateString(), show, count);
  } catch (e) { }
}

function _updateShowSummary(dateKey, show, count) {
  try {
    let s; try { s = JSON.parse(localStorage.getItem('amaica_show_summary') || '{}'); } catch { s = {}; }
    if (!s[dateKey]) s[dateKey] = {};
    if (!s[dateKey][show]) s[dateKey][show] = { peak: 0, avg: 0, total: 0, samples: 0, first: null, last: null };
    const r = s[dateKey][show];
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    r.peak = Math.max(r.peak, count); r.total += count; r.samples++;
    r.avg = Math.round(r.total / r.samples);
    if (!r.first) r.first = now; r.last = now;
    const keys = Object.keys(s).sort((a, b) => new Date(a) - new Date(b));
    while (keys.length > 7) { delete s[keys.shift()]; }
    localStorage.setItem('amaica_show_summary', JSON.stringify(s));
  } catch (e) { }
}

window.getListenerSummary = () => { try { return JSON.parse(localStorage.getItem('amaica_show_summary') || '{}'); } catch { return {}; } };
window.getTodayListenerLog = () => { const k = 'amaica_lstn_' + new Date().toISOString().slice(0, 10); try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };