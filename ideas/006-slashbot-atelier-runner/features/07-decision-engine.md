# Feature: Decision Engine

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 07
**Priority**: P3
**Status**: Not Specified

## Summary

Évaluation des conditions de branchement dans les workflows en runtime. Slashbot peut choisir la prochaine branche d'un workflow selon l'état des artefacts, le résultat d'un step, ou une décision LLM. Miroir de `DecisionNodeService.java` d'Atelier, mais avec accès direct au contexte d'exécution runtime.

## User Value

**Who benefits**: Atelier workflow author
**What they gain**: Les branches conditionnelles des workflows fonctionnent sans remonter à Spring Boot — décisions plus rapides, accès au contexte runtime complet.
**Success metric**: Les nœuds decision des workflows existants s'évaluent correctement via slashbot.

## Scope

### This Feature Includes

- Évaluation de règles de transition YAML (conditions sur artefacts, statuts)
- Décisions LLM (`DecisionRunnerInvoker` pattern) : délègue à claude-code plugin pour les décisions complexes
- Sélection de la prochaine branche et mise à jour state machine (feature 06)

### This Feature Does NOT Include

- La modification des règles de workflow
- Les décisions qui nécessitent input utilisateur (feature 04)

## Key Use Cases

### Use Case 1: Branchement conditionnel sur artefact

**Actor**: Workflow executor (feature 06)
**Goal**: Choisir la branche suivante
**Flow**:
1. Workflow executor atteint un nœud decision
2. Decision engine évalue les conditions YAML sur les artefacts disponibles
3. Retourne l'ID du step suivant
4. Workflow executor continue sur la branche sélectionnée

## Dependencies

### Requires

- Feature 06 (workflow executor — fournit le contexte et les artefacts)

### Enables

- Rien — feature terminale

## Technical Hints

### Implementation Notes

- Référence : `DecisionNodeService.java` pour les types de conditions supportés
- Conditions simples (existence artefact, valeur champ) : évaluation pure TypeScript
- Conditions complexes : spawner claude-code plugin avec prompt de décision (pattern `DecisionRunnerInvoker`)

## Open Questions

- Quels types de conditions sont définis dans les YAML workflow existants ? (à analyser sur spec-kit.yml)
