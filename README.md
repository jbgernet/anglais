# Carnet d'anglais

Application web (installable sur iPhone et Android) pour apprendre le vocabulaire de mes cours d'anglais
et gagner en aisance à l'oral.

**Adresse :** https://jbgernet.github.io/anglais/

## Ce qu'on y trouve

- **Aujourd'hui** : ce qu'il y a à revoir, le mot de liaison, le sujet d'oral et l'astuce du jour.
- **Vocabulaire** : toutes les expressions des cours, à écouter, à noter (incontournable, si possible, peu probable) et à marquer comme retenues.
- **Exercices**, du plus facile au plus exigeant : relier, écouter, deviner le sens, quelle expression ?,
  deviner l'expression, phrases à trous, écrire, test mixte. Révision espacée : une expression revient
  après 1 jour, 3 jours, 1 semaine puis 3 semaines.
- **Parler** : prise de parole au micro avec analyse automatique et correction par Claude, mots de liaison
  classés par fonction, astuces de langage, pièges à éviter.

## Fonctionnement

- Aucune compilation : `index.html`, `css/`, `js/` et `data/` sont publiés tels quels par GitHub Pages (branche `main`).
- Le contenu est dans `data/` : un fichier par séance de cours dans `data/lessons/`, et `data/fluency.json` pour l'oral.
- La progression est gardée sur chaque appareil et, si on le souhaite, synchronisée dans un **Gist privé**
  du compte GitHub (Réglages → Synchroniser avec GitHub). Le jeton n'est jamais écrit dans ce dépôt public.
- La correction des réponses orales ouvre une conversation Claude pré-remplie : elle passe par l'abonnement,
  sans clé API.

## Ajouter une séance

Voir `CLAUDE.md` : la procédure est écrite pour que Claude puisse l'appliquer à partir de la fiche du cours.
Avant de publier : `python3 tools/check_data.py`.
