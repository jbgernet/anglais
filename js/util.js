// Petites fonctions partagées par toute l'app.

export const $ = (s, r = document) => r.querySelector(s);

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function clear(n) {
  while (n.firstChild) n.removeChild(n.firstChild);
  return n;
}

export function button(label, cls, onClick) {
  const b = el('button', cls || 'btn', label);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export function link(label, href, cls) {
  const a = el('a', cls || 'btn', label);
  a.href = href;
  return a;
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const plural = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
export const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Forme exacte de l'expression dans une phrase d'exemple : « … [[forme]] … »
export function formOf(x) {
  const m = /\[\[(.+?)\]\]/.exec(x);
  return m ? m[1] : '';
}
export const plainEx = (x) => x.replace(/\[\[|\]\]/g, '');

// Phrase d'exemple : 'show' surligne l'expression, 'blank' la remplace par un trou.
export function exNode(x, mode = 'show', cls = 'ex') {
  const p = el('p', cls);
  const m = /^(.*?)\[\[(.+?)\]\](.*)$/.exec(x);
  if (!m) { p.textContent = x; return p; }
  p.append(m[1]);
  if (mode === 'blank') {
    const b = el('span', 'blank');
    b.style.minWidth = Math.min(Math.max(m[2].length, 6), 24) + 'ch';
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', 'mot manquant');
    p.append(b);
  } else {
    p.append(el('mark', null, m[2]));
  }
  p.append(m[3]);
  return p;
}

// Normalise une réponse tapée pour la comparer à l'expression attendue.
export function canon(s) {
  return String(s).toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z' -]/g, ' ')
    .replace(/\b(sb|sth|someone|something|somebody)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// Choix stable pour la journée (même mot du jour toute la journée).
export function dailyPick(list, salt = '') {
  if (!list.length) return null;
  const s = todayKey() + salt;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

let toastTimer = null;
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

export function announce(msg) {
  const n = $('#live');
  if (n) n.textContent = msg;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

export function chipGroup(host, items, current, onPick, label) {
  clear(host);
  if (label) host.setAttribute('aria-label', label);
  host.setAttribute('role', 'group');
  items.forEach((it) => {
    const b = button(it.label, 'chip');
    b.setAttribute('aria-pressed', String(it.value === current));
    b.addEventListener('click', () => onPick(it.value));
    host.append(b);
  });
  return host;
}

export function selectField(id, label, options, value, onChange) {
  const f = el('div', 'field');
  const l = el('label', null, label);
  l.htmlFor = id;
  const s = el('select');
  s.id = id;
  options.forEach(([v, t]) => {
    const o = el('option', null, t);
    o.value = String(v);
    if (String(v) === String(value)) o.selected = true;
    s.append(o);
  });
  if (onChange) s.addEventListener('change', () => onChange(s.value));
  f.append(l, s);
  return { field: f, select: s, label: l };
}

// Icônes au trait (SVG inline), couleur = currentColor.
const ICONS = {
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 7h6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8"/>',
  bubble: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  claude: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
};
export function icon(name, cls = 'ico') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', cls);
  s.innerHTML = ICONS[name] || '';
  return s;
}
