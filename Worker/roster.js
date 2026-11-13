/* ============================================================================
   ROSTER-BRAIN · Worker-Erweiterung
   ----------------------------------------------------------------------------
   Einhängen in den bestehenden Worker – zwei Zeilen im fetch-Handler:

     export default {
       async fetch(request, env, ctx) {
         const url = new URL(request.url);
         if (url.pathname === '/roster') return handleRoster(request, env, url);   // <- neu
         ... bestehender Code (Feedback, /content) ...
       }
     }

   Voraussetzung: Bindung MOD_KEY existiert bereits (wird für Feedback genutzt).
   Kein KV, kein Durable Object, keine weiteren Bindings nötig.

   Route:  GET /roster?event=<64-hex-token>&key=<mod-key>
   Antwort: { event, parties, players, playstyles, fetchedAt }
   ========================================================================== */

const AZ_BASE = 'https://www.albionzvz.com';
const META_TTL_MS = 5 * 60 * 1000;      // Event-Seite (Rollen + Comp) 5 Minuten cachen
const ALLOWED_ORIGINS = [
  'https://the-fallen-zvz.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

const META_CACHE = new Map(); // token -> { at, data }  (pro Worker-Isolate)

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin)
    }
  });
}

function resolveOrigin(request) {
  const o = request.headers.get('Origin');
  if (!o) return null;                       // curl / Server
  if (o === 'null') return 'null';           // Datei direkt geöffnet
  return ALLOWED_ORIGINS.includes(o) ? o : null;
}

/* ---------- HTML der Event-Seite in JSON zerlegen ------------------------- */

function extractRsc(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { chunks.push(JSON.parse('"' + m[1] + '"')); }
    catch (e) { /* unvollständiger Chunk, überspringen */ }
  }
  return chunks.join('\n');
}

/** Schneidet ab `start` das zusammengehörige JSON-Objekt heraus. */
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

  // Rollen-Lexikon: id -> { name, playstyle }
  const roles = {};
  const roleRe = /"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})":\{"name":"([^"]+)","playstyle":"([^"]+)"\}/g;
  let m;
  while ((m = roleRe.exec(rsc)) !== null) {
    roles[m[1]] = { name: m[2], playstyle: m[3] };
  }
  if (!Object.keys(roles).length) return null;

  // Event-Objekt mit parties/players
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
      return {
        weapons,
        player: s.assignedPlayerId ? playerName(s.assignedPlayerId) : null
      };
    })
  }));

  const playstyles = {};
  Object.values(roles).forEach(r => { playstyles[r.name] = r.playstyle; });

  const roleNames = {};
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

async function loadMeta(token) {
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

async function loadRoster(token) {
  const res = await fetch(AZ_BASE + '/api/events/public/' + token + '/roster', {
    headers: { 'Accept': 'application/json' },
    cf: { cacheTtl: 0 }
  });
  if (!res.ok) throw new Error('roster HTTP ' + res.status);
  return res.json();
}

/* ---------- Route --------------------------------------------------------- */

async function handleRoster(request, env, url) {
  const origin = resolveOrigin(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin || ALLOWED_ORIGINS[0]) });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin);
  }
  if (!origin) {
    return jsonResponse({ error: 'origin_not_allowed' }, 403, null);
  }
  if (!env.MOD_KEY || url.searchParams.get('key') !== env.MOD_KEY) {
    return jsonResponse({ error: 'unauthorized' }, 401, origin);
  }

  const token = (url.searchParams.get('event') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return jsonResponse({ error: 'bad_event', hint: 'Token = die 64 Zeichen aus /e/…' }, 400, origin);
  }

  let meta, roster;
  try {
    meta = await loadMeta(token);
  } catch (e) {
    return jsonResponse({ error: 'event_unreachable', detail: String(e && e.message || e) }, 502, origin);
  }
  try {
    roster = await loadRoster(token);
  } catch (e) {
    return jsonResponse({ error: 'roster_unreachable', detail: String(e && e.message || e) }, 502, origin);
  }

  // Spieler aus dem Live-Roster; Rollen-IDs -> Namen über das Lexikon der Seite.
  const players = (roster.players || [])
    .filter(p => p && p.signedUp)
    .map(p => ({
      name: p.displayName,
      prefs: (p.preferenceRoleIds || []).filter(Boolean).map(id => meta.roleNames[id] || null).filter(Boolean),
      tentative: !!p.isTentative,
      note: p.comment || ''
    }));

  return jsonResponse({
    event: meta.event,
    parties: meta.parties,
    playstyles: meta.playstyles,
    players,
    fetchedAt: new Date().toISOString()
  }, 200, origin);
}
