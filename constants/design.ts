export const kasaColors = {
  brand: "#0B4D3E",
  brandStrong: "#07372C",
  brandSoft: "#E8F2EE",
  accent: "#E8B84B",
  background: "#F6F8F7",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F3",
  border: "#E2E9E6",
  text: "#12211C",
  textMuted: "#64736E",
  success: "#147D64",
  successSoft: "#E5F5EF",
  warning: "#9B6617",
  warningSoft: "#FFF5E3",
  danger: "#C0392B",
  dangerSoft: "#FCECE9",
  info: "#1D72AA",
  infoSoft: "#EAF4FB",
  white: "#FFFFFF",
  overlay: "rgba(7, 55, 44, 0.46)",
} as const;

export const kasaSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 28,
} as const;

export const kasaRadii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const kasaType = {
  screenTitle: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.8 },
  sectionTitle: { fontSize: 18, fontWeight: "800" as const, letterSpacing: -0.3 },
  cardTitle: { fontSize: 15, fontWeight: "700" as const },
  body: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: "700" as const },
} as const;

export const kasaLayout = {
  screenInset: 20,
  minimumTouchTarget: 44,
} as const;
