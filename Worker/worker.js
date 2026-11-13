/* ============================================================================
   THE-FALLEN · Cloudflare Worker (komplett)
   ----------------------------------------------------------------------------
   Diese Datei ist die einzige Quelle zum Kopieren in Cloudflare.
   Enthalten:
     - Feedback (POST /, GET /?key=…)
     - Live-Editor (/content GET/POST/DELETE)
     - Roster-Brain:
         GET  /roster?event=<64-hex>&key=<mod-key>
         POST /notify   { key, event, changes:[{name,role}], link }
         POST /notify   { key, type:'pin', link }
         GET  /deaths?guild=<id>&names=A,B,C&days=30&key=<mod-key>
         GET  /guild?guild=<id>&key=<mod-key>
         GET  /guildstats?guild=<id>&window=7d|30d|90d|all&force=1&key=<mod-key>
         GET  /guildrecent?guild=<id>&force=1&key=<mod-key>
         GET  /alerts?guild=<id>&notify=0|1&force=1&key=<mod-key>
         GET  /deaths/detail?guild=<id>&name=<name>&key=<mod-key>
       - Cron (scheduled): prüft alle 5 Minuten die letzten 3 Battles auf Mehrfach-Tode

   Bindings:
     MOD_KEY            (Pflicht, Moderatoren-Key)
     DISCORD_TOKEN      (Pflicht für Meldungen)
     DISCORD_CHANNEL_ID (Pflicht, Zielkanal für Feedback/Anmeldungen/Todeswarnungen)
     DISCORD_USER_ID    (optional, nur Fallback-DM wenn keine Kanal-ID gesetzt ist)
     ALERT_GUILD        (optional, Gilden-ID für den Cron; Standard ist The-Fallen)
     FEEDBACK_TF        (Pflicht, KV; dient auch als Cache für Tode)
   ========================================================================== */

/* ============================================================
   ROSTER-BRAIN · Hilfsfunktionen
   ============================================================ */

const AZ_BASE = 'https://www.albionzvz.com';
const META_TTL_MS = 5 * 60 * 1000;          // Event-Seite 5 Minuten cachen
const META_CACHE = new Map();               // token -> { at, data } (pro Isolate)

const ROSTER_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

function rosterJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: ROSTER_HEADERS });
}

/* ---------- Event-Seite parsen ------------------------------------------- */

function extractRsc(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { chunks.push(JSON.parse('"' + m[1] + '"')); }
    catch (e) { /* unvollständiger Chunk */ }
  }
  return chunks.join('\n');
}

function sliceBalanced(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** Schneidet ab start ein JSON-Array oder -Objekt aus (Strings werden beachtet). */
function sliceJson(text, start) {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  if (open !== '[' && open !== '{') return null;

  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function parseEventHtml(html) {
  const rsc = extractRsc(html);
  if (!rsc) return null;

  const roles = {};
  const roleRe = /"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})":\{"name":"([^"]+)","playstyle":"([^"]+)"\}/g;
  let m;
  while ((m = roleRe.exec(rsc)) !== null) {
    roles[m[1]] = { name: m[2], playstyle: m[3] };
  }
  if (!Object.keys(roles).length) return null;

  const anchor = rsc.indexOf('"cosmeticsUiEnabled"');
  if (anchor < 0) return null;
  const raw = sliceBalanced(rsc, rsc.lastIndexOf('{', anchor));
  if (!raw) return null;

  let data;
  try { data = JSON.parse(raw); } catch (e) { return null; }
  if (!data || !Array.isArray(data.parties)) return null;

  const roleName = id => (roles[id] ? roles[id].name : null);
  const playerName = id => {
    const p = (data.players || []).find(x => x.id === id);
    return p ? p.displayName : null;
  };

  const parties = data.parties.map(pt => ({
    title: pt.title || 'Party',
    slots: (pt.slots || []).map(s => {
      const weapons = (s.roleOptionIds || []).map(roleName).filter(Boolean);
      return { weapons, player: s.assignedPlayerId ? playerName(s.assignedPlayerId) : null };
    })
  }));

  const playstyles = {};
  const roleNames = {};
  Object.values(roles).forEach(r => { playstyles[r.name] = r.playstyle; });
  Object.entries(roles).forEach(([id, r]) => { roleNames[id] = r.name; });

  const ev = data.event || {};
  return {
    event: {
      id: ev.id || null,
      title: ev.title || 'Event',
      startsAt: ev.startsAt || null,
      status: ev.status || null,
      shotCaller: ev.shotCallerDisplayName || null
    },
    parties,
    playstyles,
    roleNames
  };
}

/** Players-Tabelle aus der öffentlichen Gildenseite (view=players). */
function parseGuildPlayers(html) {
  const rsc = extractRsc(html);
  if (!rsc) return null;

  const marker = '"players":[';
  const i = rsc.indexOf(marker);
  if (i < 0) return null;

  const start = i + marker.length - 1;
  const raw = sliceJson(rsc, start);
  if (!raw) return null;

  let arr;
  try { arr = JSON.parse(raw); } catch (e) { return null; }
  if (!Array.isArray(arr)) return null;

  return arr
    .filter(p => p && p.name)
    .map(p => ({
      name: p.name,
      battles: p.battles || 0,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      fame: p.killFame || 0,
      lastSeen: p.lastSeenMs || 0
    }));
}

/** Spielerstatistik der Gilde für ein Zeitfenster (7d/30d/90d/all), 12 h gecacht. */
async function guildPlayers(env, guildId, windowKey, force) {
  const key = 'rb:gp:' + guildId + ':' + windowKey;
  if (!force) {
    const cached = await kvGet(env, key);
    if (cached && cached.at && Date.now() - cached.at < 12 * 60 * 60 * 1000) return cached;
  }

  const url = AZ_BASE + '/guilds/europe/' + encodeURIComponent(guildId)
    + '?view=players'
    + '&minMass=' + ZVZ_MASS_MIN
    + '&maxMass=' + ZVZ_MASS_MAX
    + '&window=' + encodeURIComponent(windowKey);

  const res = await fetch(url, {
    headers: { 'Accept': 'text/html', 'User-Agent': ALBION_UA }
  });
  if (!res.ok) throw new Error('guild players HTTP ' + res.status);

  const html = await res.text();
  const players = parseGuildPlayers(html);
  if (!players) throw new Error('guild players not parseable');

  const out = { at: Date.now(), window: windowKey, players };
  await kvPut(env, key, out, 43200);
  return out;
}

/** Gesamtübersicht: alle Spieler eines Fensters. */
async function handleGuildStats(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const guild = (url.searchParams.get('guild') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(guild)) {
    return rosterJson({ error: 'bad_guild' }, 400);
  }

  const windowKey = (url.searchParams.get('window') || '30d').toLowerCase();
  const force = url.searchParams.get('force') === '1';

  let gp;
  try { gp = await guildPlayers(env, guild, windowKey, force); }
  catch (e) { return rosterJson({ error: 'guild_players_unreachable', detail: String(e && e.message || e) }, 502); }

  const players = gp.players.map(p => ({
    name: p.name,
    battles: p.battles,
    kills: p.kills,
    deaths: p.deaths,
    kd: p.deaths ? Math.round((p.kills / p.deaths) * 100) / 100 : null,
    fame: p.fame,
    lastSeen: p.lastSeen
  }));

  return rosterJson({
    guild,
    window: windowKey,
    fetchedAt: new Date(gp.at).toISOString(),
    players
  });
}

/** 3-Tage-Auswertung aus den ZvZ-Battles, 12 h gecacht. */
async function handleGuildRecent(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const guild = (url.searchParams.get('guild') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(guild)) {
    return rosterJson({ error: 'bad_guild' }, 400);
  }

  const force = url.searchParams.get('force') === '1';
  const key = 'rb:recent3:' + guild;

  if (!force) {
    const cached = await kvGet(env, key);
    if (cached && cached.at && Date.now() - cached.at < 12 * 60 * 60 * 1000) return rosterJson(cached);
  } else {
    await kvDelete(env, 'rb:zvz:' + guild);
  }

  let battles = [];
  try { battles = await zvzAggregate(env, guild, 3, ZVZ_AGG_MAX); }
  catch (e) { return rosterJson({ error: 'battles_unreachable', detail: String(e && e.message || e) }, 502); }

  const map = new Map();
  battles.forEach(bt => {
    (bt.players || []).forEach(p => {
      if (p.guildId !== guild) return;
      const row = map.get(p.name) || { name: p.name, battles: 0, kills: 0, deaths: 0, last: 0 };
      row.battles++;
      row.kills += p.kills || 0;
      row.deaths += p.deaths || 0;
      row.last = Math.max(row.last, bt.t);
      map.set(p.name, row);
    });
  });

  const players = [...map.values()]
    .map(p => ({
      name: p.name,
      battles: p.battles,
      kills: p.kills,
      deaths: p.deaths,
      kd: p.deaths ? Math.round((p.kills / p.deaths) * 100) / 100 : null,
      lastSeen: p.last,
      risk: p.deaths >= 4 ? 'high' : p.deaths >= 2 ? 'mid' : 'low'
    }))
    .sort((a, b) => b.deaths - a.deaths || b.kills - a.kills);

  const out = {
    at: Date.now(),
    guild,
    days: 3,
    battles: battles.length,
    truncated: battles.length >= ZVZ_AGG_MAX,
    fetchedAt: new Date().toISOString(),
    players
  };
  await kvPut(env, key, out, 43200);
  return rosterJson(out);
}

async function loadEventMeta(token) {
  const hit = META_CACHE.get(token);
  if (hit && Date.now() - hit.at < META_TTL_MS) return hit.data;

  const res = await fetch(AZ_BASE + '/e/' + token, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'The-Fallen-Roster/1.0 (+https://the-fallen-zvz.github.io/)'
    }
  });
  if (!res.ok) throw new Error('event page HTTP ' + res.status);

  const html = await res.text();
  const meta = parseEventHtml(html);
  if (!meta) throw new Error('event page not parseable');

  META_CACHE.set(token, { at: Date.now(), data: meta });
  return meta;
}

async function loadEventRoster(token) {
  const res = await fetch(AZ_BASE + '/api/events/public/' + token + '/roster', {
    headers: { 'Accept': 'application/json' },
    cf: { cacheTtl: 0 }
  });
  if (!res.ok) throw new Error('roster HTTP ' + res.status);
  return res.json();
}

/* ---------- Roster -------------------------------------------------------- */

async function handleRoster(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const token = (url.searchParams.get('event') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return rosterJson({ error: 'bad_event', hint: 'Token = die 64 Zeichen aus /e/...' }, 400);
  }

  /* Nebenbei wartende Anmeldungen nachholen (die Seite fragt ohnehin alle 5 Min ab) */
  try { await flushNotifyQueue(env); } catch (e) { /* naechster Lauf */ }

  let meta, roster;
  try { meta = await loadEventMeta(token); }
  catch (e) { return rosterJson({ error: 'event_unreachable', detail: String(e && e.message || e) }, 502); }
  try { roster = await loadEventRoster(token); }
  catch (e) { return rosterJson({ error: 'roster_unreachable', detail: String(e && e.message || e) }, 502); }

  const players = (roster.players || [])
    .filter(p => p && p.signedUp)
    .map(p => ({
      name: p.displayName,
      prefs: (p.preferenceRoleIds || []).filter(Boolean).map(id => meta.roleNames[id] || null).filter(Boolean),
      tentative: !!p.isTentative,
      note: p.comment || ''
    }));

  return rosterJson({
    event: meta.event,
    parties: meta.parties,
    playstyles: meta.playstyles,
    players,
    fetchedAt: new Date().toISOString()
  });
}

/* ---------- Discord ------------------------------------------------------- */

const DISCORD_API = 'https://discord.com/api/v10';
let LAST_DISCORD = null;                     // letzter Discord-Fehler (nur Diagnose)
const WORKER_VERSION = '2026-11-13-9';       // erscheint in /health – zeigt, ob der Deploy aktuell ist
const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;    // min. 5 Min zwischen zwei Anmeldungs-Nachrichten
const NOTIFY_DUPLICATE_MS = 10 * 60 * 1000;  // identische Nachricht 10 Min nicht wiederholen
const NOTIFY_QUEUE_TTL = 24 * 60 * 60;       // gemerkte Anmeldung max. 1 Tag aufheben

function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function discordAuth(env) {
  return {
    'Authorization': 'Bot ' + env.DISCORD_TOKEN,
    'Content-Type': 'application/json'
  };
}

/** Eine Nachricht in einen Kanal posten. 1 = ok, 0 = fehlgeschlagen. */
async function postChannel(env, channelId, content) {
  if (!env.DISCORD_TOKEN || !channelId) return 0;
  try {
    const res = await fetch(DISCORD_API + '/channels/' + channelId + '/messages', {
      method: 'POST',
      headers: discordAuth(env),
      body: JSON.stringify({ content: content.slice(0, 1900) })
    });
    if (res.ok) return 1;
    LAST_DISCORD = {
      at: new Date().toISOString(),
      status: res.status,
      body: (await res.text()).slice(0, 300),
      channel: channelId
    };
    return 0;
  } catch (e) {
    LAST_DISCORD = { at: new Date().toISOString(), status: 0, body: String(e && e.message || e), channel: channelId };
    return 0;
  }
}

/** Fallback: DM an alle Moderatoren. */
async function dmMods(env, content) {
  const ids = String(env.DISCORD_USER_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  let sent = 0;
  for (const id of ids) {
    try {
      const dm = await fetch(DISCORD_API + '/users/@me/channels', {
        method: 'POST',
        headers: discordAuth(env),
        body: JSON.stringify({ recipient_id: id })
      });
      if (!dm.ok) continue;
      const ch = await dm.json();
      if (await postChannel(env, ch.id, content)) sent++;
    } catch (e) { /* nächster Empfänger */ }
  }
  return sent;
}

/** Alle Meldungen gehen in den Moderations-Kanal; ohne Kanal-ID als DM. */
async function notifyMods(env, content) {
  if (!env.DISCORD_TOKEN) return 0;
  if (env.DISCORD_CHANNEL_ID) return postChannel(env, env.DISCORD_CHANNEL_ID, content);
  return dmMods(env, content);
}

/**
 * Anmeldungen mit 5-Minuten-Sperre und Doppel-Erkennung.
 * So kann weder ein zweiter Tab noch ein Reload dieselbe Meldung spammen.
 * Innerhalb der Sperre wird der Text gemerkt und spaeter automatisch gesendet.
 */
async function sendWithCooldown(env, content, scope, force) {
  const key = 'rb:notifylast:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':' + scope;
  const last = await kvGet(env, key);
  const now = Date.now();
  const hash = hashText(content);

  if (!force && last && last.at) {
    if (last.hash === hash && now - last.at < NOTIFY_DUPLICATE_MS) {
      return { sent: 0, duplicate: true, throttled: true, queued: false, retryInMs: 0 };
    }
    if (now - last.at < NOTIFY_COOLDOWN_MS) {
      const retryInMs = NOTIFY_COOLDOWN_MS - (now - last.at);
      await kvPut(env, queueKey(env, scope), { at: now, content }, NOTIFY_QUEUE_TTL);
      return { sent: 0, duplicate: false, throttled: true, queued: true, retryInMs };
    }
  }

  const sent = await notifyMods(env, content);
  if (sent > 0) {
    await kvPut(env, key, { at: now, hash }, 3600);
    await kvDelete(env, queueKey(env, scope));
  }
  return { sent, duplicate: false, throttled: false, queued: false, retryInMs: 0 };
}

function queueKey(env, scope) {
  return 'rb:notifyq:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':' + scope;
}

/** Letzte Entscheidungen pro Event mitschreiben (fuer /health). */
async function logNotify(env, scope, entry) {
  try {
    const key = 'rb:notifylog:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':' + scope;
    const prev = await kvGet(env, key);
    const list = Array.isArray(prev) ? prev : [];
    list.unshift(Object.assign({ at: Date.now(), scope }, entry));
    await kvPut(env, key, list.slice(0, 10), 86400);
  } catch (e) { /* Log ist optional */ }
}

/** Sendet gemerkte Anmeldungen, sobald ihre Sperre abgelaufen ist (force = sofort). */
async function flushNotifyQueue(env, force) {
  const prefix = 'rb:notifyq:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':';
  let sent = 0;

  let list;
  try { list = await env.FEEDBACK_TF.list({ prefix }); }
  catch (e) { return 0; }

  for (const k of list.keys) {
    const q = await kvGet(env, k.name);
    if (!q || !q.content) { await kvDelete(env, k.name); continue; }

    const scope = k.name.slice(prefix.length);
    const lockKey = 'rb:notifylast:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':' + scope;
    const last = await kvGet(env, lockKey);
    if (!force && last && last.at && Date.now() - last.at < NOTIFY_COOLDOWN_MS) continue;

    const ok = await notifyMods(env, q.content);
    if (ok > 0) {
      await kvPut(env, lockKey, { at: Date.now(), hash: hashText(q.content) }, 3600);
      await kvDelete(env, k.name);
      await logNotify(env, scope, { result: 'flushed', sent: ok });
      sent += ok;
    } else {
      await logNotify(env, scope, { result: 'flush-failed', discord: LAST_DISCORD });
    }
  }

  return sent;
}

async function handleNotify(request, env) {
  if (request.method !== 'POST') return rosterJson({ error: 'method_not_allowed' }, 405);

  let body;
  try { body = await request.json(); }
  catch (e) { return rosterJson({ error: 'bad_json' }, 400); }

  if (!env.MOD_KEY || body.key !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const link = (typeof body.link === 'string' && /^https:\/\//.test(body.link))
    ? body.link
    : 'https://the-fallen-zvz.github.io/ZvZ-Guides/#admin-roster';

  const auth = discordAuth(env);

  /* Manuell: wartende Anmeldungen sofort senden: { key, type:'flush' } */
  if (body.type === 'flush') {
    const sent = await flushNotifyQueue(env, true);
    await logNotify(env, 'flush', { result: sent ? 'flushed-manual' : 'flush-empty', sent });
    return rosterJson({ ok: true, sent, flushed: sent > 0 });
  }

  /* Sperre manuell loeschen (zum Testen): { key, type:'reset' } */
  if (body.type === 'reset') {
    const prefix = 'rb:notifylast:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':';
    const list = await env.FEEDBACK_TF.list({ prefix });
    for (const k of list.keys) await env.FEEDBACK_TF.delete(k.name);

    const qPrefix = 'rb:notifyq:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':';
    const qList = await env.FEEDBACK_TF.list({ prefix: qPrefix });
    for (const k of qList.keys) await env.FEEDBACK_TF.delete(k.name);

    return rosterJson({ ok: true, reset: list.keys.length, queued: qList.keys.length });
  }

  /* Link in einen Kanal posten und anpinnen */
  if (body.type === 'pin') {
    if (!env.DISCORD_CHANNEL_ID) {
      return rosterJson({ error: 'no_channel', hint: 'DISCORD_CHANNEL_ID fehlt (Variable im Worker anlegen)' }, 400);
    }
    const send = await fetch('https://discord.com/api/v10/channels/' + env.DISCORD_CHANNEL_ID + '/messages', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ content: '**Roster-Brain**\nManuelle Anpassung: ' + link })
    });
    if (!send.ok) {
      return rosterJson({ error: 'discord_send_failed', detail: await send.text() }, 502);
    }
    const msg = await send.json();
    if (!msg || !msg.id) {
      return rosterJson({ error: 'no_message_id', detail: JSON.stringify(msg).slice(0, 200) }, 502);
    }
    const pin = await fetch('https://discord.com/api/v10/channels/' + env.DISCORD_CHANNEL_ID + '/pins/' + msg.id, {
      method: 'PUT',
      headers: { 'Authorization': 'Bot ' + env.DISCORD_TOKEN }
    });
    if (!pin.ok) {
      return rosterJson({ error: 'pin_failed', detail: await pin.text(), hint: 'Bot braucht MANAGE_MESSAGES' }, 502);
    }
    return rosterJson({ ok: true, pinned: true });
  }

  /* Änderungen in den Kanal */
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 25) : [];
  if (!changes.length) return rosterJson({ error: 'no_changes' }, 400);

  const eventTitle = String(body.event || '').slice(0, 80);
  const lines = changes.map(c => {
    const name = String(c.name || '').slice(0, 40);
    const role = String(c.role || '').slice(0, 60);
    return role === '-'
      ? '**' + name + '** hat den Slot verlassen'
      : 'Anmeldung von: **' + name + '** -> ' + role;
  });

  let content = '**Neue Anmeldung**' + (eventTitle ? ' - ' + eventTitle : '') + '\n'
    + lines.join('\n')
    + '\n\nManuell anpassen: ' + link;
  if (content.length > 1900) content = content.slice(0, 1870) + '\n... (gekuerzt)';

  const scope = (eventTitle || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'default';

  /* Neue Anmeldung zuerst behandeln, danach andere wartende Events nachholen. */
  const out = await sendWithCooldown(env, content, scope, body.force === true);
  try { await flushNotifyQueue(env); } catch (e) { /* naechster Lauf */ }

  if (out.duplicate) {
    await logNotify(env, scope, { changes: changes.length, result: 'duplicate' });
    return rosterJson({ ok: true, sent: 0, duplicate: true });
  }
  if (out.queued) {
    await logNotify(env, scope, { changes: changes.length, result: 'queued', retryInMs: Math.round(out.retryInMs) });
    return rosterJson({ ok: true, sent: 0, queued: true, retryInMs: out.retryInMs });
  }
  if (out.throttled) {
    await logNotify(env, scope, { changes: changes.length, result: 'cooldown' });
    return rosterJson({
      error: 'cooldown',
      throttled: true,
      retryInMs: out.retryInMs,
      hint: 'Naechste Meldung fruehestens in ' + Math.ceil(out.retryInMs / 1000) + ' s'
    }, 429);
  }
  if (!out.sent) {
    await logNotify(env, scope, { changes: changes.length, result: 'failed' });
    return rosterJson({ error: 'notify_failed', hint: 'DISCORD_CHANNEL_ID (Kanal) oder DISCORD_USER_ID (DM) pruefen' }, 502);
  }

  await logNotify(env, scope, { changes: changes.length, result: 'sent', sent: out.sent, force: body.force === true });
  return rosterJson({ ok: true, sent: out.sent });
}

/* ---------- Tode / Aktivität (offizielle Albion-API) ---------------------- */

const ALBION_BASE = 'https://gameinfo-ams.albiononline.com/api/gameinfo';
const DEATH_TTL_MS = 12 * 60 * 60 * 1000;
const ZVZ_MIN_GROUP = 10;   // Fallback, falls die Battle-Liste nicht erreichbar ist
const ZVZ_MASS_MIN = 15;    // unsere typische ZvZ-Größe
const ZVZ_MASS_MAX = 29;
const ZVZ_AGG_MAX = 40;     // Subrequest-Limit der Free-Instanz (max. 50 pro Aufruf) schonen
const ALERT_MIN_DEATHS = 2; // ab 2 Toden in einem Battle -> Erinnerung
const ALERT_BATTLES = 3;    // die letzten 3 ZvZ-Battles prüfen
const ALERT_TTL = 30 * 86400; // Merker 30 Tage (Battles sind unveränderlich)
const BATTLE_SETTLE_MS = 2 * 60 * 60 * 1000; // Battle-Daten erst 2 h nach Ende aus dem Cache
const ALBION_UA = 'The-Fallen-Roster/1.0 (+https://the-fallen-zvz.github.io/)';

/**
 * ZvZ-Erkennung.
 * Primär: BattleId muss in der ZvZ-Battle-Liste der Gilde stehen (Masse 15–29).
 * Fallback (Liste nicht verfügbar): große eigene Gruppe oder viele Gegner.
 */
function isZvzEvent(d, zvzSet) {
  if (zvzSet) return !!(d.BattleId && zvzSet.has(d.BattleId));
  return (d.groupMemberCount || 0) >= ZVZ_MIN_GROUP
      || (d.numberOfParticipants || 0) >= ZVZ_MIN_GROUP;
}

/** Battle-IDs der ZvZ-Fights unserer Gilde (Masse 15–29), 12 h gecacht. */
async function guildZvzBattles(env, guildId) {
  const key = 'rb:zvz:' + guildId;
  const cached = await kvGet(env, key);
  if (cached && cached.at && Date.now() - cached.at < DEATH_TTL_MS) return cached;

  const now = Date.now();
  const from = now - 90 * 86400000;
  const url = AZ_BASE + '/api/guild-profile/battles'
    + '?server=europe'
    + '&guildId=' + encodeURIComponent(guildId)
    + '&fromMs=' + from + '&toMs=' + now
    + '&minMass=' + ZVZ_MASS_MIN + '&maxMass=' + ZVZ_MASS_MAX
    + '&massMode=guild&fetchAll=1';

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': ALBION_UA }
  });
  if (!res.ok) throw new Error('zvz battles HTTP ' + res.status);

  const data = await res.json();
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const ids = rows.map(r => r.id).filter(Boolean);
  const slim = rows.map(r => ({
    id: r.id,
    t: new Date(r.startTime).getTime(),
    end: new Date(r.endTime).getTime(),
    mass: r.mass,
    kills: r.kills,
    deaths: r.deaths,
    participants: r.totalParticipants
  }));

  const out = { at: Date.now(), ids, rows: slim, count: ids.length };
  await kvPut(env, key, out);
  return out;
}

/** Einzelnes Battle mit Spielerstatistik und Killfeed, 30 Tage gecacht (Battles sind unveränderlich). */
async function battleData(env, battleId) {
  const key = 'rb:battle2:' + battleId;
  const cached = await kvGet(env, key);
  if (cached) {
    /* Frisch beendete Battles nicht aus dem Cache bedienen: sonst bleiben
       unvollständige Zahlen (Battle lief noch) 30 Tage stehen. */
    const ended = cached.end ? new Date(cached.end).getTime() : 0;
    if (ended && Date.now() - ended > BATTLE_SETTLE_MS) return cached;
  }

  const url = AZ_BASE + '/api/dev/battle-board/battle/events?server=europe&battleId=' + battleId;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': ALBION_UA }
  });
  if (!res.ok) throw new Error('battle HTTP ' + res.status);

  const d = await res.json();
  const players = (d.playerStats || []).map(p => ({
    id: p.playerId,
    name: p.name,
    guildId: p.guildId,
    kills: p.kills || 0,
    deaths: p.deaths || 0
  }));
  const kills = (d.killFeed || []).map(k => ({
    t: k.timeStamp,
    killer: k.killer && k.killer.name ? k.killer.name : '',
    killerId: k.killer && k.killer.id ? k.killer.id : '',
    killerGuildId: k.killer && k.killer.guildId ? k.killer.guildId : '',
    killerGuild: k.killer && k.killer.guildName ? k.killer.guildName : '',
    victim: k.victim && k.victim.name ? k.victim.name : '',
    victimId: k.victim && k.victim.id ? k.victim.id : '',
    victimGuildId: k.victim && k.victim.guildId ? k.victim.guildId : '',
    weapon: k.killer && k.killer.mainHand && k.killer.mainHand.itemId ? k.killer.mainHand.itemId : '',
    ip: Math.round((k.killer && k.killer.averageItemPower) || 0)
  }));

  const out = { at: Date.now(), start: d.startTime, end: d.endTime, players, kills };
  await kvPut(env, key, out, 2592000);
  return out;
}

/** Alle ZvZ-Battles der letzten Tage mit Spieler- und Killdaten. */
async function zvzAggregate(env, guildId, days, limit) {
  const b = await guildZvzBattles(env, guildId);
  const cutoff = Date.now() - days * 86400000;
  let rows = (b.rows || []).filter(r => r.t >= cutoff).sort((a, b) => b.t - a.t);
  if (limit && rows.length > limit) rows = rows.slice(0, limit);

  const battles = [];
  for (const r of rows) {
    try {
      const bd = await battleData(env, r.id);
      battles.push({
        id: r.id,
        t: new Date(bd.start).getTime(),
        mass: r.mass,
        players: bd.players,
        kills: bd.kills
      });
    } catch (e) { /* Battle überspringen */ }
    await sleep(250);
  }
  return battles;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Todes-Erinnerung (letzte 3 Battles) ---------------------------- */

function alertKey(guild, a) {
  return 'rb:alert:' + guild + ':' + a.battleId + ':' + String(a.name || '').toLowerCase();
}

/** Spieler mit mindestens 2 Toden in den letzten 3 ZvZ-Battles. */
async function collectDeathAlerts(env, guild) {
  const battles = await zvzAggregate(env, guild, 90, ALERT_BATTLES);
  const alerts = [];
  const totals = new Map();

  battles.forEach(bt => {
    (bt.players || []).forEach(p => {
      if (p.guildId !== guild) return;

      const row = totals.get(p.name) || { name: p.name, deaths: 0, kills: 0, matches: 0 };
      row.deaths += p.deaths || 0;
      row.kills += p.kills || 0;
      totals.set(p.name, row);

      if ((p.deaths || 0) < ALERT_MIN_DEATHS) return;
      row.matches++;
      alerts.push({
        name: p.name,
        deaths: p.deaths,
        kills: p.kills || 0,
        battleId: bt.id,
        t: bt.t,
        mass: bt.mass
      });
    });
  });

  return { alerts, totals, battles: battles.length };
}

/** Eine gemeinsame Nachricht fuer alle neuen Faelle (ASCII, damit nichts kaputtgeht). */
async function sendDeathAlerts(env, fresh, totals) {
  const seen = new Set();
  const lines = [];

  for (const a of fresh) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    const t = totals.get(a.name) || { deaths: a.deaths, kills: a.kills };
    lines.push({ name: a.name, deaths: t.deaths, kills: t.kills });
  }

  if (!lines.length) return 0;
  lines.sort((x, y) => y.deaths - x.deaths || y.kills - x.kills);

  const content = '**3-ZvZs-Todes-Warnungen**\n'
    + 'In den letzten 3-ZvZs gestorben:\n'
    + lines.map(x => '- **' + x.name + '**: ' + x.deaths + ' Tode, ' + x.kills + ' Kills').join('\n');

  return notifyMods(env, content);
}

/**
 * Prüft die letzten Battles und meldet neue Mehrfach-Tode.
 * Merker pro Battle+Spieler verhindert Wiederholungen.
 */
async function checkDeathAlerts(env, guild, opts = {}) {
  const { alerts, totals, battles } = await collectDeathAlerts(env, guild);

  const fresh = [];
  for (const a of alerts) {
    if (await kvGet(env, alertKey(guild, a))) continue;
    fresh.push(a);
  }

  let sent = 0;
  if (fresh.length && opts.notify !== false) {
    sent = await sendDeathAlerts(env, fresh, totals);
    if (sent > 0) {
      for (const a of fresh) await kvPut(env, alertKey(guild, a), 1, ALERT_TTL);
    }
  }

  return { alerts, battles, total: alerts.length, fresh: fresh.length, sent };
}

/** Löscht die Merker (optional nur für einen Namen), damit ein echter Test erneut meldet. */
async function resetAlertMarks(env, guild, name) {
  const prefix = 'rb:alert:' + guild + ':';
  const list = await env.FEEDBACK_TF.list({ prefix });
  const needle = name ? ':' + name.toLowerCase() : '';
  let removed = 0;
  for (const k of list.keys) {
    if (needle && !k.name.endsWith(needle)) continue;
    await env.FEEDBACK_TF.delete(k.name);
    removed++;
  }
  return removed;
}

/** Manueller/Client-Aufruf: /alerts?guild=…&key=…[&notify=0][&force=1] */
async function handleAlerts(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const name = (url.searchParams.get('name') || '').trim();

  /* Testnachricht: zeigt das Format, ohne echte Daten anzufassen */
  if (url.searchParams.get('demo') === '1') {
    const who = (name || 'Takumoto04').slice(0, 40);
    const deaths = Math.max(2, Math.min(20, parseInt(url.searchParams.get('deaths') || '5', 10)));
    const content = '**3-ZvZs-Todes-Warnungen** (Testnachricht)\n'
      + 'In den letzten 3-ZvZs gestorben:\n'
      + '- **' + who + '**: ' + deaths + ' Tode, 1 Kill\n'
      + '\nSo sieht die echte Warnung aus. Kein echter Treffer, nichts gespeichert.';
    const sent = await notifyMods(env, content);
    return rosterJson({
      demo: true,
      sent,
      channel: !!env.DISCORD_CHANNEL_ID,
      name: who,
      deaths
    });
  }

  const guild = (url.searchParams.get('guild') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(guild)) {
    return rosterJson({ error: 'bad_guild' }, 400);
  }

  if (url.searchParams.get('force') === '1') await kvDelete(env, 'rb:zvz:' + guild);

  let reset = 0;
  if (url.searchParams.get('reset') === '1') {
    try { reset = await resetAlertMarks(env, guild, name); }
    catch (e) { reset = 0; }
  }

  let res;
  try { res = await checkDeathAlerts(env, guild, { notify: url.searchParams.get('notify') !== '0' }); }
  catch (e) { return rosterJson({ error: 'alerts_unreachable', detail: String(e && e.message || e) }, 502); }

  return rosterJson({
    guild,
    battles: res.battles,
    minDeaths: ALERT_MIN_DEATHS,
    total: res.total,
    fresh: res.fresh,
    sent: res.sent,
    reset,
    details: res.alerts.slice(0, 60).map(a => ({
      name: a.name,
      deaths: a.deaths,
      kills: a.kills,
      battleId: a.battleId,
      time: new Date(a.t).toISOString(),
      mass: a.mass
    })),
    checkedAt: new Date().toISOString()
  });
}

/* ---------- Diagnose ------------------------------------------------------ */

/** Postet eine Testnachricht und gibt Discords Antwort im Klartext zurueck. */
async function diagnoseDiscord(env) {
  if (!env.DISCORD_TOKEN) return { ok: false, error: 'DISCORD_TOKEN fehlt' };
  if (!env.DISCORD_CHANNEL_ID) return { ok: false, error: 'DISCORD_CHANNEL_ID fehlt' };
  try {
    const res = await fetch(DISCORD_API + '/channels/' + env.DISCORD_CHANNEL_ID + '/messages', {
      method: 'POST',
      headers: discordAuth(env),
      body: JSON.stringify({ content: '**Diagnose** ' + new Date().toISOString() })
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text.slice(0, 400) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/** GET /health?key=…[&send=1] – Version, Bindings, Sperren und Discord-Test. */
async function handleHealth(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const out = {
    version: WORKER_VERSION,
    channel: env.DISCORD_CHANNEL_ID || null,
    token: !!env.DISCORD_TOKEN,
    alertGuild: env.ALERT_GUILD || 'p9uAFij9ReO0BhIhHlVa8g',
    locks: [],
    discord: null,
    now: new Date().toISOString()
  };

  try {
    const list = await env.FEEDBACK_TF.list({ prefix: 'rb:notifylast:' });
    for (const k of list.keys) {
      const v = await kvGet(env, k.name);
      out.locks.push({
        key: k.name,
        at: v && v.at ? new Date(v.at).toISOString() : null,
        ageSec: v && v.at ? Math.round((Date.now() - v.at) / 1000) : null,
        hash: v && v.hash ? v.hash : null
      });
    }
  } catch (e) {
    out.locksError = String(e && e.message || e);
  }

  try {
    const logList = await env.FEEDBACK_TF.list({ prefix: 'rb:notifylog:' });
    out.logs = [];
    for (const k of logList.keys) {
      const v = await kvGet(env, k.name);
      if (Array.isArray(v)) out.logs.push({ key: k.name, entries: v.slice(0, 5) });
    }
    const qList = await env.FEEDBACK_TF.list({ prefix: 'rb:notifyq:' });
    out.queue = qList.keys.map(k => k.name);
    out.queueDetails = [];
    for (const name of out.queue) {
      const q = await kvGet(env, name);
      const scope = name.slice(('rb:notifyq:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':').length);
      const lock = await kvGet(env, 'rb:notifylast:' + (env.DISCORD_CHANNEL_ID || 'dm') + ':' + scope);
      out.queueDetails.push({
        scope,
        queuedAgeSec: q && q.at ? Math.round((Date.now() - q.at) / 1000) : null,
        lockAgeSec: lock && lock.at ? Math.round((Date.now() - lock.at) / 1000) : null,
        preview: q && q.content ? q.content.slice(0, 140) : null
      });
    }
  } catch (e) {
    out.logsError = String(e && e.message || e);
  }

  out.lastDiscord = LAST_DISCORD;

  try {
    const raw = await env.FEEDBACK_TF.get('rb:cron');
    out.cronRaw = raw || null;
    const c = raw ? JSON.parse(raw) : null;
    out.cron = c && c.at
      ? { at: new Date(c.at).toISOString(), when: c.when || null, ageSec: Math.round((Date.now() - c.at) / 1000) }
      : null;
  } catch (e) { out.cron = null; out.cronRaw = 'error: ' + String(e && e.message || e); }

  try { out.flushedNow = await flushNotifyQueue(env); }
  catch (e) { out.flushedNow = 0; }

  if (url.searchParams.get('send') === '1') out.discord = await diagnoseDiscord(env);

  return rosterJson(out);
}

async function kvGet(env, key) {
  try {
    const v = await env.FEEDBACK_TF.get(key);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}
async function kvPut(env, key, value, ttl = 43200) {
  try {
    await env.FEEDBACK_TF.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (e) { /* Cache ist optional */ }
}
async function kvDelete(env, key) {
  try { await env.FEEDBACK_TF.delete(key); } catch (e) { /* egal */ }
}

async function albionJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'The-Fallen-Roster/1.0 (+https://the-fallen-zvz.github.io/)'
      }
    });
    if (res.status === 429) { await sleep(4000); continue; }
    if (!res.ok) throw new Error('albion HTTP ' + res.status);
    return res.json();
  }
  throw new Error('albion rate limited');
}

async function guildMembers(env, guildId) {
  const key = 'rb:members:' + guildId;
  const cached = await kvGet(env, key);
  if (cached && Array.isArray(cached)) return cached;

  const list = await albionJson(ALBION_BASE + '/guilds/' + guildId + '/members');
  const slim = (list || [])
    .filter(m => m && m.Id && m.Name)
    .map(m => ({ id: m.Id, name: m.Name }));

  await kvPut(env, key, slim);
  return slim;
}

/** Todes-Ereignisse eines Spielers (Zeit + ZvZ-Flag), 12 h gecacht. */
async function playerDeaths(env, id, zvzSet) {
  const key = 'rb:deaths3:' + id;
  const cached = await kvGet(env, key);
  if (cached && cached.at && Date.now() - cached.at < DEATH_TTL_MS) return cached;

  const events = [];

  for (let offset = 0; offset < 40; offset += 10) {
    const page = await albionJson(ALBION_BASE + '/players/' + id + '/deaths?limit=10&offset=' + offset);
    if (!Array.isArray(page) || !page.length) break;
    page.forEach(d => {
      const t = new Date(d.TimeStamp).getTime();
      if (t) events.push({ t, z: isZvzEvent(d, zvzSet) ? 1 : 0 });
    });
    if (page.length < 10) break;
    await sleep(600);
  }

  const data = { at: Date.now(), events: events.sort((a, b) => b.t - a.t) };
  await kvPut(env, key, data);
  return data;
}

async function handleDeaths(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const guild = (url.searchParams.get('guild') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(guild)) {
    return rosterJson({ error: 'bad_guild' }, 400);
  }

  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10)));
  const names = (url.searchParams.get('names') || '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 60);

  const windowKey = days <= 7 ? '7d' : days <= 30 ? '30d' : days <= 90 ? '90d' : 'all';

  let gp;
  try { gp = await guildPlayers(env, guild, windowKey); }
  catch (e) { return rosterJson({ error: 'guild_players_unreachable', detail: String(e && e.message || e) }, 502); }

  const byName = new Map(gp.players.map(p => [p.name.toLowerCase(), p]));
  const players = {};
  const missing = [];
  const wanted = names.length ? names : gp.players.map(p => p.name);

  for (const n of wanted) {
    const p = byName.get(n.toLowerCase());
    if (p) {
      players[n] = {
        deaths: p.deaths,
        zvz: p.deaths,
        deaths7: windowKey === '7d' ? p.deaths : 0,
        zvz7: windowKey === '7d' ? p.deaths : 0,
        kills: p.kills,
        battles: p.battles,
        lastDays: p.lastSeen ? Math.floor((Date.now() - p.lastSeen) / 86400000) : null,
        partial: false
      };
    } else {
      players[n] = { deaths: 0, zvz: 0, deaths7: 0, zvz7: 0, kills: 0, battles: 0, lastDays: null, partial: false };
      if (names.length) missing.push(n);
    }
  }

  return rosterJson({
    guild,
    days,
    window: windowKey,
    players,
    missing,
    zvzMass: [ZVZ_MASS_MIN, ZVZ_MASS_MAX],
    source: 'guild-players'
  });
}

/* ---------- Gildenliste und Todesdetails ---------------------------------- */

async function handleGuild(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const guild = (url.searchParams.get('guild') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(guild)) {
    return rosterJson({ error: 'bad_guild' }, 400);
  }

  let members;
  try { members = await guildMembers(env, guild); }
  catch (e) { return rosterJson({ error: 'guild_unreachable', detail: String(e && e.message || e) }, 502); }

  const sorted = members.slice().sort((a, b) => a.name.localeCompare(b.name));
  return rosterJson({ guild, count: sorted.length, members: sorted });
}

/** Rohdaten eines Spielers (deaths oder kills) mit ZvZ-Flag, max. 40 Einträge. */
async function fetchPlayerEvents(env, id, kind, zvzSet) {
  const events = [];
  const seen = new Set();

  for (let offset = 0; offset < 40; offset += 10) {
    const page = await albionJson(ALBION_BASE + '/players/' + id + '/' + kind + '?limit=10&offset=' + offset);
    if (!Array.isArray(page) || !page.length) break;

    page.forEach(d => {
      const t = d.TimeStamp;
      if (!t) return;
      if (d.EventId) {
        if (seen.has(d.EventId)) return;
        seen.add(d.EventId);
      }
      const base = {
        t,
        zvz: isZvzEvent(d, zvzSet) ? 1 : 0,
        area: d.KillArea || '',
        group: d.groupMemberCount || 0,
        parts: d.numberOfParticipants || 0,
        fame: d.TotalVictimKillFame || 0,
        battleId: d.BattleId || null
      };

      if (kind === 'deaths') {
        events.push(Object.assign(base, {
          killer: d.Killer && d.Killer.Name ? d.Killer.Name : '',
          killerGuild: d.Killer && d.Killer.GuildName ? d.Killer.GuildName : '',
          killerAlliance: d.Killer && d.Killer.AllianceName ? d.Killer.AllianceName : '',
          weapon: d.Victim && d.Victim.Equipment && d.Victim.Equipment.MainHand
            ? d.Victim.Equipment.MainHand.Type : '',
          ip: Math.round((d.Victim && d.Victim.AverageItemPower) || 0)
        }));
      } else {
        events.push(Object.assign(base, {
          victim: d.Victim && d.Victim.Name ? d.Victim.Name : '',
          victimGuild: d.Victim && d.Victim.GuildName ? d.Victim.GuildName : '',
          weapon: d.Killer && d.Killer.Equipment && d.Killer.Equipment.MainHand
            ? d.Killer.Equipment.MainHand.Type : '',
          ip: Math.round((d.Killer && d.Killer.AverageItemPower) || 0)
        }));
      }
    });

    if (page.length < 10) break;
    await sleep(600);
  }

  return events;
}

/** Tode und Kills eines Spielers, 12 h gecacht. */
async function playerDeathDetail(env, id, zvzSet) {
  const key = 'rb:detail3:' + id;
  const cached = await kvGet(env, key);
  if (cached && cached.at && Date.now() - cached.at < DEATH_TTL_MS) return cached;

  const deaths = await fetchPlayerEvents(env, id, 'deaths', zvzSet);
  const kills = await fetchPlayerEvents(env, id, 'kills', zvzSet);

  const data = { at: Date.now(), deaths, kills };
  await kvPut(env, key, data);
  return data;
}

async function handleDeathDetail(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const guild = (url.searchParams.get('guild') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(guild)) {
    return rosterJson({ error: 'bad_guild' }, 400);
  }

  const name = (url.searchParams.get('name') || '').trim();
  if (!name) return rosterJson({ error: 'bad_name' }, 400);

  const windowKey = (url.searchParams.get('window') || '30d').toLowerCase();

  let members;
  try { members = await guildMembers(env, guild); }
  catch (e) { return rosterJson({ error: 'guild_unreachable', detail: String(e && e.message || e) }, 502); }

  let zvzSet = null;
  try {
    const zvz = await guildZvzBattles(env, guild);
    zvzSet = new Set(zvz.ids);
  } catch (e) { zvzSet = null; }

  const member = members.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (!member) {
    return rosterJson({ error: 'unknown_player', hint: 'Name nicht in der Gildenliste' }, 404);
  }

  let detail;
  try { detail = await playerDeathDetail(env, member.id, zvzSet); }
  catch (e) { return rosterJson({ error: 'deaths_unreachable', detail: String(e && e.message || e) }, 502); }

  /* ZvZ-Zahlen exakt aus der Players-Tabelle, Todliste aus den Battle-Killfeeds */
  let gpRow = null;
  try {
    const gp = await guildPlayers(env, guild, windowKey);
    gpRow = gp.players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  } catch (e) { gpRow = null; }

  let battles = [];
  try { battles = await zvzAggregate(env, guild, 90); } catch (e) { battles = []; }

  const nameLc = member.name.toLowerCase();
  const cutoff = windowKey === '7d' ? Date.now() - 7 * 86400000
    : windowKey === '30d' ? Date.now() - 30 * 86400000
    : windowKey === '90d' ? Date.now() - 90 * 86400000
    : 0;
  const zvzDeaths = [];
  const zvzKills = [];
  let zvzBattles = 0;
  let lastSeen = 0;

  battles.forEach(bt => {
    const stat = (bt.players || []).find(p => p.name.toLowerCase() === nameLc && p.guildId === guild);
    if (!stat) return;
    zvzBattles++;
    lastSeen = Math.max(lastSeen, bt.t);
    (bt.kills || []).forEach(k => {
      if (k.victim && k.victim.toLowerCase() === nameLc && k.victimGuildId === guild) {
        zvzDeaths.push({ t: k.t, area: 'BATTLE', killer: k.killer, killerGuild: k.killerGuild, weapon: k.weapon, ip: k.ip, zvz: 1, battleId: bt.id });
      }
      if (k.killer && k.killer.toLowerCase() === nameLc && k.killerGuildId === guild) {
        zvzKills.push({ t: k.t, area: 'BATTLE', victim: k.victim, victimGuild: k.victimGuild, weapon: k.weapon, ip: k.ip, zvz: 1, battleId: bt.id });
      }
    });
  });

  const zDeaths = cutoff ? zvzDeaths.filter(e => new Date(e.t).getTime() >= cutoff) : zvzDeaths;
  const zKills = cutoff ? zvzKills.filter(e => new Date(e.t).getTime() >= cutoff) : zvzKills;
  zDeaths.sort((a, b) => new Date(b.t) - new Date(a.t));
  zKills.sort((a, b) => new Date(b.t) - new Date(a.t));

  return rosterJson({
    guild,
    name: member.name,
    id: member.id,
    zvzMin: ZVZ_MIN_GROUP,
    zvzMass: [ZVZ_MASS_MIN, ZVZ_MASS_MAX],
    zvzCount: zvzSet ? zvzSet.size : null,
    zvzSource: 'battles',
    zvz: gpRow ? {
      window: windowKey,
      battles: gpRow.battles,
      kills: gpRow.kills,
      deaths: gpRow.deaths,
      kd: gpRow.deaths ? Math.round((gpRow.kills / gpRow.deaths) * 100) / 100 : null,
      lastDays: gpRow.lastSeen ? Math.floor((Date.now() - gpRow.lastSeen) / 86400000) : null
    } : { window: windowKey, battles: 0, kills: 0, deaths: 0, kd: null, lastDays: null },
    zvzDeaths: zDeaths.slice(0, 60),
    zvzKills: zKills.slice(0, 60),
    deaths: detail.deaths,
    kills: detail.kills,
    capped: {
      deaths: detail.deaths.length >= 40,
      kills: detail.kills.length >= 40
    },
    fetchedAt: new Date(detail.at).toISOString()
  });
}


/* ============================================================
   FETCH-HANDLER
   ============================================================ */
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ==========================================
    // 0. ROSTER-BRAIN
    // ==========================================
    if (url.pathname === '/roster') {
      try { return await handleRoster(request, env, url); }
      catch (e) { return rosterJson({ error: 'roster_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/notify') {
      try { return await handleNotify(request, env); }
      catch (e) { return rosterJson({ error: 'notify_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/deaths') {
      try { return await handleDeaths(request, env, url); }
      catch (e) { return rosterJson({ error: 'deaths_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/guild') {
      try { return await handleGuild(request, env, url); }
      catch (e) { return rosterJson({ error: 'guild_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/guildstats') {
      try { return await handleGuildStats(request, env, url); }
      catch (e) { return rosterJson({ error: 'guildstats_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/guildrecent') {
      try { return await handleGuildRecent(request, env, url); }
      catch (e) { return rosterJson({ error: 'guildrecent_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/alerts') {
      try { return await handleAlerts(request, env, url); }
      catch (e) { return rosterJson({ error: 'alerts_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/health') {
      try { return await handleHealth(request, env, url); }
      catch (e) { return rosterJson({ error: 'health_failed', detail: String(e && e.message || e) }, 500); }
    }

    if (url.pathname === '/deaths/detail') {
      try { return await handleDeathDetail(request, env, url); }
      catch (e) { return rosterJson({ error: 'detail_failed', detail: String(e && e.message || e) }, 500); }
    }

    // ==========================================
    // 1. FEEDBACK SYSTEM ROUTEN
    // ==========================================
    if (url.pathname === '/' || url.pathname === '') {
      if (request.method === 'POST') {
        const body = await request.json();

        if (!body.category || !body.subcategory || !body.message) {
          return new Response(JSON.stringify({ error: 'Fehlende Daten' }), 
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const timestamp = Date.now();
        const id = timestamp.toString();

        if (env.FEEDBACK_TF) {
          await env.FEEDBACK_TF.put(id, JSON.stringify({
            category: body.category,
            subcategory: body.subcategory,
            message: body.message,
            timestamp: timestamp
          }));
        }

        const text = '**Neues Feedback**\n'
          + '**Bereich:** ' + body.category + ' > ' + body.subcategory + '\n'
          + '**Nachricht:**\n' + String(body.message).slice(0, 1500);

        let notified = 0;
        try { notified = await notifyMods(env, text); } catch (e) { notified = 0; }

        return new Response(JSON.stringify({ success: true, notified: !!notified }), 
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'GET') {
        const providedKey = url.searchParams.get('key');

        if (providedKey !== env.MOD_KEY) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), 
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!env.FEEDBACK_TF) {
          return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const list = await env.FEEDBACK_TF.list();
        const feedbacks = [];

        for (const key of list.keys) {
          if(key.name.startsWith('content_')) continue; // Ignoriere Content-Daten
          const value = await env.FEEDBACK_TF.get(key.name);
          if (value) {
            const parsed = JSON.parse(value);
            parsed.id = key.name;
            feedbacks.push(parsed);
          }
        }

        feedbacks.sort((a, b) => b.timestamp - a.timestamp);

        return new Response(JSON.stringify(feedbacks), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ==========================================
    // 2. LIVE EDITOR ROUTEN (CUSTOM CONTENT)
    // ==========================================
    if (url.pathname === '/content') {

      // GET: Alle Custom-Inhalte abrufen (Öffentlich)
      if (request.method === 'GET') {
        if (!env.FEEDBACK_TF) {
          return new Response(JSON.stringify({}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const list = await env.FEEDBACK_TF.list({ prefix: 'content_' });
        const content = {};
        for (const key of list.keys) {
          const val = await env.FEEDBACK_TF.get(key.name);
          content[key.name.replace('content_', '')] = val;
        }
        return new Response(JSON.stringify(content), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // POST: Neuen Inhalt speichern (Auth erforderlich)
      if (request.method === 'POST') {
        const body = await request.json();
        if (body.key !== env.MOD_KEY) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (body.pageId && body.html !== undefined) {
          await env.FEEDBACK_TF.put(`content_${body.pageId}`, body.html);
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // DELETE: Inhalt zurücksetzen (Auth erforderlich)
      if (request.method === 'DELETE') {
        const body = await request.json();
        if (body.key !== env.MOD_KEY) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (body.pageId) {
          await env.FEEDBACK_TF.delete(`content_${body.pageId}`);
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Methode nicht erlaubt', { status: 405, headers: corsHeaders });
  },

  /* Cron-Trigger (z. B. alle 5 Minuten): Todes-Erinnerungen und Anmelde-Warteschlange */
  async scheduled(event, env, ctx) {
    const guild = env.ALERT_GUILD || 'p9uAFij9ReO0BhIhHlVa8g';

    /* Herzschlag zuerst und awaited, damit er auch bei knapper Laufzeit ankommt */
    try { await kvPut(env, 'rb:cron', { at: Date.now(), when: new Date().toISOString() }, 172800); }
    catch (e) { /* egal */ }
    console.log('[cron] tick ' + new Date().toISOString());

    ctx.waitUntil((async () => {
      const flushed = await flushNotifyQueue(env).catch(() => 0);
      let waiting = 0;
      try {
        const q = await env.FEEDBACK_TF.list({ prefix: 'rb:notifyq:' });
        waiting = q.keys.length;
      } catch (e) { /* egal */ }
      await logNotify(env, 'cron', { result: 'cron', flushed, waiting });
    })());

    ctx.waitUntil(checkDeathAlerts(env, guild).catch(() => {}));
  }
};
