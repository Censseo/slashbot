# Feature: Assist Pipeline

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 08
**Priority**: P3
**Status**: Not Specified

## Summary

Enregistrer slashbot comme "conversation agent" dans le systeme Assist de Home Assistant. Cela permet d'utiliser slashbot via les interfaces vocales HA (Wyoming, microphones connectes), les automatisations Assist, et le dialogue natif HA, tout en conservant l'acces a toutes les capacites de l'agent (plugins HA, Grocy, MQTT, Node-RED).

## User Value

**Who benefits**: Tous les utilisateurs, en particulier les Household Members
**What they gain**: Interaction vocale avec slashbot via les appareils HA (enceintes, microphones), remplacement du conversation agent par defaut par un agent IA complet
**Success metric**: Slashbot selectionnable comme conversation agent dans les settings Assist, reponses fonctionnelles via vocal et texte

## Scope

### This Feature Includes
- Enregistrement comme `conversation.AgentInfo` dans HA
- Implementation du protocole `conversation.process` (intent handling)
- Support des `intent` HA natifs + fallback vers le LLM pour les requetes non-standard
- Configuration dans l'UI HA (Settings > Voice assistants > Slashbot)
- Compatibilite avec les pipelines STT/TTS existants (Wyoming, Piper, Whisper)

### This Feature Does NOT Include
- Propres services STT/TTS (on utilise ceux configures dans HA)
- Wake word detection (gere par HA)
- Support multi-langue au-dela de ce que le LLM supporte nativement

## Key Use Cases

### Use Case 1: Commande vocale
**Actor**: Household Member
**Goal**: Controler la maison a la voix
**Flow**:
1. Dit "Hey Jarvis, qu'est-ce qu'il reste dans le frigo ?"
2. HA capture la voix via le micro, transcrit avec Whisper
3. Le texte est envoye a slashbot via l'Assist pipeline
4. Slashbot interroge Grocy, formule une reponse
5. HA synthetise la reponse avec Piper
6. L'enceinte lit la liste des produits

### Use Case 2: Assist dans le dashboard
**Actor**: Household Member
**Goal**: Utiliser Assist avec slashbot comme backend
**Flow**:
1. Ouvre Assist dans le dashboard HA (icone micro)
2. Tape ou dicte "allume la lumiere et mets de la musique"
3. Slashbot traite la requete multi-actions
4. Execute les services HA correspondants
5. Repond dans Assist

## Dependencies

### Requires
- [Feature 02](02-ha-integration.md): L'enregistrement du conversation agent se fait dans l'integration
- [Feature 04](04-ha-chat-panel.md): Partage l'infrastructure de communication

### Enables
- Integration vocale complete dans l'ecosysteme HA
- Compatibilite avec les appareils Wyoming (satellites vocaux)

## Technical Hints

### Required Tools & Versions

- **Home Assistant Assist API**: Conversation agent protocol (2024.1+)
- **Wyoming protocol**: Pour les satellites vocaux (optionnel)

### Implementation Notes

- L'agent est enregistre via `conversation.async_set_agent()` dans le composant Python
- Le handler `conversation.process()` recoit le texte et doit retourner une `ConversationResult`
- Le bridge vers slashbot utilise le meme WebSocket que le panel chat
- Les reponses doivent etre concises pour la synthese vocale (pas de markdown, pas de tableaux)
- Le `ConversationResult` inclut un `speech` (reponse vocale) et optionnellement un `card` (affichage)
- Les intents HA natifs (HassTurnOn, HassTurnOff, etc.) peuvent etre geres directement sans LLM pour plus de rapidite
- Fallback vers le LLM pour les requetes complexes ou non-standard

## Open Questions

- Faut-il gerer les intents HA natifs en fast-path (sans LLM) ou tout envoyer au LLM ?
- Comment gerer les reponses longues pour le TTS ? (resume automatique ?)
- Faut-il un mode "concis" specifique pour les reponses vocales vs. texte ?
- Comment gerer le contexte de conversation en mode vocal (sessions courtes) ?

## Notes

L'Assist pipeline HA suit cette chaine :
```
Wake Word -> STT (Whisper) -> Conversation Agent (slashbot) -> TTS (Piper) -> Audio
```

Slashbot remplace uniquement la partie "Conversation Agent". Le reste de la pipeline (STT, TTS, wake word) est gere par HA.
