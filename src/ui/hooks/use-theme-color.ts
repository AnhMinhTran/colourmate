import { AppColors } from '../constants/theme';

const colorMap = {
  text: AppColors.text,
  background: AppColors.bg,
  tint: AppColors.interactive,
  icon: AppColors.muted,
  tabIconDefault: AppColors.muted,
  tabIconSelected: AppColors.interactive,
};

/**
 * Returns a themed color value from the AppColors palette.
 * @param props - Optional light/dark overrides (ignored; dark-only theme)
 * @param colorName - Semantic color key from the color map
 * @returns The resolved color string
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof colorMap
) {
  if (props.dark) return props.dark;
  return colorMap[colorName];
}
