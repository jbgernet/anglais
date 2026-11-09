// Fiche d'une expression (vocabulaire ou mot de liaison), repliable, avec utilité et statut.

import { el, button, exNode, cap1 } from './util.js';
import { status, priOf, setPri, setStatus, PRI, PRI_ORDER } from './store.js';
import { lessonName } from './data.js';
import { speakBtn } from './speech.js';

const open = new Set(); // fiches dépliées, gardées quand la liste se redessine

export function entryNode(it, onChanged) {
  const wrap = el('article', 'entry');
  wrap.id = 'it-' + it.id;
  const row = el('div', 'entry-row');
  const head = button('', 'entry-head');
  head.setAttribute('aria-expanded', String(open.has(it.id)));
  head.append(el('i', 'dot s-' + status(it.id)));
  const txt = el('span', 'entry-txt');
  const term = el('span', 'entry-term', it.t);
  const pv = priOf(it.id);
  if (pv) term.append(el('span', 'tag t-' + pv, PRI[pv]));
  txt.append(term, el('span', 'entry-def', cap1(it.d)));
  head.append(txt, el('i', 'chev'));
  row.append(head, speakBtn(it.t, 'Écouter l’expression'));
  wrap.append(row);

  const body = el('div', 'entry-body');
  body.hidden = !open.has(it.id);
  it.x.forEach((x) => {
    const exr = el('div', 'ex-row');
    exr.append(exNode(x, 'show'), speakBtn(x, 'Écouter la phrase'));
    body.append(exr);
  });
  const meta = it.kind === 'link'
    ? 'Mot de liaison · ' + it.s
    : it.lessons.map((n) => lessonName(n)).join(' et ') + (it.s ? ' · ' + it.s : '');
  body.append(el('p', 'meta', meta));

  const pr = el('div', 'row');
  pr.append(el('span', 'label', 'Utilité'));
  PRI_ORDER.forEach((k) => {
    const b = button(PRI[k], 'chip');
    b.setAttribute('aria-pressed', String(priOf(it.id) === k));
    b.addEventListener('click', () => {
      setPri(it.id, priOf(it.id) === k ? null : k);
      if (onChanged) onChanged(it.id);
    });
    pr.append(b);
  });
  body.append(pr);

  const st = el('div', 'row');
  st.append(el('span', 'label', 'Statut'));
  [['new', 'Nouveau'], ['review', 'À revoir'], ['mastered', 'Retenu']].forEach(([k, label]) => {
    const b = button(label, 'chip');
    b.setAttribute('aria-pressed', String(status(it.id) === k));
    b.addEventListener('click', () => { setStatus(it.id, k); if (onChanged) onChanged(it.id); });
    st.append(b);
  });
  body.append(st);
  wrap.append(body);

  head.addEventListener('click', () => {
    if (open.has(it.id)) open.delete(it.id); else open.add(it.id);
    head.setAttribute('aria-expanded', String(open.has(it.id)));
    body.hidden = !open.has(it.id);
  });
  return wrap;
}

export function keepInView(id) {
  const n = document.getElementById('it-' + id);
  if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
}
