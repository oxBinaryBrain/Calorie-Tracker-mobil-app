import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

/**
 * Caloria palette — deliberately calm. No alarm red anywhere: going over
 * target is described neutrally, never warned about.
 *
 * Accent direction (v2): a calm steel-blue carries the primary accent — the
 * color most calorie trackers use for trust and clarity — while the original
 * sage green moves to the tertiary role (nature, progress, movement) so both
 * feel intentional instead of one-note.
 */
export const palette = {
  // Primary: calm steel blue
  blue50: '#EEF4F8',
  blue100: '#DCEAF3',
  blue200: '#BCD4E4',
  blue300: '#8FBEDC',
  blue400: '#5E93B5',
  blue500: '#3A6B8A',
  blue600: '#2F5772',
  blue700: '#25455B',
  blue800: '#1C3446',

  // Tertiary: the original sage green, now the supporting accent
  green50: '#F0F6F1',
  green100: '#DCEDE0',
  green200: '#BBDCC6',
  green300: '#93C6A5',
  green400: '#6DAF84',
  green500: '#4E9468',
  green600: '#3E7A55',
  green700: '#336245',

  // Macro colors — muted, distinguishable, not traffic-light coded
  carbs: '#7FA8C9', // soft blue
  protein: '#A98BC4', // soft violet
  fat: '#D9A662', // soft amber

  // Neutrals — cooled slightly to sit beside the blue accent
  gray100: '#F3F5F6',
  gray200: '#E2E7EA',
  gray300: '#C6CDD2',
  gray400: '#9AA5AB',
  gray500: '#6B777E',
  gray600: '#515C63',
  gray700: '#3E474D',
  gray800: '#2A3136',
  gray900: '#1B2023',

  // Dark-mode surfaces — blue-tinted charcoal
  darkSurface: '#181A1C',
  darkCard: '#212427',
  darkBorder: '#2E3236',
};

// Paper 5.15's MD3Colors type predates the surfaceContainer tokens even
// though the runtime honors them; the cast documents that gap.
type ContainerColors = { surfaceContainer: string; surfaceContainerHigh: string; surfaceContainerHighest: string };

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...( {
      surfaceContainer: '#FFFFFF',
      surfaceContainerHigh: '#FFFFFF',
      surfaceContainerHighest: '#FFFFFF',
    } as ContainerColors),
    primary: palette.blue500,
    onPrimary: '#FFFFFF',
    primaryContainer: palette.blue100,
    onPrimaryContainer: palette.blue800,
    secondary: palette.gray600,
    secondaryContainer: palette.gray100,
    onSecondaryContainer: palette.gray700,
    tertiary: palette.green600,
    onTertiary: '#FFFFFF',
    tertiaryContainer: palette.green100,
    onTertiaryContainer: palette.green700,
    background: '#F6F7F5',
    onBackground: palette.gray800,
    surface: '#FFFFFF',
    onSurface: palette.gray800,
    // Paper cards (elevation 0-1) read these; pinning them to the surface
    // value gives every screen the same flat white card on the gray canvas.
    surfaceVariant: palette.gray100,
    // gray600, not gray500: secondary text on light surfaces must clear 4.5:1
    // (gray500 measured 4.2–4.4:1 in the light-mode QA pass).
    onSurfaceVariant: palette.gray600,
    surfaceDisabled: palette.gray100,
    outline: palette.gray300,
    outlineVariant: palette.gray200,
    error: palette.gray600, // neutralized: errors are text, not alarms
    onError: '#FFFFFF',
    errorContainer: palette.gray100,
    onErrorContainer: palette.gray700,
    backdrop: 'rgba(27, 32, 35, 0.4)',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...( {
      surfaceContainer: palette.darkCard,
      surfaceContainerHigh: palette.darkCard,
      surfaceContainerHighest: palette.darkCard,
    } as ContainerColors),
    primary: palette.blue300,
    onPrimary: palette.blue800,
    primaryContainer: palette.blue700,
    onPrimaryContainer: palette.blue100,
    secondary: palette.gray300,
    secondaryContainer: palette.gray800,
    onSecondaryContainer: palette.gray200,
    tertiary: palette.green300,
    onTertiary: palette.gray900,
    tertiaryContainer: palette.green700,
    onTertiaryContainer: palette.green100,
    background: palette.darkSurface,
    onBackground: palette.gray200,
    surface: palette.darkCard,
    onSurface: palette.gray100,
    surfaceVariant: '#24272A',
    onSurfaceVariant: palette.gray400,
    surfaceDisabled: '#1F2224',
    outline: palette.darkBorder,
    outlineVariant: '#2A2E32',
    error: palette.gray400,
    onError: palette.gray900,
    errorContainer: palette.gray800,
    onErrorContainer: palette.gray200,
    backdrop: 'rgba(0, 0, 0, 0.55)',
  },
};

/**
 * Poppins roles. Families are loaded in App.tsx (useFonts) and embedded at
 * build time on native via the expo-font config plugin; each family name
 * carries its own weight, so fontWeight stays normal to avoid synthesis.
 */
export const fontFamilies = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

/** MD3 type roles re-faced with Poppins. */
type FontRole = MD3Theme['fonts']['displayLarge'];
type DefaultRole = MD3Theme['fonts']['default'];

function withPoppins(base: MD3Theme['fonts']): MD3Theme['fonts'] {
  const face = (style: FontRole, family: string): FontRole => ({
    ...style,
    fontFamily: family,
    // Each family carries its own weight; a normal weight avoids synthesis.
    fontWeight: '400',
  });
  const faceDefault = (style: DefaultRole, family: string): DefaultRole => ({
    ...style,
    fontFamily: family,
    fontWeight: '400',
  });
  return {
    ...base,
    default: faceDefault(base.default, fontFamilies.regular),
    displayLarge: face(base.displayLarge, fontFamilies.semibold),
    displayMedium: face(base.displayMedium, fontFamilies.semibold),
    displaySmall: face(base.displaySmall, fontFamilies.semibold),
    headlineLarge: face(base.headlineLarge, fontFamilies.semibold),
    headlineMedium: face(base.headlineMedium, fontFamilies.semibold),
    headlineSmall: face(base.headlineSmall, fontFamilies.semibold),
    titleLarge: face(base.titleLarge, fontFamilies.semibold),
    titleMedium: face(base.titleMedium, fontFamilies.medium),
    titleSmall: face(base.titleSmall, fontFamilies.medium),
    bodyLarge: face(base.bodyLarge, fontFamilies.regular),
    bodyMedium: face(base.bodyMedium, fontFamilies.regular),
    bodySmall: face(base.bodySmall, fontFamilies.regular),
    labelLarge: face(base.labelLarge, fontFamilies.medium),
    labelMedium: face(base.labelMedium, fontFamilies.medium),
    labelSmall: face(base.labelSmall, fontFamilies.medium),
  };
}

lightTheme.fonts = withPoppins(MD3LightTheme.fonts);
darkTheme.fonts = withPoppins(MD3DarkTheme.fonts);

/** Semantic (non-MD3) tokens used across screens. */
export function semantic(theme: MD3Theme) {
  const dark = theme.dark;
  return {
    dark,
    ringTrack: dark ? '#2C2F32' : palette.gray200,
    ringProgress: dark ? palette.blue300 : palette.blue500,
    burnedAccent: dark ? palette.gray400 : palette.gray600,
    overTargetText: dark ? palette.gray400 : palette.gray600, // neutral, never red
    macroCarbs: palette.carbs,
    macroProtein: palette.protein,
    macroFat: palette.fat,
    chartGrid: dark ? palette.darkBorder : palette.gray200,
    mutedText: dark ? palette.gray400 : palette.gray600,
    calorieTint: dark ? '#232E36' : palette.blue50,
    proteinTint: dark ? 'rgba(169, 139, 196, 0.18)' : '#EADFF2',
    carbsTint: dark ? 'rgba(127, 168, 201, 0.18)' : '#DCE9F5',
    fatTint: dark ? 'rgba(217, 166, 98, 0.20)' : '#F5E2BE',
    waterTint: dark ? 'rgba(94, 147, 181, 0.22)' : '#E7F2F9',
    mealTint: dark ? 'rgba(217, 166, 98, 0.20)' : '#FAF0DC',
    workoutTint: dark ? 'rgba(147, 198, 165, 0.18)' : palette.green100,
    // Body trackers. Weight stays neutral on purpose: it is a measurement,
    // not a goal to push. Sleep borrows the tertiary green but as a tint,
    // never as the solid tertiaryContainer fill it used to render as.
    weightTint: dark ? 'rgba(154, 165, 171, 0.16)' : '#EDEFF1',
    sleepTint: dark ? 'rgba(147, 198, 165, 0.18)' : palette.green100,
  };
}

export type SemanticColors = ReturnType<typeof semantic>;
