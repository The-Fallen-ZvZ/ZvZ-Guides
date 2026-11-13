/* ============================================================================
   ROSTER-BRAIN · Worker-Erweiterung
   ----------------------------------------------------------------------------
   Zwei Routen, beide mit Mod-Key:

     GET  /roster?event=<64-hex>&key=<mod-key>
          -> { event, parties, players, playstyles, fetchedAt }

     POST /notify   { key, event, changes:[{name,role}], link }
          -> Discord-DM an DISCORD_USER_ID (mehrere per Komma)

     POST /notify   { key, type:'pin', link }
          -> postet den Link in DISCORD_CHANNEL_ID und pinnt ihn

     GET  /deaths?guild=<id>&names=A,B,C&days=30&key=<mod-key>
          -> { players: { Name: { deaths, deaths7, lastDays, partial } }, missing: [] }
          Nutzt die offizielle Albion-API (EU) und den vorhandenen KV als Cache.

   Einhängen in den bestehenden Worker – im fetch-Handler:

     const url = new URL(request.url);
     if (url.pathname === '/roster') return handleRoster(request, env, url);
     if (url.pathname === '/notify') return handleNotify(request, env, url);

   Voraussetzungen:
     - MOD_KEY            (vorhanden)
     - DISCORD_TOKEN      (vorhanden)
     - DISCORD_USER_ID    (vorhanden, Komma-getrennt erlaubt)
     - DISCORD_CHANNEL_ID (optional, nur fürs Anpinnen)

   Kein KV, kein Durable Object.
   ========================================================================== */

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

/* ---------- Routen -------------------------------------------------------- */

async function handleRoster(request, env, url) {
  if (request.method !== 'GET') return rosterJson({ error: 'method_not_allowed' }, 405);
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return rosterJson({ error: 'unauthorized' }, 401);
  }

  const token = (url.searchParams.get('event') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return rosterJson({ error: 'bad_event', hint: 'Token = die 64 Zeichen aus /e/...' }, 400);
  }

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

  const auth = {
    'Authorization': 'Bot ' + env.DISCORD_TOKEN,
    'Content-Type': 'application/json'
  };

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

  /* Änderungen als DM */
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 25) : [];
  if (!changes.length) return rosterJson({ error: 'no_changes' }, 400);

  const eventTitle = String(body.event || '').slice(0, 80);
  const lines = changes.map(c => {
    const name = String(c.name || '').slice(0, 40);
    const role = String(c.role || '').slice(0, 60);
    return role === '—'
      ? '**' + name + '** hat den Slot verlassen'
      : 'Anmeldung von: **' + name + '** → ' + role;
  });

  let content = '**Roster-Update**' + (eventTitle ? ' · ' + eventTitle : '') + '\n'
    + lines.join('\n')
    + '\n\nManuell anpassen: ' + link;
  if (content.length > 1900) content = content.slice(0, 1870) + '\n… (gekürzt)';

  const ids = String(env.DISCORD_USER_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return rosterJson({ error: 'no_recipient', hint: 'DISCORD_USER_ID fehlt' }, 400);

  let sent = 0;
  for (const id of ids) {
    try {
      const dm = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ recipient_id: id })
      });
      if (!dm.ok) continue;
      const ch = await dm.json();
      const msg = await fetch('https://discord.com/api/v10/channels/' + ch.id + '/messages', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ content })
      });
      if (msg.ok) sent++;
    } catch (e) { /* nächster Empfänger */ }
  }

  return rosterJson({ ok: true, sent });
}

/* ============================================================================
   TODE / AKTIVITAET  (offizielle Albion-API, EU)
   GET /deaths?guild=<id>&names=A,B,C&days=30&key=<mod-key>
   ========================================================================== */

const ALBION_BASE = 'https://gameinfo-ams.albiononline.com/api/gameinfo';
const DEATH_TTL_MS = 12 * 60 * 60 * 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function kvGet(env, key) {
  try {
    const v = await env.FEEDBACK_TF.get(key);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}
async function kvPut(env, key, value) {
  try {
    await env.FEEDBACK_TF.put(key, JSON.stringify(value), { expirationTtl: 43200 });
  } catch (e) { /* Cache ist optional */ }
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

/** Todes-Zeitstempel eines Spielers, 12 h gecacht. */
async function playerDeaths(env, id) {
  const key = 'rb:deaths:' + id;
  const cached = await kvGet(env, key);
  if (cached && cached.at && Date.now() - cached.at < DEATH_TTL_MS) return cached;

  const cutoff = Date.now() - 35 * 86400000;
  const stamps = [];

  // maximal zwei Seiten (20 Tode); reicht fuer 30-Tage-Zaehlung in der Praxis
  for (let offset = 0; offset < 20; offset += 10) {
    const page = await albionJson(ALBION_BASE + '/players/' + id + '/deaths?limit=10&offset=' + offset);
    if (!Array.isArray(page) || !page.length) break;
    page.forEach(d => {
      const t = new Date(d.TimeStamp).getTime();
      if (t) stamps.push(t);
    });
    if (page.length < 10) break;
    if (stamps.length && Math.min.apply(null, stamps) < cutoff) break;
    await sleep(600);
  }

  const data = { at: Date.now(), stamps: stamps.slice().sort((a, b) => b - a) };
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

  let members;
  try { members = await guildMembers(env, guild); }
  catch (e) { return rosterJson({ error: 'guild_unreachable', detail: String(e && e.message || e) }, 502); }

  const byName = new Map(members.map(m => [m.name.toLowerCase(), m]));
  const targets = [];
  const missing = [];

  if (names.length) {
    for (const n of names) {
      const m = byName.get(n.toLowerCase());
      if (m) targets.push({ name: n, m });
      else missing.push(n);
    }
  } else {
    members.forEach(m => targets.push({ name: m.name, m }));
  }

  const cutoff = Date.now() - days * 86400000;
  const cutoffWeek = Date.now() - Math.min(days, 7) * 86400000;
  const players = {};

  for (const t of targets) {
    try {
      const d = await playerDeaths(env, t.m.id);
      const recent = d.stamps.filter(x => x >= cutoff);
      const week = d.stamps.filter(x => x >= cutoffWeek);
      const last = d.stamps.length ? d.stamps[0] : 0;

      players[t.name] = {
        deaths: recent.length,
        deaths7: week.length,
        lastDays: last ? Math.floor((Date.now() - last) / 86400000) : null,
        partial: d.stamps.length >= 10 && (!last || (Date.now() - last) < cutoff)
      };
    } catch (e) {
      missing.push(t.name);
    }
    await sleep(700); // API drosselt; 700 ms ist getestet
  }

  return rosterJson({ guild, days, players, missing });
}
