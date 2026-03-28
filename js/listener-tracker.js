// ═══════════════════════════════════════════════════════════════
//  AMAICA PULSE — SERVER: LISTENER TRACKER
//  Polls the Icecast/SHOUTcast stream every 30s and writes to:
//    show_stats     — upserted row with current listener count
//    listener_history — rolling log with country (geo-lookup)
//
//  Run: node server/listener-tracker.js
//  Requires: npm install node-fetch @supabase/supabase-js
//
//  ⚠️  Fill in the four CONFIG values below before running.
// ═══════════════════════════════════════════════════════════════
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// ── CONFIG ─────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://dmscfpnkswmfbfgcuwwb.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2NmcG5rc3dtZmJmZ2N1d3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTYzMTYsImV4cCI6MjA4OTc3MjMxNn0.iRIYW_OiFAYjha-PoXQHf7gjwbhSfhGWdtyD_3ZgAOs';

// Try both Icecast and SHOUTcast stat URLs in order
const STAT_URLS = [
  'https://s40.myradiostream.com:23535/status-json.xsl',  // Icecast
  'https://s40.myradiostream.com:23535/stats?json=1'       // SHOUTcast
];

const GEO_API  = 'http://ip-api.com/json/'; // free, no key needed
const SHOW_ID  = 'amaica_main';
const POLL_MS  = 30_000;                    // poll every 30 s

// ── SUPABASE CLIENT ────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── FETCH LISTENER COUNT ───────────────────────────────────────
async function fetchListeners() {
  for (const url of STAT_URLS) {
    try {
      const res  = await fetch(url, { timeout: 8000 });
      if (!res.ok) continue;
      const data = await res.json();

      // Icecast JSON (status-json.xsl)
      if (data?.icestats?.source) {
        const src     = data.icestats.source;
        const sources = Array.isArray(src) ? src : [src];
        // Prefer the /listen mount; fall back to first
        const mount   = sources.find(s => s.listenurl?.includes('/listen')) || sources[0];
        const count   = parseInt(mount?.listeners ?? 0, 10);
        return { count, source: 'icecast' };
      }

      // SHOUTcast v2 (stats?json=1)
      if (data?.streams || data?.currentlisteners !== undefined) {
        const src   = data.streams?.[0] || data;
        const count = parseInt(src.uniquelisteners ?? src.currentlisteners ?? src.listeners ?? 0, 10);
        return { count, source: 'shoutcast' };
      }

    } catch (err) {
      console.warn(`[tracker] ${url} failed:`, err.message);
    }
  }
  return { count: 0, source: null };
}

// ── GEO LOOKUP (best-effort, single IP) ───────────────────────
async function getCountry(ip) {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.')) return 'Unknown';
  try {
    const res  = await fetch(`${GEO_API}${ip}`, { timeout: 5000 });
    const data = await res.json();
    return data?.country || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ── WRITE TO SUPABASE ─────────────────────────────────────────
async function updateDatabase(count) {
  const now = new Date().toISOString();

  // Upsert current count into show_stats
  const { error: upsertErr } = await supabase
    .from('show_stats')
    .upsert({ show_id: SHOW_ID, listeners: count, updated_at: now },
             { onConflict: 'show_id' });

  if (upsertErr) console.error('[tracker] upsert error:', upsertErr.message);

  // Insert into listener_history for charts and map
  // Country is 'Unknown' unless you add IP-level data from Icecast admin API
  const { error: insertErr } = await supabase
    .from('listener_history')
    .insert({ show_id: SHOW_ID, listeners: count, country: 'Unknown', recorded_at: now });

  if (insertErr) console.error('[tracker] history insert error:', insertErr.message);
}

// ── MAIN LOOP ─────────────────────────────────────────────────
async function run() {
  const { count, source } = await fetchListeners();
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] Listeners: ${count} (via ${source || 'none'})`);
  await updateDatabase(count);
}

// Boot immediately then on interval
run();
setInterval(run, POLL_MS);