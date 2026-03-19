# Projet : EXTENSION-VODIA-PUBLIC

## Description

Fork public de Digitis Assistant (EXTENTION-DIGITS) destine a etre partage avec Vodia et la communaute.
Version epuree : sidebar admin + notes seulement, sans les outils personnels Digitis.

## Public cible

- Administrateurs Vodia PBX
- Equipe Vodia

## Repo GitHub

`david-digitis/vodia-pbx-admin-sidebar` (public)

## Securite

- **Zero token / zero API key** : utilise le cookie de session admin existant (meme origine)
- **Lecture seule** : uniquement des GET sur l'API REST Vodia
- **Pas de credentials** : aucun fichier config.js, aucun secret
- **Permissions minimales** : `storage` uniquement
- **IMPORTANT** : ne jamais ajouter de features Digitis-specifiques (Gemini, Gist, overlay)

## Architecture

```
EXTENSION-VODIA-PUBLIC/
├── CLAUDE.md
├── CHANGELOG.md
├── README.md
├── LICENSE
├── Images/                ← Screenshots pour README
└── package/               ← Dossier a charger dans Chrome
    ├── manifest.json      ← Manifest V3
    ├── content.js         ← Sidebar Vodia (10 types de comptes)
    ├── content.css        ← Styles sidebar
    ├── popup.html         ← Grille 3 colonnes + toolbar
    ├── popup.js           ← Notes + tabs + drag-and-drop + export/import
    ├── convention.json    ← Convention de numerotation par defaut
    └── icons/
```

## Stack

- JavaScript vanilla
- Chrome Manifest V3
- Vodia REST API (lecture seule, cookie session)

## Differences avec EXTENTION-DIGITS (version privee)

| Prive (EXTENTION-DIGITS) | Public (ce projet) |
|--------------------------|-------------------|
| Overlay Gemini (double Ctrl+C) | Non |
| Sync GitHub Gist | Non |
| background.js (relay API) | Non |
| config.js (credentials) | Non |
| Export/Import JSON | Oui |
| Bouton Reset convention | Oui |

## Contraintes

- Ne JAMAIS ajouter de credentials ou secrets
- Ne JAMAIS referencer l'extension privee Digitis
- Garder les permissions au minimum
- Tout doit fonctionner sans configuration (zero setup)
