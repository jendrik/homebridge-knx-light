import colorsys from 'colorsys';

export interface RgbValue {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface RgbwValue extends RgbValue {
  readonly w: number;
}

function clampChannel(value: number): number {
  return Math.max(Math.min(Math.round(value), 255), 0);
}

export function hsvToRgb(hue: number, saturation: number, brightness: number): RgbValue {
  const rgb = colorsys.hsv2Rgb(hue, saturation, brightness);

  return {
    r: clampChannel(rgb.r),
    g: clampChannel(rgb.g),
    b: clampChannel(rgb.b),
  };
}

export function hsvToRgbw(hue: number, saturation: number, brightness: number): RgbwValue {
  const rgb = hsvToRgb(hue, saturation, brightness);

  const topChannel = Math.max(rgb.r, Math.max(rgb.g, rgb.b));
  if (topChannel === 0) {
    return { r: 0, g: 0, b: 0, w: 0 };
  }

  const multiplier = 255.0 / topChannel;
  const highRed = rgb.r * multiplier;
  const highGreen = rgb.g * multiplier;
  const highBlue = rgb.b * multiplier;

  const maxHigh = Math.max(highRed, Math.max(highGreen, highBlue));
  const minHigh = Math.min(highRed, Math.min(highGreen, highBlue));
  const whiteness = ((maxHigh + minHigh) / 2.0 - 127.5) * (255.0 / 127.5) / multiplier;

  return {
    r: clampChannel(rgb.r - whiteness),
    g: clampChannel(rgb.g - whiteness),
    b: clampChannel(rgb.b - whiteness),
    w: clampChannel(whiteness),
  };
}
