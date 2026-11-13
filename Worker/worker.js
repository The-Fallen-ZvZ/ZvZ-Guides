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
         GET  /deaths/detail?guild=<id>&name=<name>&key=<mod-key>

   Bindings:
     MOD_KEY            (Pflicht, Moderatoren-Key)
     DISCORD_TOKEN      (Pflicht für DM/Pin)
     DISCORD_USER_ID    (Pflicht, Komma-getrennt erlaubt)
     DISCORD_CHANNEL_ID (optional, nur fürs Anpinnen)
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

/* ---------- Tode / Aktivität (offizielle Albion-API) ---------------------- */

const ALBION_BASE = 'https://gameinfo-ams.albiononline.com/api/gameinfo';
const DEATH_TTL_MS = 12 * 60 * 60 * 1000;
const ZVZ_MIN_GROUP = 10;   // Fallback, falls die Battle-Liste nicht erreichbar ist
const ZVZ_MASS_MIN = 15;    // unsere typische ZvZ-Größe
const ZVZ_MASS_MAX = 29;
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

  const out = { at: Date.now(), ids, count: ids.length };
  await kvPut(env, key, out);
  return out;
}

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

/** Todes-Ereignisse eines Spielers (Zeit + ZvZ-Flag), 12 h gecacht. */
async function playerDeaths(env, id, zvzSet) {
  const key = 'rb:deaths2:' + id;
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

  let members;
  try { members = await guildMembers(env, guild); }
  catch (e) { return rosterJson({ error: 'guild_unreachable', detail: String(e && e.message || e) }, 502); }

  let zvzSet = null;
  try {
    const zvz = await guildZvzBattles(env, guild);
    zvzSet = new Set(zvz.ids);
  } catch (e) { zvzSet = null; }

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
      const d = await playerDeaths(env, t.m.id, zvzSet);
      const recent = d.events.filter(x => x.t >= cutoff);
      const week = d.events.filter(x => x.t >= cutoffWeek);
      const last = d.events.length ? d.events[0].t : 0;

      players[t.name] = {
        deaths: recent.length,
        zvz: recent.filter(x => x.z).length,
        deaths7: week.length,
        zvz7: week.filter(x => x.z).length,
        lastDays: last ? Math.floor((Date.now() - last) / 86400000) : null,
        partial: d.events.length >= 40 && !!last && last >= cutoff
      };
    } catch (e) {
      missing.push(t.name);
    }
    await sleep(700);
  }

  return rosterJson({
    guild,
    days,
    players,
    missing,
    zvzBattles: zvzSet ? zvzSet.size : null,
    zvzMass: [ZVZ_MASS_MIN, ZVZ_MASS_MAX]
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

  for (let offset = 0; offset < 40; offset += 10) {
    const page = await albionJson(ALBION_BASE + '/players/' + id + '/' + kind + '?limit=10&offset=' + offset);
    if (!Array.isArray(page) || !page.length) break;

    page.forEach(d => {
      const t = d.TimeStamp;
      if (!t) return;
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
  const key = 'rb:detail2:' + id;
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

  return rosterJson({
    guild,
    name: member.name,
    id: member.id,
    zvzMin: ZVZ_MIN_GROUP,
    zvzMass: [ZVZ_MASS_MIN, ZVZ_MASS_MAX],
    zvzCount: zvzSet ? zvzSet.size : null,
    zvzSource: zvzSet ? 'battles' : 'group',
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

        const discordPayload = {
          content: `**Neues Feedback!**\n**Bereich:** ${body.category} > ${body.subcategory}\n**Nachricht:**\n${body.message}`
        };

        const discordResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient_id: env.DISCORD_USER_ID.split(',')[0] })
        });

        if (!discordResponse.ok) {
          throw new Error("Discord DM konnte nicht gesendet werden.");
        }

        const dmChannel = await discordResponse.json();

        await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(discordPayload)
        });

        return new Response(JSON.stringify({ success: true }), 
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
  }
};
