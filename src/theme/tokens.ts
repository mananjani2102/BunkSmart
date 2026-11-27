export type ThemeScheme = 'light' | 'dark';
export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  popover: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  border: string;
  input: string;
  ring: string;
  fieldBackground: string;
  fieldBorder: string;
  destructive: string;
  destructiveForeground: string;
  amber: string;
  blue: string;
  success: string;
  successBg: string;
  warningText: string;
  warningBg: string;
  destructiveText: string;
  destructiveBg: string;
  scrim: string;
  rippleNeutral: string;
  ripplePrimary: string;
}

export const lightColors: ThemeColors = {
  background: '#FCFCFC',
  foreground: '#000000',
  card: '#FFFFFF',
  popover: '#FCFCFC',
  primary: '#000000',
  primaryForeground: '#FFFFFF',
  secondary: '#EBEBEB',
  muted: '#F5F5F5',
  mutedForeground: '#525252',
  accent: '#EBEBEB',
  border: '#E4E4E4',
  input: '#EBEBEB',
  ring: '#000000',
  fieldBackground: '#FFFFFF',
  fieldBorder: '#A4A4A4',
  destructive: '#CC2830',
  destructiveForeground: '#FFFFFF',
  amber: '#FFAF03',
  blue: '#2558DF',
  success: '#127034',
  successBg: '#E6F4EA',
  warningText: '#8A4B00',
  warningBg: '#FFF4D6',
  destructiveText: '#B4232A',
  destructiveBg: '#FDECEC',
  scrim: '#00000073',
  rippleNeutral: '#00000014',
  ripplePrimary: '#FFFFFF2E',
};

export const darkColors: ThemeColors = {
  background: '#000000',
  foreground: '#FFFFFF',
  card: '#090909',
  popover: '#121212',
  primary: '#FFFFFF',
  primaryForeground: '#000000',
  secondary: '#222222',
  muted: '#1D1D1D',
  mutedForeground: '#A4A4A4',
  accent: '#313131',
  border: '#242424',
  input: '#313131',
  ring: '#A4A4A4',
  fieldBackground: '#0A0A0A',
  fieldBorder: '#525252',
  destructive: '#FF5B5B',
  destructiveForeground: '#000000',
  amber: '#FFAF03',
  blue: '#5B94FF',
  success: '#4ADE80',
  successBg: '#0F2A1A',
  warningText: '#FFAF03',
  warningBg: '#2A1F00',
  destructiveText: '#FF5B5B',
  destructiveBg: '#2A0E0E',
  scrim: '#000000A6',
  rippleNeutral: '#FFFFFF1A',
  ripplePrimary: '#00000024',
};

export function getThemeColors(scheme: ThemeScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

export const fontFamily = {
  regular: 'Geist-Regular',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
} as const;

export const motion = {
  pressIn: 90,
  pressOut: 160,
  transition: 180,
  contentFade: 150,
  snackbarOut: 150,
  tabIndicator: 220,
  tabItemFade: 150,
} as const;

export const radius = {
  card: 8,
  control: 8,
  small: 6,
  dot: 999,
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
  display: {
    fontFamily: fontFamily.semibold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
  heading: {
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
