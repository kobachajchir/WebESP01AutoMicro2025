export type ThemeColors = {
  base: string;
  accent: string;
};

export type ThemeMode = "dark" | "light";

export const DEFAULT_THEME_COLORS: ThemeColors = {
  base: "#0f766e",
  accent: "#22d3ee",
};

const LIGHT_DEFAULT_THEME_COLORS: ThemeColors = {
  base: "#047857",
  accent: "#0369a1",
};

const THEME_STORAGE_KEY = "app-theme-colors";
const THEME_MODE_STORAGE_KEY = "app-theme-mode";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value: string, fallback = DEFAULT_THEME_COLORS.base) {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_COLOR_RE.test(withHash) ? withHash.toLowerCase() : fallback;
}

export function isHexColor(value: string) {
  return HEX_COLOR_RE.test(value.trim());
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const safe = normalizeHexColor(hex);
  return [
    parseInt(safe.slice(1, 3), 16),
    parseInt(safe.slice(3, 5), 16),
    parseInt(safe.slice(5, 7), 16),
  ];
}

export function hexToRgbCss(hex: string, alpha = 1) {
  const [r, g, b] = hexToRgbTuple(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

export function loadThemeColors(): ThemeColors {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_COLORS;

    const parsed = JSON.parse(raw) as Partial<ThemeColors> & {
      primary?: string;
      secondary?: string;
    };
    return {
      base: normalizeHexColor(parsed.base ?? parsed.primary ?? "", DEFAULT_THEME_COLORS.base),
      accent: normalizeHexColor(parsed.accent ?? parsed.secondary ?? "", DEFAULT_THEME_COLORS.accent),
    };
  } catch {
    return DEFAULT_THEME_COLORS;
  }
}

export function saveThemeColors(colors: ThemeColors) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(colors));
}

export function loadThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return raw === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // LocalStorage puede fallar en navegadores con privacidad estricta.
  }
}

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  applyThemeColors(loadThemeColors(), mode);
}

export function applyThemeColors(colors: ThemeColors, modeOverride?: ThemeMode) {
  const mode = modeOverride ?? loadThemeMode();
  const requestedBase = normalizeHexColor(colors.base, DEFAULT_THEME_COLORS.base);
  const requestedAccent = normalizeHexColor(colors.accent, DEFAULT_THEME_COLORS.accent);
  const base =
    mode === "light" && requestedBase === DEFAULT_THEME_COLORS.base
      ? LIGHT_DEFAULT_THEME_COLORS.base
      : requestedBase;
  const accent =
    mode === "light" && requestedAccent === DEFAULT_THEME_COLORS.accent
      ? LIGHT_DEFAULT_THEME_COLORS.accent
      : requestedAccent;
  const root = document.documentElement;

  root.style.setProperty("--ui-base", base);
  root.style.setProperty("--ui-accent", accent);
  root.style.setProperty("--ui-cyan", accent);
  root.style.setProperty("--ui-emerald", base);
  root.style.setProperty("--ui-base-soft", hexToRgbCss(base, 0.34));
  root.style.setProperty("--ui-base-wash", hexToRgbCss(base, 0.18));
  root.style.setProperty("--ui-base-trace", hexToRgbCss(base, 0.08));
  root.style.setProperty("--ui-accent-soft", hexToRgbCss(accent, 0.34));
  root.style.setProperty("--ui-accent-wash", hexToRgbCss(accent, 0.18));
  root.style.setProperty("--ui-accent-trace", hexToRgbCss(accent, 0.08));
  root.style.setProperty("--ui-ring-strong", hexToRgbCss(accent, 0.34));
  root.style.setProperty("--ui-title-color", accent);
  root.style.setProperty("--ui-action-bg", base);
  root.style.setProperty("--ui-action-hover-bg", accent);
  root.style.setProperty("--ui-action-ink", getReadableInk(base));
  root.style.setProperty("--ui-action-hover-ink", getReadableInk(accent));
  root.style.setProperty("--ui-success-bg", base);
  root.style.setProperty("--ui-page-background", "var(--ui-bg-0)");
}

export function buildThemePayload(colors: ThemeColors) {
  const base = hexToRgbTuple(colors.base);
  const accent = hexToRgbTuple(colors.accent);
  return new Uint8Array([...base, ...accent]);
}

function getReadableInk(hex: string) {
  const [r, g, b] = hexToRgbTuple(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#041018" : "#f8fafc";
}
