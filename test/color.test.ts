import assert from 'node:assert/strict';
import test from 'node:test';

import { hsvToRgb, hsvToRgbw } from '../src/color.js';

test('converts black hsv to black rgbw', () => {
  assert.deepEqual(hsvToRgbw(0, 0, 0), { r: 0, g: 0, b: 0, w: 0 });
});

test('converts saturated red hsv to rgb', () => {
  assert.deepEqual(hsvToRgb(0, 100, 100), { r: 255, g: 0, b: 0 });
});

test('converts saturated red hsv to rgbw without white', () => {
  assert.deepEqual(hsvToRgbw(0, 100, 100), { r: 255, g: 0, b: 0, w: 0 });
});

test('converts white hsv to rgbw white channel', () => {
  assert.deepEqual(hsvToRgbw(0, 0, 100), { r: 0, g: 0, b: 0, w: 255 });
});
