// Parler : mots de liaison, astuces, pièges à éviter, prise de parole guidée.

import { DB, allSpeakingQuestions, lessonName, groupOf } from './data.js';
import { S, status, priRank, grade, saveSettings } from './store.js';
import { el, button, link, clear, shuffle, cap1, exNode, chipGroup, toast, announce, plural, icon } from './util.js';
import { speak, speakBtn, canListen, createRecognizer } from './speech.js';
import { entryNode, keepInView } from './itemview.js';
import { startExercise } from './exercises.js';

export function renderSpeak(view, sub, arg, rerender) {
  if (sub === 'liaisons') return renderLinks(view, rerender);
  if (sub === 'astuces') return renderTips(view);
  if (sub === 'pieges') return renderPitfalls(view, rerender);
  if (sub === 'prise-de-parole') return renderDrill(view, arg, rerender);
  renderSpeakHub(view);
}

function back(view) {
  view.append(link('← Parler', '#/parler', 'back'));
}

function renderSpeakHub(view) {
  view.append(el('h1', 'page-title', 'Parler'));
  view.append(el('p', 'lead', 'Pour gagner en aisance à l’oral : les mots qui relient les idées, les réflexes qui font gagner du temps, les erreurs à éviter, et de l’entraînement à voix haute.'));
  const cards = [
    ['#/parler/prise-de-parole', 'Prendre la parole', 'Répondez à voix haute à une question. L’app transcrit, analyse votre réponse et prépare la correction par Claude.', DB.prompts.length + DB.lessons.reduce((n, l) => n + l.speaking.length, 0) + ' sujets'],
    ['#/parler/liaisons', 'Mots de liaison', 'Les formules qui enchaînent les idées : donner son avis, nuancer, illustrer, gagner du temps…', DB.links.length + ' expressions'],
    ['#/parler/astuces', 'Astuces de langage', 'Des réflexes simples pour parler de façon plus naturelle.', DB.tips.length + ' astuces'],
    ['#/parler/pieges', 'Pièges à éviter', 'Les erreurs typiques des francophones, avec un exercice pour s’en débarrasser.', DB.pitfalls.length + ' pièges'],
  ];
  const list = el('div', 'type-list');
  cards.forEach(([href, title, desc, count]) => {
    const a = el('a', 'type-card');
    a.href = href;
    a.append(el('b', null, title), el('span', null, desc), el('small', null, count));
    list.append(a);
  });
  view.append(list);
}

// ---------- mots de liaison ----------
function renderLinks(view, rerender) {
  back(view);
  view.append(el('h1', 'page-title', 'Mots de liaison'));
  view.append(el('p', 'lead', 'Classés par fonction. Touchez une expression pour voir l’exemple, l’écouter et noter son utilité. Ces expressions entrent dans les exercices comme le vocabulaire des cours.'));
  const act = el('div', 'actions start');
  act.append(button('S’entraîner : relier', 'btn primary', () => { startExercise('relier', { src: 'link' }); location.hash = '#/exercices/relier'; }));
  act.append(button('Autres exercices', 'btn', () => { saveSettings({ exSrc: 'link' }); location.hash = '#/exercices'; }));
  view.append(act);
  DB.groups.forEach((g) => {
    const sec = el('section', 'group');
    sec.append(el('h2', 'group-title', g.title), el('p', 'group-why', g.why));
    const box = el('div', 'list');
    DB.links.filter((it) => it.g === g.id).forEach((it) => box.append(entryNode(it, (id) => { rerender(); keepInView(id); })));
    sec.append(box);
    view.append(sec);
  });
}

// ---------- astuces ----------
function renderTips(view) {
  back(view);
  view.append(el('h1', 'page-title', 'Astuces de langage'));
  view.append(el('p', 'lead', 'Un réflexe à la fois. Lisez la version « avant », écoutez la version « après », puis répétez-la à voix haute.'));
  DB.tips.forEach((t) => {
    const c = el('article', 'tip');
    c.append(el('h2', 'tip-title', t.title), el('p', null, t.body));
    const b = el('div', 'before-after');
    const before = el('p', 'before');
    before.append(el('span', 'ba-label', 'Avant'), t.before);
    const after = el('div', 'after');
    const ap = el('p');
    ap.append(el('span', 'ba-label', 'Après'), t.after);
    after.append(ap, speakBtn(t.after, 'Écouter'));
    b.append(before, after);
    c.append(b);
    view.append(c);
  });
}

// ---------- pièges ----------
let PQ = null; // quiz en cours

function newPitfallQuiz() {
  PQ = { qs: shuffle(DB.pitfalls).slice(0, 10).map((p) => ({ p, order: Math.random() < 0.5 })), i: 0, ok: 0, answered: null, missed: [] };
}

function renderPitfalls(view, rerender) {
  back(view);
  view.append(el('h1', 'page-title', 'Pièges à éviter'));
  if (PQ) return renderPitfallQuiz(view, rerender);
  view.append(el('p', 'lead', 'Les erreurs que font souvent les francophones à l’oral. Quand vous prenez la parole, l’app repère la plupart d’entre elles automatiquement.'));
  const act = el('div', 'actions start');
  act.append(button('S’entraîner : laquelle est correcte ?', 'btn primary', () => { newPitfallQuiz(); rerender(); }));
  view.append(act);
  const list = el('div', 'pitfalls');
  DB.pitfalls.forEach((p) => list.append(pitfallCard(p)));
  view.append(list);
}

function pitfallCard(p) {
  const c = el('article', 'pitfall');
  c.append(el('p', 'wrong-line', p.wrong));
  const r = el('div', 'right-line');
  r.append(el('p', null, p.right), speakBtn(p.right.split(' / ')[0], 'Écouter la bonne version'));
  c.append(r, el('p', 'why', p.why));
  return c;
}

function renderPitfallQuiz(view, rerender) {
  if (PQ.i >= PQ.qs.length) {
    const sm = el('section', 'summary');
    const sc = el('p', 'score', String(PQ.ok));
    sc.append(el('small', null, ' / ' + PQ.qs.length));
    sm.append(sc, el('p', 'lead', PQ.missed.length ? 'À relire :' : 'Aucune erreur. Bravo.'));
    PQ.missed.forEach((p) => sm.append(pitfallCard(p)));
    const row = el('div', 'actions start');
    row.append(button('Recommencer', 'btn primary', () => { newPitfallQuiz(); rerender(); window.scrollTo(0, 0); }));
    row.append(button('Voir la liste', 'btn link', () => { PQ = null; rerender(); }));
    sm.append(row);
    view.append(sm);
    return;
  }
  const { p, order } = PQ.qs[PQ.i];
  view.append(el('p', 'avail', 'Question ' + (PQ.i + 1) + ' sur ' + PQ.qs.length));
  const card = el('div', 'card');
  card.append(el('p', 'kicker', 'Laquelle est correcte ?'));
  const a = { text: p.right.split(' / ')[0], good: true }, b = { text: p.wrong.replace(/\s*\(=.*?\)\s*$/, ''), good: false };
  const opts = el('div', 'options');
  (order ? [a, b] : [b, a]).forEach((o, k) => {
    const btn = button('', 'opt');
    btn.append(el('b', null, 'AB'[k]), el('span', null, o.text));
    if (PQ.answered != null) {
      btn.disabled = true;
      if (o.good) btn.classList.add('right');
      else if (PQ.answered === k) btn.classList.add('wrong');
    } else {
      btn.addEventListener('click', () => {
        PQ.answered = k;
        if (o.good) PQ.ok++; else PQ.missed.push(p);
        rerender();
      });
    }
    opts.append(btn);
  });
  card.append(opts);
  if (PQ.answered != null) {
    const good = (order ? [a, b] : [b, a])[PQ.answered].good;
    const v = el('div', 'verdict ' + (good ? 'right' : 'wrong'));
    v.append(el('p', 'verdict-title', good ? 'Bonne réponse.' : 'Pas tout à fait.'), el('p', null, p.why));
    if (p.right.includes(' / ')) v.append(el('p', 'hint', 'Autre façon de dire : ' + p.right.split(' / ').slice(1).join(' / ')));
    card.append(v);
    const r = el('div', 'actions');
    r.append(button(PQ.i + 1 < PQ.qs.length ? 'Question suivante' : 'Voir le résultat', 'btn primary', () => { PQ.i++; PQ.answered = null; rerender(); }));
    card.append(r);
  }
  view.append(card, button('Arrêter', 'btn link', () => { PQ = null; rerender(); }));
}

// ---------- analyse automatique d'une réponse ----------
const IRREG = {
  take: 'took|taken', hold: 'held', come: 'came', give: 'gave|given', keep: 'kept', make: 'made', go: 'went|gone',
  get: 'got|gotten', bring: 'brought', lose: 'lost', fall: 'fell|fallen', leave: 'left', run: 'ran', feel: 'felt',
  catch: 'caught', stick: 'stuck', tell: 'told', say: 'said', think: 'thought', find: 'found', see: 'saw|seen',
  know: 'knew|known', do: 'did|done|does', have: 'had|has', be: 'am|is|are|was|were|been', wear: 'wore|worn',
  strike: 'struck', draw: 'drew|drawn', bear: 'bore|borne', rise: 'rose|risen', deal: 'dealt', hang: 'hung',
  lead: 'led', buy: 'bought', win: 'won', begin: 'began|begun', break: 'broke|broken', speak: 'spoke|spoken',
  stand: 'stood', throw: 'threw|thrown', drive: 'drove|driven', ride: 'rode|ridden', fight: 'fought', set: 'set', put: 'put', cut: 'cut',
};
const SKIP = new Set(['sb', 'sth', 'someone', 'something', 'somebody', "someone's", "something's", 'your', 'yourself', "one's", 'x', 'y']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cacheRx = new Map();

function matcher(it) {
  if (cacheRx.has(it.id)) return cacheRx.get(it.id);
  let rx = null;
  if (it.id === 'lk-well') rx = /(?:^|[.!?]\s*)well\b/i;
  else if (it.id !== 'lk-since-cause') {
    const words = it.t.toLowerCase().replace(/[’]/g, "'").replace(/\(.*?\)/g, ' ').replace(/[…?!.,;:]/g, ' ')
      .split(/\s+/).filter((w) => w && !SKIP.has(w));
    if (words.length) {
      const parts = words.map((w, i) => {
        if (i === 0 && it.kind === 'vocab') {
          const base = w.length >= 4 ? esc(w.replace(/e$/, '')) + "[a-z]*" : esc(w) + '(?:s|es|ed|ing)?';
          return '(?:' + base + (IRREG[w] ? '|' + IRREG[w] : '') + ')';
        }
        return esc(w);
      });
      rx = new RegExp('\\b' + parts.join("(?:[\\s,]+[a-z'’]+){0,3}?[\\s,]+") + '\\b', 'i');
    }
  }
  cacheRx.set(it.id, rx);
  return rx;
}
const uses = (it, text) => { const rx = matcher(it); return !!rx && rx.test(text); };

const WATCH = ['and', 'so', 'very', 'really', 'like', 'actually', 'basically'];

export function analyse(text, seconds, targetIds) {
  const t = text.replace(/[’]/g, "'");
  const words = (t.toLowerCase().match(/[a-z']+/g) || []);
  const wc = words.length;
  const wpm = seconds >= 15 && wc ? Math.round(wc / (seconds / 60)) : null;
  const links = DB.links.filter((it) => uses(it, t));
  const fns = new Set(links.map((l) => l.g));
  const targets = targetIds.map((id) => DB.items.get(id)).filter(Boolean);
  const hit = targets.filter((it) => uses(it, t)).map((it) => it.id);
  const vocab = DB.vocab.filter((it) => !targetIds.includes(it.id) && uses(it, t));
  const freq = {};
  words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
  const thinkCount = (t.match(/\bi think\b/gi) || []).length;
  const reps = WATCH.map((w) => [w, freq[w] || 0]).filter(([w, n]) => n >= (w === 'and' ? 6 : 4));
  if (thinkCount >= 3) reps.push(['I think', thinkCount]);
  const fillers = (t.match(/\b(euh|heu|uh|um|erm)\b/gi) || []).length;
  const errors = DB.pitfalls.filter((p) => p.detect && new RegExp(p.detect, 'i').test(t));
  return { wc, wpm, seconds, links, fns, hit, vocab, reps, fillers, errors };
}

// ---------- Claude (gratuit via l'abonnement : on ouvre une conversation pré-remplie) ----------
const MAX_URL = 7000;
function claudeUrl(prompt) { return 'https://claude.ai/new?q=' + encodeURIComponent(prompt); }

function correctionPrompt(q, text, targets) {
  const build = (answer) => [
    "I'm a French speaker learning English (level B1-B2) and I want to sound more fluent when I speak.",
    'I answered this question out loud. Below is the transcript of what I said (speech recognition, so ignore punctuation and capital letters).',
    '',
    'Question: "' + q.q + '"',
    targets.length ? 'Expressions I tried to use: ' + targets.map((it) => it.t).join('; ') : '',
    '',
    'My answer:',
    '"""',
    answer,
    '"""',
    '',
    'Please answer in French, briefly:',
    '1. Mes erreurs de grammaire ou de vocabulaire (5 maximum), avec la correction et une courte explication.',
    '2. Les expressions et mots de liaison que j\'ai bien utilisés, et ceux que j\'aurais pu ajouter.',
    '3. Une version plus naturelle de ma réponse, en anglais oral (niveau B2), qui garde mes idées.',
    '4. Un seul conseil prioritaire pour parler de façon plus fluide.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  let answer = text.trim();
  let p = build(answer);
  while (claudeUrl(p).length > MAX_URL && answer.length > 200) {
    answer = answer.slice(0, Math.floor(answer.length * 0.85)) + ' […]';
    p = build(answer);
  }
  return p;
}

function modelPrompt(q, targets) {
  return [
    "I'm a French speaker learning English (level B1-B2) and I practise speaking.",
    'Question: "' + q.q + '"',
    'Give me a natural spoken answer of about 120 words (level B2), as a person would really say it out loud.',
    targets.length ? 'Use some of these expressions: ' + targets.map((it) => it.t).join('; ') + '.' : '',
    'Put the expressions and linking words in bold. Then, in French, explain in 3 short bullet points how the answer is structured.',
  ].filter(Boolean).join('\n');
}

function openClaude(prompt) {
  // Ouverture immédiate (sinon le navigateur bloque la fenêtre), copie en parallèle pour le cas où.
  let copied = false;
  try { navigator.clipboard.writeText(prompt).then(() => { copied = true; }, () => {}); } catch (e) { /* rien */ }
  window.open(claudeUrl(prompt), '_blank', 'noopener');
  setTimeout(() => toast(copied
    ? 'Claude s’ouvre. Si la consigne n’apparaît pas, collez-la : elle est copiée.'
    : 'Claude s’ouvre avec la consigne.'), 300);
}

// ---------- prise de parole ----------
const D = { deck: [], pos: 0, q: null, targets: [], text: '', secs: 0, startAt: 0, listening: false, analysis: null, used: {}, interim: '', rec: null, tick: null, error: '' };

function questionsFor(src) {
  const all = allSpeakingQuestions();
  if (src === 'cours') return all.filter((q) => q.lesson);
  if (src === 'sujets') return all.filter((q) => !q.lesson);
  return all;
}

function pickTargets(q) {
  const kind = DB.kinds[q.kind] || DB.kinds.opinion;
  const groups = shuffle(kind.groups).slice(0, 3);
  const links = groups.map((g) => {
    const cands = shuffle(DB.links.filter((l) => l.g === g));
    cands.sort((a, b) => (status(a.id) === 'mastered') - (status(b.id) === 'mastered') || priRank(a.id) - priRank(b.id));
    return cands[0] && cands[0].id;
  }).filter(Boolean);
  const vocab = (q.uses || []).filter((id) => DB.items.has(id)).slice(0, 3);
  return vocab.concat(links);
}

function stopListening() {
  if (D.rec && D.rec.on) D.rec.stop();
  if (D.listening) {
    D.secs += (Date.now() - D.startAt) / 1000;
    D.listening = false;
  }
  clearInterval(D.tick);
  D.tick = null;
}

function loadQuestion(q) {
  stopListening();
  Object.assign(D, { q, targets: pickTargets(q), text: '', secs: 0, analysis: null, used: {}, interim: '', error: '' });
}

function nextQuestion() {
  const src = S.settings.spSrc || 'tout';
  if (!D.deck.length || D.pos >= D.deck.length || D.src !== src) {
    D.src = src;
    D.deck = shuffle(questionsFor(src));
    D.pos = 0;
  }
  loadQuestion(D.deck[D.pos++]);
}

const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

function renderDrill(view, arg, rerender) {
  back(view);
  view.append(el('h1', 'page-title', 'Prendre la parole'));
  if (arg && (!D.q || D.q.id !== arg)) {
    const q = allSpeakingQuestions().find((x) => x.id === arg);
    if (q) loadQuestion(q);
  }
  if (!D.q) nextQuestion();
  const q = D.q;

  const srcHost = el('div', 'chips');
  chipGroup(srcHost, [
    { value: 'tout', label: 'Tous les sujets' },
    { value: 'sujets', label: 'Sujets généraux' },
    { value: 'cours', label: 'Questions des cours' },
  ], S.settings.spSrc || 'tout', (v) => { saveSettings({ spSrc: v }); nextQuestion(); location.hash = '#/parler/prise-de-parole'; rerender(); }, 'Sujets');
  view.append(srcHost);

  const kind = DB.kinds[q.kind] || DB.kinds.opinion;
  const card = el('div', 'card');
  card.append(el('p', 'kicker', q.lesson ? lessonName(q.lesson) : kind.label));
  const qh = el('div', 'reveal-head');
  qh.append(el('p', 'big', q.q), speakBtn(q.q, 'Écouter la question'));
  card.append(qh);
  const method = el('p', 'method');
  method.append(el('b', null, 'Méthode : '), kind.structure);
  card.append(method);

  card.append(el('span', 'label', 'À placer dans votre réponse'));
  const tl = el('div', 'targets');
  D.targets.forEach((id) => {
    const it = DB.items.get(id);
    const t = el('div', 'target' + (D.used[id] ? ' on' : ''));
    const txt = el('div');
    txt.append(el('b', null, it.t), el('span', null, it.kind === 'link' ? it.d : cap1(it.d)));
    t.append(txt, speakBtn(it.t));
    tl.append(t);
  });
  card.append(tl);
  view.append(card);

  // Enregistrement
  const rec = el('section', 'card speak-box');
  if (canListen) {
    const row = el('div', 'rec-row');
    const mic = button('', 'mic' + (D.listening ? ' on' : ''));
    mic.append(icon(D.listening ? 'stop' : 'mic'), el('span', null, D.listening ? 'Arrêter' : (D.text ? 'Reprendre' : 'Parler')));
    mic.setAttribute('aria-pressed', String(D.listening));
    mic.addEventListener('click', () => {
      if (D.listening) { stopListening(); rerender(); return; }
      if (!D.rec) {
        D.rec = createRecognizer({
          onText: (fin, interim) => {
            D.text = fin; D.interim = interim;
            const ta = document.getElementById('sp-text');
            if (ta) ta.value = (fin + interim).trim();
          },
          onState: (on) => { if (!on && D.listening) { stopListening(); rerender(); } },
          onError: (err) => {
            stopListening();
            D.error = err === 'not-allowed' || err === 'service-not-allowed'
              ? 'Le micro est bloqué : autorisez-le pour ce site dans les réglages du navigateur.'
              : 'La transcription s’est interrompue. Réessayez, ou dictez avec le clavier.';
            rerender();
          },
        });
      }
      D.error = '';
      D.analysis = null;
      D.listening = true;
      D.startAt = Date.now();
      D.rec.start(D.text);
      D.tick = setInterval(() => {
        const n = document.getElementById('sp-timer');
        if (n) n.textContent = fmt(D.secs + (Date.now() - D.startAt) / 1000);
      }, 500);
      rerender();
    });
    const timer = el('span', 'timer', fmt(D.secs + (D.listening ? (Date.now() - D.startAt) / 1000 : 0)));
    timer.id = 'sp-timer';
    row.append(mic, timer);
    if (D.listening) row.append(el('span', 'listening', 'Je vous écoute…'));
    rec.append(row);
  } else {
    rec.append(el('p', 'note', 'Ce navigateur ne transcrit pas la voix. Dictez avec le micro de votre clavier, ou tapez votre réponse.'));
  }
  if (D.error) rec.append(el('p', 'note warn', D.error));
  const ta = el('textarea', 'answer-box');
  ta.id = 'sp-text';
  ta.rows = 6;
  ta.value = (D.text + (D.listening ? D.interim : '')).trim();
  ta.readOnly = D.listening;
  ta.placeholder = 'Votre réponse apparaît ici pendant que vous parlez. Vous pouvez la corriger ou la taper.';
  ta.setAttribute('aria-label', 'Votre réponse');
  ta.addEventListener('input', () => { D.text = ta.value; D.analysis = null; });
  rec.append(ta);

  const acts = el('div', 'actions start');
  acts.append(button('Analyser ma réponse', 'btn primary', () => {
    stopListening();
    if (!D.text.trim()) { toast('Répondez d’abord à voix haute, ou tapez votre réponse.'); return; }
    D.analysis = analyse(D.text, D.secs, D.targets);
    D.analysis.hit.forEach((id) => { D.used[id] = true; });
    rerender();
    setTimeout(() => document.getElementById('analysis')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
  }));
  const ask = button('', 'btn claude', () => {
    if (!D.text.trim()) { toast('Il faut d’abord une réponse à corriger.'); return; }
    stopListening();
    openClaude(correctionPrompt(q, D.text, D.targets.map((id) => DB.items.get(id))));
  });
  ask.append('Corriger avec Claude');
  acts.append(ask);
  rec.append(acts);
  view.append(rec);

  if (D.analysis) view.append(analysisBlock(D.analysis, rerender));

  // Réponse modèle
  const model = el('section', 'card model');
  model.append(el('h2', 'card-title', 'Réponse modèle'));
  if (q.model) {
    const det = el('details');
    det.append(el('summary', null, 'Afficher une réponse possible'));
    const r = el('div', 'model-row');
    r.append(highlightLinks(q.model), speakBtn(q.model, 'Écouter la réponse modèle'));
    det.append(r, el('p', 'hint', 'Les mots de liaison sont surlignés. Écoutez-la, puis redites-la avec vos propres idées.'));
    model.append(det);
  } else {
    model.append(el('p', 'hint', 'Pas de réponse modèle pour cette question : Claude peut en rédiger une avec les expressions du cours.'));
    model.append(button('Demander une réponse modèle à Claude', 'btn', () => openClaude(modelPrompt(q, D.targets.map((id) => DB.items.get(id))))));
  }
  view.append(model);

  const end = el('div', 'actions');
  end.append(button('Sujet suivant', 'btn primary', () => {
    stopListening();
    Object.keys(D.used).forEach((id) => { if (D.used[id]) grade(id, 'ok'); });
    nextQuestion();
    location.hash = '#/parler/prise-de-parole';
    rerender();
    window.scrollTo(0, 0);
  }));
  view.append(end);
}

function highlightLinks(text) {
  const p = el('p', 'model-text');
  const hits = [];
  DB.links.forEach((it) => {
    const rx = matcher(it);
    if (!rx) return;
    const g = new RegExp(rx.source, 'gi');
    let m;
    while ((m = g.exec(text))) {
      let s = m.index, e = s + m[0].length;
      while (s < e && /[\s.!?]/.test(text[s])) s++;
      hits.push([s, e]);
    }
  });
  hits.sort((a, b) => a[0] - b[0]);
  let pos = 0;
  hits.forEach(([s, e]) => {
    if (s < pos) return;
    p.append(text.slice(pos, s), el('mark', null, text.slice(s, e)));
    pos = e;
  });
  p.append(text.slice(pos));
  return p;
}

function analysisBlock(a, rerender) {
  const box = el('section', 'card analysis');
  box.id = 'analysis';
  box.append(el('h2', 'card-title', 'Analyse de votre réponse'));
  const stats = el('div', 'stats-row');
  const stat = (n, l) => { const s = el('div', 'stat'); s.append(el('b', null, n), el('span', null, l)); return s; };
  stats.append(stat(String(a.wc), 'mots'));
  if (a.seconds >= 5) stats.append(stat(fmt(a.seconds), 'de parole'));
  if (a.wpm) stats.append(stat(String(a.wpm), 'mots / minute'));
  stats.append(stat(String(a.fns.size), a.fns.size > 1 ? 'fonctions de liaison' : 'fonction de liaison'));
  box.append(stats);
  if (a.wpm) {
    box.append(el('p', 'hint', a.wpm < 80 ? 'Débit posé. Pour gagner en fluidité, enchaînez les idées avec des mots de liaison plutôt que des silences.'
      : a.wpm <= 140 ? 'Débit naturel pour une conversation.'
      : 'Débit rapide : marquez une courte pause après les mots de liaison, ça rend le propos plus clair.'));
  }

  box.append(el('span', 'label', 'Expressions à placer'));
  const tl = el('div', 'targets');
  D.targets.forEach((id) => {
    const it = DB.items.get(id);
    const b = button('', 'target check' + (D.used[id] ? ' on' : ''));
    b.setAttribute('aria-pressed', String(!!D.used[id]));
    b.append(icon('check', 'ico ok-ico'), el('b', null, it.t));
    b.addEventListener('click', () => { D.used[id] = !D.used[id]; rerender(); });
    tl.append(b);
  });
  box.append(tl, el('p', 'hint', 'Cochées = repérées dans votre réponse. Touchez-en une pour corriger : celles cochées comptent comme réussies quand vous passez au sujet suivant.'));

  box.append(el('span', 'label', 'Mots de liaison employés'));
  if (a.links.length) {
    const c = el('div', 'chips');
    a.links.forEach((l) => c.append(el('span', 'chip static', l.t.replace(/[,.]$/, '') + ' · ' + (groupOf(l.g) || {}).title)));
    box.append(c);
    if (a.fns.size < 3) box.append(el('p', 'hint', 'Essayez d’ajouter une autre fonction : un exemple (« for instance »), une nuance (« having said that ») ou une conclusion (« all in all »).'));
  } else {
    box.append(el('p', 'hint', 'Aucun repéré. Pour commencer, structurez avec « In my view… », « For instance… », « All in all… ».'));
  }

  if (a.vocab.length) {
    box.append(el('span', 'label', 'Autres expressions des cours'));
    const c = el('div', 'chips');
    a.vocab.forEach((it) => c.append(el('span', 'chip static', it.t)));
    box.append(c);
  }

  if (a.reps.length || a.fillers) {
    box.append(el('span', 'label', 'Répétitions'));
    const ul = el('ul', 'plain');
    a.reps.forEach(([w, n]) => ul.append(el('li', null, '« ' + w + ' » × ' + n + (w === 'and' || w === 'so' ? ' : remplacez-en un ou deux par « what\'s more », « which means » ou « that\'s why ».' : w === 'very' || w === 'really' ? ' : variez avec « extremely », « incredibly » ou un adjectif plus fort.' : '.'))));
    if (a.fillers) ul.append(el('li', null, '« euh » × ' + a.fillers + ' : remplacez-le par « well » ou « let me think ».'));
    box.append(ul);
  }

  if (a.errors.length) {
    box.append(el('span', 'label', 'Erreurs fréquentes repérées'));
    a.errors.forEach((p) => box.append(pitfallCard(p)));
  }

  box.append(el('p', 'note', 'Cette analyse repère des mots, pas la grammaire ni la prononciation. Pour une vraie correction, utilisez « Corriger avec Claude ».'));
  return box;
}
