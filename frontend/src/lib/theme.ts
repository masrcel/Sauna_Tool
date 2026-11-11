function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6 * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

// Generiert eine 9-Stufen-Palette aus einer Basisfarbe (= Shade 500)
function generateScale(hex: string): Record<string, string> {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Hellere Töne: interpoliere von l hoch zu 97
  // Dunklere Töne: interpoliere von l runter bis ~18
  const shades: [number, number, number][] = [
    [50,  clamp(97, 0, 97), s * 0.1],
    [100, clamp(93, 0, 97), s * 0.2],
    [200, clamp(86, 0, 97), s * 0.45],
    [300, clamp(76, 0, 97), s * 0.7],
    [400, clamp(l + 12, l, 97), s],
    [500, l, s],
    [600, clamp(l - 9,  10, l), s],
    [700, clamp(l - 18, 10, l), s],
    [800, clamp(l - 26, 10, l), s],
    [900, clamp(l - 33, 10, l), s],
  ];

  const scale: Record<string, string> = {};
  for (const [shade, lightness, saturation] of shades) {
    const [sr, sg, sb] = hslToRgb(h, clamp(saturation, 0, 100), clamp(lightness, 5, 97));
    scale[String(shade)] = `${sr} ${sg} ${sb}`;
  }
  return scale;
}

export function applyTheme(primaryColor: string) {
  const scale = generateScale(primaryColor);
  const root = document.documentElement;
  for (const [shade, value] of Object.entries(scale)) {
    root.style.setProperty(`--brand-${shade}`, value);
  }
}

export function applyThemeMode(mode: string) {
  const root = document.documentElement;
  if (mode === 'system') {
    root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  } else {
    root.classList.toggle('dark', mode !== 'light');
  }
}

export const DEFAULT_PRIMARY = '#d97d1d';
