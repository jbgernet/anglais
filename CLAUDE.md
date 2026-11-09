# Carnet d'anglais — consignes pour Claude

App web (HTML, CSS, JavaScript sans compilation) pour apprendre le vocabulaire de mes cours d'anglais
et gagner en aisance à l'oral. Publiée par GitHub Pages depuis la branche `main` :
https://jbgernet.github.io/anglais/

Je suis francophone, niveau B1-B2. L'interface est en français, le contenu à apprendre en anglais.

## Structure

- `index.html`, `css/app.css`, `js/*.js` : l'app (modules ES, aucune dépendance).
  - `js/data.js` charge le contenu ; `js/store.js` la progression ; `js/sync.js` la synchro par Gist.
  - `js/exercises.js` les exercices ; `js/speak.js` la partie « Parler » ; `js/views.js` accueil, vocabulaire, réglages.
- `data/lessons/index.json` : liste ordonnée des fichiers de séance.
- `data/lessons/NN-titre.json` : une séance de cours.
- `data/fluency.json` : mots de liaison, astuces, pièges, sujets d'oral avec réponses modèles.
- `data/legacy-ids.json` : correspondance avec les identifiants de l'ancien carnet (e001…). Ne pas modifier.
- `tools/check_data.py` : vérification du contenu, à lancer avant chaque commit.
- `sw.js` : fonctionnement hors connexion. Incrémenter `CACHE` (anglais-v2, v3…) quand on change le code.

## Ajouter une séance de cours (cas le plus fréquent)

Je fournis la fiche du cours (PDF ou texte). Pour l'ajouter :

1. Créer `data/lessons/NN-titre-court.json` (NN = numéro sur deux chiffres, ou `03bis` pour une séance intermédiaire) :
   ```json
   {
     "num": 5,
     "label": "4",
     "title": "Titre du support",
     "subtitle": "Sous-titre ou question centrale",
     "entries": [
       {
         "id": "ward-off",
         "t": "ward off",
         "d": "to stop something unpleasant from getting closer or affecting you",
         "x": ["Modern medicine can [[ward off]] death in many situations."],
         "s": "Nom de la partie du support"
       }
     ],
     "speaking": [
       { "q": "Question d'oral du support ?", "uses": ["ward-off"] }
     ]
   }
   ```
   - `num` : entier unique et croissant (ordre d'affichage). `label` : ce qui s'affiche (« 4 », « 3bis »).
   - `t` : l'expression telle qu'on l'apprend (avec « sb », « sth », « someone » si besoin).
   - `d` : définition en anglais, simple, sans majuscule initiale ni point final.
   - `x` : phrases d'exemple tirées du support ; entourer de `[[…]]` exactement la forme employée dans la phrase
     (conjuguée si besoin : `[[held]] everyone back`). Une seule paire de crochets par phrase.
     Si le support ne donne pas de phrase, en écrire une naturelle, niveau B2.
   - `s` : la partie du support où apparaît l'expression.
   - `id` : l'expression en minuscules, sans accents ni ponctuation, mots séparés par des tirets.
     Si l'expression existe déjà dans une autre séance, réutiliser le MÊME `id` : l'app fusionne les fiches.
   - `speaking` : les questions d'oral du support, avec les `id` des expressions qu'elles font employer.
2. Ajouter le nom du fichier à la fin de `data/lessons/index.json`.
3. Lancer `python3 tools/check_data.py` et corriger jusqu'à « tout est cohérent ».
4. Commit et push sur `main` : GitHub Pages publie en une à deux minutes.

Règle d'or : ne jamais renommer ni supprimer l'`id` d'une expression existante. La progression est rangée par `id`.

## Contenu « Parler » (`data/fluency.json`)

- `groups` : familles de mots de liaison (`id`, `title`, `why`, `items`). Les items suivent le format
  des expressions (`id`, `t`, `d` en français, `x` avec `[[…]]`). Dans l'app, leur identifiant devient `lk-<id>`.
- `tips` : astuces (`title`, `body`, `before`, `after`).
- `pitfalls` : erreurs fréquentes (`wrong`, `right`, `why`, et `detect` : expression régulière, insensible à la casse,
  qui repère l'erreur dans une réponse orale ; elle doit repérer `wrong` et jamais `right`).
- `kinds` : types de questions, avec une méthode et les familles de mots de liaison à proposer.
- `prompts` : sujets d'oral avec une réponse modèle (environ 80 à 100 mots, anglais oral naturel, B2).

## Principes

- Pas de dépendance, pas d'étape de compilation : les fichiers du dépôt sont servis tels quels.
- La correction par IA reste gratuite : l'app ouvre `https://claude.ai/new?q=…` avec la consigne
  (abonnement Pro), jamais l'API payante.
- Progression : `localStorage` + Gist privé (jeton saisi dans Réglages, jamais dans le dépôt, qui est public).
- Tester sur téléphone (≈ 400 px de large) et en mode sombre.
