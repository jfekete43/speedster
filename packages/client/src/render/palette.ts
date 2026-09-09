/**
 * Small color utilities shared by the art modules. Everything works in plain
 * hex strings so the draw functions stay free of any Phaser dependency (which
 * is what lets them be previewed/iterated on in a bare canvas harness).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Mix two colors; amount 0 = a, 1 = b. */
export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount,
  });
}

export const lighten = (hex: string, amount: number) => mix(hex, '#ffffff', amount);
export const darken = (hex: string, amount: number) => mix(hex, '#000000', amount);

/** Push a color toward a warm/cool shadow rather than flat black - reads far less muddy. */
export const shade = (hex: string, amount: number) => mix(hex, '#241b3a', amount);

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Per-player derived ramp so a character reads as one shaded material. */
export interface ColorRamp {
  base: string;
  light: string;
  highlight: string;
  dark: string;
  outline: string;
}

export function makeRamp(base: string): ColorRamp {
  return {
    base,
    light: lighten(base, 0.22),
    highlight: lighten(base, 0.45),
    dark: shade(base, 0.32),
    outline: shade(base, 0.62),
  };
}

/** Shared world palette - keeping these in one place is what makes the scene read as one piece. */
export const WORLD = {
  skyTop: '#2f66c9',
  skyMid: '#5b93e6',
  skyLow: '#9dc4f2',
  skyHaze: '#dceafc',
  sun: '#fff3c4',
  mountainFar: '#9db7e4',
  mountainNear: '#7791c9',
  hillFar: '#4a7f74',
  hillNear: '#2f6459',
  bush: '#1f4a45',
  grass: '#3f9e6a',
  grassDark: '#2d7350',
  dirt: '#6b4a35',
  dirtDark: '#4a3324',
  track: '#3a3550',
  trackLine: '#f2c14e',
  ink: '#191430',
} as const;
