// Exercices : choix de la source, puis séries de questions de difficulté croissante.

import { DB, pool, lessonName } from './data.js';
import { S, status, isDue, box, priRank, grade, hasPri, counts, saveSettings, STATUS_LABEL } from './store.js';
import { el, button, link, clear, shuffle, cap1, exNode, formOf, canon, chipGroup, selectField, announce, plural } from './util.js';
import { speak, speakBtn, tts } from './speech.js';

export const LEVELS = [
  { n: 1, label: 'Reconnaître', hint: 'Pour découvrir les expressions et les fixer en mémoire.' },
  { n: 2, label: 'Comprendre', hint: 'Vous les reconnaissez : vérifiez que le sens est clair.' },
  { n: 3, label: 'Retrouver', hint: 'Les faire revenir de mémoire, puis en contexte.' },
  { n: 4, label: 'Produire', hint: 'Les écrire vous-même, comme à l’oral.' },
];

export const TYPES = [
  { id: 'relier', level: 1, label: 'Relier', desc: 'Cinq expressions, cinq définitions : associez-les.' },
  { id: 'ecouter', level: 1, label: 'Écouter', desc: 'Entendez une expression et choisissez son sens.', tts: true },
  { id: 'sens', level: 2, label: 'Deviner le sens', desc: 'Voyez l’expression, rappelez-vous son sens, puis vérifiez.' },
  { id: 'qcm', level: 2, label: 'Quelle expression ?', desc: 'Une définition, quatre expressions : choisissez la bonne.' },
  { id: 'deviner', level: 3, label: 'Deviner l’expression', desc: 'Voyez la définition et retrouvez l’expression de mémoire.' },
  { id: 'trous', level: 3, label: 'Phrases à trous', desc: 'Choisissez l’expression qui complète la phrase.' },
  { id: 'ecrire', level: 4, label: 'Écrire', desc: 'Tapez l’expression qui manque dans la phrase.' },
  { id: 'test', level: 4, label: 'Test mixte', desc: 'Des questions variées, corrigées, avec un score.' },
];
const typeOf = (id) => TYPES.find((t) => t.id === id);
const itemOf = (id) => DB.items.get(id);

const SRC = [
  { value: 'vocab', label: 'Vocabulaire des cours' },
  { value: 'link', label: 'Mots de liaison' },
  { value: 'all', label: 'Les deux' },
];

function cfg() {
  return {
    src: S.settings.exSrc || 'vocab',
    lesson: Number(S.settings.exLesson) || 0,
    size: Number(S.settings.size) || 10,
  };
}

// ---------- choix des expressions ----------
// D'abord celles à revoir aujourd'hui et les nouvelles, par utilité ; on complète avec les moins connues.
function buildQueue(items, size) {
  const cand = shuffle(items.filter((it) => isDue(it.id) || status(it.id) === 'new'));
  cand.sort((a, b) => {
    const da = isDue(a.id), db = isDue(b.id);
    return priRank(a.id) - priRank(b.id) || (db - da) || (da && db ? S.p[a.id].due - S.p[b.id].due : 0);
  });
  let q = cand.slice(0, size);
  if (q.length < size) {
    const taken = new Set(q.map((it) => it.id));
    const rest = shuffle(items.filter((it) => !taken.has(it.id)));
    rest.sort((a, b) => (status(a.id) === 'mastered') - (status(b.id) === 'mastered')
      || priRank(a.id) - priRank(b.id) || box(a.id) - box(b.id));
    q = q.concat(rest.slice(0, size - q.length));
  }
  return q.map((it) => it.id);
}

// Mauvaises réponses plausibles. Pour les mots de liaison, jamais un synonyme de la même famille.
function distractors(it, n, key) {
  const near = it.kind === 'link'
    ? DB.links.filter((o) => o.g !== it.g)
    : DB.vocab.filter((o) => o.id !== it.id && o.lessons.some((l) => it.lessons.includes(l)));
  const far = it.kind === 'link' ? [] : DB.vocab.filter((o) => o.id !== it.id);
  const seen = new Set([canon(it[key])]);
  const out = [];
  for (const o of shuffle(near).concat(shuffle(far))) {
    const k = canon(o[key]);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o.id);
    if (out.length >= n) break;
  }
  return out;
}

function question(id, kind) {
  const it = itemOf(id);
  const q = { id, kind, ex: it.x.length ? it.x[Math.floor(Math.random() * it.x.length)] : '' };
  if (kind === 'qcm' || kind === 'trous') q.opts = shuffle([id].concat(distractors(it, 3, 't')));
  if (kind === 'inverse' || kind === 'ecouter') q.opts = shuffle([id].concat(distractors(it, 3, 'd')));
  if ((kind === 'trous' || kind === 'ecrire') && !q.ex) q.kind = kind === 'trous' ? 'qcm' : 'deviner';
  return q;
}

// Groupes de 5 pour « Relier », sans deux synonymes dans le même groupe.
function rounds(ids) {
  const k = Math.max(1, Math.ceil(ids.length / 5));
  const cap = Math.ceil(ids.length / k);
  const out = Array.from({ length: k }, () => []);
  const clash = (g, it) => it.g && g.some((o) => itemOf(o).g === it.g);
  ids.forEach((id) => {
    const it = itemOf(id);
    let r = out.find((g) => g.length < cap && !clash(g, it)) || out.find((g) => g.length < 5 && !clash(g, it));
    if (!r) { r = []; out.push(r); }
    r.push(id);
  });
  return out.filter((g) => g.length);
}

// ---------- séance ----------
let X = null;

export function startExercise(type, opts = {}) {
  if (opts.src) saveSettings({ exSrc: opts.src });
  if (opts.lesson != null) saveSettings({ exLesson: opts.lesson });
  const c = cfg();
  const ids = opts.ids || buildQueue(pool(c.src, c.lesson), c.size);
  X = { type, ids, i: 0, first: {}, retries: {}, done: false, answered: false, picked: -1, typed: null, pending: null, shown: false };
  if (type === 'relier') {
    X.rounds = rounds(ids);
    X.gi = 0;
    X.miss = {};
    startRound();
  } else {
    const kinds = { ecouter: 'ecouter', sens: 'sens', qcm: 'qcm', deviner: 'deviner', trous: 'trous', ecrire: 'ecrire' };
    const mix = ['qcm', 'trous', 'inverse', 'ecrire'];
    X.queue = ids.map((id, n) => question(id, type === 'test' ? mix[n % mix.length] : kinds[type]));
  }
  return X;
}

function startRound() {
  const ids = X.rounds[X.gi];
  X.termOrder = shuffle(ids);
  X.defOrder = shuffle(ids);
  X.matched = {};
  X.selT = null; X.selD = null; X.flash = null; X.lock = false; X.pairs = 0; X.focusId = null;
}

// ---------- page « Exercices » ----------
export function renderExercises(view, sub, rerender) {
  if (sub && typeOf(sub)) {
    if (!X || X.type !== sub) startExercise(sub);
    return renderSession(view, rerender);
  }
  X = null;
  renderHub(view, rerender);
}

function renderHub(view, rerender) {
  const c = cfg();
  view.append(el('h1', 'page-title', 'Exercices'));
  view.append(el('p', 'lead', 'Choisissez sur quoi travailler, puis un exercice. Les niveaux vont du plus facile au plus exigeant : commencez par reconnaître, finissez par produire.'));

  const setup = el('section', 'panel setup');
  const srcHost = el('div', 'chips');
  chipGroup(srcHost, SRC, c.src, (v) => { saveSettings({ exSrc: v }); rerender(); }, 'Source');
  setup.append(srcHost);
  const grid = el('div', 'setup-grid');
  if (c.src !== 'link') {
    const lessonSel = selectField('ex-lesson', 'Cours',
      [[0, 'Tous les cours']].concat(DB.lessons.map((l) => [l.num, lessonName(l.num)])), c.lesson,
      (v) => { saveSettings({ exLesson: Number(v) }); rerender(); });
    grid.append(lessonSel.field);
  }
  const sizeSel = selectField('ex-size', 'Nombre d’expressions', [[5, '5'], [10, '10'], [20, '20']], c.size,
    (v) => { saveSettings({ size: Number(v) }); rerender(); });
  grid.append(sizeSel.field);
  setup.append(grid);

  const items = pool(c.src, c.lesson);
  const n = counts(items);
  const avail = el('p', 'avail');
  avail.append(el('b', null, String(n.due)), ' à revoir aujourd’hui · ', el('b', null, String(n.new)), ' nouvelles · ',
    el('b', null, String(n.mastered)), ' retenues sur ' + n.total);
  setup.append(avail);
  if (hasPri(items)) setup.append(el('p', 'note', 'Ordre : vos incontournables d’abord, puis « si possible », les non notées, et « peu probable » en dernier. Une expression retenue revient seulement dans trois semaines.'));
  view.append(setup);

  LEVELS.forEach((L) => {
    const sec = el('section', 'level');
    const h = el('h2', 'level-title');
    h.append(el('span', 'level-n', String(L.n)), L.label);
    sec.append(h, el('p', 'level-hint', L.hint));
    const list = el('div', 'type-list');
    TYPES.filter((t) => t.level === L.n).forEach((t) => {
      const a = el('a', 'type-card');
      a.href = '#/exercices/' + t.id;
      const disabled = t.tts && !tts.ok;
      if (disabled) { a.removeAttribute('href'); a.classList.add('off'); a.setAttribute('aria-disabled', 'true'); }
      a.append(el('b', null, t.label), el('span', null, disabled ? 'Votre navigateur ne sait pas lire l’anglais à voix haute.' : t.desc));
      a.addEventListener('click', () => { if (!disabled) startExercise(t.id); });
      list.append(a);
    });
    sec.append(list);
    view.append(sec);
  });
}

// ---------- déroulé d'une série ----------
function renderSession(view, rerender) {
  const t = typeOf(X.type);
  const top = el('div', 'session-top');
  top.append(link('← Exercices', '#/exercices', 'back'), el('span', 'session-name', t.label));
  view.append(top);
  if (X.done) return renderEnd(view, rerender);
  if (X.type === 'relier') return renderMatch(view, rerender);
  const total = X.queue.length;
  view.append(progress(X.i, total, 'Question ' + (X.i + 1) + ' sur ' + total, STATUS_LABEL[status(X.queue[X.i].id)]));
  const q = X.queue[X.i];
  if (q.kind === 'sens' || q.kind === 'deviner') renderCard(view, q, rerender);
  else if (q.kind === 'ecrire') renderTyping(view, q, rerender);
  else renderChoice(view, q, rerender);
}

function progress(done, total, left, right) {
  const w = el('div', 'progress');
  const tr = el('div', 'track');
  const bar = el('i');
  bar.style.width = (total ? (done / total) * 100 : 0) + '%';
  tr.append(bar);
  const p = el('p');
  p.append(el('span', null, left), el('span', null, right || ''));
  w.append(tr, p);
  return w;
}

function next(rerender) {
  X.i++;
  X.answered = false; X.picked = -1; X.typed = null; X.pending = null; X.shown = false;
  if (X.i >= X.queue.length) X.done = true;
  rerender();
  window.scrollTo(0, 0);
}

function answerBlock(it, ex) {
  const box = el('div', 'reveal');
  const h = el('div', 'reveal-head');
  h.append(el('p', 'big', it.t), speakBtn(it.t));
  box.append(h, el('p', 'def', cap1(it.d) + '.'));
  if (ex) {
    const r = el('div', 'ex-row');
    r.append(exNode(ex, 'show'), speakBtn(ex, 'Écouter la phrase'));
    box.append(r);
  }
  return box;
}

// Cartes à retourner (auto-évaluation)
function renderCard(view, q, rerender) {
  const it = itemOf(q.id);
  const card = el('div', 'card');
  if (q.kind === 'sens') {
    card.append(el('p', 'kicker', 'Que veut dire…'));
    const h = el('div', 'reveal-head');
    h.append(el('p', 'big', it.t), speakBtn(it.t));
    card.append(h);
  } else {
    card.append(el('p', 'kicker', 'Quelle expression ?'), el('p', 'big def', cap1(it.d) + '.'));
  }
  if (!X.shown) {
    card.append(el('p', 'hint', q.kind === 'sens' ? 'Dites le sens à voix haute ou dans votre tête, puis vérifiez.' : 'Dites l’expression à voix haute, puis vérifiez.'));
    const r = el('div', 'actions');
    r.append(button('Voir la réponse', 'btn primary', () => { X.shown = true; rerender(); }));
    card.append(r);
  } else {
    card.append(answerBlock(it, q.ex));
    card.append(el('p', 'hint', 'Comment ça s’est passé ?'));
    const g = el('div', 'grades');
    [['ko', 'À revoir', 'g-ko'], ['mid', 'Hésitant', 'g-mid'], ['ok', 'Je savais', 'g-ok']].forEach(([r, label, cls]) => {
      g.append(button(label, 'btn ' + cls, () => {
        if (!(q.id in X.first)) X.first[q.id] = r;
        grade(q.id, r);
        if (r === 'ko' && (X.retries[q.id] || 0) < 2) {
          X.retries[q.id] = (X.retries[q.id] || 0) + 1;
          X.queue.push({ ...q });
        }
        next(rerender);
      }));
    });
    card.append(g);
  }
  view.append(card, stopLink(rerender));
}

// Questions à choix
function renderChoice(view, q, rerender) {
  const it = itemOf(q.id);
  const card = el('div', 'card');
  if (q.kind === 'qcm') {
    card.append(el('p', 'kicker', 'Quelle expression correspond ?'), el('p', 'big def', cap1(it.d) + '.'));
  } else if (q.kind === 'inverse') {
    card.append(el('p', 'kicker', 'Que veut dire…'));
    const h = el('div', 'reveal-head');
    h.append(el('p', 'big', it.t), speakBtn(it.t));
    card.append(h);
  } else if (q.kind === 'trous') {
    card.append(el('p', 'kicker', 'Quelle expression complète la phrase ?'), exNode(q.ex, X.answered ? 'show' : 'blank', 'sentence'));
  } else if (q.kind === 'ecouter') {
    card.append(el('p', 'kicker', 'Écoutez, puis choisissez le sens'));
    const play = button('', 'btn play', () => speak(it.t));
    play.append('Réécouter');
    card.append(play);
    if (X.answered) card.append(el('p', 'big', it.t));
    if (!X.autoplayed) { X.autoplayed = true; setTimeout(() => speak(it.t), 250); }
  }
  const opts = el('div', 'options');
  const showDef = q.kind === 'inverse' || q.kind === 'ecouter';
  q.opts.forEach((oid, k) => {
    const o = itemOf(oid);
    const b = button('', 'opt');
    b.append(el('b', null, 'ABCD'[k]), el('span', null, showDef ? cap1(o.d) : o.t));
    if (X.answered) {
      b.disabled = true;
      if (oid === q.id) b.classList.add('right');
      else if (k === X.picked) b.classList.add('wrong');
    } else {
      b.addEventListener('click', () => {
        X.answered = true; X.picked = k;
        const good = oid === q.id;
        if (!(q.id in X.first)) X.first[q.id] = good ? 'ok' : 'ko';
        grade(q.id, good ? 'up' : 'ko');
        announce(good ? 'Bonne réponse.' : 'Pas tout à fait.');
        rerender();
      });
    }
    opts.append(b);
  });
  card.append(opts);
  if (X.answered) {
    const good = q.opts[X.picked] === q.id;
    const v = el('div', 'verdict ' + (good ? 'right' : 'wrong'));
    v.append(el('p', 'verdict-title', good ? 'Bonne réponse.' : 'Pas tout à fait.'));
    v.append(answerBlock(it, q.kind === 'trous' ? '' : q.ex));
    card.append(v);
    const r = el('div', 'actions');
    r.append(button(X.i + 1 < X.queue.length ? 'Question suivante' : 'Voir le résultat', 'btn primary', () => { X.autoplayed = false; next(rerender); }));
    card.append(r);
  }
  view.append(card, stopLink(rerender));
}

// Réponse tapée
function renderTyping(view, q, rerender) {
  const it = itemOf(q.id);
  const card = el('div', 'card');
  card.append(el('p', 'kicker', 'Écrivez l’expression qui manque'), exNode(q.ex, X.answered ? 'show' : 'blank', 'sentence'));
  card.append(el('p', 'hint', 'Sens : ' + it.d + '.'));
  if (!X.answered) {
    const row = el('form', 'type-row');
    const inp = el('input');
    inp.type = 'text'; inp.id = 'ex-answer'; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('aria-label', 'Votre réponse');
    row.append(inp, button('Valider', 'btn primary'));
    row.lastChild.type = 'submit';
    row.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!inp.value.trim()) return;
      const a = canon(inp.value), f = canon(formOf(q.ex)), t = canon(it.t);
      const strip = (s) => s.replace(/^to /, '');
      X.answered = true;
      X.typed = inp.value.trim();
      X.pending = a === f || a === t || strip(a) === strip(f) || strip(a) === strip(t);
      rerender();
    });
    card.append(row);
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (x) { /* rien */ } }, 0);
  } else {
    const v = el('div', 'verdict ' + (X.pending ? 'right' : 'wrong'));
    v.append(el('p', 'verdict-title', X.pending ? 'Bonne réponse.' : 'Pas tout à fait.'));
    if (!X.pending) v.append(el('p', null, 'Votre réponse : ' + X.typed));
    v.append(answerBlock(it, ''));
    if (!X.pending) v.append(button('Ma réponse était juste, la compter', 'btn link', () => { X.pending = true; rerender(); }));
    card.append(v);
    const r = el('div', 'actions');
    r.append(button(X.i + 1 < X.queue.length ? 'Question suivante' : 'Voir le résultat', 'btn primary', () => {
      if (!(q.id in X.first)) X.first[q.id] = X.pending ? 'ok' : 'ko';
      grade(q.id, X.pending ? 'ok' : 'ko');
      next(rerender);
    }));
    card.append(r);
  }
  view.append(card, stopLink(rerender));
}

// Relier
function renderMatch(view, rerender) {
  const ids = X.rounds[X.gi];
  let doneCount = X.pairs;
  for (let g = 0; g < X.gi; g++) doneCount += X.rounds[g].length;
  view.append(progress(doneCount, X.ids.length, 'Série ' + (X.gi + 1) + ' sur ' + X.rounds.length, doneCount + ' sur ' + X.ids.length + ' reliées'));
  const card = el('div', 'card');
  card.append(el('p', 'kicker', 'Reliez chaque expression à sa définition'));
  const complete = X.pairs >= ids.length;
  if (!complete) {
    card.append(el('p', 'hint', X.selT ? 'Touchez maintenant la définition qui correspond.'
      : X.selD ? 'Touchez maintenant l’expression qui correspond.'
      : 'Touchez une expression, puis sa définition. Vous pouvez aussi commencer par la définition.'));
  }
  const item = (side, id) => {
    const it = itemOf(id);
    const b = button('', 'mt-item ' + (side === 't' ? 'mt-term' : 'mt-def'));
    b.id = 'mt-' + side + '-' + id;
    const no = X.matched[id];
    if (no) {
      b.classList.add('done');
      b.disabled = true;
      b.append(el('span', 'pairno', String(no)));
    } else {
      b.setAttribute('aria-pressed', String(side === 't' ? X.selT === id : X.selD === id));
      b.addEventListener('click', () => tapMatch(side, id, rerender));
    }
    if (X.flash && (side === 't' ? X.flash.t === id : X.flash.d === id)) b.classList.add('wrong');
    b.append(el('span', null, side === 't' ? it.t : cap1(it.d) + '.'));
    return b;
  };
  card.append(el('span', 'label', 'Expressions'));
  const tl = el('div', 'mt-terms');
  tl.setAttribute('role', 'group'); tl.setAttribute('aria-label', 'Expressions');
  X.termOrder.forEach((id) => tl.append(item('t', id)));
  card.append(tl, el('span', 'label', 'Définitions'));
  const dl = el('div', 'mt-defs');
  dl.setAttribute('role', 'group'); dl.setAttribute('aria-label', 'Définitions');
  X.defOrder.forEach((id) => dl.append(item('d', id)));
  card.append(dl);
  if (complete) {
    const firstTry = ids.filter((id) => !X.miss[id]).length;
    const fin = el('div', 'reveal');
    fin.append(el('p', 'big def', firstTry === ids.length ? 'Série parfaite.' : firstTry + ' sur ' + ids.length + ' du premier coup.'));
    if (firstTry < ids.length) fin.append(el('p', 'hint', 'Celles où vous avez hésité reviendront bientôt.'));
    const more = X.gi + 1 < X.rounds.length;
    const nx = button(more ? 'Série suivante' : 'Voir le résultat', 'btn primary', () => {
      if (more) { X.gi++; startRound(); } else X.done = true;
      rerender();
      window.scrollTo(0, 0);
    });
    nx.id = 'mt-next';
    const r = el('div', 'actions');
    r.append(nx);
    fin.append(r);
    card.append(fin);
    X.focusId = 'mt-next';
  }
  view.append(card, stopLink(rerender));
  if (X.focusId) {
    const f = document.getElementById(X.focusId);
    if (f && !f.disabled) { try { f.focus({ preventScroll: true }); } catch (x) { /* rien */ } }
    X.focusId = null;
  }
}

function tapMatch(side, id, rerender) {
  if (X.lock || X.matched[id]) return;
  if (side === 't') X.selT = X.selT === id ? null : id;
  else X.selD = X.selD === id ? null : id;
  X.focusId = 'mt-' + side + '-' + id;
  if (!(X.selT && X.selD)) return rerender();
  const t = X.selT, d = X.selD;
  if (t === d) {
    X.pairs++;
    X.matched[t] = X.pairs;
    X.selT = null; X.selD = null;
    const slip = !!X.miss[t];
    X.first[t] = slip ? 'mid' : 'ok';
    grade(t, slip ? 'mid' : 'up');
    announce('Bonne association. ' + X.pairs + ' sur ' + X.rounds[X.gi].length + '.');
    return rerender();
  }
  X.miss[t] = (X.miss[t] || 0) + 1;
  X.miss[d] = (X.miss[d] || 0) + 1;
  X.flash = { t, d };
  X.lock = true;
  announce('Ce n’est pas la bonne définition. Réessayez.');
  rerender();
  const mine = X;
  setTimeout(() => {
    if (X !== mine) return;
    X.flash = null; X.selT = null; X.selD = null; X.lock = false;
    if (location.hash.startsWith('#/exercices/relier')) rerender();
  }, 700);
}

function stopLink(rerender) {
  return button('Arrêter la série', 'btn link', () => { X = null; location.hash = '#/exercices'; rerender(); });
}

function renderEnd(view, rerender) {
  const ids = Object.keys(X.first);
  const ok = ids.filter((id) => X.first[id] === 'ok').length;
  view.append(el('h1', 'page-title', 'Série terminée'));
  const sm = el('section', 'summary');
  const sc = el('p', 'score', String(ok));
  sc.append(el('small', null, ' / ' + ids.length + ' du premier coup'));
  sm.append(sc);
  const missed = ids.filter((id) => X.first[id] !== 'ok');
  sm.append(el('p', 'lead', missed.length
    ? plural(missed.length, 'expression') + ' à retravailler : elles reviendront en priorité.'
    : 'Aucune erreur. Ces expressions reviendront plus tard, pour bien les fixer.'));
  if (missed.length) {
    sm.append(el('span', 'label', 'À retenir'));
    const list = el('div', 'missed');
    missed.forEach((id) => {
      const it = itemOf(id);
      const d = el('div', 'missed-row');
      const txt = el('div');
      txt.append(el('b', null, it.t), el('span', null, cap1(it.d) + '.'));
      d.append(txt, speakBtn(it.t));
      list.append(d);
    });
    sm.append(list);
  }
  const row = el('div', 'actions start');
  const type = X.type;
  if (missed.length && (type !== 'relier' || missed.length >= 3)) {
    row.append(button('Refaire les ratées', 'btn', () => { startExercise(type, { ids: missed }); rerender(); window.scrollTo(0, 0); }));
  }
  row.append(button('Nouvelle série', 'btn primary', () => { startExercise(type); rerender(); window.scrollTo(0, 0); }));
  row.append(link('Autre exercice', '#/exercices', 'btn link'));
  sm.append(row);
  view.append(sm);
}
