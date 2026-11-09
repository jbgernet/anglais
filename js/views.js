// Pages « Aujourd'hui », « Vocabulaire » et « Réglages ».

import { DB, lessonName } from './data.js';
import { S, counts, status, priOf, priRank, streak, merge, payload, saveSettings, STATUS_LABEL, STATUS_ORDER, PRI, PRI_ORDER } from './store.js';
import { el, button, link, clear, cap1, exNode, chipGroup, selectField, toast, dailyPick, plural, icon } from './util.js';
import { tts, speak, speakBtn } from './speech.js';
import { entryNode, keepInView } from './itemview.js';
import { startExercise } from './exercises.js';
import { sync, connect, disconnect, syncNow } from './sync.js';

// ---------- Aujourd'hui ----------
function statusBar(items) {
  const c = counts(items);
  const box = el('div', 'stats');
  const bar = el('div', 'bar');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', 'Répartition des ' + c.total + ' expressions par statut');
  STATUS_ORDER.forEach((k) => {
    const seg = el('i', 's-' + k);
    seg.style.width = (c.total ? (c[k] / c.total) * 100 : 0) + '%';
    bar.append(seg);
  });
  const lg = el('div', 'legend');
  STATUS_ORDER.forEach((k) => {
    const s = el('span');
    s.append(el('i', 'dot s-' + k), el('b', null, String(c[k])), ' ' + STATUS_LABEL[k].toLowerCase());
    lg.append(s);
  });
  box.append(bar, lg);
  return box;
}

export function renderHome(view) {
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  view.append(el('p', 'eyebrow', cap1(date)), el('h1', 'page-title', 'Aujourd’hui'));

  const all = DB.vocab.concat(DB.links);
  const c = counts(all), cv = counts(DB.vocab), cl = counts(DB.links);
  const top = el('section', 'card today');
  const st = streak();
  const line = el('p', 'today-line');
  line.append(el('b', null, String(c.due)), ' ' + (c.due > 1 ? 'expressions' : 'expression') + ' à revoir aujourd’hui');
  if (st) line.append(' · série de ', el('b', null, plural(st, 'jour')));
  top.append(line, statusBar(all));
  const acts = el('div', 'actions start');
  acts.append(button('Réviser le vocabulaire', 'btn primary', () => { startExercise('relier', { src: 'vocab', lesson: 0 }); location.hash = '#/exercices/relier'; }));
  acts.append(button('Réviser les mots de liaison', 'btn', () => { startExercise('relier', { src: 'link' }); location.hash = '#/exercices/relier'; }));
  top.append(acts);
  top.append(el('p', 'hint', 'Vocabulaire des cours : ' + cv.due + ' à revoir, ' + cv.new + ' nouvelles. Mots de liaison : ' + cl.due + ' à revoir, ' + cl.new + ' nouveaux.'));
  view.append(top);

  const grid = el('div', 'home-grid');

  const fresh = DB.links.filter((it) => status(it.id) !== 'mastered');
  const lk = dailyPick(fresh.length ? fresh : DB.links, 'link');
  if (lk) {
    const card = el('section', 'card');
    card.append(el('p', 'kicker', 'Mot de liaison du jour'));
    const h = el('div', 'reveal-head');
    h.append(el('p', 'big', lk.t), speakBtn(lk.t));
    card.append(h, el('p', 'def', cap1(lk.d) + ' · ' + lk.s.toLowerCase()));
    const r = el('div', 'ex-row');
    r.append(exNode(lk.x[0], 'show'), speakBtn(lk.x[0], 'Écouter la phrase'));
    card.append(r, link('Tous les mots de liaison', '#/parler/liaisons', 'btn link'));
    grid.append(card);
  }

  const pr = dailyPick(DB.prompts, 'prompt');
  if (pr) {
    const card = el('section', 'card');
    card.append(el('p', 'kicker', 'Sujet du jour pour parler'), el('p', 'big', pr.q));
    card.append(el('p', 'hint', (DB.kinds[pr.kind] || {}).structure || ''));
    card.append(link('Répondre à voix haute', '#/parler/prise-de-parole/p-' + pr.id, 'btn primary'));
    grid.append(card);
  }

  const tip = dailyPick(DB.tips, 'tip');
  if (tip) {
    const card = el('section', 'card');
    card.append(el('p', 'kicker', 'Astuce du jour'), el('h2', 'card-title', tip.title), el('p', null, tip.body));
    const r = el('div', 'ex-row');
    const p = el('p', 'ex');
    p.append(tip.after);
    r.append(p, speakBtn(tip.after));
    card.append(r, link('Toutes les astuces', '#/parler/astuces', 'btn link'));
    grid.append(card);
  }
  view.append(grid);
  view.append(el('p', 'foot', 'Une nouvelle fiche de cours ? Envoyez-la à Claude dans le projet « Cours anglais » en lui demandant de l’ajouter à l’app.'));
}

// ---------- Vocabulaire ----------
const G = { q: '', lesson: 0, status: 'all', pri: 'all', sort: 'course' };

export function renderVocab(view) {
  view.append(el('h1', 'page-title', 'Vocabulaire'));
  view.append(el('p', 'lead', DB.vocab.length + ' expressions venues de ' + plural(DB.lessons.length, 'cours') + '. Touchez une expression pour l’écouter, voir l’exemple et noter son utilité : vos incontournables passent en premier dans les exercices.'));
  const search = el('input');
  search.type = 'search';
  search.id = 'voc-q';
  search.placeholder = 'Rechercher une expression ou un mot de la définition';
  search.setAttribute('aria-label', 'Rechercher');
  search.value = G.q;
  search.autocomplete = 'off';
  view.append(search);
  const lessons = el('div', 'chips');
  const statuses = el('div', 'chips');
  const pris = el('div', 'chips');
  const sortRow = el('div', 'row');
  const sorts = el('div', 'chips');
  const count = el('span', 'avail push');
  sortRow.append(el('span', 'label', 'Tri'), sorts, count);
  const list = el('div', 'vocab-list');
  view.append(lessons, statuses, pris, sortRow, list);

  const draw = () => {
    chipGroup(lessons, [{ value: 0, label: 'Tous les cours' }].concat(DB.lessons.map((l) => ({ value: l.num, label: lessonName(l.num) }))), G.lesson, (v) => { G.lesson = v; draw(); }, 'Cours');
    chipGroup(statuses, [{ value: 'all', label: 'Tous statuts' }].concat(STATUS_ORDER.map((k) => ({ value: k, label: STATUS_LABEL[k] }))), G.status, (v) => { G.status = v; draw(); }, 'Statut');
    chipGroup(pris, [{ value: 'all', label: 'Toute utilité' }].concat(PRI_ORDER.map((k) => ({ value: k, label: PRI[k] }))).concat([{ value: 'none', label: 'Non noté' }]), G.pri, (v) => { G.pri = v; draw(); }, 'Utilité');
    chipGroup(sorts, [{ value: 'course', label: 'Par cours' }, { value: 'priority', label: 'Par priorité' }], G.sort, (v) => { G.sort = v; draw(); }, 'Tri');
    const q = G.q.trim().toLowerCase();
    let items = DB.vocab.filter((it) => {
      if (G.lesson && !it.lessons.includes(G.lesson)) return false;
      if (G.status !== 'all' && status(it.id) !== G.status) return false;
      if (G.pri !== 'all' && (priOf(it.id) || 'none') !== G.pri) return false;
      if (q && (it.t + ' ' + it.d + ' ' + it.x.join(' ')).toLowerCase().replace(/\[\[|\]\]/g, '').indexOf(q) === -1) return false;
      return true;
    });
    count.textContent = plural(items.length, 'résultat');
    clear(list);
    const onChanged = (id) => { draw(); keepInView(id); };
    if (!items.length) { list.append(el('div', 'empty', 'Aucune expression ne correspond.')); return; }
    if (G.sort === 'priority') {
      items = items.slice().sort((a, b) => priRank(a.id) - priRank(b.id) || a.t.toLowerCase().localeCompare(b.t.toLowerCase()));
      const box = el('div', 'list');
      items.forEach((it) => box.append(entryNode(it, onChanged)));
      list.append(box);
      return;
    }
    DB.lessons.forEach((L) => {
      const mine = items.filter((it) => it.lessons[0] === L.num).sort((a, b) => priRank(a.id) - priRank(b.id));
      if (!mine.length) return;
      const h = el('h2', 'group-title', lessonName(L.num));
      h.append(el('small', null, (L.subtitle ? L.subtitle + ' · ' : '') + plural(mine.length, 'expression')));
      const box = el('div', 'list');
      mine.forEach((it) => box.append(entryNode(it, onChanged)));
      list.append(h, box);
    });
  };
  search.addEventListener('input', () => { G.q = search.value; draw(); });
  draw();
}

// ---------- Réglages ----------
export function renderSettings(view, rerender) {
  view.append(el('h1', 'page-title', 'Réglages'));

  // Synchronisation
  const s1 = el('section', 'card');
  s1.append(el('h2', 'card-title', 'Synchroniser avec GitHub'));
  const stLine = el('p', 'sync-state s-' + sync.state);
  const time = sync.last ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(sync.last)) : '';
  stLine.textContent = sync.state === 'off' ? 'Non connecté : votre progression reste sur cet appareil.'
    : sync.state === 'busy' ? 'Synchronisation en cours…'
    : sync.state === 'error' ? sync.error
    : 'Connecté au compte GitHub ' + (sync.login || '') + (time ? ' · dernière synchronisation : ' + time : '') + '.';
  s1.append(stLine);
  if (!sync.token) {
    s1.append(el('p', null, 'Votre progression (statuts, utilité, révisions) peut suivre d’un appareil à l’autre. Elle est rangée dans un Gist privé de votre compte GitHub. À faire une fois par appareil :'));
    const ol = el('ol', 'steps');
    const li1 = el('li');
    const a = el('a', null, 'Créer un jeton GitHub');
    a.href = 'https://github.com/settings/tokens/new?scopes=gist&description=Carnet%20d%27anglais';
    a.target = '_blank'; a.rel = 'noopener';
    li1.append(a, ' : la case « gist » est déjà cochée. Pour l’expiration, choisissez « No expiration » (le jeton ne donne accès qu’à vos Gists) ou une date, mais il faudra alors le recréer. Cliquez sur « Generate token ».');
    ol.append(li1, el('li', null, 'Copiez le jeton (il commence par « ghp_ ») et collez-le ci-dessous. Sur un deuxième appareil, collez le même jeton.'));
    s1.append(ol);
    const f = el('form', 'type-row');
    const inp = el('input');
    inp.type = 'password'; inp.id = 'gh-token'; inp.placeholder = 'ghp_…'; inp.autocomplete = 'off';
    inp.setAttribute('aria-label', 'Jeton GitHub');
    const go = button('Connecter', 'btn primary');
    go.type = 'submit';
    f.append(inp, go);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!inp.value.trim()) return;
      go.disabled = true; go.textContent = 'Connexion…';
      try {
        const found = await connect(inp.value);
        toast(found ? 'Connecté : progression récupérée et fusionnée.' : 'Connecté : sauvegarde créée dans votre compte.');
      } catch (err) {
        toast(err.message);
      }
      rerender();
    });
    s1.append(f);
  } else {
    const row = el('div', 'actions start');
    row.append(button('Synchroniser maintenant', 'btn', async () => { await syncNow(); rerender(); }));
    row.append(button('Déconnecter cet appareil', 'btn link', () => { disconnect(); toast('Appareil déconnecté. La progression reste ici.'); rerender(); }));
    s1.append(row, el('p', 'note', 'Le jeton est gardé sur cet appareil uniquement.'));
  }
  view.append(s1);

  // Voix
  const s2 = el('section', 'card');
  s2.append(el('h2', 'card-title', 'Voix anglaise'));
  if (!tts.ok || !tts.voices.length) {
    s2.append(el('p', 'note', tts.ok ? 'Aucune voix anglaise trouvée sur cet appareil.' : 'Ce navigateur ne lit pas le texte à voix haute.'));
  } else {
    const opts = [['', 'Automatique (anglais britannique si possible)']].concat(tts.voices.map((v) => [v.voiceURI, v.name + ' · ' + v.lang]));
    const vs = selectField('voice', 'Voix', opts, S.settings.voice, (v) => saveSettings({ voice: v }));
    const rate = el('div', 'field');
    const rl = el('label', null, 'Vitesse');
    rl.htmlFor = 'rate';
    const ri = el('input');
    ri.type = 'range'; ri.id = 'rate'; ri.min = '0.7'; ri.max = '1.1'; ri.step = '0.05'; ri.value = String(S.settings.rate || 0.95);
    ri.addEventListener('change', () => saveSettings({ rate: Number(ri.value) }));
    rate.append(rl, ri);
    const g = el('div', 'setup-grid');
    g.append(vs.field, rate);
    s2.append(g, button('Tester la voix', 'btn', () => speak('Having said that, I tend to think it is worth trying.')));
  }
  view.append(s2);

  // Sauvegarde
  const s3 = el('section', 'card');
  s3.append(el('h2', 'card-title', 'Sauvegarde'));
  s3.append(el('p', null, 'Un fichier avec toute votre progression, à garder ou à importer sur un autre appareil.'));
  const row = el('div', 'actions start');
  row.append(button('Exporter ma progression', 'btn', () => {
    const blob = new Blob([JSON.stringify(payload(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'anglais-progression-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }));
  const file = el('input');
  file.type = 'file'; file.accept = 'application/json,.json'; file.id = 'import-file'; file.hidden = true;
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    try { importText(await f.text()); } catch (e) { toast('Ce fichier n’est pas une sauvegarde lisible.'); }
    file.value = '';
    rerender();
  });
  row.append(button('Importer une sauvegarde', 'btn', () => file.click()), file);
  s3.append(row);
  const det = el('details');
  det.append(el('summary', null, 'Reprendre la progression de l’ancien carnet (artefact)'));
  det.append(el('p', 'hint', 'Dans l’ancien carnet, touchez « copier ma progression » tout en bas de la page, puis collez le texte ici.'));
  const ta = el('textarea', 'answer-box');
  ta.id = 'legacy-paste'; ta.rows = 3; ta.placeholder = '{"p": …}';
  ta.setAttribute('aria-label', 'Progression de l’ancien carnet');
  det.append(ta, button('Importer', 'btn', () => {
    try { importText(ta.value); ta.value = ''; rerender(); } catch (e) { toast('Le texte collé n’est pas une progression lisible.'); }
  }));
  s3.append(det);
  view.append(s3);

  // Ajouter un cours
  const s4 = el('section', 'card');
  s4.append(el('h2', 'card-title', 'Ajouter un cours'));
  s4.append(el('p', null, 'Envoyez la fiche du cours à Claude, dans le projet « Cours anglais » ou dans une session Claude Code sur le dépôt « anglais », en lui demandant de l’ajouter à l’app. Il crée le fichier de la séance, vérifie les données et publie : la nouvelle séance apparaît ici quelques minutes plus tard, sans perdre votre progression.'));
  s4.append(el('p', 'note', DB.vocab.length + ' expressions de cours · ' + DB.links.length + ' mots de liaison · ' + DB.tips.length + ' astuces · ' + DB.pitfalls.length + ' pièges · ' + (DB.prompts.length + DB.lessons.reduce((n, l) => n + l.speaking.length, 0)) + ' sujets d’oral'));
  view.append(s4);
}

function importText(text) {
  const obj = JSON.parse(text);
  const before = Object.keys(S.p).length + Object.keys(S.pr).length;
  merge(obj, 'import');
  const after = Object.keys(S.p).length + Object.keys(S.pr).length;
  toast('Progression importée' + (after > before ? ' : ' + plural(after - before, 'élément') + ' ajouté' + (after - before > 1 ? 's' : '') : '') + '.');
}
