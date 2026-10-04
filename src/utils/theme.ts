export type ThemeColors = {
  base: string;
  accent: string;
};

export type ThemeMode = "dark" | "light";

export const DEFAULT_THEME_COLORS: ThemeColors = {
  base: "#0f766e",
  accent: "#22d3ee",
};

export const LIGHT_THEME_COLORS: ThemeColors = {
  base: "#047857",
  accent: "#0369a1",
};

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
  applyThemeColors(mode);
}

export function applyThemeColors(mode: ThemeMode = loadThemeMode()) {
  const { base, accent } = mode === "light" ? LIGHT_THEME_COLORS : DEFAULT_THEME_COLORS;
  const softOpacity = mode === "light" ? 0.14 : 0.34;
  const washOpacity = mode === "light" ? 0.07 : 0.18;
  const traceOpacity = mode === "light" ? 0.04 : 0.08;
  const root = document.documentElement;

  root.style.setProperty("--ui-base", base);
  root.style.setProperty("--ui-accent", accent);
  root.style.setProperty("--ui-cyan", accent);
  root.style.setProperty("--ui-emerald", base);
  root.style.setProperty("--ui-base-soft", hexToRgbCss(base, softOpacity));
  root.style.setProperty("--ui-base-wash", hexToRgbCss(base, washOpacity));
  root.style.setProperty("--ui-base-trace", hexToRgbCss(base, traceOpacity));
  root.style.setProperty("--ui-accent-soft", hexToRgbCss(accent, softOpacity));
  root.style.setProperty("--ui-accent-wash", hexToRgbCss(accent, washOpacity));
  root.style.setProperty("--ui-accent-trace", hexToRgbCss(accent, traceOpacity));
  root.style.setProperty("--ui-ring-strong", hexToRgbCss(accent, 0.56));
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
