import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { readThemeMode, writeThemeMode } from '@/lib/prefs';
import {
  getThemeColors,
  type ThemeColors,
  type ThemeMode,
  type ThemeScheme,
} from '@/theme/tokens';

export interface ThemeContextValue {
  mode: ThemeMode;
  scheme: ThemeScheme;
  isDark: boolean;
  colors: ThemeColors;
  themeLoaded: boolean;
  setMode: (nextMode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

type NamedStyles = Parameters<typeof StyleSheet.create>[0];

/**
 * Caches StyleSheet output per color scheme so themed styles are built at most
 * once for light and once for dark instead of on every render.
 */
export function createThemedStyles<T extends NamedStyles>(
  factory: (colors: ThemeColors, scheme: ThemeScheme) => T & NamedStyles
): (colors: ThemeColors, scheme: ThemeScheme) => Readonly<T> {
  const cache: Partial<Record<ThemeScheme, Readonly<T>>> = {};
  return (themeColors: ThemeColors, scheme: ThemeScheme): Readonly<T> => {
    const cached = cache[scheme];
    if (cached) {
      return cached;
    }
    const created = StyleSheet.create(factory(themeColors, scheme));
    cache[scheme] = created;
    return created;
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readThemeMode()
      .then((savedMode) => {
        if (!cancelled) {
          setModeState(savedMode);
          setThemeLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThemeLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void writeThemeMode(nextMode);
  }, []);

  const scheme: ThemeScheme =
    mode === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : mode;

  const colors = getThemeColors(scheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      scheme,
      isDark: scheme === 'dark',
      colors,
      themeLoaded,
      setMode,
    }),
    [mode, scheme, colors, themeLoaded, setMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return context;
}

export function useThemedStyles<T>(
  getStyles: (colors: ThemeColors, scheme: ThemeScheme) => T
): T {
  const { colors, scheme } = useTheme();
  return getStyles(colors, scheme);
}
