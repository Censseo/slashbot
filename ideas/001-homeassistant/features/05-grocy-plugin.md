# Feature: Grocy Plugin

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 05
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Plugin slashbot (TypeScript) donnant a l'agent IA un acces complet a l'API REST de Grocy pour gerer l'inventaire du foyer, les recettes, les plans de repas et les listes de courses. L'acces est direct (API Grocy) et non via l'integration HA native (trop limitee). C'est le premier cas d'usage concret et motivant de slashbot dans HA.

## User Value

**Who benefits**: Household Members (usage quotidien) et Power User (configuration)
**What they gain**: Gestion complete du quotidien en langage naturel - "qu'est-ce qu'il reste ?", "propose un menu", "ajoute du lait a la liste"
**Success metric**: Capacite a gerer l'inventaire, consulter des recettes, planifier des menus et maintenir la liste de courses entierement via slashbot

## Scope

### This Feature Includes
- Plugin slashbot standard (`src/plugins/grocy/`)
- Outils AI (tools) exposes au LLM :
  - `grocy_get_stock` - Inventaire complet ou filtre (par lieu, categorie, peremption)
  - `grocy_consume_product` - Consommer un produit (retirer du stock)
  - `grocy_add_to_stock` - Ajouter un produit au stock
  - `grocy_get_recipes` - Lister/rechercher les recettes
  - `grocy_get_recipe_details` - Details d'une recette (ingredients, etapes)
  - `grocy_get_meal_plan` - Consulter le plan de repas
  - `grocy_add_meal_plan` - Ajouter un repas au plan
  - `grocy_get_shopping_list` - Consulter la liste de courses
  - `grocy_add_to_shopping_list` - Ajouter un article a la liste
  - `grocy_clear_shopping_list` - Vider la liste de courses
- Client HTTP pour l'API REST Grocy
- Prompt contribution decrivant les capacites Grocy au LLM
- Detection automatique de l'URL Grocy (via add-on HA ou config manuelle)

### This Feature Does NOT Include
- Interface Grocy dans HA (on utilise l'API, pas l'UI)
- Gestion des utilisateurs Grocy
- Scanner de codes-barres (pourrait etre un futur ajout)

## Key Use Cases

### Use Case 1: Consulter l'inventaire
**Actor**: Household Member (via Telegram)
**Goal**: Savoir ce qu'il y a dans le frigo
**Flow**:
1. "Qu'est-ce qu'il reste dans le frigo ?"
2. Slashbot appelle `grocy_get_stock` avec filtre location "Frigo"
3. Repond avec la liste : produit, quantite, date de peremption
4. Alerte sur les produits bientot perimes

### Use Case 2: Planifier un menu
**Actor**: Household Member (via HA Panel)
**Goal**: Menu de la semaine
**Flow**:
1. "Propose-moi un menu pour la semaine avec ce qu'on a"
2. Slashbot consulte `grocy_get_stock` et `grocy_get_recipes`
3. L'IA croise le stock avec les recettes realisables
4. Propose un menu equilibre
5. Sur validation, appelle `grocy_add_meal_plan` pour chaque repas
6. Genere la liste de courses via `grocy_add_to_shopping_list` pour les ingredients manquants

### Use Case 3: Liste de courses
**Actor**: Household Member (via Discord)
**Goal**: Completer la liste de courses
**Flow**:
1. "Ajoute du lait, des oeufs et du beurre a la liste de courses"
2. Slashbot appelle `grocy_add_to_shopping_list` pour chaque produit
3. Confirme "Ajoute : lait, oeufs, beurre"
4. "Montre la liste complete" -> affiche toute la liste

### Use Case 4: Alertes peremption
**Actor**: Power User (via automation HA)
**Goal**: Etre alerte des produits qui vont perimer
**Flow**:
1. Automation HA quotidienne appelle `slashbot.send_message("quels produits periment dans les 3 prochains jours ?")`
2. Slashbot interroge `grocy_get_stock` filtre par date
3. Le resultat est envoye via notification HA ou Telegram

## Dependencies

### Requires
- [Feature 03](03-ha-core-plugin.md): Partage l'infrastructure de connexion et le pattern plugin HA
- Grocy accessible sur le reseau (add-on HA ou instance externe)

### Enables
- Aucune dependance directe, mais enrichit tous les canaux (Telegram, Discord, Panel, Assist)

## Technical Hints

### Required Tools & Versions

- **Grocy API**: v2 (REST, documentation : https://demo.grocy.info/api)
- **Grocy**: 4.0+ (API stable)

### Implementation Notes

- L'URL et la cle API Grocy sont configurees dans les options de l'add-on
- Detection automatique : si le Grocy add-on est installe, utiliser `http://addon_grocy:9283`
- L'API Grocy utilise une cle API (header `GROCY-API-KEY`)
- Les reponses de stock sont formatees pour etre lisibles (tableau, pas de JSON brut)
- Le prompt systeme inclut les categories de produits et lieux de stockage disponibles
- Le tool `grocy_get_stock` supporte le filtrage multi-criteres (lieu, categorie, peremption < X jours)
- La planification de menu est un workflow multi-etapes orchestre par le LLM (pas un tool unique)

## Open Questions

- Faut-il supporter la creation de nouvelles recettes via slashbot ou juste la consultation ?
- Comment gerer les produits qui n'existent pas encore dans Grocy ? (creation automatique ?)
- Faut-il un mapping intelligent entre le langage naturel et les noms de produits Grocy ? (ex: "lait" -> "Lait demi-ecreme 1L")

## Notes

L'API Grocy est riche et bien documentee. Les endpoints principaux :
- `GET /api/stock` - Inventaire
- `POST /api/stock/products/{id}/consume` - Consommer
- `POST /api/stock/products/{id}/add` - Ajouter au stock
- `GET /api/objects/recipes` - Recettes
- `GET /api/objects/meal_plan` - Plan de repas
- `GET /api/objects/shopping_list` - Liste de courses
- `POST /api/objects/shopping_list` - Ajouter a la liste
