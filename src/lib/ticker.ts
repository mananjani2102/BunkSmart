import { useEffect, useState } from 'react';

const TICK_INTERVAL_MS = 60_000;

let sharedIntervalId: ReturnType<typeof setInterval> | null = null;
let currentMinuteKey = Math.floor(Date.now() / TICK_INTERVAL_MS);
const listeners = new Set<(minuteKey: number) => void>();

function notifyIfChanged(): void {
  const next = Math.floor(Date.now() / TICK_INTERVAL_MS);
  if (next !== currentMinuteKey) {
    currentMinuteKey = next;
    for (const listener of listeners) {
      listener(next);
    }
  }
}

function syncInterval(): void {
  if (listeners.size === 0) {
    if (sharedIntervalId !== null) {
      clearInterval(sharedIntervalId);
      sharedIntervalId = null;
    }
    return;
  }

  if (sharedIntervalId === null) {
    sharedIntervalId = setInterval(notifyIfChanged, TICK_INTERVAL_MS);
  }
}

/**
 * Shares a single 60-second interval across active subscribers and stops the
 * timer automatically when no subscriber is active.
 */
export function useMinuteTicker(enabled = true): number {
  const [minuteKey, setMinuteKey] = useState(() =>
    Math.floor(Date.now() / TICK_INTERVAL_MS)
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    listeners.add(setMinuteKey);
    syncInterval();
    void Promise.resolve().then(() => {
      if (!cancelled) {
        notifyIfChanged();
      }
    });

    return () => {
      cancelled = true;
      listeners.delete(setMinuteKey);
      syncInterval();
    };
  }, [enabled]);

  return minuteKey;
}
