// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — ADMIN MODULE
//  Stats dashboard (hidden), feed CRUD, rewards CRUD, staff PIN
//  Access: tap version label 5× in Settings → enter PIN
// ═══════════════════════════════════════════════════════════════
(function () {
  // ── Default data (overridden by localStorage) ─────────────────
  const DEFAULT_FEED = [
    { id: 1, tag: 'News',    title: 'Amaica Festival 2024 Lineup Announced', body: 'Top artists confirmed for the biggest night in Kakamega.', time: '2h ago' },
    { id: 2, tag: 'Live',    title: 'The Midnight Pulse is Live Now', body: 'DJ Echo is mixing the freshest tracks on 98.7 FM.', time: 'Now' },
    { id: 3, tag: 'Rewards', title: '+50 Bonus Points This Weekend', body: 'Tune in Saturday for a listener-appreciation points boost.', time: '1d ago' },
  ];

  const DEFAULT_REWARDS = [
    { id: 1, icon: '🎟️', name: 'VIP Event Ticket',    desc: 'Any Amaica-hosted event', pts: 500 },
    { id: 2, icon: '🎧', name: 'Wireless Headphones', desc: 'Echo-Series, free shipping', pts: 2500 },
    { id: 3, icon: '☕', name: 'Local Coffee Voucher', desc: 'Partner café — any drink', pts: 100 },
    { id: 4, icon: '👕', name: 'Amaica T-Shirt',       desc: 'Forest green · unisex', pts: 1000 },
  ];

  const DEFAULT_MARKET = [
    { id: 1, icon: '👕', name: 'Amaica T-Shirt',    price: 1000, tag: 'Physical', desc: 'Forest Green Leaf' },
    { id: 2, icon: '🧢', name: 'Official Cap',      price: 1300, tag: 'Physical', desc: 'Embroidered Pulse' },
    { id: 3, icon: '🧥', name: 'The Pulse Hoodie',  price: 6000, tag: 'Physical', desc: 'Heavyweight Cotton' },
    { id: 4, icon: '📱', name: '100 KES Airtime',   price: 200,  tag: 'Digital',  desc: 'Instant Top-up' },
  ];

  // ── Persistence helpers ───────────────────────────────────────
  function loadData(key, def) {
    try { return JSON.parse(localStorage.getItem('amaica_' + key)) || def; }
    catch { return def; }
  }
  function saveData(key, data) {
    try { localStorage.setItem('amaica_' + key, JSON.stringify(data)); } catch(e){}
  }

  // Expose to rest of app
  window.getAdminFeed    = () => loadData('feed',    DEFAULT_FEED);
  window.getAdminRewards = () => loadData('rewards', DEFAULT_REWARDS);
  window.getAdminMarket  = () => loadData('market',  DEFAULT_MARKET);

  // ── Admin panel toggle ────────────────────────────────────────
  window.toggleAdmin = (show) => {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    panel.style.display = show ? 'block' : 'none';
    if (show) { renderAdminStats(); renderAdminFeedEditor(); renderAdminRewardsEditor(); renderAdminMarketEditor(); }
  };

  // ── Stats (ADMIN ONLY — never shown in public screens) ────────
  function renderAdminStats() {
    const el = document.getElementById('admin-stats');
    if (!el) return;

    const pts   = window._profile?.points        ?? window._localPoints   ?? 0;
    const msgs  = window._profile?.messages_sent ?? window._localChatMsgs ?? 0;
    const mins  = window._listenMins ?? 0;
    const live  = window._liveListeners;
    const liveStr = live != null ? Number(live).toLocaleString() : '—';

    // ── Top 4 tiles ──────────────────────────────────────────
    let html = `
      <div class="adm-stat-grid" style="margin-bottom:16px;">
        <div class="adm-stat adm-stat-fire">
          <p class="adm-val">${liveStr}</p>
          <p class="adm-lbl">🔴 Live Now</p>
        </div>
        <div class="adm-stat">
          <p class="adm-val">${pts.toLocaleString()}</p>
          <p class="adm-lbl">Your Points</p>
        </div>
        <div class="adm-stat">
          <p class="adm-val">${msgs}</p>
          <p class="adm-lbl">Msgs Sent</p>
        </div>
        <div class="adm-stat">
          <p class="adm-val">${mins}</p>
          <p class="adm-lbl">Listen Mins</p>
        </div>
      </div>`;

    // ── Per-show / per-day breakdown ──────────────────────────
    const summary = window.getListenerSummary ? window.getListenerSummary() : {};
    const days    = Object.keys(summary).sort((a, b) => new Date(b) - new Date(a));

    if (days.length === 0) {
      html += `<p style="font-size:.72rem;opacity:.5;text-align:center;padding:10px 0;">
        No listener data yet — counts log automatically every ~2 min while the page is open.
      </p>`;
    } else {
      html += `<p style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;
                         color:var(--c-primary);margin-bottom:10px;">📊 Listeners Per Show / Day</p>`;

      days.forEach(day => {
        const shows = summary[day];
        const showNames = Object.keys(shows);

        // Day header
        const isToday = day === new Date().toDateString();
        html += `
          <div style="background:var(--c-surface-high);border-radius:10px;padding:12px;margin-bottom:10px;
                      border-left:3px solid ${isToday ? 'var(--c-primary)' : 'rgba(255,255,255,.1)'};">
            <p style="font-size:.7rem;font-weight:800;color:${isToday ? 'var(--c-primary)' : 'var(--c-on-surface-variant)'};
                      margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              ${isToday ? '● ' : ''}${day}${isToday ? ' <span style="font-weight:400;opacity:.6;">(today)</span>' : ''}
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:.72rem;">
              <thead>
                <tr style="color:var(--c-on-surface-variant);text-align:left;">
                  <th style="padding:3px 6px 6px 0;font-weight:700;font-size:.6rem;
                             text-transform:uppercase;letter-spacing:.06em;">Show</th>
                  <th style="padding:3px 6px 6px;font-weight:700;font-size:.6rem;
                             text-transform:uppercase;letter-spacing:.06em;text-align:right;">Peak</th>
                  <th style="padding:3px 6px 6px;font-weight:700;font-size:.6rem;
                             text-transform:uppercase;letter-spacing:.06em;text-align:right;">Avg</th>
                  <th style="padding:3px 6px 6px;font-weight:700;font-size:.6rem;
                             text-transform:uppercase;letter-spacing:.06em;text-align:right;">Samples</th>
                  <th style="padding:3px 0 6px 6px;font-weight:700;font-size:.6rem;
                             text-transform:uppercase;letter-spacing:.06em;text-align:right;">Time</th>
                </tr>
              </thead>
              <tbody>`;

        showNames.forEach((show, idx) => {
          const r    = shows[show];
          const even = idx % 2 === 0;
          html += `
                <tr style="background:${even ? 'rgba(255,255,255,.02)' : 'transparent'};border-radius:4px;">
                  <td style="padding:5px 6px 5px 0;font-weight:600;max-width:110px;
                             overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                      title="${show}">${show}</td>
                  <td style="padding:5px 6px;text-align:right;font-family:var(--font-display);
                             font-weight:800;color:var(--c-primary);">${Number(r.peak).toLocaleString()}</td>
                  <td style="padding:5px 6px;text-align:right;color:var(--c-on-surface-variant);">
                    ${Number(r.avg).toLocaleString()}</td>
                  <td style="padding:5px 6px;text-align:right;color:var(--c-on-surface-variant);
                             font-size:.62rem;">${r.samples}</td>
                  <td style="padding:5px 0 5px 6px;text-align:right;color:var(--c-on-surface-variant);
                             font-size:.6rem;white-space:nowrap;">${r.first || '—'}${r.last && r.last !== r.first ? '–' + r.last : ''}</td>
                </tr>`;
        });

        html += `
              </tbody>
            </table>
          </div>`;
      });
    }

    // ── Today's raw log preview (last 10 entries) ─────────────
    const todayLog = window.getTodayListenerLog ? window.getTodayListenerLog() : [];
    if (todayLog.length > 0) {
      const recent = todayLog.slice(-10).reverse();
      html += `
        <p style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;
                   color:var(--c-on-surface-variant);margin:14px 0 8px;">🕓 Recent Count Log (today)</p>
        <div style="background:var(--c-surface-high);border-radius:10px;padding:10px;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:.7rem;white-space:nowrap;">
            <thead>
              <tr style="color:var(--c-on-surface-variant);">
                <th style="padding:2px 8px 6px 0;text-align:left;font-weight:700;font-size:.58rem;
                           text-transform:uppercase;">Time</th>
                <th style="padding:2px 8px 6px;text-align:left;font-weight:700;font-size:.58rem;
                           text-transform:uppercase;">Show</th>
                <th style="padding:2px 0 6px 8px;text-align:right;font-weight:700;font-size:.58rem;
                           text-transform:uppercase;">Listeners</th>
              </tr>
            </thead>
            <tbody>
              ${recent.map((r, i) => `
                <tr style="background:${i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent'}">
                  <td style="padding:4px 8px 4px 0;color:var(--c-on-surface-variant);">${r.time}</td>
                  <td style="padding:4px 8px;max-width:130px;overflow:hidden;
                             text-overflow:ellipsis;">${r.show}</td>
                  <td style="padding:4px 0 4px 8px;text-align:right;font-family:var(--font-display);
                             font-weight:800;color:var(--c-primary);">${Number(r.count).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <button onclick="adminClearListenerLog()"
          style="margin-top:8px;font-size:.6rem;color:var(--c-error);background:none;border:none;
                 cursor:pointer;text-decoration:underline;padding:4px 0;">
          Clear all listener logs
        </button>`;
    }

    el.innerHTML = html;
  }

  // Clear listener history (admin use only)
  window.adminClearListenerLog = function () {
    if (!confirm('Clear all listener log data? This cannot be undone.')) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith('amaica_lstn_') || k === 'amaica_show_summary')
      .forEach(k => localStorage.removeItem(k));
    renderAdminStats();
    if (window.showToast) showToast('Listener logs cleared', 'check_circle');
  };

  // ── Feed editor ──────────────────────────────────────────────
  function renderAdminFeedEditor() {
    const el = document.getElementById('admin-feed-list');
    if (!el) return;
    const feed = loadData('feed', DEFAULT_FEED);
    el.innerHTML = feed.map(f => `
      <div class="adm-row" id="adm-feed-${f.id}">
        <div class="adm-row-info">
          <span class="adm-tag">${f.tag}</span>
          <strong>${f.title}</strong>
          <p style="font-size:.7rem;opacity:.6;margin-top:2px;">${f.body}</p>
        </div>
        <div class="adm-row-actions">
          <button class="adm-btn-edit" onclick="adminEditFeed(${f.id})">Edit</button>
          <button class="adm-btn-del"  onclick="adminDeleteFeed(${f.id})">✕</button>
        </div>
      </div>`).join('');
  }

  window.adminAddFeed = function () {
    const tag   = document.getElementById('adm-feed-tag').value.trim()   || 'News';
    const title = document.getElementById('adm-feed-title').value.trim();
    const body  = document.getElementById('adm-feed-body').value.trim();
    if (!title) { alert('Title is required'); return; }
    const feed  = loadData('feed', DEFAULT_FEED);
    const newId = Date.now();
    feed.unshift({ id: newId, tag, title, body, time: 'Just now' });
    saveData('feed', feed);
    document.getElementById('adm-feed-title').value = '';
    document.getElementById('adm-feed-body').value  = '';
    renderAdminFeedEditor();
    if (window.renderFeed) renderFeed();
    if (window.showToast) showToast('Feed item added ✓', 'check_circle');
  };

  window.adminDeleteFeed = function (id) {
    if (!confirm('Delete this feed item?')) return;
    const feed = loadData('feed', DEFAULT_FEED).filter(f => f.id !== id);
    saveData('feed', feed);
    renderAdminFeedEditor();
    if (window.renderFeed) renderFeed();
  };

  window.adminEditFeed = function (id) {
    const feed = loadData('feed', DEFAULT_FEED);
    const item = feed.find(f => f.id === id);
    if (!item) return;
    const newTitle = prompt('Edit title:', item.title);
    if (newTitle === null) return;
    const newBody  = prompt('Edit body:', item.body);
    if (newBody  === null) return;
    const newTag   = prompt('Edit tag (News/Live/Rewards/Event):', item.tag);
    item.title = newTitle.trim() || item.title;
    item.body  = newBody.trim()  || item.body;
    item.tag   = newTag?.trim()  || item.tag;
    saveData('feed', feed);
    renderAdminFeedEditor();
    if (window.renderFeed) renderFeed();
    if (window.showToast) showToast('Feed item updated ✓', 'edit');
  };

  // ── Rewards editor ────────────────────────────────────────────
  function renderAdminRewardsEditor() {
    const el = document.getElementById('admin-rewards-list');
    if (!el) return;
    const rewards = loadData('rewards', DEFAULT_REWARDS);
    el.innerHTML = rewards.map(r => `
      <div class="adm-row">
        <div class="adm-row-info">
          <span style="font-size:1.2rem;margin-right:6px;">${r.icon}</span>
          <strong>${r.name}</strong> — <span style="color:var(--c-primary);">${r.pts.toLocaleString()} pts</span>
          <p style="font-size:.68rem;opacity:.6;">${r.desc}</p>
        </div>
        <div class="adm-row-actions">
          <button class="adm-btn-edit" onclick="adminEditReward(${r.id})">Edit</button>
          <button class="adm-btn-del"  onclick="adminDeleteReward(${r.id})">✕</button>
        </div>
      </div>`).join('');
  }

  window.adminAddReward = function () {
    const icon = document.getElementById('adm-rwd-icon').value.trim() || '🎁';
    const name = document.getElementById('adm-rwd-name').value.trim();
    const desc = document.getElementById('adm-rwd-desc').value.trim();
    const pts  = parseInt(document.getElementById('adm-rwd-pts').value) || 0;
    if (!name || !pts) { alert('Name and points are required'); return; }
    const rewards = loadData('rewards', DEFAULT_REWARDS);
    rewards.push({ id: Date.now(), icon, name, desc, pts });
    saveData('rewards', rewards);
    ['adm-rwd-name','adm-rwd-desc','adm-rwd-pts'].forEach(id => { const e = document.getElementById(id); if(e) e.value = ''; });
    renderAdminRewardsEditor();
    if (window.renderRewardsList) renderRewardsList();
    if (window.showToast) showToast('Reward added ✓', 'check_circle');
  };

  window.adminDeleteReward = function (id) {
    if (!confirm('Delete this reward?')) return;
    saveData('rewards', loadData('rewards', DEFAULT_REWARDS).filter(r => r.id !== id));
    renderAdminRewardsEditor();
    if (window.renderRewardsList) renderRewardsList();
  };

  window.adminEditReward = function (id) {
    const rewards = loadData('rewards', DEFAULT_REWARDS);
    const item    = rewards.find(r => r.id === id);
    if (!item) return;
    const newName = prompt('Name:', item.name); if (newName === null) return;
    const newPts  = prompt('Points:', item.pts); if (newPts  === null) return;
    const newDesc = prompt('Description:', item.desc);
    item.name = newName.trim() || item.name;
    item.pts  = parseInt(newPts) || item.pts;
    item.desc = newDesc?.trim() || item.desc;
    saveData('rewards', rewards);
    renderAdminRewardsEditor();
    if (window.renderRewardsList) renderRewardsList();
    if (window.showToast) showToast('Reward updated ✓', 'edit');
  };

  // ── Marketplace editor ────────────────────────────────────────
  function renderAdminMarketEditor() {
    const el = document.getElementById('admin-market-list');
    if (!el) return;
    const market = loadData('market', DEFAULT_MARKET);
    el.innerHTML = market.map(m => `
      <div class="adm-row">
        <div class="adm-row-info">
          <span style="font-size:1.2rem;margin-right:6px;">${m.icon}</span>
          <strong>${m.name}</strong> — <span style="color:var(--c-primary);">${m.price.toLocaleString()} pts</span>
          <span class="adm-tag" style="margin-left:6px;">${m.tag}</span>
        </div>
        <div class="adm-row-actions">
          <button class="adm-btn-del" onclick="adminDeleteMarket(${m.id})">✕</button>
        </div>
      </div>`).join('');
  }

  window.adminAddMarket = function () {
    const icon  = document.getElementById('adm-mkt-icon').value.trim()  || '🎁';
    const name  = document.getElementById('adm-mkt-name').value.trim();
    const price = parseInt(document.getElementById('adm-mkt-price').value) || 0;
    const tag   = document.getElementById('adm-mkt-tag').value.trim()   || 'Physical';
    if (!name || !price) { alert('Name and price are required'); return; }
    const market = loadData('market', DEFAULT_MARKET);
    market.push({ id: Date.now(), icon, name, price, tag, desc: '' });
    saveData('market', market);
    ['adm-mkt-name','adm-mkt-price'].forEach(id => { const e = document.getElementById(id); if(e) e.value = ''; });
    renderAdminMarketEditor();
    if (window.renderMarketplace) renderMarketplace();
    if (window.showToast) showToast('Market item added ✓', 'check_circle');
  };

  window.adminDeleteMarket = function (id) {
    if (!confirm('Remove this item?')) return;
    saveData('market', loadData('market', DEFAULT_MARKET).filter(m => m.id !== id));
    renderAdminMarketEditor();
    if (window.renderMarketplace) renderMarketplace();
  };

  // ── Redemption code verifier ──────────────────────────────────
  window.verifyCode = async function () {
    const code      = document.getElementById('verify-input')?.value?.trim()?.toUpperCase();
    const resultDiv = document.getElementById('verify-result');
    if (!resultDiv || !code) return;
    if (!window._sb) { resultDiv.innerHTML = '<p style="color:orange;">Backend not connected</p>'; resultDiv.style.display='block'; return; }
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p style="text-align:center;opacity:.6;">⌛ Checking…</p>';
    const { data, error } = await window._sb.from('redemptions').select('*, profiles(username)').eq('code', code).single();
    if (error || !data) {
      resultDiv.innerHTML = `<div class="verify-card err"><p>❌ INVALID CODE</p><p>Not found in system.</p></div>`;
    } else if (data.status === 'claimed') {
      resultDiv.innerHTML = `<div class="verify-card warn"><p>⚠️ ALREADY CLAIMED</p><p>Collected ${new Date(data.updated_at).toLocaleDateString()}</p></div>`;
    } else {
      resultDiv.innerHTML = `<div class="verify-card ok"><p style="color:var(--c-primary);font-weight:800;font-size:1.1rem;">✅ VALID: ${data.item_name}</p><p>User: <strong>${data.profiles?.username || 'Guest'}</strong></p><button class="btn-primary" style="margin-top:14px;width:100%;justify-content:center;" onclick="confirmCollection('${data.id}')">MARK AS COLLECTED</button></div>`;
    }
  };

  window.confirmCollection = async function (id) {
    const { error } = await window._sb.from('redemptions').update({ status: 'claimed', updated_at: new Date() }).eq('id', id);
    if (!error) { alert('Item officially claimed! Hand over the merch.'); toggleAdmin(false); }
  };

  // ── Staff PIN (5× tap on version in Settings) ─────────────────
  window.addEventListener('load', () => {
    let clicks = 0;
    const versionEl = document.querySelector('#screen-settings .version-tap');
    if (versionEl) {
      versionEl.style.cursor = 'pointer';
      versionEl.addEventListener('click', () => {
        clicks++;
        if (clicks >= 5) {
          const pin = prompt('Enter Staff PIN:');
          if (pin === window.APP_CONFIG.ADMIN_PIN) {
            toggleAdmin(true);
          } else if (pin !== null) {
            if (window.showToast) showToast('Incorrect PIN', 'lock');
          }
          clicks = 0;
        }
      });
    }
  });
})();


// ═══════════════════════════════════════════════════════════════
//  ADMIN STATS REFRESH (loadAdminStats)
//  Runs when staff portal opens. Pulls peak from listener_history
//  and current count from show_stats. Sits before initAdminDashboard
//  in the toggleAdmin patch chain.
// ═══════════════════════════════════════════════════════════════
(function () {
  async function loadAdminStats() {
    if (!window._sb) return;

    // ── Peak from history ────────────────────────────────────
    const { data: peak } = await window._sb
      .from('listener_history')
      .select('listeners')
      .eq('show_id', 'amaica_main')
      .order('listeners', { ascending: false })
      .limit(1)
      .single();

    if (peak) {
      const el = document.getElementById('adm-peak-count');
      if (el) el.textContent = Number(peak.listeners).toLocaleString();
    }

    // ── Current live count ───────────────────────────────────
    const { data: current } = await window._sb
      .from('show_stats')
      .select('listeners')
      .eq('show_id', 'amaica_main')
      .single();

    if (current) {
      const el = document.getElementById('adm-live-count');
      if (el) el.textContent = Number(current.listeners).toLocaleString();
      const status = document.getElementById('adm-live-status');
      if (status) {
        status.textContent = current.listeners > 0 ? '🔴 LIVE' : '⚫ OFFLINE';
        status.style.color = current.listeners > 0
          ? 'var(--c-primary)' : 'var(--c-on-surface-variant)';
      }
    }
  }

  // Patch toggleAdmin — runs before initAdminDashboard's patch
  const _originalToggle = window.toggleAdmin;
  window.toggleAdmin = function (show) {
    if (show) loadAdminStats();
    if (typeof _originalToggle === 'function') _originalToggle(show);
  };
})();

// ═══════════════════════════════════════════════════════════════
//  ADMIN LIVE DASHBOARD
//  Rendered inside the existing admin panel (#admin-stats area).
//  Uses window._sb (set by supabase-client.js) — no ES imports.
//  Elements injected into #admin-dashboard-live (see index.html).
// ═══════════════════════════════════════════════════════════════
(function () {
  let _chart        = null;
  let _map          = null;
  let _markers      = [];
  let _realtimeSub  = null;
  let _animInterval = null;
  let _peak         = 0;
  const SHOW_ID     = 'amaica_main';

  // ── Exposed: called by toggleAdmin(true) in the IIFE above ───
  window.initAdminDashboard = async function () {
    const container = document.getElementById('admin-dashboard-live');
    if (!container) return;

    // Reset peak each time panel opens
    _peak = 0;

    const sb = window._sb;
    if (!sb) {
      container.innerHTML = '<p style="opacity:.5;font-size:.8rem;text-align:center;padding:20px 0;">Backend not connected — dashboard unavailable.</p>';
      return;
    }

    await _loadInitial(sb);
    _initChart(sb);
    _initMap();
    await _loadMapData(sb);
    _subscribeRealtime(sb);
  };

  // Called by toggleAdmin(false) to clean up subscriptions
  window.teardownAdminDashboard = function () {
    if (_realtimeSub) { try { _realtimeSub.unsubscribe(); } catch(e){} _realtimeSub = null; }
    clearInterval(_animInterval);
  };

  // ── INITIAL DATA ─────────────────────────────────────────────
  async function _loadInitial(sb) {
    try {
      const { data, error } = await sb
        .from('show_stats')
        .select('*')
        .eq('show_id', SHOW_ID)
        .single();

      if (error || !data) return;

      _setCount(data.listeners);
      _setStatus(data.listeners);
      _peak = data.listeners;
      _setPeak(_peak);
    } catch(e) { console.warn('[admin dashboard] loadInitial:', e); }
  }

  // ── CHART ────────────────────────────────────────────────────
  async function _initChart(sb) {
    const canvas = document.getElementById('adm-listener-chart');
    if (!canvas || !window.Chart) return;

    // Destroy previous instance to avoid "Canvas already in use" error
    if (_chart) { _chart.destroy(); _chart = null; }

    try {
      const { data } = await sb
        .from('listener_history')
        .select('recorded_at, listeners')
        .eq('show_id', SHOW_ID)
        .order('recorded_at', { ascending: true })
        .limit(30);

      const labels = (data || []).map(d => new Date(d.recorded_at).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }));
      const values = (data || []).map(d => d.listeners);

      _chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Listeners',
            data: values,
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#e84118',
            backgroundColor: 'rgba(232,65,24,0.08)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 5,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
          }
        }
      });
    } catch(e) { console.warn('[admin dashboard] chart init:', e); }
  }

  function _updateChart(count) {
    if (!_chart) return;
    const time = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
    _chart.data.labels.push(time);
    _chart.data.datasets[0].data.push(count);
    if (_chart.data.labels.length > 30) {
      _chart.data.labels.shift();
      _chart.data.datasets[0].data.shift();
    }
    _chart.update('none'); // no animation on realtime updates
  }

  // ── MAP ───────────────────────────────────────────────────────
  function _initMap() {
    const el = document.getElementById('adm-listener-map');
    if (!el || !window.L) return;

    // Destroy and recreate to avoid Leaflet "already initialized" error
    if (_map) { _map.remove(); _map = null; _markers = []; }

    _map = L.map('adm-listener-map', { zoomControl: true, attributionControl: false }).setView([5, 20], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(_map);
  }

  async function _loadMapData(sb) {
    if (!_map || !window.L) return;
    const coords = window.countryCoords || {};
    try {
      const { data } = await sb
        .from('listener_history')
        .select('country')
        .eq('show_id', SHOW_ID);

      const counts = {};
      (data || []).forEach(d => {
        const c = d.country || 'Unknown';
        counts[c] = (counts[c] || 0) + 1;
      });

      // Remove old markers
      _markers.forEach(m => _map.removeLayer(m));
      _markers = [];

      Object.entries(counts).forEach(([country, count]) => {
        const latlng = coords[country] || [0, 0];
        const marker = L.circleMarker(latlng, {
          radius: Math.min(5 + Math.sqrt(count) * 3, 30),
          fillColor: '#e84118',
          color: '#e84118',
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.5
        }).addTo(_map).bindPopup(`<strong>${country}</strong>: ${count} listener${count !== 1 ? 's' : ''}`);
        _markers.push(marker);
      });
    } catch(e) { console.warn('[admin dashboard] map data:', e); }
  }

  // ── REALTIME ─────────────────────────────────────────────────
  function _subscribeRealtime(sb) {
    // Unsubscribe previous if any
    if (_realtimeSub) { try { _realtimeSub.unsubscribe(); } catch(e){} }

    _realtimeSub = sb
      .channel('adm-realtime-show')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'show_stats',
        filter: `show_id=eq.${SHOW_ID}`
      }, (payload) => {
        const count = payload.new?.listeners ?? 0;
        _animateCount(count);
        _setStatus(count);
        _updateChart(count);
        if (count > _peak) { _peak = count; _setPeak(_peak); }
        // Throttled map refresh — only every 5th update
        _mapRefreshCounter = ((_mapRefreshCounter || 0) + 1) % 5;
        if (_mapRefreshCounter === 0) _loadMapData(sb);
      })
      .subscribe();
  }

  let _mapRefreshCounter = 0;

  // ── UI HELPERS ────────────────────────────────────────────────
  // Animate counter without leaking intervals
  function _animateCount(target) {
    clearInterval(_animInterval);
    const el = document.getElementById('adm-live-count');
    if (!el) return;
    let current = parseInt(el.textContent.replace(/,/g, '')) || 0;
    if (current === target) return;
    _animInterval = setInterval(() => {
      if (current === target) { clearInterval(_animInterval); return; }
      // Step size scales with distance to avoid sluggish large jumps
      const step = Math.max(1, Math.floor(Math.abs(target - current) / 10));
      current += current < target ? step : -step;
      if ((current < target && current + step > target) || (current > target && current - step < target)) {
        current = target;
      }
      el.textContent = current.toLocaleString();
    }, 30);
  }

  function _setCount(count) {
    const el = document.getElementById('adm-live-count');
    if (el) el.textContent = Number(count).toLocaleString();
  }
  function _setPeak(count) {
    const el = document.getElementById('adm-peak-count');
    if (el) el.textContent = Number(count).toLocaleString();
  }
  function _setStatus(count) {
    const el = document.getElementById('adm-live-status');
    if (!el) return;
    el.textContent    = count > 0 ? '🔴 LIVE' : '⚫ OFFLINE';
    el.style.color    = count > 0 ? 'var(--c-primary)' : 'var(--c-on-surface-variant)';
  }

  // Patch toggleAdmin to init/teardown dashboard automatically
  const _origToggle = window.toggleAdmin;
  window.toggleAdmin = function (show) {
    if (_origToggle) _origToggle(show);
    if (show)  window.initAdminDashboard();
    else       window.teardownAdminDashboard();
  };
})();