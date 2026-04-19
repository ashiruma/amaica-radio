/**
 * security.js
 * Central security module for Amaica Radio PWA.
 * Load this FIRST before any other app script.
 *
 * Provides:
 *   - Input sanitization
 *   - Email/password validation
 *   - Rate limiting factory
 *   - Safe DOM element creation (no innerHTML for user content)
 *   - Auth attempt tracking
 */

'use strict';

window.Security = (() => {

  // ─── Input sanitization ───────────────────────────────────────────────────

  /**
   * Strip leading/trailing whitespace, enforce max length,
   * and remove characters that enable HTML injection.
   * Use for ALL user-supplied strings before storing or displaying.
   */
  function sanitizeInput(str, maxLen = 300) {
    if (typeof str !== 'string') return '';
    return str
      .trim()
      .slice(0, maxLen)
      .replace(/[<>]/g, '')          // block tag injection
      .replace(/javascript:/gi, '')  // block JS URI
      .replace(/on\w+=/gi, '');      // block inline event attrs
  }

  /**
   * Sanitize a display name — letters, numbers, spaces, hyphens only.
   */
  function sanitizeUsername(str) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, 30).replace(/[^a-zA-Z0-9 _\-\.]/g, '');
  }

  /**
   * Sanitize a chat message. Stricter than generic input.
   */
  function sanitizeChatMessage(str) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, 280).replace(/[<>]/g, '').replace(/javascript:/gi, '');
  }


  // ─── Validation ───────────────────────────────────────────────────────────

  function validateEmail(email) {
    if (typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
  }

  /**
   * Minimum 8 chars, at least one uppercase, one number.
   * Returns { valid: bool, message: string }
   */
  function validatePassword(password) {
    if (typeof password !== 'string') return { valid: false, message: 'Invalid input.' };
    if (password.length < 8)          return { valid: false, message: 'Minimum 8 characters.' };
    if (!/[A-Z]/.test(password))      return { valid: false, message: 'Add at least one uppercase letter.' };
    if (!/[0-9]/.test(password))      return { valid: false, message: 'Add at least one number.' };
    return { valid: true, message: 'Strong' };
  }


  // ─── Rate limiter factory ─────────────────────────────────────────────────

  /**
   * Creates a rate limiter for a named action.
   * Usage:
   *   const limiter = createRateLimiter('auth', 5, 60000);
   *   if (!limiter.allow()) { showToast('Too many attempts.'); return; }
   */
  function createRateLimiter(name, maxAttempts, windowMs) {
    const key = `rl_${name}`;

    return {
      allow() {
        const now = Date.now();
        const stored = JSON.parse(sessionStorage.getItem(key) || '{"count":0,"reset":0}');

        if (now > stored.reset) {
          // Window expired — reset
          sessionStorage.setItem(key, JSON.stringify({ count: 1, reset: now + windowMs }));
          return true;
        }

        if (stored.count >= maxAttempts) {
          const wait = Math.ceil((stored.reset - now) / 1000);
          this.waitSeconds = wait;
          return false;
        }

        stored.count++;
        sessionStorage.setItem(key, JSON.stringify(stored));
        return true;
      },
      reset() {
        sessionStorage.removeItem(key);
      },
      waitSeconds: 0,
    };
  }

  // Pre-built limiters
  const authLimiter = createRateLimiter('auth', 5, 60 * 1000);       // 5 attempts / 60s
  const chatLimiter = createRateLimiter('chat', 20, 30 * 1000);      // 20 messages / 30s
  const referralLimiter = createRateLimiter('referral', 3, 300 * 1000); // 3 / 5min


  // ─── Safe DOM helpers ─────────────────────────────────────────────────────

  /**
   * Create a chat message element using textContent only.
   * NEVER use innerHTML for user-generated content.
   */
  function createChatMessageEl(username, text, isOwn = false) {
    const safeUser = sanitizeUsername(username) || 'Listener';
    const safeText = sanitizeChatMessage(text);

    const wrap = document.createElement('div');
    wrap.className = isOwn ? 'cpm cpm-own' : 'cpm';

    const av = document.createElement('div');
    av.className = 'cpm-av';
    av.textContent = safeUser.charAt(0).toUpperCase();

    const body = document.createElement('div');
    body.className = 'cpm-body';

    const u = document.createElement('p');
    u.className = 'cpm-user';
    u.textContent = safeUser;

    const t = document.createElement('p');
    t.className = 'cpm-text';
    t.textContent = safeText;

    body.appendChild(u);
    body.appendChild(t);
    wrap.appendChild(av);
    wrap.appendChild(body);
    return wrap;
  }


  // ─── Supabase init guard ──────────────────────────────────────────────────

  /**
   * Verify APP_CONFIG exists and has required keys before any DB call.
   * Throws clearly instead of failing silently.
   */
  function assertConfig() {
    if (!window.APP_CONFIG) {
      throw new Error('APP_CONFIG not loaded. Check js/config.js was generated by the build step.');
    }
    if (!window.APP_CONFIG.supabaseUrl || !window.APP_CONFIG.supabaseAnonKey) {
      throw new Error('APP_CONFIG is incomplete. Re-run the build step with correct environment variables.');
    }
  }


  // ─── Public API ───────────────────────────────────────────────────────────

  return Object.freeze({
    sanitizeInput,
    sanitizeUsername,
    sanitizeChatMessage,
    validateEmail,
    validatePassword,
    createRateLimiter,
    authLimiter,
    chatLimiter,
    referralLimiter,
    createChatMessageEl,
    assertConfig,
  });

})();
