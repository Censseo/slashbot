---
name: bot-connector-patterns
description: Discord.js and Telegraf bot connector patterns for slashbot
---

# Bot Connector Patterns

## Connector Interface

All platform connectors implement the `Connector` interface from `src/connectors/base.ts`:

```typescript
export interface Connector {
  readonly source: ConnectorSource;    // 'cli' | 'telegram' | 'discord'
  readonly config: ConnectorConfig;
  setMessageHandler(handler: MessageHandler): void;
  setEventBus?(eventBus: EventBus): void;
  start(): Promise<void>;
  stop(): void;
  sendMessage(text: string): Promise<void>;
  isRunning(): boolean;
}

export interface ConnectorConfig {
  maxMessageLength: number;    // Platform message limit
  supportsMarkdown: boolean;
  conciseMode: boolean;        // Shorter responses for chat platforms
}
```

## Platform Configs

```typescript
export const PLATFORM_CONFIGS: Record<ConnectorSource, ConnectorConfig> = {
  cli:      { maxMessageLength: Infinity, supportsMarkdown: true,  conciseMode: false },
  telegram: { maxMessageLength: 4000,     supportsMarkdown: true,  conciseMode: true  },
  discord:  { maxMessageLength: 2000,     supportsMarkdown: true,  conciseMode: true  },
};
```

## Connector Directory Structure

```
src/connectors/telegram/
  index.ts          # TelegramPlugin class
  connector.ts      # TelegramConnector (implements Connector)
  commands.ts       # Telegram-specific slash commands
  parser.ts         # Message parsing utilities
  plugin.ts         # Plugin contribution wiring
  types.ts          # Telegram-specific types

src/connectors/discord/
  index.ts          # DiscordPlugin class
  connector.ts      # DiscordConnector (implements Connector)
  commands.ts       # Discord slash commands
  parser.ts         # Message parsing
  plugin.ts         # Plugin contribution wiring
  types.ts          # Discord-specific types
```

## Connector as Plugin

Connectors are also plugins — they implement both `Connector` and `Plugin` interfaces:

```typescript
export class TelegramPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'connector.telegram',
    name: 'Telegram',
    category: 'connector',
    // ...
  };

  async init(context: PluginContext): Promise<void> {
    // Initialize Telegraf bot
    // Register with ConnectorRegistry
  }
}
```

## Libraries

- **Discord**: `discord.js` v14 — Guild-based bot with slash commands
- **Telegram**: `telegraf` v4 — Telegram Bot API wrapper

## Message Handling

```typescript
type MessageHandler = (
  message: string,
  source: ConnectorSource,
  metadata?: MessageMetadata,
) => Promise<string | void>;

interface MessageMetadata {
  alreadyDisplayed?: boolean;
  sessionId?: string;
  chatId?: string;
}
```

## Message Splitting

The `splitMessage()` utility respects platform limits:
- Splits at newlines first, then spaces, then hard-splits
- Ensures chunks stay within `maxMessageLength`

## ConnectorRegistry

Manages all active connectors with concurrent locking via `src/connectors/locks.ts`:

```typescript
// Register connector
registry.register(connector);

// Start all connectors
await registry.startAll();

// Route message to connector
await registry.sendMessage(source, text);
```

## Adding a New Connector

1. Create directory: `src/connectors/my-platform/`
2. Implement `Connector` interface in `connector.ts`
3. Create plugin wrapper in `index.ts`
4. Register in `src/plugins/loader.ts`
5. Add platform config to `PLATFORM_CONFIGS` in `src/connectors/base.ts`
