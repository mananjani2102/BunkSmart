import { useSegments } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Snackbar,
  type SnackbarItem,
  type SnackbarTone,
} from '@/components/ui/Snackbar';
import { spacing } from '@/theme/tokens';

const DEFAULT_DURATION_MS = 4000;
const TAB_BAR_ROW_HEIGHT = 56;

export interface ShowSnackbarOptions {
  message: string;
  tone?: SnackbarTone;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs?: number;
}

export interface SnackbarActionsValue {
  showSnackbar: (options: ShowSnackbarOptions | string) => void;
  hideSnackbar: () => void;
}

const SnackbarActionsContext = createContext<SnackbarActionsValue | null>(null);

function SnackbarHost({
  item,
  onDismiss,
}: {
  item: SnackbarItem | null;
  onDismiss: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const isTabRoute = segments[0] === '(tabs)';
  const baseInset = Math.max(insets.bottom, spacing.sm);
  const bottomOffset = isTabRoute
    ? TAB_BAR_ROW_HEIGHT + baseInset + spacing.md
    : baseInset + spacing.md;

  return (
    <Snackbar item={item} bottomOffset={bottomOffset} onDismiss={onDismiss} />
  );
}

/**
 * Provides a stable global snackbar controller showing one snackbar at a time
 * for 4 seconds above the bottom tab bar.
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<SnackbarItem | null>(null);
  const nextIdRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const hideSnackbar = useCallback(() => {
    clearTimer();
    setItem(null);
  }, [clearTimer]);

  const dismissById = useCallback(
    (id: number) => {
      setItem((current) => {
        if (current && current.id === id) {
          clearTimer();
          return null;
        }
        return current;
      });
    },
    [clearTimer]
  );

  const showSnackbar = useCallback(
    (options: ShowSnackbarOptions | string) => {
      const normalized: ShowSnackbarOptions =
        typeof options === 'string' ? { message: options } : options;
      const duration = normalized.durationMs ?? DEFAULT_DURATION_MS;
      const id = nextIdRef.current;
      nextIdRef.current += 1;

      clearTimer();
      setItem({
        id,
        message: normalized.message,
        tone: normalized.tone ?? 'default',
        actionLabel: normalized.actionLabel,
        onAction: normalized.onAction,
      });

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setItem((current) => (current && current.id === id ? null : current));
      }, duration);
    },
    [clearTimer]
  );

  const actionsValue = useMemo<SnackbarActionsValue>(
    () => ({
      showSnackbar,
      hideSnackbar,
    }),
    [hideSnackbar, showSnackbar]
  );

  return (
    <SnackbarActionsContext.Provider value={actionsValue}>
      {children}
      <SnackbarHost item={item} onDismiss={dismissById} />
    </SnackbarActionsContext.Provider>
  );
}

/**
 * Returns stable snackbar actions whose identities never change.
 */
export function useSnackbarActions(): SnackbarActionsValue {
  const context = useContext(SnackbarActionsContext);
  if (!context) {
    throw new Error(
      'useSnackbarActions must be used within a SnackbarProvider.'
    );
  }
  return context;
}
