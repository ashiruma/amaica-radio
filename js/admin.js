// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — ADMIN MODULE v9
//  - Supabase-backed staff login (superuser / staff roles)
//  - Schedule CRUD (Supabase, live across devices)
//  - Feed / Rewards / Marketplace CRUD (localStorage)
//  - Role-based panel: staff sees redemption + content only
//  - Superuser sees analytics, staff management, everything
// ═══════════════════════════════════════════════════════════════

(function () {

  // ── State ─────────────────────────────────────────────────────
  let _staffUser = null; // { id, username, role }

  // ── Default data ──────────────────────────────────────────────
  const DEFAULT_FEED = [
    { id: 1, tag: 'News', title: 'Amaica Festival 2024 Lineup Announced', body: 'Top artists confirmed for the biggest night in Kakamega.', time: '2h ago' },
    { id: 2, tag: 'Live', title: 'The Midnight Pulse is Live Now', body: 'DJ Echo is mixing the freshest tracks on 98.7 FM.', time: 'Now' },
    { id: 3, tag: 'Rewards', title: '+50 Bonus Points This Weekend', body: 'Tune in Saturday for a listener-appreciation points boost.', time: '1d ago' },
  ];
  const DEFAULT_REWARDS = [
    { id: 1, icon: '🎟️', name: 'VIP Event Ticket', desc: 'Any Amaica-hosted event', pts: 500 },
    { id: 2, icon: '🎧', name: 'Wireless Headphones', desc: 'Echo-Series, free shipping', pts: 2500 },
    { id: 3, icon: '☕', name: 'Local Coffee Voucher', desc: 'Partner café — any drink', pts: 100 },
    { id: 4, icon: '👕', name: 'Amaica T-Shirt', desc: 'Forest green · unisex', pts: 1000 },
  ];
  const DEFAULT_MARKET = [
    { id: 1, icon: '👕', name: 'Amaica T-Shirt', price: 1000, tag: 'Physical', desc: 'Forest Green Leaf' },
    { id: 2, icon: '🧢', name: 'Official Cap', price: 1300, tag: 'Physical', desc: 'Embroidered Pulse' },
    { id: 3, icon: '🧥', name: 'The Pulse Hoodie', price: 6000, tag: 'Physical', desc: 'Heavyweight Cotton' },
    { id: 4, icon: '📱', name: '100 KES Airtime', price: 200, tag: 'Digital', desc: 'Instant Top-up' },
  ];

  // ── Persistence helpers ───────────────────────────────────────
  function loadData(key, def) {
    try { return JSON.parse(localStorage.getItem('amaica_' + key)) || def; } catch { return def; }
  }
  function saveData(key, data) {
    try { localStorage.setItem('amaica_' + key, JSON.stringify(data)); } catch (e) { }
  }

  window.getAdminFeed = () => loadData('feed', DEFAULT_FEED);
  window.getAdminRewards = () => loadData('rewards', DEFAULT_REWARDS);
  window.getAdminMarket = () => loadData('market', DEFAULT_MARKET);

  // ── ADMIN TOGGLE ─────────────────────────────────────────────
  window.toggleAdmin = (show) => {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    if (show) {
      panel.style.display = 'block';
      _showLoginOrPanel();
    } else {
      panel.style.display = 'none';
      window.teardownAdminDashboard?.();
    }
  };

  // ── LOGIN FLOW ────────────────────────────────────────────────
  function _showLoginOrPanel() {
    if (_staffUser) {
      _renderPanel();
    } else {
      _renderLogin();
    }
  }

  function _renderLogin() {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div style="max-width:400px;margin:60px auto;padding:28px 24px;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="font-size:.62rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
                    color:var(--c-on-surface-variant);margin-bottom:8px;">Staff Portal</p>
          <h2 style="font-family:var(--font-display);font-size:1.8rem;font-weight:800;">Sign In</h2>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
                          color:var(--c-on-surface-variant);display:block;margin-bottom:5px;">Username</label>
            <input id="staff-username" type="text" placeholder="Enter username"
              style="width:100%;background:var(--c-surface-high);border:1px solid var(--c-outline);
                     border-radius:10px;padding:12px;color:var(--c-on-surface);font-size:.9rem;outline:none;"/>
          </div>
          <div>
            <label style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
                          color:var(--c-on-surface-variant);display:block;margin-bottom:5px;">PIN</label>
            <input id="staff-pin" type="password" placeholder="Enter PIN" maxlength="10"
              style="width:100%;background:var(--c-surface-high);border:1px solid var(--c-outline);
                     border-radius:10px;padding:12px;color:var(--c-on-surface);font-size:.9rem;outline:none;"
              onkeydown="if(event.key==='Enter')staffLogin()"/>
          </div>
          <p id="staff-login-err" style="color:var(--c-error);font-size:.72rem;display:none;"></p>
          <button onclick="staffLogin()"
            style="padding:14px;border-radius:12px;background:var(--c-primary);color:#fff;
                   font-family:var(--font-display);font-weight:800;font-size:.9rem;border:none;
                   box-shadow:0 8px 24px var(--c-accent-glow);cursor:pointer;margin-top:4px;">
            Sign In
          </button>
          <button onclick="toggleAdmin(false)"
            style="padding:10px;border-radius:12px;background:transparent;color:var(--c-on-surface-variant);
                   font-size:.78rem;border:1px solid var(--c-outline);cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>`;
  }

  window.staffLogin = async function () {
    const username = document.getElementById('staff-username')?.value?.trim();
    const pin = document.getElementById('staff-pin')?.value?.trim();
    const errEl = document.getElementById('staff-login-err');
    if (!username || !pin) { if (errEl) { errEl.textContent = 'Username and PIN required.'; errEl.style.display = 'block'; } return; }
    if (!window._sb) { if (errEl) { errEl.textContent = 'Backend not connected.'; errEl.style.display = 'block'; } return; }

    const { data, error } = await window._sb
      .from('staff')
      .select('id, username, role')
      .eq('username', username)
      .eq('pin', pin)
      .single();

    if (error || !data) {
      if (errEl) { errEl.textContent = 'Invalid username or PIN.'; errEl.style.display = 'block'; }
      return;
    }

    _staffUser = data;
    _renderPanel();
  };

  window.staffLogout = function () {
    _staffUser = null;
    window.teardownAdminDashboard?.();
    _renderLogin();
  };

  // ── MAIN PANEL ────────────────────────────────────────────────
  function _renderPanel() {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    const isSuperuser = _staffUser?.role === 'superuser';

    panel.innerHTML = `
      <div style="max-width:600px;margin:0 auto;padding:28px 20px 80px;">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
          <div>
            <span class="section-label" style="margin-bottom:0;">Staff Portal</span>
            <p style="font-size:.62rem;color:var(--c-on-surface-variant);margin-top:3px;">
              ${_staffUser?.username} · <span style="color:var(--c-primary);font-weight:700;text-transform:uppercase;">
              ${_staffUser?.role}</span>
            </p>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="staffLogout()" class="btn-ghost" style="font-size:.62rem;color:var(--c-on-surface-variant);">Sign Out</button>
            <button class="btn-ghost" onclick="toggleAdmin(false)" style="opacity:0.6;">✕ Close</button>
          </div>
        </div>

        ${isSuperuser ? `
        <!-- LIVE DASHBOARD (superuser only) -->
        <div id="admin-stats" style="margin-bottom:0;"></div>
        <div id="admin-dashboard-live">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
            <div style="background:rgba(232,65,24,0.08);border:1px solid rgba(232,65,24,0.3);border-radius:12px;padding:16px;text-align:center;">
              <p id="adm-live-status" style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-on-surface-variant);margin-bottom:6px;">⚫ OFFLINE</p>
              <p id="adm-live-count" style="font-family:var(--font-display);font-size:2rem;font-weight:800;color:var(--c-primary);line-height:1;">—</p>
              <p style="font-size:.58rem;color:var(--c-on-surface-variant);margin-top:4px;text-transform:uppercase;letter-spacing:.08em;">Live Listeners</p>
            </div>
            <div style="background:var(--c-surface-high);border-radius:12px;padding:16px;text-align:center;">
              <p style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-on-surface-variant);margin-bottom:6px;">Session Peak</p>
              <p id="adm-peak-count" style="font-family:var(--font-display);font-size:2rem;font-weight:800;color:var(--c-on-surface);line-height:1;">—</p>
              <p style="font-size:.58rem;color:var(--c-on-surface-variant);margin-top:4px;text-transform:uppercase;letter-spacing:.08em;">Peak Count</p>
            </div>
          </div>
          <div style="background:var(--c-surface-high);border-radius:12px;padding:14px;margin-bottom:16px;">
            <p style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-on-surface-variant);margin-bottom:10px;">Listener Trend (last 30 pts)</p>
            <div style="height:130px;position:relative;"><canvas id="adm-listener-chart"></canvas></div>
          </div>
        </div>

        <!-- STAFF MANAGEMENT (superuser only) -->
        <div class="auth-card" style="margin-bottom:20px;">
          <p style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">👥 Staff Management</p>
          <div id="staff-list" style="margin-bottom:12px;"></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:8px;">
              <input id="new-staff-username" type="text" placeholder="Username"
                style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <input id="new-staff-pin" type="password" placeholder="PIN"
                style="width:80px;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <select id="new-staff-role"
                style="background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);">
                <option value="staff">Staff</option>
                <option value="superuser">Superuser</option>
              </select>
            </div>
            <button class="btn-primary" onclick="adminAddStaff()" style="justify-content:center;">+ Add Staff</button>
          </div>
        </div>

        <!-- SCHEDULE EDITOR (superuser only) -->
        <div class="auth-card" style="margin-bottom:20px;">
          <p style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">📅 Schedule Manager</p>
          <div id="admin-schedule-list" style="margin-bottom:12px;"></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:8px;">
              <input id="adm-sch-name" type="text" placeholder="Show name"
                style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <input id="adm-sch-host" type="text" placeholder="Host(s)"
                style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
            </div>
            <div style="display:flex;gap:8px;">
              <input id="adm-sch-start" type="number" placeholder="Start (mins, e.g. 360=6AM)"
                style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <input id="adm-sch-end" type="number" placeholder="End (mins)"
                style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
            </div>
            <div>
              <p style="font-size:.62rem;color:var(--c-on-surface-variant);margin-bottom:6px;">Days (0=Sun, 1=Mon … 6=Sat)</p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;" id="adm-sch-days">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `
                  <label style="display:flex;align-items:center;gap:3px;font-size:.72rem;cursor:pointer;">
                    <input type="checkbox" value="${i}" style="accent-color:var(--c-primary);"> ${d}
                  </label>`).join('')}
              </div>
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;cursor:pointer;">
              <input type="checkbox" id="adm-sch-news" style="accent-color:var(--c-primary);"> News bulletin
            </label>
            <button class="btn-primary" onclick="adminAddShow()" style="justify-content:center;">+ Add Show</button>
          </div>
        </div>
        ` : ''}

        <!-- REDEMPTION VERIFIER (all staff) -->
        <div class="auth-card" style="margin-bottom:20px;">
          <p style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">🎫 Verify Redemption</p>
          <input type="text" id="verify-input" placeholder="e.g. AM-X492"
            style="width:100%;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:10px;
                   padding:14px;color:var(--c-on-surface);font-family:monospace;font-size:1.1rem;
                   letter-spacing:.08em;outline:none;text-transform:uppercase;margin-bottom:10px;"/>
          <button onclick="checkCode()" class="btn-primary" style="width:100%;justify-content:center;">VERIFY CLAIM</button>
          <div id="verify-result-display" style="margin-top:14px;"></div>
          <div id="verify-result" style="display:none;"></div>
        </div>

        <!-- FEED MANAGER (all staff) -->
        <div class="auth-card" style="margin-bottom:20px;">
          <p style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">📰 Feed Manager</p>
          <div id="admin-feed-list" style="margin-bottom:12px;"></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <select id="adm-feed-tag" style="background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);">
              <option>News</option><option>Live</option><option>Rewards</option><option>Event</option>
            </select>
            <input id="adm-feed-title" type="text" placeholder="Headline…"
              style="background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
            <textarea id="adm-feed-body" placeholder="Body text…" rows="2"
              style="background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;resize:none;"></textarea>
            <button class="btn-primary" onclick="adminAddFeed()" style="justify-content:center;">+ Add Feed Item</button>
          </div>
        </div>

        <!-- REWARDS MANAGER (all staff) -->
        <div class="auth-card" style="margin-bottom:20px;">
          <p style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">🎁 Rewards Manager</p>
          <div id="admin-rewards-list" style="margin-bottom:12px;"></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:8px;">
              <input id="adm-rwd-icon" type="text" placeholder="Icon 🎟️" style="width:70px;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <input id="adm-rwd-name" type="text" placeholder="Reward name…" style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <input id="adm-rwd-pts"  type="number" placeholder="pts" style="width:80px;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
            </div>
            <input id="adm-rwd-desc" type="text" placeholder="Description…"
              style="background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
            <button class="btn-primary" onclick="adminAddReward()" style="justify-content:center;">+ Add Reward</button>
          </div>
        </div>

        <!-- MARKETPLACE MANAGER (all staff) -->
        <div class="auth-card" style="margin-bottom:20px;">
          <p style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">🛒 Marketplace Manager</p>
          <div id="admin-market-list" style="margin-bottom:12px;"></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:8px;">
              <input id="adm-mkt-icon"  type="text"   placeholder="Icon" style="width:60px;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <input id="adm-mkt-name"  type="text"   placeholder="Item name…" style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
              <input id="adm-mkt-price" type="number" placeholder="pts" style="width:80px;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
            </div>
            <select id="adm-mkt-tag" style="background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);">
              <option>Physical</option><option>Digital</option><option>Exclusive</option>
            </select>
            <button class="btn-primary" onclick="adminAddMarket()" style="justify-content:center;">+ Add Market Item</button>
          </div>
        </div>

        ${isSuperuser ? `
        <!-- CHANGE MY PIN (superuser) -->
        <div class="auth-card" style="margin-bottom:20px;">
          <p style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">🔑 Change My PIN</p>
          <div style="display:flex;gap:8px;">
            <input id="new-pin-input" type="password" placeholder="New PIN"
              style="flex:1;background:var(--c-surface-high);border:1px solid var(--c-outline);border-radius:6px;padding:8px;color:var(--c-on-surface);font-size:.84rem;outline:none;"/>
            <button class="btn-primary" onclick="adminChangePin()" style="padding:8px 14px;">Save</button>
          </div>
        </div>
        ` : ''}

      </div>`;

    // Render all sections
    renderAdminFeedEditor();
    renderAdminRewardsEditor();
    renderAdminMarketEditor();
    if (isSuperuser) {
      renderAdminStats();
      renderStaffList();
      renderScheduleList();
      window.initAdminDashboard?.();
    }
  }

  // ── STATS ─────────────────────────────────────────────────────
  function renderAdminStats() {
    const el = document.getElementById('admin-stats');
    if (!el) return;
    const pts = window._profile?.points ?? window._localPoints ?? 0;
    const msgs = window._profile?.messages_sent ?? window._localChatMsgs ?? 0;
    const mins = window._listenMins ?? 0;
    const live = window._liveListeners;
    const liveStr = live != null ? Number(live).toLocaleString() : '—';

    let html = `
      <div class="adm-stat-grid" style="margin-bottom:16px;">
        <div class="adm-stat adm-stat-fire"><p class="adm-val">${liveStr}</p><p class="adm-lbl">🔴 Live Now</p></div>
        <div class="adm-stat"><p class="adm-val">${pts.toLocaleString()}</p><p class="adm-lbl">Your Points</p></div>
        <div class="adm-stat"><p class="adm-val">${msgs}</p><p class="adm-lbl">Msgs Sent</p></div>
        <div class="adm-stat"><p class="adm-val">${mins}</p><p class="adm-lbl">Listen Mins</p></div>
      </div>`;

    const summary = window.getListenerSummary?.() || {};
    const days = Object.keys(summary).sort((a, b) => new Date(b) - new Date(a));
    if (days.length === 0) {
      html += `<p style="font-size:.72rem;opacity:.5;text-align:center;padding:10px 0;">No listener data yet — counts log automatically every ~2 min while the page is open.</p>`;
    } else {
      html += `<p style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--c-primary);margin-bottom:10px;">📊 Listeners Per Show / Day</p>`;
      days.forEach(day => {
        const shows = summary[day];
        const isToday = day === new Date().toDateString();
        html += `<div style="background:var(--c-surface-high);border-radius:10px;padding:12px;margin-bottom:10px;border-left:3px solid ${isToday ? 'var(--c-primary)' : 'rgba(255,255,255,.1)'};">
          <p style="font-size:.7rem;font-weight:800;color:${isToday ? 'var(--c-primary)' : 'var(--c-on-surface-variant)'};margin-bottom:8px;">${isToday ? '● ' : ''}${day}${isToday ? ' <span style="font-weight:400;opacity:.6;">(today)</span>' : ''}</p>
          <table style="width:100%;border-collapse:collapse;font-size:.72rem;">
            <thead><tr style="color:var(--c-on-surface-variant);text-align:left;">
              <th style="padding:3px 6px 6px 0;font-weight:700;font-size:.6rem;text-transform:uppercase;">Show</th>
              <th style="padding:3px 6px 6px;font-weight:700;font-size:.6rem;text-transform:uppercase;text-align:right;">Peak</th>
              <th style="padding:3px 6px 6px;font-weight:700;font-size:.6rem;text-transform:uppercase;text-align:right;">Avg</th>
              <th style="padding:3px 6px 6px;font-weight:700;font-size:.6rem;text-transform:uppercase;text-align:right;">Samples</th>
            </tr></thead><tbody>`;
        Object.entries(shows).forEach(([show, r], idx) => {
          html += `<tr style="background:${idx % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent'}">
            <td style="padding:5px 6px 5px 0;font-weight:600;">${show}</td>
            <td style="padding:5px 6px;text-align:right;font-family:var(--font-display);font-weight:800;color:var(--c-primary);">${Number(r.peak).toLocaleString()}</td>
            <td style="padding:5px 6px;text-align:right;color:var(--c-on-surface-variant);">${Number(r.avg).toLocaleString()}</td>
            <td style="padding:5px 6px;text-align:right;color:var(--c-on-surface-variant);font-size:.62rem;">${r.samples}</td>
          </tr>`;
        });
        html += `</tbody></table></div>`;
      });
    }
    el.innerHTML = html;
  }

  // ── STAFF MANAGEMENT ──────────────────────────────────────────
  async function renderStaffList() {
    const el = document.getElementById('staff-list');
    if (!el || !window._sb) return;
    const { data } = await window._sb.from('staff').select('id, username, role').order('created_at');
    if (!data) return;
    el.innerHTML = data.map(s => `
      <div class="adm-row">
        <div class="adm-row-info">
          <strong>${s.username}</strong>
          <span class="adm-tag" style="margin-left:6px;${s.role === 'superuser' ? 'background:rgba(232,65,24,.15);color:var(--c-primary);' : ''}">${s.role}</span>
        </div>
        <div class="adm-row-actions">
          <button class="adm-btn-edit" onclick="adminResetPin('${s.id}','${s.username}')">Reset PIN</button>
          ${s.id !== _staffUser?.id ? `<button class="adm-btn-del" onclick="adminDeleteStaff('${s.id}')">✕</button>` : ''}
        </div>
      </div>`).join('');
  }

  window.adminAddStaff = async function () {
    const username = document.getElementById('new-staff-username')?.value?.trim();
    const pin = document.getElementById('new-staff-pin')?.value?.trim();
    const role = document.getElementById('new-staff-role')?.value || 'staff';
    if (!username || !pin) { alert('Username and PIN required'); return; }
    if (!window._sb) return;
    const { error } = await window._sb.from('staff').insert({ username, pin, role });
    if (error) { alert('Error: ' + (error.message || 'Could not add staff')); return; }
    document.getElementById('new-staff-username').value = '';
    document.getElementById('new-staff-pin').value = '';
    renderStaffList();
    if (window.showToast) showToast('Staff member added ✓', 'check_circle');
  };

  window.adminDeleteStaff = async function (id) {
    if (!confirm('Remove this staff member?')) return;
    await window._sb.from('staff').delete().eq('id', id);
    renderStaffList();
    if (window.showToast) showToast('Staff removed', 'check_circle');
  };

  window.adminResetPin = async function (id, username) {
    const newPin = prompt(`New PIN for ${username}:`);
    if (!newPin) return;
    await window._sb.from('staff').update({ pin: newPin }).eq('id', id);
    if (window.showToast) showToast('PIN updated ✓', 'lock');
  };

  window.adminChangePin = async function () {
    const newPin = document.getElementById('new-pin-input')?.value?.trim();
    if (!newPin) { alert('Enter a new PIN'); return; }
    await window._sb.from('staff').update({ pin: newPin }).eq('id', _staffUser.id);
    document.getElementById('new-pin-input').value = '';
    if (window.showToast) showToast('PIN changed ✓', 'lock');
  };

  // ── SCHEDULE EDITOR ───────────────────────────────────────────
  async function renderScheduleList() {
    const el = document.getElementById('admin-schedule-list');
    if (!el || !window._sb) return;
    const { data } = await window._sb.from('schedule').select('*').order('start_min');
    if (!data) return;
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fmtTime = m => { const h = Math.floor(m / 60) % 24, mn = m % 60, ap = h < 12 ? 'AM' : 'PM', hh = h % 12 || 12; return mn === 0 ? `${hh}${ap}` : `${hh}:${String(mn).padStart(2, '0')}${ap}`; };
    el.innerHTML = data.map(s => `
      <div class="adm-row">
        <div class="adm-row-info">
          <strong>${s.name}</strong>${s.is_news ? ' <span style="font-size:.6rem;color:var(--c-on-surface-variant);">📰</span>' : ''}
          <p style="font-size:.68rem;color:var(--c-on-surface-variant);">${s.host} · ${fmtTime(s.start_min)}–${fmtTime(s.end_min)} · ${s.days.map(d => DAY_NAMES[d]).join(', ')}</p>
        </div>
        <div class="adm-row-actions">
          <button class="adm-btn-del" onclick="adminDeleteShow('${s.id}')">✕</button>
        </div>
      </div>`).join('') || '<p style="font-size:.72rem;opacity:.5;">No shows yet — add one below.</p>';
  }

  window.adminAddShow = async function () {
    const name = document.getElementById('adm-sch-name')?.value?.trim();
    const host = document.getElementById('adm-sch-host')?.value?.trim();
    const start = parseInt(document.getElementById('adm-sch-start')?.value);
    const end = parseInt(document.getElementById('adm-sch-end')?.value);
    const days = [...document.querySelectorAll('#adm-sch-days input:checked')].map(c => parseInt(c.value));
    const isNews = document.getElementById('adm-sch-news')?.checked || false;
    if (!name || !host || isNaN(start) || isNaN(end) || days.length === 0) {
      alert('All fields required and at least one day must be selected'); return;
    }
    if (!window._sb) return;
    const { error } = await window._sb.from('schedule').insert({ name, host, start_min: start, end_min: end, days, is_news: isNews });
    if (error) { alert('Error: ' + error.message); return; }
    document.getElementById('adm-sch-name').value = '';
    document.getElementById('adm-sch-host').value = '';
    document.getElementById('adm-sch-start').value = '';
    document.getElementById('adm-sch-end').value = '';
    document.querySelectorAll('#adm-sch-days input').forEach(c => c.checked = false);
    document.getElementById('adm-sch-news').checked = false;
    renderScheduleList();
    // Reload schedule in app
    if (window.loadScheduleFromSupabase) loadScheduleFromSupabase();
    if (window.showToast) showToast('Show added ✓', 'check_circle');
  };

  window.adminDeleteShow = async function (id) {
    if (!confirm('Delete this show?')) return;
    await window._sb.from('schedule').delete().eq('id', id);
    renderScheduleList();
    if (window.loadScheduleFromSupabase) loadScheduleFromSupabase();
    if (window.showToast) showToast('Show removed', 'check_circle');
  };

  // ── FEED EDITOR ───────────────────────────────────────────────
  function renderAdminFeedEditor() {
    const el = document.getElementById('admin-feed-list');
    if (!el) return;
    el.innerHTML = loadData('feed', DEFAULT_FEED).map(f => `
      <div class="adm-row">
        <div class="adm-row-info">
          <span class="adm-tag">${f.tag}</span> <strong>${f.title}</strong>
          <p style="font-size:.7rem;opacity:.6;margin-top:2px;">${f.body}</p>
        </div>
        <div class="adm-row-actions">
          <button class="adm-btn-edit" onclick="adminEditFeed(${f.id})">Edit</button>
          <button class="adm-btn-del"  onclick="adminDeleteFeed(${f.id})">✕</button>
        </div>
      </div>`).join('');
  }

  window.adminAddFeed = function () {
    const tag = document.getElementById('adm-feed-tag')?.value?.trim() || 'News';
    const title = document.getElementById('adm-feed-title')?.value?.trim();
    const body = document.getElementById('adm-feed-body')?.value?.trim();
    if (!title) { alert('Title required'); return; }
    const feed = loadData('feed', DEFAULT_FEED);
    feed.unshift({ id: Date.now(), tag, title, body, time: 'Just now' });
    saveData('feed', feed);
    document.getElementById('adm-feed-title').value = '';
    document.getElementById('adm-feed-body').value = '';
    renderAdminFeedEditor();
    if (window.renderFeed) renderFeed();
    if (window.showToast) showToast('Feed item added ✓', 'check_circle');
  };

  window.adminDeleteFeed = function (id) {
    if (!confirm('Delete this feed item?')) return;
    saveData('feed', loadData('feed', DEFAULT_FEED).filter(f => f.id !== id));
    renderAdminFeedEditor();
    if (window.renderFeed) renderFeed();
  };

  window.adminEditFeed = function (id) {
    const feed = loadData('feed', DEFAULT_FEED);
    const item = feed.find(f => f.id === id);
    if (!item) return;
    const newTitle = prompt('Edit title:', item.title); if (newTitle === null) return;
    const newBody = prompt('Edit body:', item.body); if (newBody === null) return;
    const newTag = prompt('Edit tag (News/Live/Rewards/Event):', item.tag);
    item.title = newTitle.trim() || item.title;
    item.body = newBody.trim() || item.body;
    item.tag = newTag?.trim() || item.tag;
    saveData('feed', feed);
    renderAdminFeedEditor();
    if (window.renderFeed) renderFeed();
    if (window.showToast) showToast('Updated ✓', 'edit');
  };

  // ── REWARDS EDITOR ────────────────────────────────────────────
  function renderAdminRewardsEditor() {
    const el = document.getElementById('admin-rewards-list');
    if (!el) return;
    el.innerHTML = loadData('rewards', DEFAULT_REWARDS).map(r => `
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
    const icon = document.getElementById('adm-rwd-icon')?.value?.trim() || '🎁';
    const name = document.getElementById('adm-rwd-name')?.value?.trim();
    const desc = document.getElementById('adm-rwd-desc')?.value?.trim();
    const pts = parseInt(document.getElementById('adm-rwd-pts')?.value) || 0;
    if (!name || !pts) { alert('Name and points required'); return; }
    const rewards = loadData('rewards', DEFAULT_REWARDS);
    rewards.push({ id: Date.now(), icon, name, desc, pts });
    saveData('rewards', rewards);
    ['adm-rwd-name', 'adm-rwd-desc', 'adm-rwd-pts'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
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
    const item = rewards.find(r => r.id === id);
    if (!item) return;
    const newName = prompt('Name:', item.name); if (newName === null) return;
    const newPts = prompt('Points:', item.pts); if (newPts === null) return;
    const newDesc = prompt('Description:', item.desc);
    item.name = newName.trim() || item.name;
    item.pts = parseInt(newPts) || item.pts;
    item.desc = newDesc?.trim() || item.desc;
    saveData('rewards', rewards);
    renderAdminRewardsEditor();
    if (window.renderRewardsList) renderRewardsList();
    if (window.showToast) showToast('Updated ✓', 'edit');
  };

  // ── MARKETPLACE EDITOR ────────────────────────────────────────
  function renderAdminMarketEditor() {
    const el = document.getElementById('admin-market-list');
    if (!el) return;
    el.innerHTML = loadData('market', DEFAULT_MARKET).map(m => `
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
    const icon = document.getElementById('adm-mkt-icon')?.value?.trim() || '🎁';
    const name = document.getElementById('adm-mkt-name')?.value?.trim();
    const price = parseInt(document.getElementById('adm-mkt-price')?.value) || 0;
    const tag = document.getElementById('adm-mkt-tag')?.value?.trim() || 'Physical';
    if (!name || !price) { alert('Name and price required'); return; }
    const market = loadData('market', DEFAULT_MARKET);
    market.push({ id: Date.now(), icon, name, price, tag, desc: '' });
    saveData('market', market);
    ['adm-mkt-name', 'adm-mkt-price'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    renderAdminMarketEditor();
    if (window.renderMarketplace) renderMarketplace();
    if (window.showToast) showToast('Item added ✓', 'check_circle');
  };

  window.adminDeleteMarket = function (id) {
    if (!confirm('Remove this item?')) return;
    saveData('market', loadData('market', DEFAULT_MARKET).filter(m => m.id !== id));
    renderAdminMarketEditor();
    if (window.renderMarketplace) renderMarketplace();
  };

  // ── REDEMPTION VERIFIER ───────────────────────────────────────
  window.checkCode = async function () {
    const code = (document.getElementById('verify-input')?.value || '').trim().toUpperCase();
    const display = document.getElementById('verify-result-display');
    if (!display || !code) return;
    display.innerHTML = `<p style="text-align:center;opacity:0.5;padding:20px 0;">Searching…</p>`;
    if (!window._sb) { display.innerHTML = `<p style="color:var(--c-error);text-align:center;">Backend not connected</p>`; return; }
    const { data, error } = await window._sb.from('redemptions').select('*').eq('code', code).single();
    if (error || !data) {
      display.innerHTML = `<div style="text-align:center;padding:20px 0;"><p style="font-size:1.8rem;">⚠️</p><p style="opacity:0.5;">Code not found.</p></div>`; return;
    }
    const isClaimed = data.status === 'claimed';
    display.innerHTML = `
      <div style="text-align:center;">
        <p style="font-weight:800;font-size:.9rem;color:${isClaimed ? 'var(--c-error)' : 'var(--c-primary)'};">${isClaimed ? 'Already Collected' : 'Verification Success'}</p>
        <h3 style="font-family:var(--font-display);font-size:1.3rem;font-weight:800;margin:8px 0 4px;">${data.item_name}</h3>
        <p style="opacity:0.6;font-size:.85rem;">Code: <strong>${data.code}</strong> · Type: <strong>${data.item_type || '—'}</strong></p>
        ${!isClaimed ? `<button onclick="confirmCollection('${data.id}')" class="btn-primary" style="margin-top:16px;width:100%;justify-content:center;">MARK AS HANDED OVER</button>`
        : `<p style="margin-top:12px;font-size:.72rem;opacity:.35;">Collected ${new Date(data.updated_at).toLocaleDateString()}</p>`}
      </div>`;
  };

  window.confirmCollection = async function (id) {
    const { error } = await window._sb.from('redemptions').update({ status: 'claimed', updated_at: new Date() }).eq('id', id);
    if (!error) { if (window.showToast) showToast('Item marked as collected ✓', 'check_circle'); window.checkCode(); }
  };

  // ── VERSION TAP → STAFF LOGIN ─────────────────────────────────
  window.addEventListener('load', () => {
    let clicks = 0, timer = null;
    const versionEl = document.querySelector('#screen-settings .version-tap');
    if (versionEl) {
      versionEl.style.cursor = 'pointer';
      versionEl.addEventListener('click', () => {
        clicks++;
        clearTimeout(timer);
        timer = setTimeout(() => { clicks = 0; }, 3000);
        if (clicks >= 5) { clicks = 0; toggleAdmin(true); }
      });
    }
  });

})();

// ═══════════════════════════════════════════════════════════════
//  ADMIN LIVE DASHBOARD (superuser only)
// ═══════════════════════════════════════════════════════════════
(function () {
  let _chart = null, _realtimeSub = null, _animInterval = null, _peak = 0;
  const SHOW_ID = 'amaica_main';

  window.initAdminDashboard = async function () {
    const sb = window._sb;
    if (!sb) return;
    _peak = 0;
    await _loadInitial(sb);
    _initChart(sb);
    _subscribeRealtime(sb);
  };

  window.teardownAdminDashboard = function () {
    if (_realtimeSub) { try { _realtimeSub.unsubscribe(); } catch (e) { } _realtimeSub = null; }
    clearInterval(_animInterval);
  };

  async function _loadInitial(sb) {
    try {
      const { data } = await sb.from('show_stats').select('*').eq('show_id', SHOW_ID).single();
      if (!data) return;
      _setCount(data.listeners); _setStatus(data.listeners); _peak = data.listeners; _setPeak(_peak);
    } catch (e) { }
  }

  async function _initChart(sb) {
    const canvas = document.getElementById('adm-listener-chart');
    if (!canvas || !window.Chart) return;
    if (_chart) { _chart.destroy(); _chart = null; }
    try {
      const { data } = await sb.from('listener_history').select('recorded_at, listeners')
        .eq('show_id', SHOW_ID).order('recorded_at', { ascending: true }).limit(30);
      const labels = (data || []).map(d => new Date(d.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
      const values = (data || []).map(d => d.listeners);
      _chart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Listeners', data: values, borderColor: '#e84118', backgroundColor: 'rgba(232,65,24,0.08)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3 }] },
        options: {
          responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
          }
        }
      });
    } catch (e) { }
  }

  function _updateChart(count) {
    if (!_chart) return;
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    _chart.data.labels.push(time); _chart.data.datasets[0].data.push(count);
    if (_chart.data.labels.length > 30) { _chart.data.labels.shift(); _chart.data.datasets[0].data.shift(); }
    _chart.update('none');
  }

  function _subscribeRealtime(sb) {
    if (_realtimeSub) { try { _realtimeSub.unsubscribe(); } catch (e) { } }
    _realtimeSub = sb.channel('adm-realtime-show')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'show_stats', filter: `show_id=eq.${SHOW_ID}` }, (payload) => {
        const count = payload.new?.listeners ?? 0;
        _animateCount(count); _setStatus(count); _updateChart(count);
        if (count > _peak) { _peak = count; _setPeak(_peak); }
      }).subscribe();
  }

  function _animateCount(target) {
    clearInterval(_animInterval);
    const el = document.getElementById('adm-live-count');
    if (!el) return;
    let current = parseInt(el.textContent.replace(/,/g, '')) || 0;
    if (current === target) return;
    _animInterval = setInterval(() => {
      if (current === target) { clearInterval(_animInterval); return; }
      const step = Math.max(1, Math.floor(Math.abs(target - current) / 10));
      current += current < target ? step : -step;
      if (Math.abs(current - target) < step) current = target;
      el.textContent = current.toLocaleString();
    }, 30);
  }

  function _setCount(c) { const el = document.getElementById('adm-live-count'); if (el) el.textContent = Number(c).toLocaleString(); }
  function _setPeak(c) { const el = document.getElementById('adm-peak-count'); if (el) el.textContent = Number(c).toLocaleString(); }
  function _setStatus(c) { const el = document.getElementById('adm-live-status'); if (!el) return; el.textContent = c > 0 ? '🔴 LIVE' : '⚫ OFFLINE'; el.style.color = c > 0 ? 'var(--c-primary)' : 'var(--c-on-surface-variant)'; }
})();