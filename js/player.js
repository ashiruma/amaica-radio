// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — PLAYER.JS  v8.2
//  Fixed: orb toggle (#main-orb-btn / #orb-icon),
//         dual-format Icecast+SHOUTcast polling,
//         always-on listener count, snapshot logger for admin.
// ═══════════════════════════════════════════════════════════════

const STREAM_URL   = () => window.APP_CONFIG?.STREAM_URL   || 'https://s40.myradiostream.com:23535/listen.mp3';
const CORS_PROXIES = () => window.APP_CONFIG?.CORS_PROXIES || ['https://corsproxy.io/?','https://api.allorigins.win/raw?url='];
const POLL_MS      = () => window.APP_CONFIG?.POLL_MS      || 30000;
const STATS_URLS   = () => [
  window.APP_CONFIG?.STATS_URL   || 'https://s40.myradiostream.com:23535/status-json.xsl',
  window.APP_CONFIG?.STATS_URL_2 || 'https://s40.myradiostream.com:23535/stats?json=1'
];

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload     = 'none';

let isPlaying    = false;
let metaInterval = null;
let proxyIdx     = 0;

window.isPlaying = () => isPlaying;

// ── TOGGLE PLAY / PAUSE ──────────────────────────────────────────
window.toggleRadio = async function () {
  const playBtn      = document.getElementById('play-btn');
  const playIcon     = playBtn?.querySelector('.material-symbols-outlined');
  const orbBtn       = document.getElementById('main-orb-btn');
  const orbIcon      = document.getElementById('orb-icon');
  const orbWrap      = orbBtn?.closest('.orb-wrap');
  const miniIcons    = document.querySelectorAll('.mini-play .material-symbols-outlined, #main-play');
  const statusEls    = document.querySelectorAll('#player-status, .mp-sub, #player-status-bar, #connect-status');
  const pulseDot     = document.querySelector('.pulse-dot');
  const ring         = document.getElementById('pulse-ring');
  const noa          = document.querySelector('.now-on-air');
  const playBtnClean = document.querySelector('.play-main-clean');

  // Click feedback on both orb and home button
  [playBtnClean, orbBtn].forEach(b => {
    if (!b) return;
    b.classList.add('animate-click');
    setTimeout(() => b.classList.remove('animate-click'), 400);
  });

  if (!isPlaying) {
    // ── Connecting state ──────────────────────────────────────
    if (playIcon) { playIcon.textContent = 'sync'; playIcon.classList.add('rotating'); }
    if (orbIcon)  { orbIcon.textContent  = 'sync'; orbIcon.classList.add('rotating'); }
    miniIcons.forEach(i => { i.textContent = 'sync'; i.classList.add('rotating'); });
    statusEls.forEach(el => { if (el) el.textContent = 'Connecting…'; });

    try {
      audio.src = `${STREAM_URL()}?t=${Date.now()}`;
      await audio.play();
      isPlaying = true;

      // ── Connected state ───────────────────────────────────
      if (playIcon) { playIcon.textContent = 'pause_circle'; playIcon.classList.remove('rotating'); }
      if (orbIcon)  { orbIcon.textContent  = 'pause';        orbIcon.classList.remove('rotating'); }
      miniIcons.forEach(i => { i.textContent = 'pause'; i.classList.remove('rotating'); });

      if (orbBtn)       orbBtn.classList.add('playing');
      if (orbWrap)      orbWrap.classList.add('playing');
      if (pulseDot)     pulseDot.classList.add('active');
      if (ring)         ring.style.animationPlayState = 'running';
      if (noa)          noa.classList.add('playing');
      if (playBtnClean) playBtnClean.classList.add('active-playing');

      setPlayVisuals(true);

      audio.addEventListener('timeupdate', () => {
        if (audio.buffered.length > 0) {
          const end = audio.buffered.end(audio.buffered.length - 1);
          if (end - audio.currentTime > 3) audio.currentTime = end - 0.1;
        }
      });

      startInteractiveSync();
      if (window.showToast)                         showToast('Live Sync Active', 'timer');
      if (typeof sbEarnPoints === 'function')        sbEarnPoints(5, 'Tuned in');
      if (window.startListenSession)                 startListenSession();
      if (window._lastListenDay !== new Date().toDateString() && window.saveLocal) saveLocal();
      if (window.updateDailyStreak)                  updateDailyStreak();
      if (window.updateFireMeter)                    updateFireMeter(3);
      if (navigator.vibrate) navigator.vibrate(20);

    } catch (err) {
      console.error('Stream error:', err);
      if (window.showToast) showToast('Connection blocked — try the browser link', 'wifi_off');
      statusEls.forEach(el => { if (el) el.textContent = 'Stream blocked'; });
      _resetRadioUI();
    }

  } else {
    // ── Stop ─────────────────────────────────────────────────
    audio.pause();
    audio.src = '';
    isPlaying  = false;
    if (playBtnClean) playBtnClean.classList.remove('active-playing');
    _resetRadioUI();
    stopInteractiveSync();
    if (window.endListenSession) endListenSession();
  }
};

// ── RESET UI ─────────────────────────────────────────────────────
function _resetRadioUI() {
  const playBtn   = document.getElementById('play-btn');
  const playIcon  = playBtn?.querySelector('.material-symbols-outlined');
  const orbBtn    = document.getElementById('main-orb-btn');
  const orbIcon   = document.getElementById('orb-icon');
  const orbWrap   = orbBtn?.closest('.orb-wrap');
  const miniIcons = document.querySelectorAll('.mini-play .material-symbols-outlined, #main-play');
  const statusEls = document.querySelectorAll('#player-status, .mp-sub, #player-status-bar, #connect-status');
  const pulseDot  = document.querySelector('.pulse-dot');
  const ring      = document.getElementById('pulse-ring');
  const noa       = document.querySelector('.now-on-air');

  if (playIcon) { playIcon.textContent = 'play_arrow'; playIcon.classList.remove('rotating'); }
  if (orbIcon)  { orbIcon.textContent  = 'play_arrow'; orbIcon.classList.remove('rotating'); }
  if (orbBtn)   orbBtn.classList.remove('playing');
  if (orbWrap)  orbWrap.classList.remove('playing');
  miniIcons.forEach(i => { i.textContent = 'play_arrow'; i.classList.remove('rotating'); });
  statusEls.forEach(el => { if (el) el.textContent = '98.7 FM — Tap to play'; });
  if (pulseDot) pulseDot.classList.remove('active');
  if (ring)     ring.style.animationPlayState = 'paused';
  if (noa)      noa.classList.remove('playing');
  setPlayVisuals(false);
}

// ── VISUALS ──────────────────────────────────────────────────────
function setPlayVisuals(playing) {
  document.querySelector('.player-art')?.classList.toggle('is-spinning', playing);
  document.getElementById('mini-player')?.classList.toggle('playing', playing);
  const nop = document.getElementById('noa-orb-pulse');
  const ag  = document.getElementById('player-art-glow');
  if (nop) nop.style.animationPlayState = playing ? 'running' : 'paused';
  if (ag)  ag.style.animationPlayState  = playing ? 'running' : 'paused';
  const bar = document.getElementById('noa-bar-fill');
  if (bar) { bar.classList.toggle('live-stream', playing); if (!playing) bar.style.width = '0'; }
  const ring = document.getElementById('pulse-ring');
  if (ring) ring.style.animationPlayState = playing ? 'running' : 'paused';
  document.querySelectorAll('.wave-bar').forEach((b, i) => {
    if (playing) {
      b.style.background = 'var(--c-primary)';
      b.style.animation  = `wave ${0.5 + Math.random()}s ease-in-out infinite alternate`;
      b.style.animationDelay = `${i * 0.05}s`;
    } else {
      b.style.background = 'var(--c-surface-highest)';
      b.style.animation  = 'none';
      b.style.height     = '4px';
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
    const prev = parseInt(peak.textContent.replace(/,/g,'')) || 0;
    if (count > prev) peak.textContent = fmt;
  }
  _logListenerSnapshot(count);
}

// ── STATION POLLING ───────────────────────────────────────────────
async function syncStationData() {
  const proxies = CORS_PROXIES();
  const urls    = STATS_URLS();
  for (let pi = 0; pi < proxies.length; pi++) {
    const proxy = proxies[(proxyIdx + pi) % proxies.length];
    for (const url of urls) {
      try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res   = await fetch(proxy + encodeURIComponent(url), { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) continue;
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { continue; }

        // Icecast (status-json.xsl)
        if (data.icestats) {
          const src     = data.icestats.source;
          const sources = Array.isArray(src) ? src : (src ? [src] : []);
          const mount   = sources.find(s => s.listenurl?.includes('/listen')) || sources[0];
          if (mount) {
            const raw = mount.title || mount.server_name || '';
            if (raw.trim()) applyNowPlaying(raw.trim());
            applyListenerCount(parseInt(mount.listeners ?? 0, 10));
          }
          proxyIdx = (proxyIdx + pi) % proxies.length;
          return;
        }

        // SHOUTcast v2 (stats?json=1)
        if (data.streams || data.currentlisteners !== undefined || data.songtitle !== undefined) {
          const src = data.streams?.[0] || data;
          const raw = src.songtitle || src.title || src.currentsong || src.song || '';
          if (raw.trim()) applyNowPlaying(raw.trim());
          applyListenerCount(parseInt(src.uniquelisteners ?? src.currentlisteners ?? src.listeners ?? 0, 10));
          proxyIdx = (proxyIdx + pi) % proxies.length;
          return;
        }
      } catch (e) {
        console.warn('[player] poll failed:', proxy, url, e.message || e);
      }
    }
  }
}

function applyNowPlaying(raw) {
  const dash   = raw.indexOf(' - ');
  const artist = dash > -1 ? raw.slice(0, dash).trim()  : '';
  const title  = dash > -1 ? raw.slice(dash + 3).trim() : raw;
  const mt = document.getElementById('mini-show-title');   if (mt) mt.textContent = title;
  const ht = document.getElementById('hero-show-title');   if (ht) ht.textContent = title;
  const pt = document.getElementById('player-show-title'); if (pt) pt.textContent = artist ? `${title} — ${artist}` : title;
  if (artist) {
    const hh = document.getElementById('hero-show-host');  if (hh) hh.textContent = 'with ' + artist;
    const ph = document.getElementById('player-show-host');if (ph) ph.textContent = artist;
  }
  if (isPlaying) {
    const ps  = document.getElementById('player-status');    if (ps)  ps.textContent  = artist || '98.7 FM · Live';
    const psb = document.getElementById('player-status-bar');if (psb) psb.textContent = artist ? `Now playing: ${artist}` : 'Live on 98.7 FM';
    const cs  = document.getElementById('connect-status');   if (cs)  cs.textContent  = '● Connected — Live 98.7 FM';
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
      const b = document.createElement('div'); b.classList.add('wave-bar');
      Object.assign(b.style, {
        width:'4px', background:'var(--c-primary)', opacity:'1',
        animationDelay:(Math.random()*-1.2)+'s', animationDuration:(0.7+Math.random()*0.9)+'s'
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
  isPlaying = false; _resetRadioUI();
  if (window.showToast) showToast('Stream connection lost', 'wifi_off');
});
audio.addEventListener('stalled', () => {
  if (isPlaying && window.showToast) showToast('Buffering…', 'sync');
});

// ── LISTENER SNAPSHOT LOGGER ──────────────────────────────────────
function _logListenerSnapshot(count) {
  try {
    const now     = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
    const show    = document.getElementById('hero-show-title')?.textContent?.trim() || 'On Air';
    const logKey  = 'amaica_lstn_' + now.toISOString().slice(0, 10);
    let log;
    try { log = JSON.parse(localStorage.getItem(logKey) || '[]'); } catch { log = []; }
    const last = log[log.length - 1];
    if (last && (now - new Date(last.ts)) < 120000) return;
    log.push({ ts: now.toISOString(), time: timeStr, show, count });
    if (log.length > 400) log.splice(0, log.length - 400);
    localStorage.setItem(logKey, JSON.stringify(log));
    _updateShowSummary(now.toDateString(), show, count);
  } catch(e) {}
}

function _updateShowSummary(dateKey, show, count) {
  try {
    let s; try { s = JSON.parse(localStorage.getItem('amaica_show_summary') || '{}'); } catch { s = {}; }
    if (!s[dateKey])       s[dateKey] = {};
    if (!s[dateKey][show]) s[dateKey][show] = { peak:0, avg:0, total:0, samples:0, first:null, last:null };
    const r = s[dateKey][show];
    const now = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
    r.peak = Math.max(r.peak, count); r.total += count; r.samples++;
    r.avg  = Math.round(r.total / r.samples);
    if (!r.first) r.first = now; r.last = now;
    const keys = Object.keys(s).sort((a,b) => new Date(a)-new Date(b));
    while (keys.length > 7) { delete s[keys.shift()]; }
    localStorage.setItem('amaica_show_summary', JSON.stringify(s));
  } catch(e) {}
}

window.getListenerSummary  = () => { try { return JSON.parse(localStorage.getItem('amaica_show_summary')||'{}'); } catch { return {}; } };
window.getTodayListenerLog = () => { const k='amaica_lstn_'+new Date().toISOString().slice(0,10); try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } };