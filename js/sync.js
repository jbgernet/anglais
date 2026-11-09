// Synchronisation de la progression entre appareils, via un Gist privé du compte GitHub.
// Le jeton reste sur l'appareil ; il ne sert qu'à lire et écrire ce Gist.

import { payload, merge, onChange } from './store.js';

const API = 'https://api.github.com';
const FILE = 'anglais-progression.json';
const DESC = "Carnet d'anglais · progression (ne pas supprimer)";
const KEY = 'anglais-sync-v1';

export const sync = { token: '', gist: '', login: '', last: 0, state: 'off', error: '' };
let dirty = false, busy = false, again = false, timer = null;

const subs = new Set();
export const onSync = (fn) => subs.add(fn);
function emit() { subs.forEach((fn) => fn(sync)); }

function loadCfg() {
  try { Object.assign(sync, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* rien */ }
  sync.state = sync.token && sync.gist ? 'idle' : 'off';
  sync.error = '';
}
function saveCfg() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token: sync.token, gist: sync.gist, login: sync.login, last: sync.last }));
  } catch (e) { /* rien */ }
}

class SyncError extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}

async function gh(path, opts = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + sync.token,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body,
      keepalive: !!opts.keepalive,
      cache: 'no-store',
    });
  } catch (e) {
    throw new SyncError('Pas de connexion à GitHub pour le moment.', 'offline');
  }
  if (r.status === 401) throw new SyncError('GitHub refuse ce jeton : il est peut-être expiré ou mal copié.', 'auth');
  if (r.status === 403) throw new SyncError('Ce jeton n’a pas le droit d’écrire des Gists : cochez « gist » en le créant.', 'scope');
  if (r.status === 404) throw new SyncError('Le Gist de sauvegarde est introuvable.', 'missing');
  if (!r.ok) throw new SyncError('GitHub a répondu ' + r.status + '. Réessayez dans un moment.', 'http');
  return r.status === 204 ? null : r.json();
}

async function readRemote() {
  const g = await gh('/gists/' + sync.gist);
  const f = g.files && g.files[FILE];
  if (!f) return null;
  let text = f.content;
  if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url)).text();
  try { return JSON.parse(text); } catch (e) { return null; }
}

function writeRemote(keepalive = false) {
  return gh('/gists/' + sync.gist, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(payload()) } } }),
    keepalive,
  });
}

// Branche cet appareil : vérifie le jeton, retrouve le Gist existant ou le crée.
export async function connect(token) {
  const prev = { ...sync };
  sync.token = token.trim();
  sync.gist = '';
  sync.state = 'busy'; emit();
  try {
    const me = await gh('/user');
    sync.login = me.login || '';
    let found = null;
    for (let page = 1; page <= 5 && !found; page++) {
      const list = await gh('/gists?per_page=100&page=' + page);
      found = list.find((g) => g.files && g.files[FILE]);
      if (list.length < 100) break;
    }
    if (found) {
      sync.gist = found.id;
      const remote = await readRemote();
      merge(remote || {}, 'remote');
      await writeRemote();
    } else {
      const g = await gh('/gists', {
        method: 'POST',
        body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(payload()) } } }),
      });
      sync.gist = g.id;
    }
    sync.last = Date.now();
    sync.state = 'ok'; sync.error = '';
    dirty = false;
    saveCfg(); emit();
    return !!found;
  } catch (e) {
    Object.assign(sync, prev, { state: prev.token ? prev.state : 'off', error: e.message });
    emit();
    throw e;
  }
}

export function disconnect() {
  sync.token = ''; sync.gist = ''; sync.login = ''; sync.last = 0;
  sync.state = 'off'; sync.error = '';
  dirty = false;
  saveCfg(); emit();
}

// Récupère, fusionne, et renvoie si l'appareil a du nouveau.
export async function syncNow() {
  if (!sync.token || !sync.gist) return;
  if (busy) { again = true; return; }
  busy = true;
  sync.state = 'busy'; emit();
  try {
    const remote = await readRemote();
    const localNewer = remote ? merge(remote, 'remote') : true;
    if (localNewer || dirty) {
      dirty = false;
      await writeRemote();
    }
    sync.last = Date.now();
    sync.state = 'ok'; sync.error = '';
    saveCfg();
  } catch (e) {
    sync.state = 'error'; sync.error = e.message;
    if (e.code !== 'offline') dirty = true;
  } finally {
    busy = false;
    emit();
    if (again) { again = false; schedule(500); }
  }
}

function schedule(ms = 3000) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

export function initSync() {
  loadCfg();
  onChange((origin) => {
    if (origin === 'remote' || !sync.token) return;
    dirty = true;
    schedule();
  });
  document.addEventListener('visibilitychange', () => {
    if (!sync.token || !sync.gist) return;
    if (document.visibilityState === 'hidden') {
      if (dirty) {
        clearTimeout(timer);
        dirty = false;
        writeRemote(true).catch(() => { dirty = true; });
      }
    } else {
      schedule(300);
    }
  });
  window.addEventListener('online', () => { if (sync.token) schedule(300); });
  emit();
  if (sync.token && sync.gist) schedule(200);
}
