/**
 * @module ui/tui-message-list
 *
 * Message rendering component for the SlashbotTui.
 * Displays conversation messages, agent activity indicators, and the command palette.
 */

import React from 'react';
import type { ChatLine } from './palette.js';
import { MessageLine } from './message-line.js';
import { CommandPalette } from './command-palette.js';

export interface MessageListProps {
  lines: ChatLine[];
  paletteOpen: boolean;
  filteredCommands: Array<{ id: string; description: string }>;
  paletteIndex: number;
  paletteItemPrefix: string;
  cols: number;
}

export function MessageList({
  lines,
  paletteOpen,
  filteredCommands,
  paletteIndex,
  paletteItemPrefix,
  cols,
}: MessageListProps): React.ReactElement {
  return (
    <>
      {lines.map((line) => (
        <MessageLine key={line.id} line={line} cols={cols} />
      ))}
      {paletteOpen && filteredCommands.length > 0 && (
        <CommandPalette
          commands={filteredCommands}
          selectedIndex={paletteIndex}
          cols={cols}
          prefix={paletteItemPrefix}
        />
      )}
    </>
  );
}
