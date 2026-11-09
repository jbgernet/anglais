#!/usr/bin/env python3
"""Vérifie le contenu de l'app avant de publier : python3 tools/check_data.py

- chaque séance listée dans data/lessons/index.json existe et a les bons champs ;
- chaque expression a un identifiant lisible, une définition et des exemples avec
  exactement un [[…]] autour de la forme employée ;
- les questions d'oral ne citent que des expressions existantes ;
- aucun identifiant de l'ancien carnet n'a disparu (sinon la progression importée se perd) ;
- les détecteurs d'erreurs de data/fluency.json repèrent la phrase fautive et pas la bonne.
"""
import io, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []

def err(msg):
    errors.append(msg)

def load(p):
    with io.open(ROOT / p, encoding="utf-8") as f:
        return json.load(f)

ID_RX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
index = load("data/lessons/index.json")
ids, nums = {}, set()
for fname in index["lessons"]:
    try:
        L = load("data/lessons/" + fname)
    except Exception as e:
        err(f"{fname} : illisible ({e})")
        continue
    for k in ("num", "label", "title", "entries"):
        if k not in L:
            err(f"{fname} : champ « {k} » manquant")
    if L.get("num") in nums:
        err(f"{fname} : numéro {L.get('num')} déjà utilisé par une autre séance")
    nums.add(L.get("num"))
    seen = set()
    for e in L.get("entries", []):
        i = e.get("id", "")
        if not ID_RX.match(i):
            err(f"{fname} : identifiant invalide « {i} »")
        if i in seen:
            err(f"{fname} : identifiant en double « {i} »")
        seen.add(i)
        if i in ids and ids[i] != e.get("t"):
            err(f"{fname} : « {i} » désigne déjà « {ids[i]} » dans une autre séance")
        ids[i] = e.get("t")
        if not e.get("t") or not e.get("d"):
            err(f"{fname} : « {i} » sans expression ou sans définition")
        for x in e.get("x", []):
            if x.count("[[") != 1 or x.count("]]") != 1:
                err(f"{fname} : exemple de « {i} » sans exactement un [[…]] : {x}")
for fname in index["lessons"]:
    L = load("data/lessons/" + fname)
    for s in L.get("speaking", []):
        for u in s.get("uses", []):
            if u not in ids:
                err(f"{fname} : la question « {s['q'][:40]}… » cite « {u} », qui n'existe pas")

legacy = load("data/legacy-ids.json")
for old, new in legacy.items():
    if new not in ids:
        err(f"data/legacy-ids.json : « {new} » ({old}) n'existe plus : ne renommez pas un identifiant existant")

F = load("data/fluency.json")
lk = set()
for g in F["groups"]:
    for it in g["items"]:
        if it["id"] in lk:
            err(f"fluency : identifiant en double « {it['id']} »")
        lk.add(it["id"])
        for x in it["x"]:
            if x.count("[[") != 1 or x.count("]]") != 1:
                err(f"fluency : exemple de « {it['id']} » sans exactement un [[…]]")
gids = {g["id"] for g in F["groups"]}
for k, v in F["kinds"].items():
    for g in v["groups"]:
        if g not in gids:
            err(f"fluency : le type « {k} » cite la famille inconnue « {g} »")
for p in F["prompts"]:
    if p["kind"] not in F["kinds"]:
        err(f"fluency : le sujet « {p['id']} » a un type inconnu")
for p in F["pitfalls"]:
    if "detect" in p:
        rx = re.compile(p["detect"], re.I)
        if not rx.search(p["wrong"]):
            err(f"fluency : le détecteur de « {p['id']} » ne repère pas la phrase fautive")
        if rx.search(p["right"]):
            err(f"fluency : le détecteur de « {p['id']} » se déclenche sur la bonne phrase")

total = len(ids)
if errors:
    print("\n".join("✗ " + e for e in errors))
    sys.exit(1)
print(f"✓ {len(index['lessons'])} séances, {total} expressions, {len(lk)} mots de liaison, {len(F['pitfalls'])} pièges : tout est cohérent.")
