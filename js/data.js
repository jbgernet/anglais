// Chargement du contenu : vocabulaire des cours (un fichier par séance) et aisance à l'oral.

export const DB = {
  lessons: [],      // {num, label, title, subtitle, speaking:[{q, uses}]}
  items: new Map(), // id -> item (vocabulaire et mots de liaison)
  vocab: [],        // items du vocabulaire des cours
  links: [],        // mots de liaison (id préfixé « lk- »)
  groups: [],       // fonctions des mots de liaison
  tips: [],
  pitfalls: [],
  prompts: [],
  kinds: {},
  legacy: {},       // anciens identifiants du carnet (e001…) -> identifiants actuels
};

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' : ' + r.status);
  return r.json();
}

export async function loadData() {
  const index = await getJSON('data/lessons/index.json');
  const lessons = await Promise.all(index.lessons.map((f) => getJSON('data/lessons/' + f)));
  lessons.sort((a, b) => a.num - b.num);
  for (const L of lessons) {
    DB.lessons.push({
      num: L.num,
      label: L.label || String(L.num),
      title: L.title,
      subtitle: L.subtitle || '',
      speaking: L.speaking || [],
    });
    for (const e of L.entries) {
      const known = DB.items.get(e.id);
      if (known) {
        // Une expression revue dans une autre séance : on garde une seule fiche.
        if (!known.lessons.includes(L.num)) known.lessons.push(L.num);
        (e.x || []).forEach((x) => { if (!known.x.includes(x)) known.x.push(x); });
        continue;
      }
      const it = { id: e.id, kind: 'vocab', t: e.t, d: e.d, x: (e.x || []).slice(), s: e.s || '', lessons: [L.num] };
      DB.items.set(it.id, it);
      DB.vocab.push(it);
    }
  }

  const F = await getJSON('data/fluency.json');
  for (const g of F.groups) {
    DB.groups.push({ id: g.id, title: g.title, why: g.why });
    for (const i of g.items) {
      const it = { id: 'lk-' + i.id, kind: 'link', t: i.t, d: i.d, x: i.x, g: g.id, s: g.title, lessons: [] };
      DB.items.set(it.id, it);
      DB.links.push(it);
    }
  }
  DB.tips = F.tips || [];
  DB.pitfalls = F.pitfalls || [];
  DB.prompts = F.prompts || [];
  DB.kinds = F.kinds || {};
  try { DB.legacy = await getJSON('data/legacy-ids.json'); } catch (e) { DB.legacy = {}; }
}

export const lessonOf = (n) => DB.lessons.find((l) => l.num === n);
export const groupOf = (id) => DB.groups.find((g) => g.id === id);

export function lessonName(n, withTitle = true) {
  const l = lessonOf(n);
  if (!l) return 'Cours ' + n;
  return 'Cours ' + l.label + (withTitle ? ' · ' + l.title : '');
}

// Ensemble d'items selon la source choisie : 'vocab', 'link' ou 'all', et un cours (0 = tous).
export function pool(src, lesson = 0) {
  let list = src === 'link' ? DB.links : src === 'all' ? DB.vocab.concat(DB.links) : DB.vocab;
  if (lesson && src !== 'link') list = list.filter((it) => it.kind === 'link' || it.lessons.includes(lesson));
  return list;
}

// Toutes les questions orales : sujets généraux + questions des cours.
export function allSpeakingQuestions() {
  const out = DB.prompts.map((p) => ({ id: 'p-' + p.id, q: p.q, kind: p.kind, model: p.model, uses: [], lesson: 0 }));
  DB.lessons.forEach((L) => L.speaking.forEach((s, i) => {
    out.push({ id: 'c' + L.label + '-' + (i + 1), q: s.q, kind: 'opinion', model: '', uses: s.uses || [], lesson: L.num });
  }));
  return out;
}
