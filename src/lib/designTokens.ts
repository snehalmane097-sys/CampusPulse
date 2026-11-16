// Shared by Tailwind and chart components; no application data lives here.
export const UI_COLORS = {
  canvas: "#F5F6FA", surface: "#FFFFFF", raised: "#EEF1F7", line: "#DDE2EE",
  text: "#20283E", muted: "#626F85", primary: "#4F46E5", primaryHover: "#4038BE",
  secondary: "#326A96", accent: "#A65332", success: "#20765B", pending: "#8C5614",
  progress: "#495FAD", danger: "#AD344C",
};
export const CHART_COLORS = [UI_COLORS.primary, UI_COLORS.secondary, UI_COLORS.accent, "#7D73AE", UI_COLORS.success, "#A16F85", UI_COLORS.muted];

export const THEME_COLORS = Object.fromEntries(Object.keys(UI_COLORS).map(key => [key, `rgb(var(--cp-${key}))`])) as Record<keyof typeof UI_COLORS, string>;
