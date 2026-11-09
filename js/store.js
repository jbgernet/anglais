// Progression : statut de chaque expression, priorités, activité par jour.
// Tout est gardé sur l'appareil (localStorage) et fusionné avec le Gist par sync.js.

import { DB } from './data.js';
import { todayKey } from './util.js';

const KEY = 'anglais-progression-v1';
const DAY = 864e5;
export const INTERVALS = [0, 1, 3, 7, 21]; // jours avant la prochaine révision, par palier

export const S = {
  p: {},   // id -> {b: palier (-1 nouveau … 4 retenu), due, n, ok, t}
  pr: {},  // id -> {v: 'must'|'nice'|'low'|null, t}
  act: {}, // 'AAAA-MM-JJ' -> nombre de réponses ce jour-là
  settings: { voice: '', rate: 0.95, size: 10 }, // propre à l'appareil, non synchronisé
};

export const STATUS_LABEL = { new: 'Nouveau', review: 'À revoir', learning: 'En cours', mastered: 'Retenu' };
export const STATUS_ORDER = ['new', 'review', 'learning', 'mastered'];
export const PRI = { must: 'Incontournable', nice: 'Si possible', low: 'Peu probable' };
export const PRI_ORDER = ['must', 'nice', 'low'];
const PRI_RANK = { must: 0, nice: 1, none: 2, low: 3 };

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
function emit(origin) { listeners.forEach((fn) => fn(origin)); }

export function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o) {
      S.p = o.p || {};
      S.pr = o.pr || {};
      S.act = o.act || {};
      Object.assign(S.settings, o.settings || {});
    }
  } catch (e) { /* stockage indisponible : on travaille en mémoire */ }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* idem */ }
}

function changed() { save(); emit('local'); }

export function saveSettings(patch) {
  Object.assign(S.settings, patch);
  save();
}

// ---------- statut et révision espacée ----------
export function box(id) { const r = S.p[id]; return r ? r.b : -1; }

export function status(id) {
  const b = box(id);
  if (b < 0) return 'new';
  if (b <= 1) return 'review';
  if (b <= 3) return 'learning';
  return 'mastered';
}

export function isDue(id) {
  const r = S.p[id];
  return !!r && r.b >= 0 && r.due <= Date.now();
}

function setRec(id, b) {
  const now = Date.now();
  const r = S.p[id] || { n: 0, ok: 0 };
  S.p[id] = { b, due: b < 0 ? 0 : now + INTERVALS[b] * DAY, n: r.n || 0, ok: r.ok || 0, t: now };
}

export function setStatus(id, st) {
  setRec(id, st === 'new' ? -1 : st === 'review' ? 0 : 4);
  changed();
}

// result : 'ko' raté · 'mid' hésitant · 'up' reconnu (QCM, relier) · 'ok' su de mémoire
export function grade(id, result) {
  const now = Date.now();
  const r = S.p[id] || { b: -1, n: 0, ok: 0 };
  let b = r.b;
  if (result === 'ko') b = 0;
  else if (result === 'mid') b = b < 0 ? 1 : Math.max(1, Math.min(b, 3));
  else if (result === 'up') b = b < 0 ? 1 : b >= 4 ? 4 : Math.min(b + 1, 3);
  else b = b < 0 ? 2 : Math.min(b + 1, 4);
  S.p[id] = { b, due: now + INTERVALS[b] * DAY, n: (r.n || 0) + 1, ok: (r.ok || 0) + (result === 'ko' ? 0 : 1), t: now };
  const k = todayKey();
  S.act[k] = (S.act[k] || 0) + 1;
  changed();
}

// ---------- priorité (utilité) ----------
export function priOf(id) { const r = S.pr[id]; return r && PRI[r.v] ? r.v : null; }
export function priRank(id) { return PRI_RANK[priOf(id) || 'none']; }
export function setPri(id, v) { S.pr[id] = { v, t: Date.now() }; changed(); }
export function hasPri(items) { return items.some((it) => priOf(it.id)); }

// ---------- chiffres ----------
export function counts(items) {
  const c = { new: 0, review: 0, learning: 0, mastered: 0, due: 0, total: items.length };
  items.forEach((it) => { c[status(it.id)]++; if (isDue(it.id)) c.due++; });
  return c;
}

export function streak() {
  let n = 0;
  const d = new Date();
  if (!S.act[todayKey(d)]) d.setDate(d.getDate() - 1); // la série n'est pas perdue avant ce soir
  while (S.act[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- sauvegarde et fusion ----------
export function payload() {
  return { app: 'anglais', v: 1, p: S.p, pr: S.pr, act: S.act, at: Date.now() };
}

function mergeInto(local, remote) {
  let localNewer = false;
  for (const id in remote) {
    const r = remote[id], l = local[id];
    if (!l || (r.t || 0) > (l.t || 0)) local[id] = r;
    else if ((l.t || 0) > (r.t || 0)) localNewer = true;
  }
  for (const id in local) if (!(id in remote)) localNewer = true;
  return localNewer;
}

// Fusionne une progression venue d'ailleurs (Gist, fichier, ancien carnet).
// Renvoie true si l'appareil a des informations que l'autre côté n'a pas.
export function merge(remote, origin = 'remote') {
  if (!remote || typeof remote !== 'object') return false;
  const fixed = fromLegacy(remote);
  let localNewer = mergeInto(S.p, fixed.p || {});
  localNewer = mergeInto(S.pr, fixed.pr || {}) || localNewer;
  const act = fixed.act || {};
  for (const k in act) S.act[k] = Math.max(S.act[k] || 0, act[k] || 0);
  for (const k in S.act) if ((S.act[k] || 0) > (act[k] || 0)) localNewer = true;
  save();
  emit(origin);
  return localNewer;
}

// L'ancien carnet (artefact) utilisait des identifiants e001, e002… : on les traduit.
function fromLegacy(o) {
  const map = DB.legacy || {};
  const conv = (obj) => {
    if (!obj) return obj;
    const out = {};
    for (const id in obj) out[map[id] || id] = obj[id];
    return out;
  };
  const looksLegacy = Object.keys(o.p || {}).concat(Object.keys(o.pr || {})).some((id) => /^e\d{3}$/.test(id));
  return looksLegacy ? { p: conv(o.p), pr: conv(o.pr), act: o.act } : o;
}
