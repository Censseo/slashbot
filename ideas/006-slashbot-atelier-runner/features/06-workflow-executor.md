# Feature: Workflow Executor

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 06
**Priority**: P3
**Status**: Not Specified

## Summary

Slashbot lit et exécute les YAML de workflow Atelier de façon autonome, sans dépendre de l'orchestrateur Spring Boot pour la boucle d'état. Slashbot devient un orchestrateur à part entière : il lit les steps, dispatche vers les plugins, gère les transitions, maintient l'état de session.

## User Value

**Who benefits**: Atelier (infrastructure)
**What they gain**: L'orchestrateur Spring Boot peut déléguer entièrement l'exécution d'un workflow à slashbot — réduction de la complexité Spring Boot, orchestration plus rapide (pas d'aller-retour HTTP par step).
**Success metric**: Un workflow complet (spec-kit.yml — 7 steps) s'exécute via slashbot sans intervention de l'orchestrateur Spring Boot après le déclenchement initial.

## Scope

### This Feature Includes

- Parser YAML workflow Atelier (steps, transitions, artefacts input/output)
- State machine : exécution séquentielle des steps, gestion des transitions
- Dispatch vers plugin registry par type de step (claude-code, http-call, etc.)
- Accumulation des artefacts entre steps (output d'un step = input du suivant)
- Reporting de progression vers Atelier (events `step_progress` → Redis → Spring Boot)
- Gestion des états terminaux : COMPLETED, FAILED, PAUSED

### This Feature Does NOT Include

- Le décision engine pour les branches conditionnelles — feature 07
- La modification des YAML workflow (read-only)
- La persistance longue durée des artefacts (délégué à l'API Atelier existante)

## Key Use Cases

### Use Case 1: Exécution workflow complet

**Actor**: Atelier (Spring Boot — déclenchement initial)
**Goal**: Exécuter un workflow end-to-end
**Flow**:
1. Spring Boot POST `/sessions/start` avec `{ workflowId: 'spec-kit', projectId, initialContext }`
2. Slashbot charge le YAML workflow
3. Boucle : pour chaque step en ordre → dispatch plugin → collecter artefact → évaluer transition
4. Events `step_progress` streamés vers Redis à chaque transition
5. Fin : event `workflow_complete` avec artefacts finaux

## Dependencies

### Requires

- Feature 01 (runner module)
- Feature 02 (claude-code plugin)
- Feature 04 (callback handler)

### Enables

- Feature 07 (decision engine)

## Technical Hints

### Implementation Notes

- Parser YAML : `js-yaml` ou `yaml` npm package
- La structure YAML Atelier (`spec-kit.yml`) est la référence de format à supporter
- State machine simple : Map<stepId, StepStatus> + current step pointer
- Artefacts entre steps : stockés en mémoire dans la session slashbot (pas Redis pour l'instant)
- Compatibilité Spring Boot : les events `step_progress` doivent matcher le format attendu par `StepExecutionService.java`

## Open Questions

- Spring Boot garde-t-il un rôle après le déclenchement (polling, validation) ou c'est full-async ?
- Les YAML workflow sont-ils servis par l'API Atelier ou lus depuis le filesystem du container ?
