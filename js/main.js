// Démarrage, navigation et rafraîchissement des pages.

import { loadData } from './data.js';
import { load, onChange } from './store.js';
import { initSync, onSync, sync } from './sync.js';
import { initVoices } from './speech.js';
import { $, el, clear } from './util.js';
import { renderHome, renderVocab, renderSettings } from './views.js';
import { renderExercises } from './exercises.js';
import { renderSpeak } from './speak.js';

const view = $('#view');
let current = '';

function parts() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

function render() {
  const [page = '', sub = '', arg = ''] = parts();
  const key = page || 'accueil';
  const changedPage = key + '/' + sub !== current;
  current = key + '/' + sub;
  const y = window.scrollY;
  clear(view);
  const rerender = () => render();
  if (key === 'vocabulaire') renderVocab(view, rerender);
  else if (key === 'exercices') renderExercises(view, sub, rerender);
  else if (key === 'parler') renderSpeak(view, sub, arg, rerender);
  else if (key === 'reglages') renderSettings(view, rerender);
  else renderHome(view, rerender);
  document.querySelectorAll('.bottomnav a').forEach((a) => {
    const on = a.dataset.nav === key || (key === 'accueil' && a.dataset.nav === 'accueil');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (changedPage) {
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, y);
  }
}

// Une progression arrivée d'un autre appareil : on redessine les pages de consultation,
// jamais une série en cours.
function refreshIfIdle() {
  const [page = '', sub = ''] = parts();
  if (page === 'exercices' && sub) return;
  if (page === 'parler' && sub === 'prise-de-parole') return;
  if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  render();
}

function syncDot() {
  const d = $('#sync-dot');
  if (!d) return;
  d.className = 'sync-dot s-' + sync.state;
  d.hidden = sync.state === 'off';
  d.title = sync.state === 'error' ? sync.error : sync.state === 'busy' ? 'Synchronisation…' : 'Progression synchronisée';
  d.setAttribute('aria-label', d.title);
}

async function boot() {
  load();
  try {
    await loadData();
  } catch (e) {
    clear(view);
    view.append(el('h1', 'page-title', 'Chargement impossible'),
      el('p', 'lead', 'Le contenu de l’app n’a pas pu être chargé. Vérifiez la connexion puis rechargez la page.'));
    return;
  }
  initVoices(() => { if (parts()[0] === 'reglages') refreshIfIdle(); });
  onChange((origin) => { if (origin === 'remote') refreshIfIdle(); });
  onSync(syncDot);
  initSync();
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
