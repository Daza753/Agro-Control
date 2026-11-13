function parseHexColor(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;

  const value = match[1];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function linearize(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (!foregroundRgb || !backgroundRgb) return 0;

  const luminance = ([red, green, blue]: [number, number, number]) => (
    0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
  );
  const first = luminance(foregroundRgb);
  const second = luminance(backgroundRgb);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function ensureReadableTextColor(
  foreground: string,
  background: string,
  minimumRatio = 4.5,
): string {
  if (contrastRatio(foreground, background) >= minimumRatio) return foreground;

  const dark = '#0f172a';
  const light = '#f8fafc';
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
}

export function getContrastingTextColor(background: string): string {
  const dark = '#0f172a';
  const light = '#ffffff';
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
}
