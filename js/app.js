// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — APP.JS  v8
//  Navigation, chat, local storage, UI state, schedule engine,
//  fire pit / inferno mode, ember particles, vibe engine,
//  sponsorship system, streak gear, peak chart, online tracking
// ═══════════════════════════════════════════════════════════════
(function () {

  // ── Local storage ─────────────────────────────────────────────
  const _saved = (() => { try { return JSON.parse(localStorage.getItem('amaica_pulse') || '{}'); } catch { return {}; } })();
  window._localPoints = _saved.points ?? 0;
  window._localStreak = _saved.streak || 0;
  window._localUser = _saved.username || '';
  window._localChatMsgs = _saved.chatMsgs ?? 0;
  window._listenMins = _saved.listenMins || 0;
  window._lastListenDay = _saved.lastListenDay || '';
  window._hasStreakFreeze = _saved.streakFreeze || false;

  window.saveLocal = function () {
    const today = new Date().toDateString();
    if (window._lastListenDay !== today) {
      const yest = new Date(Date.now() - 86400000).toDateString();
      if (!window._hasStreakFreeze) {
        window._localStreak = window._lastListenDay === yest ? window._localStreak + 1 : 1;
      }
      window._lastListenDay = today;
    }
    try {
      localStorage.setItem('amaica_pulse', JSON.stringify({
        points: window._localPoints,
        streak: window._localStreak,
        username: window._localUser,
        chatMsgs: window._localChatMsgs,
        listenMins: window._listenMins,
        lastListenDay: window._lastListenDay,
        streakFreeze: window._hasStreakFreeze
      }));
    } catch (e) { }
    const se = document.getElementById('profile-streak');
    if (se) se.textContent = window._localStreak;
  };

  window.updateDailyStreak = function () {
    const today = new Date().toDateString();
    const yest = new Date(Date.now() - 86400000).toDateString();
    if (window._lastListenDay === today) return;
    if (!window._hasStreakFreeze) {
      window._localStreak = window._lastListenDay === yest ? window._localStreak + 1 : 1;
    }
    window._lastListenDay = today;
    const bonus = Math.min(window._localStreak * 10, 100);
    window._localPoints += bonus;
    saveLocal();
    showToast(`Day ${window._localStreak} Streak! +${bonus} pts`, 'workspace_premium');
  };

  // ── Points UI ────────────────────────────────────────────────
  function animateCounter(el, from, to, duration = 600) {
    if (!el) return;
    const start = performance.now();
    const run = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e).toLocaleString();
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  window.updateLocalUI = function () {
    const pts = window._localPoints;
    const f = pts.toLocaleString();
    ['points-display', 'profile-pts-num'].forEach(id => {
      const e = document.getElementById(id);
      if (e) animateCounter(e, parseInt(e.textContent.replace(/,/g, '')) || 0, pts);
    });
    const pp = document.getElementById('profile-pts'); if (pp) pp.textContent = f + ' pts';
    const lb = document.getElementById('lb-your-pts'); if (lb) lb.textContent = f + ' pts';
  };

  window.showPtsPop = function (pts) {
    if (pts <= 0) return;
    const count = pts >= 50 ? 3 : pts >= 20 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'pts-pop';
      p.textContent = '+' + pts + ' pts';
      p.style.left = (Math.random() * 55 + 20) + '%';
      p.style.bottom = '168px';
      p.style.animationDelay = (i * 0.12) + 's';
      p.style.fontSize = (0.8 + Math.random() * 0.5) + 'rem';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1700 + i * 120);
    }
  };

  // Premium "STOKED" pop — fire-styled, shows above fire meter
  function triggerPremiumPop(pts) {
    if (pts <= 0) return;
    const p = document.createElement('div');
    p.className = 'pts-pop';
    p.style.left = '50%';
    p.style.bottom = '200px';
    p.style.color = 'var(--fire-gold, #fbc531)';
    p.style.textShadow = '0 0 20px #e84118';
    p.innerHTML = `<span style="font-size:10px;opacity:0.6;">STOKED</span><br>+${pts}`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }

  // Fallback sbEarnPoints (used before supabase-client loads)
  if (typeof window.sbEarnPoints === 'undefined') {
    window.sbEarnPoints = async (pts, reason) => {
      const currentListeners = window._liveListeners || 100;
      const scarcityMultiplier = 1 / (1 + (currentListeners / (window.APP_CONFIG?.SCARCITY_DIVISOR || 1000)));
      const validActions = ['Listening bonus', 'Stoked the fire', 'Referral bonus', 'Mission complete', 'Tuned in', 'Sent message'];
      if (pts > 0 && !validActions.includes(reason)) return;
      const adjustedPts = pts > 0 ? Math.max(1, Math.floor(pts * scarcityMultiplier)) : pts;
      window._localPoints += adjustedPts;
      saveLocal(); updateLocalUI(); showPtsPop(adjustedPts);
      if (pts > 0) { triggerPremiumPop(adjustedPts); updateFireMeter(1); }
    };
  }

  // Burn sound on earn
  function playBurnSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const dur = 0.5;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buf;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
      noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      noise.start();
    } catch (e) { }
  }
  const _origEarn = window.sbEarnPoints;
  window.sbEarnPoints = async (pts, reason) => { playBurnSound(); if (_origEarn) await _origEarn(pts, reason); };
  window.playBurnSound = playBurnSound;

  // Listen bonus every minute
  setInterval(() => {
    if (window.isPlaying && window.isPlaying()) {
      sbEarnPoints(window.APP_CONFIG?.LISTEN_BONUS_PTS || 10, 'Listening bonus');
      showToast('+' + (window.APP_CONFIG?.LISTEN_BONUS_PTS || 10) + ' pts for listening!', 'stars');
      window._listenMins = (window._listenMins || 0) + 1;
      saveLocal();
      const lm = document.getElementById('profile-listen-mins'); if (lm) lm.textContent = window._listenMins;
    }
  }, window.APP_CONFIG?.LISTEN_BONUS_SECS || 60000);

  // ══════════════════════════════════════════════════════════════
  //  🔥 FIRE PIT / COMMUNITY HEAT METER
  // ══════════════════════════════════════════════════════════════
  let _firePct = 0;

  window.updateFireMeter = function (increment) {
    _firePct = Math.min(100, _firePct + (increment || 1));
    const fill = document.getElementById('fire-fill');
    const val = document.getElementById('fire-val');
    if (fill) fill.style.width = _firePct + '%';
    if (val) val.textContent = Math.floor(_firePct);
  };

  window.triggerInfernoMode = function (heroName) {
    const mc = document.getElementById('main-content');
    if (mc) mc.style.boxShadow = 'inset 0 0 150px rgba(232,65,24,0.6)';
    showToast(`🔥 INFERNO MODE! Thank ${heroName} for stoking the fire!`, 'local_fire_department');
    _firePct = 100;
    const fill = document.getElementById('fire-fill');
    const val = document.getElementById('fire-val');
    if (fill) fill.style.width = '100%';
    if (val) val.textContent = 'MAX';
    // Particle rain during inferno
    const infernoBurst = setInterval(() => createEmbers(true), 100);
    // Cool down after 30 minutes
    setTimeout(() => {
      clearInterval(infernoBurst);
      if (mc) mc.style.boxShadow = 'none';
      _firePct = 0;
      const f2 = document.getElementById('fire-fill');
      const v2 = document.getElementById('fire-val');
      if (f2) f2.style.width = '0%';
      if (v2) v2.textContent = '0';
      showToast('The fire is cooling down...', 'wb_sunny');
    }, 1800000);
  };

  // Alias used by older code
  window.triggerInfernoFlare = window.triggerInfernoMode;

  // Fire decays 1% every 2 minutes when not at max
  setInterval(() => {
    if (_firePct > 0 && _firePct < 100) {
      _firePct -= 1;
      const fill = document.getElementById('fire-fill');
      const val = document.getElementById('fire-val');
      if (fill) fill.style.width = _firePct + '%';
      if (val) val.textContent = Math.floor(_firePct);
    }
  }, 120000);

  // ══════════════════════════════════════════════════════════════
  //  🔥 EMBER PARTICLES
  // ══════════════════════════════════════════════════════════════
  window.createEmbers = function (isBurst) {
    isBurst = !!isBurst;
    if (!window.isPlaying?.() && !isBurst) return;
    const container = document.getElementById('main-content');
    if (!container) return;
    const count = isBurst ? 20 : 1;
    for (let i = 0; i < count; i++) {
      const ember = document.createElement('div');
      ember.className = 'ember';
      const size = (Math.random() * 3) + 1;
      ember.style.left = Math.random() * window.innerWidth + 'px';
      ember.style.bottom = '0px';
      ember.style.width = size + 'px';
      ember.style.height = size + 'px';
      ember.style.background = Math.random() > 0.3
        ? 'var(--fire-orange, #e84118)'
        : 'var(--fire-gold, #fbc531)';
      ember.style.boxShadow = `0 0 10px ${ember.style.background}`;
      const duration = 2 + Math.random() * 3;
      ember.style.animation = `float-up ${duration}s ease-out forwards`;
      container.appendChild(ember);
      setTimeout(() => ember.remove(), duration * 1000);
    }
  };

  // Continuous trickle (only fires when playing or on home/player)
  setInterval(() => createEmbers(false), 300);

  // ══════════════════════════════════════════════════════════════
  //  💗 VIBE ENGINE  (enhanced version from index_5)
  // ══════════════════════════════════════════════════════════════
  let globalVibe = 0;

  window.sendPulseVibe = function () {
    globalVibe += 10;
    // 1. Physical feedback
    if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    // 2. Heatwave flash
    const mc = document.getElementById('main-content');
    if (mc) {
      mc.style.transition = 'background 0.1s ease';
      mc.style.background = 'radial-gradient(circle at 50% 40%, rgba(232,65,24,0.45) 0%, #050505 80%)';
    }
    // 3. Shake the play button
    const playBtn = document.querySelector('.play-circle-wrap');
    if (playBtn) {
      playBtn.style.transition = 'transform 0.1s cubic-bezier(0.175,0.885,0.32,1.275)';
      playBtn.style.transform = 'scale(1.15) rotate(3deg)';
    }
    // 4. Ember burst
    for (let i = 0; i < 15; i++) setTimeout(() => createEmbers(true), i * 40);
    // 5. Cool down
    setTimeout(() => {
      if (mc) {
        mc.style.transition = 'background 2.5s ease';
        mc.style.background = '';
      }
      if (playBtn) {
        playBtn.style.transition = 'transform 0.5s ease';
        playBtn.style.transform = '';
      }
    }, 200);
    // 6. Points & toast
    sbEarnPoints(1, 'Stoked the fire');
    updateFireMeter(5);
    showToast('Fire stoked! 🔥', 'local_fire_department');
    // 7. Vibe decay
    clearTimeout(window.vDecay);
    window.vDecay = setTimeout(() => {
      globalVibe = 0;
      document.documentElement.style.setProperty('--vibe-glow', '0px');
    }, 4000);
  };

  // ══════════════════════════════════════════════════════════════
  //  🏢 SPONSORSHIP SYSTEM
  // ══════════════════════════════════════════════════════════════
  window.setSponsor = function (brand) {
    const brands = {
      'default': { color: '#76b82a', name: 'Amaica Media' },
      'safaricom': { color: '#49aa10', name: 'Safaricom Friday' },
      'airtel': { color: '#ff0000', name: 'Airtel Live' },
      'kcb': { color: '#005da3', name: 'KCB Hour' }
    };
    const s = brands[brand] || brands['default'];
    document.documentElement.style.setProperty('--sponsor-color', s.color);
    document.documentElement.style.setProperty('--c-primary', s.color);
    showToast(`App powered by ${s.name}`, 'verified');
  };

  // ══════════════════════════════════════════════════════════════
  //  ❄️ STREAK FREEZE + GEAR REWARDS
  // ══════════════════════════════════════════════════════════════
  const GEAR_REWARDS = [
    { id: 'tshirt', name: 'Amaica Leaf T-Shirt', price: 2000, referralsNeeded: 3, icon: '👕', desc: 'Forest green · unisex' },
    { id: 'halfjacket', name: 'Amaica Forest Half-Jacket', price: 5000, referralsNeeded: 7, icon: '🧥', desc: 'Limited run · embroidered logo' },
    { id: 'hoodie', name: 'The Pulse Hoodie', price: 8000, referralsNeeded: 12, icon: '🫱', desc: 'Super Fan exclusive · numbered' },
  ];

  window.buyStreakFreeze = function () {
    const cost = 500;
    const currentPts = window._profile?.points ?? window._localPoints;
    if (currentPts < cost) {
      showToast(`Need ${(cost - currentPts).toLocaleString()} more pts for a Freeze!`, 'error');
      return;
    }
    if (window._hasStreakFreeze) {
      showToast('You already have a Streak Freeze active! ❄️', 'info');
      return;
    }
    if (window._currentUser) {
      window.sbEarnPoints(-cost, 'Purchased Streak Freeze');
    } else {
      window._localPoints -= cost;
      updateLocalUI(); saveLocal();
    }
    window._hasStreakFreeze = true;
    saveLocal();
    showToast('Streak Freeze Active! ❄️', 'ac_unit');
    renderRewardsStore();
    const btn = document.getElementById('freeze-btn');
    if (btn) {
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Freeze Active ❄️';
      btn.disabled = true;
      btn.style.opacity = '.6';
    }
  };

  window.renderRewardsStore = function () {
    const grid = document.getElementById('gear-grid');
    if (!grid) return;
    const userPts = window._profile?.points ?? window._localPoints;
    const userRefs = window._profile?.referrals_made ?? 0;
    grid.innerHTML = GEAR_REWARDS.map(item => {
      const canAfford = userPts >= item.price;
      const hasRefs = userRefs >= item.referralsNeeded;
      const unlocked = canAfford && hasRefs;
      const lockLabel = !canAfford
        ? `${(item.price - userPts).toLocaleString()} more pts needed`
        : `Refer ${item.referralsNeeded - userRefs} more friends`;
      return `
        <div class="gear-card${unlocked ? '' : ' gear-locked'}" onclick="${unlocked ? `claimGear('${item.id}')` : ''}">
          <div class="gear-img">${item.icon}</div>
          <div class="gear-info">
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
            ${!unlocked ? `<p style="color:var(--c-error);font-size:.62rem;margin-top:2px;">🔒 ${lockLabel}</p>` : ''}
          </div>
          <div class="gear-price">
            <span>${item.price.toLocaleString()}</span>
            <small>pts + ${item.referralsNeeded} refs</small>
            ${unlocked ? `<button class="btn-primary" style="margin-top:6px;padding:5px 12px;font-size:.66rem;" onclick="event.stopPropagation();claimGear('${item.id}')">Claim</button>` : ''}
          </div>
        </div>`;
    }).join('');
  };

  window.claimGear = function (itemId) {
    const item = GEAR_REWARDS.find(g => g.id === itemId);
    if (!item) return;
    const userPts = window._profile?.points ?? window._localPoints;
    const userRefs = window._profile?.referrals_made ?? 0;
    if (userPts < item.price) { showToast(`Need ${(item.price - userPts).toLocaleString()} more pts!`, 'error'); return; }
    if (userRefs < item.referralsNeeded) { showToast(`Refer ${item.referralsNeeded - userRefs} more friends to unlock!`, 'lock'); return; }
    playBurnSound();
    if (window._currentUser) {
      window.sbEarnPoints(-item.price, `Claimed gear: ${item.name}`);
    } else {
      window._localPoints -= item.price;
      updateLocalUI(); saveLocal();
    }
    showToast(`🎉 ${item.name} voucher sent! Check your email.`, 'celebration');
    renderRewardsStore();
  };

  // ══════════════════════════════════════════════════════════════
  //  🔥 FIRE PARTICLES ON LOYALTY STREAK CIRCLE
  // ══════════════════════════════════════════════════════════════
  let _fireInterval = null;

  window.createFireParticles = function () {
    const container = document.querySelector('.loyalty-container');
    if (!container || (window._localStreak ?? 0) < 3) return;
    if (_fireInterval) return;
    _fireInterval = setInterval(() => {
      const p = document.createElement('div');
      p.className = 'fire-particle';
      p.style.left = (Math.random() * 80 + 10) + '%';
      p.style.bottom = '20px';
      p.style.background = Math.random() > 0.5 ? '#ff4500' : 'var(--brand-green-leaf)';
      p.style.animationDuration = (0.6 + Math.random() * 0.6) + 's';
      container.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }, 180);
  };

  window.stopFireParticles = function () {
    clearInterval(_fireInterval);
    _fireInterval = null;
  };

  window.checkSecretReward = function () {
    const streak = window._profile?.streak ?? window._localStreak ?? 0;
    const card = document.getElementById('secret-streak-reward');
    if (!card) return;
    if (streak >= 7) {
      card.style.display = 'block';
      card.classList.remove('animate-reveal');
      requestAnimationFrame(() => card.classList.add('animate-reveal'));
      createFireParticles();
    } else {
      card.style.display = 'none';
      stopFireParticles();
    }
    const btn = document.getElementById('freeze-btn');
    if (btn && window._hasStreakFreeze) {
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Freeze Active ❄️';
      btn.disabled = true;
      btn.style.opacity = '.6';
    }
  };

  // ══════════════════════════════════════════════════════════════
  //  📊 PEAK LISTENER COUNT + MINI CANVAS CHART
  // ══════════════════════════════════════════════════════════════
  let historyData = [];
  let peak = 0;

  window.drawChart = function () {
    const canvas = document.getElementById('listenersChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (historyData.length < 2) return;
    const max = Math.max(...historyData, 10);
    ctx.beginPath();
    historyData.forEach((val, i) => {
      const x = (i / (historyData.length - 1)) * w;
      const y = h - (val / max) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#76b82a';
    ctx.stroke();
  };

  // Feed live listener data into the chart
  window._updateListenerChart = function (count) {
    if (count > peak) {
      peak = count;
      const el = document.getElementById('peak-count');
      if (el) el.textContent = peak;
    }
    historyData.push(count);
    if (historyData.length > 30) historyData.shift();
    drawChart();
  };

  // Analytics history fetch
  window.loadAnalytics = async function () {
    try {
      const res = await fetch('https://dmscfpnkswmfbfgcuwwb.supabase.co/functions/v1/analytics');
      const data = await res.json();
      historyData = data.map(d => d.count).reverse().slice(-30);
      drawChart();
    } catch (e) {
      // Silently skip — chart stays empty until live data arrives
    }
  };

  // ══════════════════════════════════════════════════════════════
  //  👥 UNIFIED STATS ENGINE (presence + live listener count)
  // ══════════════════════════════════════════════════════════════
  // ── STATS ENGINE ─────────────────────────────────────────────
  // Stable session UID: generated once, reused on every heartbeat.
  // Bug fixed: the old code called Math.random() inside syncStats(),
  // creating a new guest ID every 15s → phantom rows in online_users.
  const _sessionUid = window._currentUser?.id
    || 'guest-' + Math.random().toString(36).substr(2, 8);

  async function syncStatistics() {
    if (!window._sb) return;
    try {
      // A. Register / heartbeat this session (only for logged-in users)
      if (window._currentUser?.id) {
        await window._sb.from('online_users').upsert({
          id: window._currentUser.id,
          user_id: window._currentUser.id,
          last_seen: new Date().toISOString()
        }, { onConflict: 'id' });
      }

      // B. Fetch live listener count from show_stats
      // B. Push real stream count to show_stats, then read back
      const streamCount = window._liveListeners ?? 0;
      await window._sb
        .from('show_stats')
        .update({ listeners: streamCount, updated_at: new Date().toISOString() })
        .eq('show_id', 'amaica_main');

      const { data } = await window._sb
        .from('show_stats')
        .select('listeners')
        .eq('show_id', 'amaica_main')
        .single();

      if (data) {
        const listeners = data.listeners ?? 0;
        window._liveListeners = listeners;
        window._hasRealListenerData = true;

        // Update every .listener-count-el element (home, player, admin)
        document.querySelectorAll('.listener-count-el').forEach(el => {
          el.textContent = Number(listeners).toLocaleString();
        });
        const badge = document.getElementById('live-count-badge');
        if (badge) badge.textContent = listeners + ' LIVE';
        const admCount = document.getElementById('adm-live-count');
        if (admCount) admCount.textContent = Number(listeners).toLocaleString();
        const lc = document.getElementById('listener-count');
        if (lc) lc.textContent = Number(listeners).toLocaleString();

        // Feed chart and monetisation engine
        if (typeof window._updateListenerChart === 'function') {
          window._updateListenerChart(listeners);
        }
        if (typeof runMonetization === 'function') runMonetization(listeners);
      }
    } catch (e) {
      console.error('Stats Sync Error:', e);
    }
  }

  // Backward-compat alias (player.js calls this name)
  async function updateListenersFromFunction() { await syncStatistics(); }

  // ══════════════════════════════════════════════════════════════
  //  📢 MONETIZATION ENGINE
  // ══════════════════════════════════════════════════════════════
  window.runMonetization = function (listeners) {
    if (listeners >= 20 && !window.m20) { window.m20 = true; showToast('📢 Trigger: Entry Ad Slot', 'campaign'); }
    if (listeners >= 50 && !window.m50) { window.m50 = true; showToast('🔥 Trigger: Mid-tier Ad', 'campaign'); }
    if (listeners >= 100 && !window.m100) { window.m100 = true; showToast('🚀 Trigger: Premium Ad', 'campaign'); }
  };

  // ── Navigation ────────────────────────────────────────────────
  window.navigateTo = function (s) {
    document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
    const el = document.getElementById('screen-' + s); if (el) el.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    const nb = document.getElementById('nav-' + s); if (nb) nb.classList.add('active');
    const mc = document.getElementById('main-content');
    if (mc) mc.scrollTop = 0;
    const mini = document.getElementById('mini-player');
    if (mini) mini.classList.toggle('retracted', s === 'community');
    if (s === 'rewards' && document.getElementById('r-leaderboard')?.style.display !== 'none') {
      if (window.loadLeaderboard) loadLeaderboard();
    }
    if (s === 'profile' || s === 'settings') syncLocalProfileUI();
    if (s === 'profile') { syncLoyaltyUI(); checkSecretReward(); }
    if (s === 'home') renderFeed();
    if (s === 'rewards') { renderRewardsList(); renderMarketplace(); renderRewardsStore(); }
    // Background switch — fiery on home/player, flat elsewhere
    if (mc) {
      mc.style.background = (s === 'home' || s === 'player')
        ? 'radial-gradient(circle at 50% 30%, var(--stone-glow, rgba(232,65,24,0.15)), var(--amaica-charcoal, #080808) 70%)'
        : '#050505';
    }
    setTimeout(initReveal, 50);
  };

  // ── Toast ────────────────────────────────────────────────────
  window.showToast = function (msg, icon) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="material-symbols-outlined">${icon || 'info'}</span>${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2900);
  };

  window.showLiveShoutout = (username, text) => {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const s = document.createElement('div');
    s.className = 'toast shoutout-toast';
    s.innerHTML = `<div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:.58rem;color:var(--c-primary);font-weight:800;letter-spacing:.1em;">📣 LIVE SHOUTOUT</span><span style="font-size:.78rem;"><strong>${username}:</strong> ${text}</span></div>`;
    c.appendChild(s);
    setTimeout(() => s.remove(), 5000);
  };

  // ── Feed renderer ─────────────────────────────────────────────
  window.renderFeed = function () {
    const el = document.getElementById('minimal-feed');
    if (!el) return;
    const feed = window.getAdminFeed ? getAdminFeed() : [];
    el.innerHTML = feed.slice(0, 4).map(f => `
      <div class="feed-card reveal">
        <span class="fc-tag">${f.tag}</span>
        <p class="fc-title">${f.title}</p>
        <p class="fc-body">${f.body}</p>
        <div class="fc-footer"><span class="fc-time">${f.time}</span></div>
      </div>`).join('');
    setTimeout(initReveal, 60);
  };

  // ── Rewards list renderer ─────────────────────────────────────
  window.renderRewardsList = function () {
    const el = document.getElementById('rewards-list-dynamic');
    if (!el) return;
    const rewards = window.getAdminRewards ? getAdminRewards() : [];
    el.innerHTML = rewards.map(r => `
      <div class="rwd-card" onclick="claimReward(${r.pts})">
        <div class="rwd-icon">${r.icon}</div>
        <div class="rwd-info"><p class="rwd-name">${r.name}</p><p class="rwd-desc">${r.desc}</p></div>
        <div class="rwd-pts">${r.pts.toLocaleString()}<small>points</small></div>
      </div>`).join('');
  };

  // ── Marketplace renderer ──────────────────────────────────────
  window.renderMarketplace = function () {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    const market = window.getAdminMarket ? getAdminMarket() : [];
    grid.innerHTML = market.map(item => `
      <div class="market-item" onclick="redeemPulseItem('${item.name}', ${item.price}, '${item.tag}')">
        <span class="item-tag">${item.tag}</span>
        <div class="item-icon">${item.icon}</div>
        <p style="font-weight:700;font-size:13px;margin-bottom:2px;">${item.name}</p>
        <p class="item-price">${item.price.toLocaleString()}<span>PTS</span></p>
        <p style="font-size:9px;opacity:0.6;">${item.desc || ''}</p>
      </div>`).join('');
  };

  window.redeemPulseItem = async function (name, cost, type) {
    const bal = window._profile?.points ?? window._localPoints;
    if (bal < cost) {
      showToast(`Need ${(cost - bal).toLocaleString()} more pts!`, 'error');
      return;
    }

    // For airtime, ask for phone number
    let phone = null;
    if (type === 'Digital' && name.toLowerCase().includes('airtime')) {
      phone = prompt('Enter your Safaricom number (e.g. 0712345678):');
      if (!phone) return;
    }

    if (confirm(`Redeem ${name} for ${cost} pts?`)) {
      const shortCode = 'AM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      await sbEarnPoints(-cost, `Redeemed ${name}`);

      if (cost >= 1000) triggerInfernoMode(window._profile?.username || 'A Legend');

      // Backend log — save regardless of auth status
      let redemptionId = null;
      if (window._sb) {
        const { data: rd, error: rErr } = await window._sb.from('redemptions').insert({
          user_id: window._currentUser?.id || null,
          item_name: name,
          item_type: type,
          code: shortCode,
          status: 'pending',
          created_at: new Date()
        }).select().single();
        if (rErr) console.warn('[redemption] insert failed:', rErr.message);
        redemptionId = rd?.id;
      }
      // If airtime — call Edge Function
      if (phone && redemptionId) {
        showToast('Sending airtime...', 'check_circle');
        try {
          const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/send-airtime`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`
            },
            body: JSON.stringify({ phone, amount: cost / 2, redemption_id: redemptionId })
          });
          const result = await res.json();
          if (result.success) {
            showToast(`✅ KES ${cost / 2} airtime sent to ${phone}!`, 'celebration');
            await window._sb.from('redemptions').update({ status: 'claimed' }).eq('id', redemptionId);
          } else {
            showToast(`Airtime failed: ${result.error}`, 'error');
          }
        } catch (e) {
          showToast('Airtime sending failed. Contact staff.', 'error');
        }
      } else {
        alert(`SUCCESS! Your code is ${shortCode}. Collect at Kakamega Station.`);
      }
    }
  };

  window.claimReward = function (cost) {
    const bal = window._profile?.points ?? window._localPoints;
    if (bal < cost) { showToast('Not enough points', 'error'); return; }
    if (window._profile) window._profile.points -= cost; else window._localPoints -= cost;
    updateLocalUI();
    showToast('Reward claimed! 🎉', 'celebration');
  };

  // ── Chat ─────────────────────────────────────────────────────
  const seedMsgs = [
    { u: 'Marcus R.', text: 'DJ Echo is fire tonight', own: false, time: '9:42 PM', pts: true },
    { u: 'Elena V.', text: "Been tuned in for 2 hours. Can't leave!", own: false, time: '9:44 PM', pts: false },
    { u: 'You', text: 'Just joined — this is the vibe', own: true, time: '9:45 PM', pts: false },
    { u: 'J. Aris', text: "Who's calling in next?", own: false, time: '9:46 PM', pts: true },
  ];

  function buildMsg(m) {
    const d = document.createElement('div');
    d.className = 'cmsg' + (m.own ? ' own' : '');
    d.innerHTML = `<div class="cav">${m.u.charAt(0)}</div><div class="cbw"><p class="cuser">${m.u}${m.pts ? ' <span class="pts-pill"><span class="material-symbols-outlined" style="font-size:10px;">stars</span>+5 pts</span>' : ''}</p><div class="cbubble">${m.text}</div><p class="ctime">${m.time}</p></div>`;
    return d;
  }

  window.appendChatMsg = function (m) {
    const c = document.getElementById('chat-messages'); if (!c) return;
    c.appendChild(buildMsg(m)); c.scrollTop = c.scrollHeight;
  };

  function initChat() {
    const c = document.getElementById('chat-messages'); if (!c) return;
    seedMsgs.forEach(m => c.appendChild(buildMsg(m)));
    c.scrollTop = c.scrollHeight;
  }

  window.sendChat = function () {
    const inp = document.getElementById('chat-input');
    const txt = inp?.value.trim(); if (!txt) return;
    const c = document.getElementById('chat-messages'); if (!c) return;
    const t = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    c.appendChild(buildMsg({ u: window._profile?.username || window._localUser || 'You', text: txt, own: true, time: t, pts: false }));
    c.scrollTop = c.scrollHeight; inp.value = '';
    window._localChatMsgs++; updateChatMission(); saveLocal();
    sbEarnPoints(window.APP_CONFIG?.CHAT_PTS || 5, 'Sent message');
    showToast('+' + (window.APP_CONFIG?.CHAT_PTS || 5) + ' Pulse Points!', 'stars');
    if (window.sbSendMessage) sbSendMessage(txt);
    const rs = [{ u: 'Elena V.', text: 'Absolutely! 🔥' }, { u: 'Marcus R.', text: "That's it!" }, { u: 'J. Aris', text: 'Welcome!' }];
    const r = rs[Math.floor(Math.random() * rs.length)];
    const typing = document.createElement('div');
    typing.className = 'cmsg'; typing.id = 'typing-indicator';
    typing.innerHTML = `<div class="cav">${r.u.charAt(0)}</div><div class="cbw"><p class="cuser">${r.u}</p><div class="cbubble" style="display:flex;gap:4px;align-items:center;padding:10px 14px;"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
    c.appendChild(typing); c.scrollTop = c.scrollHeight;
    setTimeout(() => {
      typing.remove();
      appendChatMsg({ u: r.u, text: r.text, own: false, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), pts: true });
    }, 1000 + Math.random() * 600);
  };

  window.homeQuickChat = function () {
    const inp = document.getElementById('home-chat-input'); if (!inp) return;
    const txt = inp.value.trim(); if (!txt) return;
    inp.value = '';
    const preview = document.getElementById('home-chat-preview');
    if (preview) {
      const name = window._profile?.username || window._localUser || 'You';
      const div = document.createElement('div'); div.className = 'cpm';
      div.innerHTML = `<div class="cpm-av">${name.charAt(0).toUpperCase()}</div><div class="cpm-body"><p class="cpm-user" style="color:var(--c-on-surface);">${name}</p><p class="cpm-text">${txt}</p></div>`;
      preview.appendChild(div);
      if (preview.children.length > 5) preview.removeChild(preview.children[0]);
    }
    sbEarnPoints(window.APP_CONFIG?.CHAT_PTS || 5, 'Sent message');
    showToast('+' + (window.APP_CONFIG?.CHAT_PTS || 5) + ' Pulse Points!', 'stars');
    window._localChatMsgs++; updateChatMission(); saveLocal();
    if (window.sbSendMessage) sbSendMessage(txt);
  };

  function updateChatMission() {
    const n = window._localChatMsgs, g = 5;
    const pct = Math.min(100, (n / g) * 100);
    const b = document.getElementById('chat-prog'); if (b) b.style.width = pct + '%';
    const l = document.getElementById('chat-mission-lbl'); if (l) l.textContent = Math.min(n, g) + ' / ' + g + ' messages';
    const pc = document.getElementById('profile-chat'); if (pc) pc.textContent = n;
  }

  // ── Profile ──────────────────────────────────────────────────
  function syncLocalProfileUI() {
    const pts = window._profile?.points ?? window._localPoints;
    const streak = window._profile?.streak ?? window._localStreak;
    const msgs = window._profile?.messages_sent ?? window._localChatMsgs;
    const name = window._profile?.username || window._localUser || 'Listener';
    const mins = window._listenMins || 0;
    const f = pts.toLocaleString();

    const av = document.getElementById('profile-avatar-letter'); if (av) av.textContent = (name.charAt(0) || 'L').toUpperCase();
    const ud = document.getElementById('profile-username-display'); if (ud) ud.textContent = name;
    const ml = document.getElementById('profile-member-label');
    if (ml) ml.textContent = window._profile ? 'Cloud synced · Pulse Points Member' : 'Local listener · points saved on this device';

    ['points-display', 'profile-pts-num'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = f; });
    const pp = document.getElementById('profile-pts'); if (pp) pp.textContent = f + ' pts';
    const lb = document.getElementById('lb-your-pts'); if (lb) lb.textContent = f + ' pts';
    const ps = document.getElementById('profile-streak'); if (ps) ps.textContent = streak;
    const pc = document.getElementById('profile-chat'); if (pc) pc.textContent = msgs;
    const lm = document.getElementById('profile-listen-mins'); if (lm) lm.textContent = mins;
    const inp = document.getElementById('local-username-input');
    if (inp && !inp.value && window._localUser) inp.value = window._localUser;

    const ue = document.getElementById('username-editor');
    const li = document.getElementById('profile-logged-in');
    const as = document.getElementById('auth-section');
    if (window._currentUser) {
      if (ue) ue.style.display = 'none'; if (li) li.style.display = 'block'; if (as) as.style.display = 'none';
    } else {
      if (ue) ue.style.display = 'block'; if (li) li.style.display = 'none'; if (as) as.style.display = 'block';
    }
  }

  window.syncLocalProfileUI = syncLocalProfileUI;

  const _origRAS = window.renderAuthState;
  window.renderAuthState = () => { if (_origRAS) _origRAS(); syncLocalProfileUI(); };

  window.syncLoyaltyUI = function () {
    const streak = window._profile?.streak ?? window._localStreak ?? 0;
    const numEl = document.getElementById('streak-num');
    const circle = document.getElementById('loyalty-progress');
    if (numEl) numEl.textContent = streak;
    if (circle) {
      const prog = Math.min(streak / 7, 1);
      circle.style.strokeDashoffset = 283 - (prog * 283);
      circle.style.stroke = streak >= 3 ? 'var(--brand-green-leaf)' : '';
      circle.style.filter = streak >= 3 ? 'drop-shadow(0 0 8px #e84118)' : `drop-shadow(0 0 ${prog * 10}px var(--brand-green-leaf))`;
    }
    checkSecretReward();
  };

  // ── Leaderboard ──────────────────────────────────────────────
  const localLB = [
    { username: 'Sarah Sterling', points: 7800, streak: 14 },
    { username: 'Luka Chen', points: 6200, streak: 8 },
    { username: 'Nadia Bloom', points: 5900, streak: 32 },
    { username: 'Keion Marks', points: 5400, streak: 5 },
    { username: 'Priya Dev', points: 4800, streak: 21 },
  ];

  window.renderLeaderboard = function (data) {
    const c = document.getElementById('lb-list'); if (!c) return;
    c.innerHTML = '';
    (data || localLB).forEach((u, i) => {
      const sv = u.streak || 0;
      const fc = sv >= 7 ? '#76b82a' : sv >= 3 ? '#ff9500' : 'var(--c-on-surface-variant)';
      const fi = sv >= 7 ? '🌳' : '🔥';
      const sf = sv > 0 ? `<span style="color:${fc};font-size:12px;font-weight:800;margin-left:4px;">${fi} ${sv}</span>` : '';
      const row = document.createElement('div'); row.className = 'lb-row';
      row.innerHTML = `<span class="lb-rank">${i + 4}</span><div class="lb-av">${(u.username || '?').charAt(0)}</div><div style="flex:1;"><p class="lb-name">${u.username}${sf}</p><p style="font-size:.58rem;color:var(--c-on-surface-variant);">Level: ${u.tier || 'Bronze'}</p></div><span class="lb-pts">${((u.points || 0) / 1000).toFixed(1)}k</span>`;
      c.appendChild(row);
    });
  };

  if (typeof window.loadLeaderboard === 'undefined') {
    window.loadLeaderboard = () => renderLeaderboard(localLB);
  }

  // ── Auth helpers ──────────────────────────────────────────────
  window.switchTab = function (t) {
    document.getElementById('tab-signin')?.classList.toggle('active', t === 'signin');
    document.getElementById('tab-signup')?.classList.toggle('active', t === 'signup');
    const fs = document.getElementById('form-signin'); if (fs) fs.style.display = t === 'signin' ? 'block' : 'none';
    const fu = document.getElementById('form-signup'); if (fu) fu.style.display = t === 'signup' ? 'block' : 'none';
  };

  window.doSignIn = async function () {
    if (!window._sb) { showToast('Backend not connected', 'error'); return; }
    try {
      await sbSignIn(document.getElementById('si-email').value, document.getElementById('si-pass').value);
      showToast('Welcome back!', 'check_circle');
    } catch (e) {
      const er = document.getElementById('si-error');
      if (er) { er.textContent = e.message; er.style.display = 'block'; }
    }
  };

  window.doSignUp = async function () {
    if (!window._sb) { showToast('Backend not connected', 'error'); return; }
    try {
      await sbSignUp(document.getElementById('su-email').value, document.getElementById('su-pass').value, document.getElementById('su-user').value);
      showToast('Account created! Check your email.', 'check_circle');
    } catch (e) {
      const er = document.getElementById('su-error');
      if (er) { er.textContent = e.message; er.style.display = 'block'; }
    }
  };

  window.saveLocalUsername = function () {
    const inp = document.getElementById('local-username-input');
    const name = inp?.value.trim(); if (!name) { showToast('Enter a name first', 'error'); return; }
    window._localUser = name; saveLocal(); syncLocalProfileUI(); showToast('Name saved', 'check_circle');
  };

  window.resetAllData = function () {
    if (!confirm('Reset all local data? Points and history will be cleared.')) return;
    try { localStorage.removeItem('amaica_pulse'); } catch (e) { }
    window._localPoints = 0; window._localStreak = 0; window._localUser = '';
    window._localChatMsgs = 0; window._listenMins = 0; window._lastListenDay = '';
    syncLocalProfileUI(); showToast('Local data cleared', 'check_circle');
  };

  // ── Chips & sections ─────────────────────────────────────────
  window.setChip = function (el, gid) {
    document.querySelectorAll('#' + gid + ' .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  };

  window.showRSec = function (s) {
    ['points', 'leaderboard', 'perks', 'refer'].forEach(x => {
      const e = document.getElementById('r-' + x); if (e) e.style.display = x === s ? 'block' : 'none';
    });
    if (s === 'leaderboard') loadLeaderboard();
    if (s === 'perks') { renderRewardsList(); renderRewardsStore(); }
    if (s === 'points') {
      setTimeout(() => {
        document.querySelectorAll('#r-points .prog-fill').forEach(b => {
          const w = b.style.width; b.style.width = '0';
          requestAnimationFrame(() => { b.style.transition = 'width 1s cubic-bezier(0.22,1,0.36,1)'; b.style.width = w; });
        });
      }, 100);
    }
  };

  // ── Reminders ────────────────────────────────────────────────
  const _reminders = new Set();
  window.setReminder = function (idx, btn) {
    if (_reminders.has(idx)) {
      _reminders.delete(idx); btn.textContent = 'Remind'; btn.classList.remove('set');
      showToast('Reminder removed', 'notifications_off');
    } else {
      _reminders.add(idx); btn.textContent = '✓ Set'; btn.classList.add('set');
      sbEarnPoints(5, 'Set reminder');
      showToast('Reminder set! +50 pts at showtime.', 'event_upcoming');
    }
  };

  // ── Sleep timer ──────────────────────────────────────────────
  let _sleepTimer = null, _sleepTick = null;
  window.setSleepTimer = function (mins) {
    clearTimeout(_sleepTimer); clearInterval(_sleepTick);
    const el = document.getElementById('sleep-status');
    if (mins === 0) { if (el) el.textContent = 'Not set'; showToast('Sleep timer cancelled', 'bedtime'); return; }
    let remaining = mins;
    if (el) el.textContent = `Stops in ${remaining} min`;
    showToast(`Sleep timer: ${mins} min`, 'bedtime');
    _sleepTick = setInterval(() => {
      remaining--;
      if (el) el.textContent = remaining > 0 ? `Stops in ${remaining} min` : 'Stopping…';
      if (remaining <= 0) clearInterval(_sleepTick);
    }, 60000);
    _sleepTimer = setTimeout(() => {
      if (window.isPlaying && window.isPlaying()) toggleRadio();
      if (el) el.textContent = 'Not set';
      showToast('Sleep timer — stream stopped', 'bedtime');
    }, mins * 60000);
  };

  // ── Quality ───────────────────────────────────────────────────
  window.setQuality = function (q, btn) {
    document.querySelectorAll('#quality-chips .chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    showToast({ auto: 'Auto quality', low: 'Low bandwidth', high: 'High quality' }[q] || q, 'graphic_eq');
  };

  // ── Theme ────────────────────────────────────────────────────
  window.setTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    updateSettingsThemeButtons();
    showToast(t === 'ember' ? 'Ember Mode 🔥' : 'Cyan Mode', 'palette');
  };
  function updateSettingsThemeButtons() {
    const t = document.documentElement.getAttribute('data-theme') || 'ember';
    const te = document.getElementById('ts-ember'); const tc = document.getElementById('ts-cyan');
    if (te) te.style.borderColor = t === 'ember' ? 'var(--c-primary)' : 'transparent';
    if (tc) tc.style.borderColor = t === 'cyan' ? 'var(--c-primary)' : 'transparent';
    const te2 = document.getElementById('theme-ember'); const tc2 = document.getElementById('theme-cyan');
    if (te2) te2.classList.toggle('active', t === 'ember');
    if (tc2) tc2.classList.toggle('active', t === 'cyan');
  }
  window.updateSettingsThemeButtons = updateSettingsThemeButtons;

  // ── Share / copy ──────────────────────────────────────────────
  window.shareApp = function () {
    if (navigator.share) {
      navigator.share({ title: 'Amaica Media', text: 'Listen live on Amaica Radio 98.7 FM!', url: location.href });
    } else {
      navigator.clipboard.writeText(location.href).then(() => showToast('Link copied!', 'link'));
    }
  };
  window.copyCode = function () {
    const c = document.getElementById('referral-code-display')?.textContent || 'PULSE-XK47';
    navigator.clipboard.writeText(c).then(() => showToast('Code copied!', 'content_copy'));
  };
  if (typeof window.applyReferralCode === 'undefined') {
    window.applyReferralCode = () => showToast('Sign in to apply referral codes', 'info');
  }

  // ── Scroll reveal ─────────────────────────────────────────────
  window.initReveal = function () {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.08 });
    document.querySelectorAll('.feed-card, .ev-card, .rwd-card, .ach-card, .lb-row, .content-card, .return-card')
      .forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = `${(i % 6) * 0.05}s`; obs.observe(el); });
  };

  // ── Programme Schedule Engine ─────────────────────────────────
  let SCHEDULE = [
    { name: 'Amaica Asubuhi', host: 'Godson & Chiteri', days: [1, 2, 3, 4, 5], start: 360, end: 600 },
    { name: 'Jungu la Habari', host: 'Amaica Newsroom', days: [1, 2, 3, 4, 5], start: 420, end: 430, isNews: true },
    { name: 'Jungu la Habari', host: 'Amaica Newsroom', days: [1, 2, 3, 4, 5], start: 540, end: 550, isNews: true },
    { name: 'Mikikimikiki', host: 'Antony', days: [1, 2, 3, 4, 5], start: 600, end: 780 },
    { name: 'Tuvibe', host: 'Amaica Media', days: [1, 2, 3, 4, 5], start: 780, end: 960 },
    { name: 'Jungu la Habari', host: 'Amaica Newsroom', days: [1, 2, 3, 4, 5], start: 780, end: 790, isNews: true },
    { name: 'Rhumba Koleka', host: 'Joshua · Chiteri · Brilliant', days: [1, 2, 3], start: 960, end: 1200 },
    { name: 'SupaJam', host: 'Vincent', days: [4, 5], start: 960, end: 1200 },
    { name: 'Jungu la Habari', host: 'Amaica Newsroom', days: [1, 2, 3, 4, 5], start: 960, end: 970, isNews: true },
    { name: 'Mdahalo', host: 'Godson', days: [6], start: 480, end: 660 },
    { name: 'SupaJam', host: 'Vincent', days: [6], start: 660, end: 900 },
    { name: 'Amaica Viwanjani', host: 'Antony & Chiteri', days: [6], start: 900, end: 1140 },
    { name: 'Hema ya Ushindi', host: 'Shitanda', days: [0], start: 360, end: 600 },
    { name: 'Sifa', host: 'Joshua', days: [0], start: 600, end: 780 },
    { name: 'SupaJam', host: 'Vincent', days: [0], start: 780, end: 960 },
    { name: 'Barizika', host: 'Joshua', days: [0], start: 960, end: 1140 },
  ];

  // Load schedule from Supabase — replaces hardcoded if rows exist
  window.loadScheduleFromSupabase = async function () {
    if (!window._sb) return;
    try {
      const { data, error } = await window._sb.from('schedule').select('*').order('start_min');
      if (error || !data || data.length === 0) return;
      SCHEDULE = data.map(s => ({
        name: s.name,
        host: s.host,
        days: s.days,
        start: s.start_min,
        end: s.end_min,
        isNews: s.is_news || false,
      }));
      syncScheduleUI();
    } catch (e) { console.warn('[schedule] Supabase load failed:', e); }
  };

  function _minsNow() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  function _dayShows(dow, noNews) { return SCHEDULE.filter(s => s.days.includes(dow) && (!noNews || !s.isNews)).sort((a, b) => a.start - b.start); }
  function _fmtTime(m) { const h = Math.floor(m / 60) % 24, mn = m % 60, ap = h < 12 ? 'AM' : 'PM', hh = h % 12 || 12; return mn === 0 ? `${hh} ${ap}` : `${hh}:${String(mn).padStart(2, '0')} ${ap}`; }
  function _dayName(d) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]; }

  function getCurrentShow() { const now = _minsNow(), dow = new Date().getDay(); return _dayShows(dow).find(s => now >= s.start && now < s.end) || null; }
  function getNextMainShow() {
    const now = _minsNow(), dow = new Date().getDay();
    const l = _dayShows(dow, true).find(s => s.start > now); if (l) return { ...l, dayLabel: 'Today' };
    const tmr = (dow + 1) % 7, f = _dayShows(tmr, true)[0]; return f ? { ...f, dayLabel: _dayName(tmr) } : null;
  }
  function getUpcoming(count = 3) {
    const now = _minsNow(), dow = new Date().getDay(), res = [];
    _dayShows(dow, true).filter(s => s.start > now).forEach(s => res.push({ ...s, dayLabel: 'Today' }));
    if (res.length < count) { const t = (dow + 1) % 7; _dayShows(t, true).forEach(s => res.push({ ...s, dayLabel: _dayName(t) })); }
    return res.slice(0, count);
  }

  function syncScheduleUI() {
    const cur = getCurrentShow(), nxt = getNextMainShow(), up = getUpcoming(3);
    const setText = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    setText('hero-show-title', cur ? cur.name : 'Amaica Media');
    const hh = document.getElementById('hero-show-host');
    if (hh) hh.textContent = cur ? (cur.isNews ? '📰 ' + cur.host : 'with ' + (cur.host || 'Amaica Media 98.7 FM')) : '98.7 FM · Live';
    setText('player-show-title', cur ? cur.name : 'Amaica Media 98.7 FM');
    setText('player-show-host', cur ? (cur.host || '98.7 FM') : '98.7 FM');
    setText('mini-show-title', cur ? cur.name : 'Amaica Media');
    const nu = document.querySelector('.nu-label');
    if (nu && nxt) nu.innerHTML = `<strong>${nxt.name}</strong> · ${_fmtTime(nxt.start)}`;
    const rcList = document.getElementById('rc-shows-list');
    if (rcList && up.length) {
      rcList.innerHTML = up.map((s, i) => `
        <div class="rc-show-row">
          <span class="rc-time">${_fmtTime(s.start)}</span>
          <div class="rc-show-info"><p class="rc-show-name">${s.name}</p><p class="rc-show-host">${s.host || 'Amaica Media'}${s.dayLabel !== 'Today' ? ' · ' + s.dayLabel : ''}</p></div>
          <button class="rc-remind-btn" id="remind-dyn-${i}" onclick="setReminder('dyn-${i}',this)">Remind</button>
        </div>`).join('');
    }
    const evTitle = document.getElementById('ev-live-title');
    if (evTitle) evTitle.textContent = cur ? `${cur.name}${cur.host ? ' — ' + cur.host : ''}` : 'Amaica Media 98.7 FM';
  }

  // ── Waveform background ───────────────────────────────────────
  window.addEventListener('load', () => {
    const hwb = document.getElementById('hero-wave-bg');
    if (hwb) {
      for (let i = 0; i < 40; i++) {
        const b = document.createElement('div'); b.classList.add('wave-bar');
        Object.assign(b.style, {
          width: '4px', background: 'var(--c-primary)', opacity: '1',
          animationDelay: (Math.random() * -1.2) + 's', animationDuration: (0.7 + Math.random() * 0.9) + 's'
        });
        hwb.appendChild(b);
      }
    }
    // Init UI
    syncLocalProfileUI();
    updateSettingsThemeButtons();
    initChat();
    renderLeaderboard();
    renderFeed();
    renderRewardsList();
    renderMarketplace();
    renderRewardsStore();
    syncScheduleUI();
    setInterval(syncScheduleUI, 60000);
    if (typeof renderAuthState !== 'undefined') renderAuthState();
    initReveal();
    // Wait for Supabase then start the stats engine
    function startEngine() {
      if (window._sb) {
        console.log('Database Connected. Starting Stats...');
        syncStatistics();
        setInterval(syncStatistics, 15000);
        if (typeof loadAnalytics === 'function') loadAnalytics();
        if (window.loadScheduleFromSupabase) loadScheduleFromSupabase();
      } else {
        setTimeout(startEngine, 500);
      }
    }
    startEngine();
  });

})();