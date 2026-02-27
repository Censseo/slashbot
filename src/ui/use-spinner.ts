/**
 * @module ui/use-spinner
 *
 * Animated spinner hook for the Slashbot TUI.
 * Provides smooth braille-based spinning and a wave animation
 * for use in thinking indicators and progress bars.
 */
import { useState, useEffect } from 'react';

// Braille dot spinner — smooth rotation
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Dots wave — ripple effect for progress bar
const DOTS_FRAMES = [
  '⠁⠂⠄⡀⢀⠠⠐⠈',
  '⠂⠄⡀⢀⠠⠐⠈⠁',
  '⠄⡀⢀⠠⠐⠈⠁⠂',
  '⡀⢀⠠⠐⠈⠁⠂⠄',
  '⢀⠠⠐⠈⠁⠂⠄⡀',
  '⠠⠐⠈⠁⠂⠄⡀⢀',
  '⠐⠈⠁⠂⠄⡀⢀⠠',
  '⠈⠁⠂⠄⡀⢀⠠⠐',
];

/**
 * Returns an animated spinner character that cycles at 80ms intervals.
 * Only ticks while `active` is true.
 */
export function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(id);
  }, [active]);

  return active ? SPINNER_FRAMES[frame] : ' ';
}

/**
 * Returns an animated dots wave string that shifts at 120ms intervals.
 * Only ticks while `active` is true.
 */
export function useDots(active: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % DOTS_FRAMES.length);
    }, 120);
    return () => clearInterval(id);
  }, [active]);

  return active ? DOTS_FRAMES[frame] : '';
}

/**
 * Returns a smoothly cycling float 0..1 for gradient/pulse effects.
 * Cycles with a configurable period (default 2000ms).
 */
export function usePulse(active: boolean, periodMs = 2000): number {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = 60;
    const id = setInterval(() => {
      setPhase((p) => (p + interval / periodMs) % 1);
    }, interval);
    return () => clearInterval(id);
  }, [active, periodMs]);

  return active ? phase : 0;
}
