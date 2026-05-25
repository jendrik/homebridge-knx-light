import assert from 'node:assert/strict';
import test from 'node:test';

import { detectLightMode, normalizePlatformConfig } from '../src/config.js';

test('normalizes platform defaults and valid switch device', () => {
  const normalized = normalizePlatformConfig({
    devices: [
      {
        name: 'Kitchen',
        set_status: '1/1/1',
        listen_status: '1/1/2',
      },
    ],
  });

  assert.equal(normalized.ip, '224.0.23.12');
  assert.equal(normalized.port, 3671);
  assert.equal(normalized.devices.length, 1);
  assert.equal(normalized.devices[0].name, 'Kitchen');
  assert.equal(normalized.devices[0].setStatus, '1/1/1');
  assert.equal(normalized.devices[0].listenStatus, '1/1/2');
  assert.equal(normalized.invalidDevices.length, 0);
});

test('accepts numeric string ports', () => {
  const normalized = normalizePlatformConfig({
    port: '3672',
    devices: [],
  });

  assert.equal(normalized.port, 3672);
});

test('defaults invalid ports and missing devices to no devices', () => {
  const normalized = normalizePlatformConfig({
    port: 'not-a-port',
    devices: 'not-an-array',
  });

  assert.equal(normalized.port, 3671);
  assert.equal(normalized.devices.length, 0);
  assert.equal(normalized.invalidDevices.length, 0);
});

test('rejects devices missing required switch addresses', () => {
  const normalized = normalizePlatformConfig({
    devices: [
      {
        name: 'Broken',
        set_status: '1/1/1',
      },
    ],
  });

  assert.equal(normalized.devices.length, 0);
  assert.equal(normalized.invalidDevices.length, 1);
  assert.match(normalized.invalidDevices[0].reason, /listen_status/);
});

test('detects switch, dimmer, rgb, and rgbw modes', () => {
  assert.deepEqual(detectLightMode({
    name: 'Switch',
    setStatus: '1/1/1',
    listenStatus: '1/1/2',
  }), { dimmer: false, rgb: false, rgbw: false });

  assert.deepEqual(detectLightMode({
    name: 'Dimmer',
    setStatus: '1/1/1',
    listenStatus: '1/1/2',
    setBrightness: '1/1/3',
  }), { dimmer: true, rgb: false, rgbw: false });

  assert.deepEqual(detectLightMode({
    name: 'RGB',
    setStatus: '1/1/1',
    listenStatus: '1/1/2',
    setBrightnessR: '1/1/3',
    setBrightnessG: '1/1/4',
    setBrightnessB: '1/1/5',
  }), { dimmer: false, rgb: true, rgbw: false });

  assert.deepEqual(detectLightMode({
    name: 'RGBW',
    setStatus: '1/1/1',
    listenStatus: '1/1/2',
    setBrightness: '1/1/6',
    setBrightnessR: '1/1/3',
    setBrightnessG: '1/1/4',
    setBrightnessB: '1/1/5',
  }), { dimmer: false, rgb: true, rgbw: true });
});
