import { useWindowDimensions } from 'react-native';

export const COLORS = {
  navy: '#0F2747',
  navyLight: '#1B3A66',
  navyDeep: '#0A1B33',
  amber: '#F5B301',
  amberDark: '#B97E00',
  bg: '#F4F6FA',
  card: '#FFFFFF',
  surface: '#EBEFF6',
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#5B6475',
  placeholder: '#8A93A6',
  success: '#15803D',
  successBg: '#E6F6EC',
  danger: '#C62828',
  dangerBg: '#FDECEC',
  warn: '#B45309',
  warnBg: '#FFF3D6',
  infoBg: '#E8F0FD',
  border: '#E1E6EF',
  white: '#FFFFFF',
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const RADIUS = { sm: 10, md: 14, lg: 20, pill: 999 };

// Typography. Line-heights are deliberately generous (~1.45×) — Malayalam,
// Tamil and Hindi glyphs are taller than Latin ones and get clipped by tight
// line-heights. Body text never goes below 13px.
export const TYPE = {
  title: { fontSize: 24, lineHeight: 34, fontWeight: '800' },
  h2: { fontSize: 20, lineHeight: 29, fontWeight: '800' },
  h3: { fontSize: 17, lineHeight: 25, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontWeight: '700' },
  small: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
  smallStrong: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  label: { fontSize: 13, lineHeight: 19, fontWeight: '700', letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.4 },
};

export const SHADOW = {
  shadowColor: '#0F2747',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

// Layout that adapts to ANY screen: small phones, large phones, foldables
// and tablets. Content is capped at a comfortable reading width and centred.
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmall = width < 360;
  const contentMax = 760;
  const contentWidth = Math.min(width, contentMax);
  const gutter = isSmall ? 12 : 16;
  return { width, height, isTablet, isSmall, contentMax, contentWidth, gutter };
}
