export const colors = {
  bg: '#F5F4F0',
  surface: '#FFFFFF',
  surfaceMuted: '#ECEBE6',
  border: '#DAD8D0',
  text: '#16181A',
  textMuted: '#5B6066',
  accent: '#0B6E66',
  accentSoft: '#E2F1EF',
  onAccent: '#FFFFFF',
  safe: '#1B7A3E',
  safeBg: '#E4F3E8',
  warn: '#8A5200',
  warnBg: '#FBEFD6',
  danger: '#B42318',
  dangerBg: '#FCE7E4',
} as const;

export const radius = {
  card: 14,
  control: 10,
  small: 8,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600' as const,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
} as const;
