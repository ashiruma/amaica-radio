// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — CONFIG
//  Edit this file to change stream URLs, keys, admin PIN, etc.
// ═══════════════════════════════════════════════════════════════

window.APP_CONFIG = {
  // ── Supabase ────────────────────────────────────────────────
  SUPABASE_URL: 'https://dmscfpnkswmfbfgcuwwb.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2NmcG5rc3dtZmJmZ2N1d3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTYzMTYsImV4cCI6MjA4OTc3MjMxNn0.iRIYW_OiFAYjha-PoXQHf7gjwbhSfhGWdtyD_3ZgAOs',

  // ── Stream ──────────────────────────────────────────────────
  STREAM_URL: 'https://s40.myradiostream.com:23535/listen.mp3',
  STATS_URL: 'https://s40.myradiostream.com:23535/status-json.xsl',
  STATS_URL_2: 'https://s40.myradiostream.com:23535/stats?json=1',
  CORS_PROXIES: [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ],
  POLL_MS: 30000,

  // ── Station ──────────────────────────────────────────────────
  STATION_NAME: 'Amaica Radio 98.7 FM',
  STATION_FREQ: '98.7 FM',
  LOCATION: 'Kakamega, Kenya',
  WEBSITE: 'http://amaicamedia.com',
  WHATSAPP: '+254715505284',
  APP_VERSION: 'The Pulse v7',

  // ── Admin (change this PIN!) ──────────────────────────────────
  // Accessed by tapping the version text 5 times in Settings
  ADMIN_PIN: '1234',

  // ── Points economy ───────────────────────────────────────────
  LISTEN_BONUS_PTS: 10,       // pts per minute of listening
  LISTEN_BONUS_SECS: 60000,    // how often to award listen bonus (ms)
  CHAT_PTS: 5,        // pts per chat message
  FIRE_STOKE_PTS: 25,       // pts for stoking the fire
  SCARCITY_DIVISOR: 1000,     // higher = slower scarcity curve

  // ── Tiers ────────────────────────────────────────────────────
  TIERS: {
    bronze: 0,
    silver: 500,
    gold: 2000,
    superfan: 5000
  }
  CONTACT_EMAIL: 'info@amaicamedia.com',
  CALL_IN_NUMBER: '+254715505284',
  LEGAL_BASE_URL: '',
  SOCIALS: {
    facebook: 'https://facebook.com/amaicamedia',
    twitter: 'https://twitter.com/amaicamedia',
    instagram: 'https://instagram.com/official',
    youtube: 'https://youtube.com/@amaicaradio',
    tiktok: 'https://tiktok.com/@amaicaentertainment',
  },
};
