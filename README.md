# Arkantya — système Foundry VTT (v13)

Jeu de rôle **Arkantya** (règles issues du scénario d’initiation *La Plume de Dragon*, E. Din Cyr). Compatible **Foundry v13** (testé `verified: 13`).

## Installation

1. Copiez le dossier `arkantya` dans le répertoire `Data/systems/` de Foundry (ce dépôt l’a déjà placé à côté d’autres systèmes).
2. Créez un monde et choisissez le système **Arkantya** dans la liste des systèmes de jeu.

## Règles prises en charge

- Six **attributs** (6–18) et **compétences** (0–4) : Constitution, Esprit, Dextérité, Habileté, Combativité, Arkanes (les deux derniers avec compétences nommées librement).
- **Test** : 1d20 ≤ attribut + compétence (+ bonus de talent / situation saisis dans la fenêtre de jet). **1** = réussite critique, **20** = échec critique.
- **Destin** : champ 1–6 + bouton « Lancer le Destin (1d6) » ; l’**initiative** de combat utilise `@system.session.destin` (comme en table : ordre lié au Destin de séance).
- **Jetons** Blessure / Fatigue / Surmenage (0–4) avec barres sur le token (Blessure et Fatigue).
- Onglet **Séance** (inventaire, or, exemples de combat, infos supp.) calqué sur la fiche de séance type *Börjk*.

Les PDF de référence (fiches perso, séance, scénario joueur) peuvent rester dans le dossier voisin `Arkantya/` pour consultation ; le système ne les embarque pas.

## Importer Börjk

1. Dans Foundry : **Actors** → icône dossier **Importer**.
2. Choisissez le fichier `data/import-borjk.json` (import de données d’acteur JSON selon la version de Foundry : menu *Importer l’acteur* ou glisser-déposer selon votre build).

Si l’import JSON direct n’est pas proposé, créez un acteur *Personnage* et copiez-collez les valeurs depuis `import-borjk.json` (champ `system`).

## API (macros)

```js
// Jet programmatique (sans boîte de dialogue)
await CONFIG.ARKANTYA.rollArkantyaTest(actor, {
  attrKey: "habilete",
  skillKey: "perception",
  situational: 0,
  talent: 0
});

// Combativité / Arkanes : utiliser compIndex (0-based)
await CONFIG.ARKANTYA.rollArkantyaTest(actor, {
  attrKey: "combativite",
  compIndex: 0,
  situational: 0,
  talent: 0
});
```

## Crédits

- **Arkantya** : Ezechiel Din Cyr — utilisez les supports officiels (Wankil / scénarios) pour la diffusion des PDF et l’usage commercial.
- Conversion Foundry : structure libre pour usage sur table privée.
