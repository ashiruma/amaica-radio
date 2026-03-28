// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — SUPABASE CLIENT
//  Auth, points, profiles, leaderboard, redemptions
// ═══════════════════════════════════════════════════════════════
(async function () {
  const { SUPABASE_URL, SUPABASE_ANON } = window.APP_CONFIG;

  // Lazy-load the Supabase ESM module
  let sb;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = mod.createClient(SUPABASE_URL, SUPABASE_ANON);
    window._sb = sb;
  } catch (e) {
    console.warn('Database unavailable — running in local mode.');
    return; // Graceful fallback to localStorage mode
  }

  // ── Auth helpers ──────────────────────────────────────────────
  window.sbSignUp = async (email, password, username) => {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw error;
    await sb.from('profiles').insert({
      id: data.user.id, username, points: 0, streak: 0, tier: 'bronze',
      messages_sent: 0,
      referral_code: 'PULSE-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      referrals_made: 0
    });
    return data;
  };

  window.sbSignIn = async (email, password) => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  window.sbSignOut = async () => {
    await sb.auth.signOut();
    window._currentUser = null; window._profile = null;
    if (window.renderAuthState) renderAuthState();
  };

  sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) { window._currentUser = session.user; await loadProfile(session.user.id); }
    else               { window._currentUser = null; window._profile = null; }
    if (window.renderAuthState) renderAuthState();
  });

  async function loadProfile(uid) {
    const { data } = await sb.from('profiles').select('*').eq('id', uid).single();
    if (data) { window._profile = data; if (window.syncProfileToUI) syncProfileToUI(data); }
  }

  // ── Profile sync ──────────────────────────────────────────────
  window.syncProfileToUI = (p) => {
    if (!p) return;
    const f = p.points.toLocaleString();
    ['points-display', 'profile-pts-num'].forEach(id => {
      const e = document.getElementById(id); if (e) e.textContent = f;
    });
    const pp  = document.getElementById('profile-pts');             if (pp)  pp.textContent  = f + ' pts';
    const lb  = document.getElementById('lb-your-pts');             if (lb)  lb.textContent  = f + ' pts';
    const pn  = document.getElementById('profile-username');        if (pn)  pn.textContent  = p.username || 'Listener';
    const rc  = document.getElementById('referral-code-display');   if (rc)  rc.textContent  = p.referral_code || 'PULSE-XXXX';
    const pc  = document.getElementById('profile-chat');            if (pc)  pc.textContent  = p.messages_sent || 0;
    const str = document.getElementById('profile-streak');          if (str) str.textContent = p.streak || 0;
    setTierUI(p.tier || 'bronze', p.points || 0);
  };

  // ── Points ────────────────────────────────────────────────────
  window.sbEarnPoints = async (pts, reason) => {
    const cfg = window.APP_CONFIG;
    const listeners = window._liveListeners || 50;
    const mult = 1 / (1 + (listeners / cfg.SCARCITY_DIVISOR));
    const adjusted = pts > 0 ? Math.max(1, Math.floor(pts * mult)) : pts;

    const validActions = ['Listening bonus', 'Stoked the fire', 'Referral bonus', 'Mission complete', 'Tuned in', 'Sent message'];
    if (pts > 0 && !validActions.includes(reason)) return;

    if (!window._currentUser) {
      window._localPoints = (window._localPoints || 0) + adjusted;
      if (window.saveLocal) saveLocal();
      if (window.updateLocalUI) updateLocalUI();
      if (window.showPtsPop) showPtsPop(adjusted);
      return;
    }
    const uid = window._currentUser.id;
    const newPts = (window._profile?.points || 0) + adjusted;
    const { data } = await sb.from('profiles').update({ points: newPts }).eq('id', uid).select().single();
    if (data) { window._profile = data; syncProfileToUI(data); }
    await sb.from('point_events').insert({ user_id: uid, points: adjusted, reason, created_at: new Date().toISOString() });
    if (window.showPtsPop) showPtsPop(adjusted);
    if (window.updateFireMeter) updateFireMeter(1);
  };

  // ── Listen session tracking ───────────────────────────────────
  let _sessionStart = null;
  window.startListenSession = async () => {
    _sessionStart = Date.now();
    if (!window._currentUser) return;
    const today = new Date().toDateString();
    const p = window._profile;
    if (p && p.last_listen_date !== today) {
      const isConsec = p.last_listen_date === new Date(Date.now() - 86400000).toDateString();
      const newStreak = isConsec ? (p.streak || 0) + 1 : 1;
      await sb.from('profiles').update({ streak: newStreak, last_listen_date: today }).eq('id', window._currentUser.id);
      window._profile.streak = newStreak; window._profile.last_listen_date = today;
      const se = document.getElementById('profile-streak'); if (se) se.textContent = newStreak;
    }
  };
  window.endListenSession = async () => {
    if (!_sessionStart || !window._currentUser) return;
    const mins = Math.floor((Date.now() - _sessionStart) / 60000);
    if (mins < 1) return;
    await sb.from('listen_sessions').insert({
      user_id: window._currentUser.id, duration_mins: mins, created_at: new Date().toISOString()
    });
    _sessionStart = null;
  };

  // ── Chat ──────────────────────────────────────────────────────
  window.sbSendMessage = async (text, type = 'chat') => {
    if (!window._currentUser) return;
    const uid = window._currentUser.id;
    await sb.from('messages').insert({
      user_id: uid,
      username: window._profile?.username || 'Listener',
      text: type === 'shoutout' ? `📣 SHOUTOUT: ${text}` : text,
      created_at: new Date().toISOString()
    });
    const newCount = (window._profile?.messages_sent || 0) + 1;
    await sb.from('profiles').update({ messages_sent: newCount }).eq('id', uid);
    if (window._profile) window._profile.messages_sent = newCount;
  };

  // Live chat subscription
  const chatChannel = sb.channel('live-chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const m = payload.new;
      if (m.user_id === window._currentUser?.id) return;
      if (window.appendChatMsg) appendChatMsg({
        u: m.username, text: m.text, own: false,
        time: new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        pts: true
      });
      if (m.text.includes('📣 SHOUTOUT') && window.showLiveShoutout) {
        window.showLiveShoutout(m.username, m.text.replace('📣 SHOUTOUT:', '').trim());
      }
    }).subscribe();

  // ── Leaderboard ──────────────────────────────────────────────
  window.loadLeaderboard = async () => {
    const { data } = await sb.from('profiles')
      .select('username, points, streak, tier')
      .order('points', { ascending: false })
      .limit(20);
    if (data && window.renderLeaderboard) renderLeaderboard(data);
  };

  // ── Referral ──────────────────────────────────────────────────
  window.applyReferralCode = async (code) => {
    if (!window._currentUser) return;
    const { data: referrer } = await sb.from('profiles')
      .select('id, referrals_made, points')
      .eq('referral_code', code.toUpperCase()).single();
    if (!referrer) { if (window.showToast) showToast('Code not found', 'error'); return; }
    if (referrer.id === window._currentUser.id) { if (window.showToast) showToast('Cannot use own code', 'error'); return; }
    await sb.from('profiles').update({ points: referrer.points + 200, referrals_made: referrer.referrals_made + 1 }).eq('id', referrer.id);
    await sb.from('point_events').insert({ user_id: referrer.id, points: 200, reason: 'Referral bonus' });
    await window.sbEarnPoints(50, 'Used referral code');
    if (window.showToast) showToast('+50 pts for using a referral!', 'celebration');
  };

  // ── Admin: verify & claim redemption ─────────────────────────
  window.verifyCode = async function () {
    const code = document.getElementById('verify-input')?.value?.trim()?.toUpperCase();
    const resultDiv = document.getElementById('verify-result');
    if (!resultDiv) return;
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p class="rotating" style="text-align:center;">⌛ Checking...</p>';
    const { data, error } = await sb.from('redemptions').select('*, profiles(username)').eq('code', code).single();
    if (error || !data) {
      resultDiv.innerHTML = `<div class="verify-result-card error"><p>❌ INVALID CODE</p><p>This code does not exist in our system.</p></div>`;
    } else if (data.status === 'claimed') {
      resultDiv.innerHTML = `<div class="verify-result-card warn"><p>⚠️ ALREADY CLAIMED</p><p>Collected on ${new Date(data.updated_at).toLocaleDateString()}.</p></div>`;
    } else {
      resultDiv.innerHTML = `<div class="verify-result-card ok"><p>✅ VALID: ${data.item_name}</p><p>User: <strong>${data.profiles?.username || 'Guest'}</strong></p><button class="btn-primary" style="margin-top:15px;width:100%;" onclick="confirmCollection('${data.id}')">MARK AS COLLECTED</button></div>`;
    }
  };

  window.confirmCollection = async function (id) {
    const { error } = await sb.from('redemptions').update({ status: 'claimed', updated_at: new Date() }).eq('id', id);
    if (!error) { alert('Item officially claimed!'); if (window.toggleAdmin) toggleAdmin(false); }
  };

  // ── Tier UI ───────────────────────────────────────────────────
  function setTierUI(tier, pts) {
    const tiers = window.APP_CONFIG.TIERS;
    const order = ['bronze', 'silver', 'gold', 'superfan'];
    const idx = order.indexOf(tier); const next = order[idx + 1]; const nextPts = next ? tiers[next] : null;
    const el = document.getElementById('tier-next-label');
    if (el && nextPts) el.textContent = `Next: ${next.charAt(0).toUpperCase() + next.slice(1)} at ${nextPts.toLocaleString()} pts`;
    const bar = document.getElementById('tier-progress-bar');
    if (bar && nextPts) { const prev = tiers[tier]; bar.style.width = Math.min(100, ((pts - prev) / (nextPts - prev)) * 100) + '%'; }
    document.querySelectorAll('.tier-badge').forEach(b => b.classList.toggle('active', b.dataset.tier === tier));
  }
})();

